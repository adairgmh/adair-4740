export const PASSWORD_ITERATIONS = 600_000;

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function derivePasswordHash(password: string, saltHex: string): Promise<string> {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g) ?? [], (byte) => parseInt(byte, 16));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PASSWORD_ITERATIONS, hash: 'SHA-256' }, key, 256,
  );
  return toHex(new Uint8Array(bits));
}
