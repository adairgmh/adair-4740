import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { registerUser } from '../services/registration';
import { loginUser } from '../services/auth';
import type { UserProfile } from '../services/auth';

interface AuthFormProps {
  hasAccount: boolean;
  notice: string;
  onLogin: (user: UserProfile) => void;
}

export default function AuthForm({ hasAccount, notice, onLogin }: AuthFormProps) {
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>(hasAccount ? 'login' : 'register');
  const [accountExists, setAccountExists] = useState(hasAccount);
  const isRegister = mode === 'register';
  const submitting = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    submitting.current = true;
    setIsSaving(true);
    setError('');

    try {
      const email = String(fields.get('email') ?? '');
      const password = String(fields.get('password') ?? '');
      if (isRegister) {
        await registerUser({
          fullName: String(fields.get('fullName') ?? ''),
          email,
          password,
          confirmation: String(fields.get('confirmation') ?? ''),
        });
        setAccountExists(true);
        setMode('login');
      }
      const user = await loginUser(email, password);
      form.reset();
      onLogin(user);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo acceder a la cuenta. Inténtalo de nuevo.');
    } finally {
      submitting.current = false;
      setIsSaving(false);
    }
  }

  return (
    <main className="registration-layout">
      <section className="intro" aria-labelledby="brand-title">
        <p className="eyebrow">CLUB DE CARRERAS</p>
        <h1 id="brand-title">A paso de<br /><span>caracol.</span></h1>
        <p className="intro-copy">Seis caracoles, una pista y toda la emoción de llegar a la meta.</p>
        <div className="snail-art" aria-hidden="true">🐌</div>
        <p className="simulation-note">Experiencia de demostración · Saldo y carreras simulados</p>
      </section>

      <section className="form-card" aria-labelledby="form-title">
        <p className="eyebrow">{isRegister ? 'COMIENZA AQUÍ' : 'BIENVENIDO DE NUEVO'}</p>
        <h2 id="form-title">{isRegister ? 'Crea tu cuenta' : 'Inicia sesión'}</h2>
        <p className="form-description">
          {isRegister ? 'Regístrate para entrar al club. Tu saldo inicial será de $0.' : 'Entra con el correo y la contraseña de tu cuenta.'}
        </p>
        {notice && <p className="error-message" role="alert">{notice}</p>}
            <form onSubmit={handleSubmit} aria-busy={isSaving}>
              <fieldset disabled={isSaving}>
                {isRegister && <>
                <label htmlFor="fullName">Nombre completo</label>
                <input id="fullName" name="fullName" autoComplete="name" required minLength={2} maxLength={100} />
                </>}

                <label htmlFor="email">Correo electrónico</label>
                <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />

                <label htmlFor="password">Contraseña</label>
                <input id="password" name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} required minLength={isRegister ? 12 : undefined} maxLength={128} aria-describedby={isRegister ? "password-help" : undefined} />
                {isRegister && <>
                <small id="password-help">Usa entre 12 y 128 caracteres. Puedes escribir una frase.</small>

                <label htmlFor="confirmation">Confirmar contraseña</label>
                <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
                </>}

                {error && <p className="error-message" role="alert">{error}</p>}
                <button type="submit">{isSaving ? 'Procesando…' : isRegister ? 'Crear cuenta' : 'Entrar'}</button>
              </fieldset>
            </form>
            {!accountExists && (
              <button className="secondary-button" type="button" disabled={isSaving}
                onClick={() => { setMode(isRegister ? 'login' : 'register'); setError(''); }}>
                {isRegister ? 'Ya tengo cuenta' : 'Crear una cuenta'}
              </button>
            )}
      </section>
    </main>
  );
}

