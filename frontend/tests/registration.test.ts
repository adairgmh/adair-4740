import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { registerUser, validateRegistration, USER_KEY } from '../src/services/registration.ts';

const values = new Map<string, string>();
const valid = {
  fullName: '  Adair Ejemplo  ',
  email: ' ADAIR@example.com ',
  password: 'Caracoles-demo-2026',
  confirmation: 'Caracoles-demo-2026',
};

beforeEach(() => {
  values.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

test('rechaza campos inválidos sin guardar una cuenta', async () => {
  for (const change of [
    { fullName: '   ' }, { email: 'sin-correo' }, { password: 'corta' },
    { confirmation: 'otra contraseña' },
  ]) {
    const data = { ...valid, ...change };
    assert.ok(validateRegistration(data));
    await assert.rejects(registerUser(data));
    assert.equal(values.size, 0);
  }
});

test('guarda el perfil normalizado con saldo cero y sin la contraseña original', async () => {
  const user = await registerUser(valid);
  assert.equal(user.fullName, 'Adair Ejemplo');
  assert.equal(user.email, 'adair@example.com');
  assert.equal(user.balance, 0);
  assert.match(user.credentials.hash, /^[a-f0-9]{64}$/);
  assert.match(user.credentials.salt, /^[a-f0-9]{32}$/);
  const stored = values.get(USER_KEY)!;
  assert.equal(stored.includes(valid.password), false);
  assert.deepEqual(JSON.parse(stored), user);
});

test('no reemplaza una cuenta existente', async () => {
  values.set(USER_KEY, 'cuenta existente');
  await assert.rejects(registerUser(valid), /Ya existe/);
  assert.equal(values.get(USER_KEY), 'cuenta existente');
});

test('informa cuando el navegador bloquea el almacenamiento', async () => {
  globalThis.localStorage.getItem = () => { throw new DOMException('Bloqueado', 'SecurityError'); };
  await assert.rejects(registerUser(valid), /No se pudo crear la cuenta/);
  assert.equal(values.size, 0);
});

test('un fallo al guardar no se devuelve como registro exitoso', async () => {
  globalThis.localStorage.setItem = () => { throw new DOMException('Sin espacio', 'QuotaExceededError'); };
  await assert.rejects(registerUser(valid), /No se pudo crear la cuenta/);
  assert.equal(values.size, 0);
});
