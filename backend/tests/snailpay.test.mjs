import test from 'node:test';
import assert from 'node:assert/strict';
import { processPayment, paymentFailure, TIMEOUT_DELAY_MS } from '../dist/services/snailpay.js';

const valid = {
  card_number: '1234123412341234', expiration_date: '12/26', cvv: '543',
  cardholder_name: 'Adair Ejemplo', transaction_amount: 100,
  payer_id: 'usuario-demo', payer_email: 'adair@example.com',
};

test('la tarjeta de aprobación devuelve monto, pagador, datos ficticios y autorización', () => {
  const result = processPayment(valid);
  assert.equal(result.httpStatus, 201);
  assert.equal(result.body.status, 'approved');
  assert.equal(result.body.status_detail, 'accredited');
  assert.equal(result.body.transaction_amount, 100);
  assert.equal(result.body.payer_id, valid.payer_id);
  assert.equal(result.body.payer_email, valid.payer_email);
  assert.equal(result.body.card_number, valid.card_number);
  assert.equal(result.body.cvv, valid.cvv);
  assert.match(result.body.authorization_code, /^SIM-/);
  assert.equal(result.body.reference, `SNAIL-${result.body.id}`);
  assert.ok(Number.isFinite(Date.parse(result.body.date_created)));
});

test('tarjeta rechazada devuelve 422 sin autorización', () => {
  const result = processPayment({ ...valid, card_number: '1111222233334444' });
  assert.equal(result.httpStatus, 422);
  assert.equal(result.body.status, 'rejected');
  assert.equal(result.body.status_detail, 'card_declined');
  assert.equal(result.body.authorization_code, null);
});

test('acepta titulares no vacíos de más de cien caracteres', () => {
  for (const cardholder_name of ['A', 'A'.repeat(101), 'A'.repeat(1000)]) {
    const result = processPayment({ ...valid, cardholder_name });
    assert.equal(result.httpStatus, 201);
    assert.equal(result.body.status, 'approved');
  }
  for (const cardholder_name of ['', '   ', null]) {
    assert.equal(processPayment({ ...valid, cardholder_name }).body.status_detail, 'invalid_cardholder');
  }
});

test('el error interno impide aprobar ambas tarjetas ficticias', () => {
  for (const card_number of ['1234123412341234', '1111222233334444']) {
    const result = processPayment({ ...valid, card_number, simulation: 'system_error' });
    assert.equal(result.httpStatus, 503);
    assert.equal(result.body.status, 'error');
    assert.equal(result.body.authorization_code, null);
  }
});

test('la demora siempre termina en error, nunca en una aprobación tardía', () => {
  const result = processPayment({ ...valid, simulation: 'timeout' });
  assert.equal(result.httpStatus, 504);
  assert.equal(result.delayMs, TIMEOUT_DELAY_MS);
  assert.equal(result.body.status, 'error');
  assert.equal(result.body.authorization_code, null);
});

test('rechaza montos inválidos y acepta cantidades exactas de centavos', () => {
  for (const transaction_amount of [0, -1, 0.001, 1.000000001, '100', null, NaN, Infinity, Number.MAX_VALUE]) {
    const result = processPayment({ ...valid, transaction_amount });
    assert.equal(result.body.status_detail, 'invalid_amount');
    assert.equal(result.body.authorization_code, null);
  }
  for (const transaction_amount of [0.01, 0.29, 99.99, 10000.5]) {
    const result = processPayment({ ...valid, transaction_amount });
    assert.equal(result.body.status, 'approved');
    assert.equal(result.body.transaction_amount, transaction_amount);
  }
});

test('rechaza los campos incompletos y escenarios desconocidos', () => {
  for (const change of [
    { payer_id: '' }, { payer_email: 'invalido' }, { cardholder_name: '   ' },
    { expiration_date: '01/30' }, { cvv: '123' }, { simulation: 'otra' },
    { simulation: ['normal'] },
  ]) {
    const result = processPayment({ ...valid, ...change });
    assert.equal(result.httpStatus, 400);
    assert.equal(result.body.status, 'rejected');
    assert.equal(result.body.authorization_code, null);
  }
  for (const value of [undefined, null, [], 'texto']) {
    assert.equal(processPayment(value).httpStatus, 400);
  }
});

test('no devuelve números de tarjeta fuera de los ficticios documentados', () => {
  const result = processPayment({ ...valid, card_number: '9999999999999999' });
  assert.equal(result.body.status_detail, 'test_card_required');
  assert.equal(result.body.card_number, null);
  assert.equal(result.body.cvv, null);
});

test('todas las respuestas mantienen los campos del contrato y un ID propio', () => {
  const outcomes = [processPayment(valid), processPayment({ ...valid, card_number: '1111222233334444' }),
    processPayment({ ...valid, simulation: 'system_error' }), processPayment({ ...valid, simulation: 'timeout' }),
    processPayment({}), paymentFailure(undefined, 400, 'invalid_json', 'JSON inválido')];
  const fields = ['id', 'status', 'status_detail', 'message', 'transaction_amount', 'date_created',
    'authorization_code', 'reference', 'payer_id', 'payer_email', 'card_number', 'cvv'].sort();
  for (const result of outcomes) assert.deepEqual(Object.keys(result.body).sort(), fields);
  assert.equal(new Set(outcomes.map((result) => result.body.id)).size, outcomes.length);
});
