import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../../backend/dist/app.js';
import { submitTopUp } from '../src/services/payments.ts';
import { USER_KEY } from '../src/services/registration.ts';
import { SESSION_KEY } from '../src/services/auth.ts';

test('el cliente procesa los cuatro escenarios del servidor real sin tocar la cuenta de Chrome', async () => {
  const user = { id: 'integration-user', fullName: 'Usuario de prueba', email: 'test@example.com', balance: 0 };
  const values = new Map([
    [USER_KEY, JSON.stringify({ ...user, credentials: {
      algorithm: 'PBKDF2', iterations: 600_000, salt: 'a'.repeat(32), hash: 'b'.repeat(64),
    } })],
    [SESSION_KEY, JSON.stringify({ userId: user.id })],
  ]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  });
  let server;
  try {
    await new Promise((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve());
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const fetcher = (path, options) => fetch(`${origin}${path}`, options);
    for (const scenario of ['approved', 'declined', 'system_error', 'timeout']) {
      const result = await submitTopUp({ amount: 100, cardholderName: 'A'.repeat(101), scenario }, user, {
        fetcher, timeoutMs: scenario === 'timeout' ? 100 : 5_000,
      });
      assert.equal(result.user.balance, 100);
      assert.equal(result.record.response.status, scenario === 'approved' ? 'approved' : scenario === 'declined' ? 'rejected' : 'error');
      assert.equal(result.record.source, scenario === 'timeout' ? 'client' : 'snailpay');
    }
    const stored = JSON.parse(values.get(USER_KEY));
    assert.equal(stored.balance, 100);
    assert.equal(stored.payments.length, 4);
    assert.ok(stored.payments.every((payment) => payment.response.cvv === '543'));
  } finally {
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
});
