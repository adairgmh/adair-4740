import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { submitTopUp } from '../src/services/payments.ts';
import { getAuthSnapshot, SESSION_KEY } from '../src/services/auth.ts';
import { USER_KEY } from '../src/services/registration.ts';

const user = { id: 'usuario-demo', fullName: 'Adair Ejemplo', email: 'adair@example.com', balance: 0 };
const input = { amount: 100, cardholderName: user.fullName, scenario: 'approved' as const };
const values = new Map<string, string>();

beforeEach(() => {
  values.clear();
  values.set(USER_KEY, JSON.stringify({ ...user, credentials: {
    algorithm: 'PBKDF2', iterations: 600_000, salt: 'a'.repeat(32), hash: 'b'.repeat(64),
  } }));
  values.set(SESSION_KEY, JSON.stringify({ userId: user.id }));
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
});

function approved(overrides = {}) {
  const id = crypto.randomUUID();
  return {
    id, reference: `SNAIL-${id}`, status: 'approved', status_detail: 'accredited', message: 'Aprobada',
    transaction_amount: 100, date_created: new Date().toISOString(), authorization_code: 'SIM-demo',
    payer_id: user.id, payer_email: user.email, card_number: '1234123412341234', cvv: '543', ...overrides,
  };
}

const stored = () => JSON.parse(values.get(USER_KEY)!);
const respond = (body: unknown, status = 201) => async () => Response.json(body, { status });

test('envía un titular de más de cien caracteres y rechaza uno vacío', async () => {
  const cardholderName = 'A'.repeat(101);
  const result = await submitTopUp({ ...input, cardholderName }, user, { fetcher: async (_url, options) => {
    assert.equal(JSON.parse(String(options?.body)).cardholder_name, cardholderName);
    return Response.json(approved(), { status: 201 });
  } });
  assert.equal(result.user.balance, 100);
  await assert.rejects(submitTopUp({ ...input, cardholderName: '   ' }, user, {
    fetcher: async () => { assert.fail('No debe enviar un titular vacío'); },
  }), /titular no vacío/);
});

test('envía datos ficticios y del usuario; guarda respuesta, CVV y saldo juntos', async () => {
  const body = approved();
  const result = await submitTopUp(input, user, { fetcher: async (url, options) => {
    assert.equal(url, '/api/payments');
    assert.equal(options?.method, 'POST');
    const sent = JSON.parse(String(options?.body));
    assert.equal(sent.payer_id, user.id);
    assert.equal(sent.payer_email, user.email);
    assert.equal(sent.expiration_date, '12/26');
    assert.equal(sent.card_number, body.card_number);
    assert.equal(sent.cvv, '543');
    return Response.json(body, { status: 201 });
  } });
  assert.equal(result.user.balance, 100);
  assert.equal(getAuthSnapshot().user?.balance, 100);
  assert.deepEqual(stored().payments[0], { source: 'snailpay', response: body });
  assert.ok(stored().credentials);
});

test('una respuesta repetida no suma dos veces la misma recarga', async () => {
  const fetcher = respond(approved());
  await submitTopUp(input, user, { fetcher });
  await submitTopUp(input, user, { fetcher });
  assert.equal(stored().balance, 100);
  assert.equal(stored().payments.length, 1);
});

test('dos recargas usan el saldo actual y calculan los importes en centavos', async () => {
  await submitTopUp({ ...input, amount: 0.1 }, user, { fetcher: respond(approved({ transaction_amount: 0.1 })) });
  await submitTopUp({ ...input, amount: 0.2 }, user, { fetcher: respond(approved({ transaction_amount: 0.2 })) });
  assert.equal(stored().balance, 0.3);
  assert.equal(stored().payments.length, 2);
});

test('rechazo y error del sistema se guardan sin alterar el saldo', async () => {
  for (const scenario of ['declined', 'system_error'] as const) {
    const body = approved({
      status: scenario === 'declined' ? 'rejected' : 'error',
      status_detail: scenario === 'declined' ? 'card_declined' : 'service_unavailable',
      authorization_code: null,
      card_number: scenario === 'declined' ? '1111222233334444' : '1234123412341234',
    });
    const result = await submitTopUp({ ...input, scenario }, user, { fetcher: respond(body, scenario === 'declined' ? 422 : 503) });
    assert.equal(result.record.source, 'snailpay');
    assert.equal(result.user.balance, 0);
    assert.equal(stored().balance, 0);
  }
  assert.equal(stored().payments.length, 2);
});

