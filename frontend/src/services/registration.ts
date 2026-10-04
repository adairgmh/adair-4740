import { derivePasswordHash, PASSWORD_ITERATIONS, toHex } from './password.ts';
import type { PaymentRecord } from '../types/payment.ts';

export const USER_KEY = 'caracoles.user.v1';

export interface RegistrationData {
  fullName: string;
  email: string;
  password: string;
  confirmation: string;
}

export interface StoredUser {
  id: string;
  fullName: string;
  email: string;
  balance: number;
  payments?: PaymentRecord[];
  credentials: {
    algorithm: 'PBKDF2';
    iterations: number;
    salt: string;
    hash: string;
  };
}

export function validateRegistration(data: RegistrationData): string | null {
  if (data.fullName.trim().length < 2 || data.fullName.trim().length > 100) {
    return 'Escribe tu nombre completo, entre 2 y 100 caracteres.';
  }
  if (data.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    return 'Escribe un correo electrónico válido.';
  }
  if (data.password.length < 12 || data.password.length > 128 || !data.password.trim()) {
    return 'La contraseña debe tener entre 12 y 128 caracteres y no contener solo espacios.';
  }
  if (data.password !== data.confirmation) return 'Las contraseñas no coinciden.';
  return null;
}

function ensureNoAccount(): void {
  if (localStorage.getItem(USER_KEY) !== null) {
    throw new Error('Ya existe una cuenta registrada en este navegador.');
  }
}

export async function registerUser(data: RegistrationData): Promise<StoredUser> {
  const error = validateRegistration(data);
  if (error) throw new Error(error);

  try {
    ensureNoAccount();
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await derivePasswordHash(data.password, salt);

    const user: StoredUser = {
      id: crypto.randomUUID(),
      fullName: data.fullName.trim(),
      email: data.email.trim().toLowerCase(),
      balance: 0,
      credentials: {
        algorithm: 'PBKDF2', iterations: PASSWORD_ITERATIONS, salt, hash,
      },
    };

    // Revisa de nuevo después del cálculo para evitar reemplazar otra cuenta.
    ensureNoAccount();
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch (error) {
    if (error instanceof DOMException) {
      throw new Error('No se pudo crear la cuenta. Revisa el espacio y los permisos del navegador.');
    }
    throw error;
  }
}
