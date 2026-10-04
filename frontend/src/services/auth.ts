import { USER_KEY } from './registration.ts';
import type { StoredUser } from './registration.ts';
import { derivePasswordHash, PASSWORD_ITERATIONS } from './password.ts';

export const SESSION_KEY = 'caracoles.session.v1';
export type UserProfile = Omit<StoredUser, 'credentials' | 'payments'>;

export interface AuthSnapshot {
  user: UserProfile | null;
  hasAccount: boolean;
  error: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// LocalStorage contiene texto externo a TypeScript: comprobamos su estructura.
export function readStoredUser(): StoredUser | null {
  const stored = localStorage.getItem(USER_KEY);
  if (stored === null) return null;
  let user: unknown;
  try {
    user = JSON.parse(stored);
  } catch {
    throw new Error('Los datos de la cuenta guardada no son válidos.');
  }
  if (
    !isRecord(user) || typeof user.id !== 'string' || !user.id ||
    typeof user.fullName !== 'string' || !user.fullName.trim() ||
    typeof user.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) ||
    typeof user.balance !== 'number' || !Number.isFinite(user.balance) || user.balance < 0 ||
    !isRecord(user.credentials) || user.credentials.algorithm !== 'PBKDF2' ||
    user.credentials.iterations !== PASSWORD_ITERATIONS ||
    typeof user.credentials.salt !== 'string' || !/^[a-f0-9]{32}$/.test(user.credentials.salt) ||
    typeof user.credentials.hash !== 'string' || !/^[a-f0-9]{64}$/.test(user.credentials.hash)
  ) {
    throw new Error('Los datos de la cuenta guardada no son válidos.');
  }
  return user as unknown as StoredUser;
}

function profileOf(user: StoredUser): UserProfile {
  return { id: user.id, fullName: user.fullName, email: user.email, balance: user.balance };
}

export function getAuthSnapshot(): AuthSnapshot {
  try {
    const user = readStoredUser();
    if (!user) return { user: null, hasAccount: false, error: '' };
    const storedSession = localStorage.getItem(SESSION_KEY);
    if (storedSession === null) return { user: null, hasAccount: true, error: '' };
    let session: unknown;
    try {
      session = JSON.parse(storedSession);
    } catch {
      return { user: null, hasAccount: true, error: 'La sesión guardada no es válida. Inicia sesión de nuevo.' };
    }
    if (!isRecord(session) || session.userId !== user.id) {
      return { user: null, hasAccount: true, error: 'Inicia sesión para acceder a tu cuenta.' };
    }
    return { user: profileOf(user), hasAccount: true, error: '' };
  } catch (error) {
    return {
      user: null,
      hasAccount: true,
      error: error instanceof DOMException
        ? 'No se pudo leer la cuenta. Revisa los permisos de almacenamiento del navegador.'
        : error instanceof Error ? error.message : 'No se pudo recuperar la cuenta.',
    };
  }
}

export async function loginUser(email: string, password: string): Promise<UserProfile> {
  try {
    const user = readStoredUser();
    if (!user || user.email !== email.trim().toLowerCase() || password.length > 128 || !password) {
      throw new Error('El correo o la contraseña son incorrectos.');
    }
    const hash = await derivePasswordHash(password, user.credentials.salt);
    if (hash !== user.credentials.hash) throw new Error('El correo o la contraseña son incorrectos.');

    const currentUser = readStoredUser();
    if (!currentUser || currentUser.id !== user.id || currentUser.credentials.hash !== hash ||
        currentUser.credentials.salt !== user.credentials.salt || currentUser.email !== user.email) {
      throw new Error('La cuenta cambió durante el acceso. Inténtalo de nuevo.');
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: currentUser.id }));
    return profileOf(currentUser);
  } catch (error) {
    if (error instanceof DOMException) {
      throw new Error('No se pudo iniciar sesión. Revisa los permisos y el espacio del navegador.');
    }
    throw error;
  }
}

export function logoutUser(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    throw new Error('No se pudo cerrar la sesión. Revisa los permisos del navegador e inténtalo de nuevo.');
  }
}
