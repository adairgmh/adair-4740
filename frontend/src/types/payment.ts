export type PaymentScenario = 'approved' | 'declined' | 'system_error' | 'timeout';

export interface TopUpInput {
  cardholderName: string;
  amount: number;
  scenario: PaymentScenario;
}

export interface PaymentRequest {
  card_number: string;
  expiration_date: string;
  cvv: string;
  cardholder_name: string;
  transaction_amount: number;
  payer_id: string;
  payer_email: string;
  simulation: 'normal' | 'system_error' | 'timeout';
}

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

export interface PaymentRecord {
  source: 'snailpay' | 'client';
  response: PaymentResponse;
}
