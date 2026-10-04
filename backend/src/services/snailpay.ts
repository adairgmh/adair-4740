import { randomUUID } from 'node:crypto';

export const APPROVED_CARD = '1234123412341234';
export const DECLINED_CARD = '1111222233334444';
export const TIMEOUT_DELAY_MS = 8_000;

export interface PaymentResponse {
  id: string;
  status: 'approved' | 'rejected' | 'error';
  status_detail: string;
  message: string;
  transaction_amount: number | null;
  date_created: string;
  authorization_code: string | null;
  reference: string;
  payer_id: string | null;
  payer_email: string | null;
  card_number: string | null;
  cvv: string | null;
}

export interface PaymentResult {
  httpStatus: number;
  delayMs: number;
  body: PaymentResponse;
}

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function text(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength
    ? value.trim() : null;
}

function validAmount(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return false;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) && cents > 0 && Number(value.toFixed(2)) === value;
}

function responseBase(input: unknown): PaymentResponse {
  const data = recordOf(input);
  const id = randomUUID();
  const fictitiousCard = data.card_number === APPROVED_CARD || data.card_number === DECLINED_CARD;
  return {
    id,
    status: 'rejected',
    status_detail: 'invalid_request',
    message: 'Revisa los datos de la recarga.',
    transaction_amount: typeof data.transaction_amount === 'number' && Number.isFinite(data.transaction_amount)
      ? data.transaction_amount : null,
    date_created: new Date().toISOString(),
    authorization_code: null,
    reference: `SNAIL-${id}`,
    payer_id: text(data.payer_id, 100),
    payer_email: text(data.payer_email, 254),
    // Solo devolvemos datos de las tarjetas ficticias documentadas.
    card_number: fictitiousCard ? String(data.card_number) : null,
    cvv: fictitiousCard && typeof data.cvv === 'string' && /^\d{3}$/.test(data.cvv) ? data.cvv : null,
  };
}

export function paymentFailure(
  input: unknown, httpStatus: number, detail: string, message: string,
): PaymentResult {
  return {
    httpStatus,
    delayMs: 0,
    body: { ...responseBase(input), status: httpStatus >= 500 ? 'error' : 'rejected', status_detail: detail, message },
  };
}

export function processPayment(input: unknown): PaymentResult {
  const data = recordOf(input);
  const invalid = (detail: string, message: string) => paymentFailure(input, 400, detail, message);

  if (!text(data.payer_id, 100) || !text(data.payer_email, 254) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.payer_email).trim())) {
    return invalid('invalid_payer', 'Indica el identificador y un correo válido del usuario.');
  }
  if (!validAmount(data.transaction_amount)) {
    return invalid('invalid_amount', 'El monto debe ser mayor que cero y tener como máximo dos decimales dentro del rango admitido.');
  }
  if (typeof data.cardholder_name !== 'string' || !data.cardholder_name.trim()) {
    return invalid('invalid_cardholder', 'Indica un nombre de titular no vacío.');
  }
  if (data.card_number !== APPROVED_CARD && data.card_number !== DECLINED_CARD) {
    return invalid('test_card_required', 'Utiliza una de las tarjetas ficticias de SnailPay.');
  }
  // La fecha es una clave fija de simulación, independiente de la fecha actual.
  if (data.expiration_date !== '12/26' || data.cvv !== '543') {
    return invalid('invalid_card_data', 'Usa la fecha ficticia 12/26 y el CVV ficticio 543.');
  }
  if (data.simulation !== undefined && (typeof data.simulation !== 'string' ||
      !['normal', 'system_error', 'timeout'].includes(data.simulation))) {
    return invalid('invalid_simulation', 'La simulación debe ser normal, system_error o timeout.');
  }
  if (data.simulation === 'system_error') {
    return paymentFailure(input, 503, 'service_unavailable', 'SnailPay no está disponible. No se aprobó ninguna recarga.');
  }
  if (data.simulation === 'timeout') {
    return {
      ...paymentFailure(input, 504, 'simulated_timeout', 'SnailPay tardó demasiado. No se aprobó ninguna recarga.'),
      delayMs: TIMEOUT_DELAY_MS,
    };
  }
  if (data.card_number === DECLINED_CARD) {
    return paymentFailure(input, 422, 'card_declined', 'La tarjeta ficticia fue rechazada. Prueba con la tarjeta de aprobación.');
  }
  return {
    httpStatus: 201,
    delayMs: 0,
    body: {
      ...responseBase(input),
      status: 'approved',
      status_detail: 'accredited',
      message: 'Recarga simulada aprobada.',
      transaction_amount: Math.round(data.transaction_amount * 100) / 100,
      authorization_code: `SIM-${randomUUID()}`,
    },
  };
}
