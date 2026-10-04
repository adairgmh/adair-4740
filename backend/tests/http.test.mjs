import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import app from '../dist/app.js';

let server;
let baseUrl;
const valid = {
  card_number: '1234123412341234', expiration_date: '12/26', cvv: '543',
  cardholder_name: 'Adair Ejemplo', transaction_amount: 100,
  payer_id: 'usuario-demo', payer_email: 'adair@example.com',
};

before(async () => {
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve());
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

function post(body, options = {}) {
  return fetch(`${baseUrl}/api/payments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), ...options,
  });
}

test('la ruta HTTP entrega aprobación, rechazo y error interno con su código correcto', async () => {
  for (const [change, code, status] of [[{}, 201, 'approved'],
    [{ cardholder_name: 'A'.repeat(101) }, 201, 'approved'],
    [{ card_number: '1111222233334444' }, 422, 'rejected'],
    [{ simulation: 'system_error' }, 503, 'error']]) {
    const response = await post({ ...valid, ...change });
    assert.equal(response.status, code);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).status, status);
  }
});

test('JSON malformado conserva el contrato de error en lugar de devolver HTML', async () => {
  const response = await post(null, { body: '{' });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.status_detail, 'invalid_json');
  assert.equal(body.authorization_code, null);
  assert.ok('card_number' in body && 'cvv' in body && 'payer_id' in body);
});

test('rechaza contenido no JSON y cuerpos demasiado grandes', async () => {
  const wrongType = await post(valid, { headers: { 'Content-Type': 'text/plain' } });
  assert.equal(wrongType.status, 415);
  assert.equal((await wrongType.json()).status_detail, 'json_required');
  const tooLarge = await post({ value: 'a'.repeat(20_000) });
  assert.equal(tooLarge.status, 413);
  assert.equal((await tooLarge.json()).status_detail, 'request_too_large');
});

test('el cliente puede cancelar una respuesta tardía y la API sigue funcionando', async () => {
  await assert.rejects(post({ ...valid, simulation: 'timeout' }, {
    signal: AbortSignal.timeout(100),
  }), (error) => error.name === 'TimeoutError');
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');
});