test('no aplica respuestas con monto, pagador, tarjeta, autorización o HTTP incorrectos', async () => {
  for (const change of [{ transaction_amount: 999 }, { payer_id: 'otro' }, { payer_email: 'otro@example.com' },
    { card_number: '9999999999999999' }, { cvv: '000' }, { authorization_code: null }, { status: 'unknown' }]) {
    const result = await submitTopUp(input, user, { fetcher: respond(approved(change)) });
    assert.equal(result.record.response.status_detail, 'invalid_response');
    assert.equal(result.user.balance, 0);
  }
  const result = await submitTopUp(input, user, { fetcher: respond(approved(), 500) });
  assert.equal(result.record.response.status_detail, 'invalid_response');
  assert.equal(stored().balance, 0);
});

test('ni una falsa aprobación de un escenario de error aumenta el saldo', async () => {
  const result = await submitTopUp({ ...input, scenario: 'system_error' }, user, { fetcher: respond(approved()) });
  assert.equal(result.user.balance, 0);
  assert.equal(result.record.source, 'client');
});

test('la ausencia del backend y una respuesta no JSON son errores comprensibles', async () => {
  const network = await submitTopUp(input, user, { fetcher: async () => { throw new TypeError('Failed to fetch'); } });
  assert.equal(network.record.response.status_detail, 'network_error');
  const invalid = await submitTopUp(input, user, { fetcher: async () => new Response('<html>Error</html>', { status: 500 }) });
  assert.equal(invalid.record.response.status_detail, 'invalid_response');
  assert.equal(stored().balance, 0);
});

test('el timeout no permite aplicar una respuesta aprobada tardía', async () => {
  const result = await submitTopUp(input, user, {
    timeoutMs: 5,
    fetcher: async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return Response.json(approved(), { status: 201 });
    },
  });
  assert.equal(result.record.response.status_detail, 'client_timeout');
  assert.equal(result.record.source, 'client');
  assert.equal(stored().balance, 0);
  assert.equal(stored().payments[0].response.cvv, '543');
});

test('cancelar la pantalla impide guardar una respuesta tardía', async () => {
  const controller = new AbortController();
  const original = values.get(USER_KEY);
  await assert.rejects(submitTopUp(input, user, {
    signal: controller.signal,
    fetcher: async () => { controller.abort(); return Response.json(approved(), { status: 201 }); },
  }), /cancelada/);
  assert.equal(values.get(USER_KEY), original);
});

test('cerrar sesión durante la solicitud impide aplicar la recarga', async () => {
  const original = values.get(USER_KEY);
  await assert.rejects(submitTopUp(input, user, {
    fetcher: async () => { values.delete(SESSION_KEY); return Response.json(approved(), { status: 201 }); },
  }), /sesión cambió/);
  assert.equal(values.get(USER_KEY), original);
});

test('un fallo de almacenamiento conserva tanto el saldo como el historial anteriores', async () => {
  const original = values.get(USER_KEY);
  globalThis.localStorage.setItem = () => { throw new DOMException('Sin espacio', 'QuotaExceededError'); };
  await assert.rejects(submitTopUp(input, user, { fetcher: respond(approved()) }), /No se pudo guardar/);
  assert.equal(values.get(USER_KEY), original);
});

test('montos inválidos o ausencia de sesión impiden enviar solicitudes', async () => {
  const fetcher = async () => { assert.fail('No debe llamar a la API'); };
  for (const amount of [0, -1, 0.001, 1.000000001, NaN, Infinity]) {
    await assert.rejects(submitTopUp({ ...input, amount }, user, { fetcher }));
  }
  values.delete(SESSION_KEY);
  await assert.rejects(submitTopUp(input, user, { fetcher }), /sesión cambió/);
  assert.equal(stored().balance, 0);
});

test('una respuesta duplicada con datos distintos no altera el historial', async () => {
  const body = approved();
  await submitTopUp(input, user, { fetcher: respond(body) });
  const original = values.get(USER_KEY);
  await assert.rejects(submitTopUp(input, user, { fetcher: respond({ ...body, authorization_code: 'SIM-otro' }) }), /identificador/);
  assert.equal(values.get(USER_KEY), original);
});
