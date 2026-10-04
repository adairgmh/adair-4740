import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { getAuthSnapshot, loginUser, logoutUser, SESSION_KEY } from '../src/services/auth.ts';
import { USER_KEY } from '../src/services/registration.ts';

const password = 'Caracoles-demo-2026';
const salt = '0123456789abcdef0123456789abcdef';
// El formato coincide con las cuentas creadas antes de añadir el login.
const account = {
  id: 'test-user', fullName: 'Adair Ejemplo', email: 'adair@example.com', balance: 125.5,
  credentials: {
    algorithm: 'PBKDF2', iterations: 600_000, salt,
    hash: pbkdf2Sync(password, Buffer.from(salt, 'hex'), 600_000, 32, 'sha256').toString('hex'),
  },
};
const values = new Map<string, string>();

beforeEach(() => {
  values.clear();
  values.set(USER_KEY, JSON.stringify(account));
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
});

test('una cuenta guardada sin sesión no concede acceso', () => {
  assert.deepEqual(getAuthSnapshot(), { user: null, hasAccount: true, error: '' });
});

test('permite entrar con una cuenta anterior y recuperar la sesión sin cambiar el saldo', async () => {
  const user = await loginUser(' ADAIR@example.com ', password);
  assert.equal(user.balance, 125.5);
  assert.equal('credentials' in user, false);
  assert.deepEqual(getAuthSnapshot().user, user);
  assert.deepEqual(JSON.parse(values.get(SESSION_KEY)!), { userId: account.id });
});

test('contraseña o correo incorrectos no crean una sesión ni modifican la cuenta', async () => {
  const original = values.get(USER_KEY);
  await assert.rejects(loginUser(account.email, 'contraseña incorrecta'), /incorrectos/);
  await assert.rejects(loginUser('otra@example.com', password), /incorrectos/);
  assert.equal(values.has(SESSION_KEY), false);
  assert.equal(values.get(USER_KEY), original);
});

test('cerrar sesión conserva la cuenta y permite entrar otra vez', async () => {
  await loginUser(account.email, password);
  const original = values.get(USER_KEY);
  logoutUser();
  assert.equal(values.has(SESSION_KEY), false);
  assert.equal(getAuthSnapshot().user, null);
  assert.equal(values.get(USER_KEY), original);
  assert.equal((await loginUser(account.email, password)).id, account.id);
});

test('sesiones malformadas o de otra cuenta no conceden acceso', () => {
  for (const session of ['{', 'null', '{"userId":"otra-cuenta"}']) {
    values.set(SESSION_KEY, session);
    assert.equal(getAuthSnapshot().user, null);
    assert.ok(getAuthSnapshot().error);
  }
});

test('una sesión sin cuenta no concede acceso', () => {
  values.delete(USER_KEY);
  values.set(SESSION_KEY, JSON.stringify({ userId: account.id }));
  assert.equal(getAuthSnapshot().user, null);
  assert.equal(getAuthSnapshot().hasAccount, false);
});

test('datos de cuenta inválidos se informan sin borrarlos ni permitir acceso', () => {
  for (const stored of ['{', 'null', JSON.stringify({ ...account, balance: -1 }),
    JSON.stringify({ ...account, credentials: { ...account.credentials, iterations: 1 } })]) {
    values.set(USER_KEY, stored);
    values.set(SESSION_KEY, JSON.stringify({ userId: account.id }));
    assert.equal(getAuthSnapshot().user, null);
    assert.ok(getAuthSnapshot().error);
    assert.equal(values.get(USER_KEY), stored);
  }
});

test('un error al guardar la sesión no se informa como acceso exitoso', async () => {
  globalThis.localStorage.setItem = () => { throw new DOMException('Sin espacio', 'QuotaExceededError'); };
  await assert.rejects(loginUser(account.email, password), /No se pudo iniciar sesión/);
  assert.equal(getAuthSnapshot().user, null);
});

test('informa los errores al leer o eliminar la sesión', () => {
  globalThis.localStorage.getItem = () => { throw new DOMException('Bloqueado', 'SecurityError'); };
  assert.equal(getAuthSnapshot().user, null);
  assert.match(getAuthSnapshot().error, /permisos/);
  globalThis.localStorage.removeItem = () => { throw new DOMException('Bloqueado', 'SecurityError'); };
  assert.throws(logoutUser, /No se pudo cerrar/);
});
