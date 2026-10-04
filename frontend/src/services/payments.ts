import { getAuthSnapshot, readStoredUser } from './auth.ts';
import type { UserProfile } from './auth.ts';
import { USER_KEY } from './registration.ts';
import type { PaymentRecord, PaymentRequest, PaymentResponse, TopUpInput } from '../types/payment.ts';

export const APPROVED_CARD = '1234123412341234';
export const DECLINED_CARD = '1111222233334444';
export const PAYMENT_TIMEOUT_MS = 5_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPaymentResponse(value: unknown): value is PaymentResponse {
  if (!isRecord(value)) return false;
  const requiredStrings = ['id', 'status_detail', 'message', 'date_created', 'reference'];
  return requiredStrings.every((key) => typeof value[key] === 'string' && value[key].length > 0) &&
    ['approved', 'rejected', 'error'].includes(String(value.status)) && typeof value.status === 'string' &&
    Number.isFinite(Date.parse(String(value.date_created))) &&
    (value.transaction_amount === null || (typeof value.transaction_amount === 'number' && Number.isFinite(value.transaction_amount))) &&
    ['authorization_code', 'payer_id', 'payer_email', 'card_number', 'cvv']
      .every((key) => value[key] === null || typeof value[key] === 'string');
}

function centsOf(amount: number): number {
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(cents) || Number(amount.toFixed(2)) !== amount) {
    throw new Error('El monto debe tener como máximo dos decimales y estar dentro del rango admitido.');
  }
  return cents;
}

function makeRequest(input: TopUpInput, user: UserProfile): PaymentRequest {
  if (centsOf(input.amount) <= 0) throw new Error('Introduce un monto mayor que cero.');
  if (!input.cardholderName.trim()) {
    throw new Error('Escribe un nombre de titular no vacío.');
  }
  if (!['approved', 'declined', 'system_error', 'timeout'].includes(input.scenario)) {
    throw new Error('Selecciona un escenario de prueba válido.');
  }
  return {
    card_number: input.scenario === 'declined' ? DECLINED_CARD : APPROVED_CARD,
    expiration_date: '12/26', cvv: '543', cardholder_name: input.cardholderName.trim(),
    transaction_amount: input.amount, payer_id: user.id, payer_email: user.email,
    simulation: input.scenario === 'system_error' || input.scenario === 'timeout' ? input.scenario : 'normal',
  };
}

function assertSession(request: PaymentRequest): void {
  const auth = getAuthSnapshot();
  if (auth.user?.id !== request.payer_id || auth.user.email !== request.payer_email) {
    throw new Error('La sesión cambió. Inicia sesión de nuevo antes de recargar.');
  }
}

// Una sola escritura guarda a la vez el saldo y la operación; nunca se guardan a medias.
async function saveResult(request: PaymentRequest, record: PaymentRecord, signal: AbortSignal): Promise<UserProfile> {
  function commit(): UserProfile {
    signal.throwIfAborted();
    assertSession(request);
    const user = readStoredUser();
    if (!user) throw new Error('No se encontró la cuenta.');
    const payments = user.payments ?? [];
    if (!Array.isArray(payments) || !payments.every((item) => isRecord(item) &&
      ['snailpay', 'client'].includes(String(item.source)) && isPaymentResponse(item.response))) {
      throw new Error('El historial guardado no es válido. No se modificó el saldo.');
    }
    const existing = payments.find((item) => item.response.id === record.response.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(record)) {
      throw new Error('La respuesta repite un identificador con datos diferentes. No se modificó el saldo.');
    }
    let balance = user.balance;
    if (!existing) {
      if (record.source === 'snailpay' && record.response.status === 'approved') {
        const totalCents = centsOf(user.balance) + centsOf(request.transaction_amount);
        if (!Number.isSafeInteger(totalCents)) throw new Error('El saldo resultante supera el rango admitido.');
        balance = totalCents / 100;
        if (centsOf(balance) !== totalCents) throw new Error('No se puede representar el saldo con precisión.');
      }
      try {
        localStorage.setItem(USER_KEY, JSON.stringify({ ...user, balance, payments: [...payments, record] }));
      } catch {
        throw new Error('No se pudo guardar la operación. Tu saldo no cambió. Revisa el espacio y los permisos del navegador.');
      }
    }
    return { id: user.id, fullName: user.fullName, email: user.email, balance };
  }

  // Chrome coordina las escrituras entre pestañas para no perder una recarga simultánea.
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('caracoles-payments', { signal }, commit);
  }
  return commit();
}

function clientFailure(request: PaymentRequest, detail: string, message: string): PaymentRecord {
  const id = crypto.randomUUID();
  return {
    source: 'client',
    response: {
      id, status: 'error', status_detail: detail, message,
      transaction_amount: request.transaction_amount, date_created: new Date().toISOString(),
      authorization_code: null, reference: `CLIENT-${id}`, payer_id: request.payer_id,
      payer_email: request.payer_email, card_number: request.card_number, cvv: request.cvv,
    },
  };
}

interface PaymentOptions {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

export async function submitTopUp(input: TopUpInput, user: UserProfile, options: PaymentOptions = {}) {
  const request = makeRequest(input, user);
  assertSession(request);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) throw new Error('Operación cancelada. No se modificó el saldo.');
  options.signal?.addEventListener('abort', cancel, { once: true });
  const timeoutMs = options.timeoutMs ?? PAYMENT_TIMEOUT_MS;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  let record: PaymentRecord;

  try {
    const response = await (options.fetcher ?? fetch)('/api/payments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request), signal: controller.signal,
    });
    const body: unknown = await response.json();
    controller.signal.throwIfAborted();
    if (!isPaymentResponse(body) || body.payer_id !== request.payer_id || body.payer_email !== request.payer_email ||
        body.transaction_amount !== request.transaction_amount || body.card_number !== request.card_number || body.cvv !== request.cvv ||
        (body.status === 'approved' && (response.status !== 201 || body.status_detail !== 'accredited' ||
          !body.authorization_code || request.simulation !== 'normal' || request.card_number !== APPROVED_CARD)) ||
        (body.status !== 'approved' && (response.ok || body.authorization_code !== null))) {
      throw new Error('invalid_response');
    }
    record = { source: 'snailpay', response: body };
  } catch (error) {
    if (options.signal?.aborted) throw new Error('Operación cancelada. No se modificó el saldo.');
    record = timedOut
      ? clientFailure(request, 'client_timeout', 'SnailPay tardó demasiado. No se modificó tu saldo. Puedes volver a intentarlo.')
      : error instanceof TypeError
        ? clientFailure(request, 'network_error', 'No se pudo conectar con SnailPay. Comprueba que el backend esté encendido. Tu saldo no cambió.')
        : clientFailure(request, 'invalid_response', 'No se recibió una respuesta válida de SnailPay. Tu saldo no cambió.');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }

  // El timeout ya terminó; una cancelación de la pantalla aún debe impedir el guardado.
  const saveSignal = options.signal ?? new AbortController().signal;
  const updatedUser = await saveResult(request, record, saveSignal);
  return { user: updatedUser, record };
}
