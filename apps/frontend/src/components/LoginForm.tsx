import { FormEvent, useState } from 'react';

interface Props {
  onSubmit: (email: string, password: string) => Promise<void>;
}

export function LoginForm({ onSubmit }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const parseErrorMessage = (value: unknown) => {
    if (!(value instanceof Error)) {
      return 'No se pudo iniciar sesion.';
    }

    try {
      const parsed = JSON.parse(value.message) as { message?: string | string[] };
      if (Array.isArray(parsed.message)) {
        return parsed.message.join(' | ');
      }
      return parsed.message || value.message;
    } catch {
      return value.message || 'No se pudo iniciar sesion.';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      setError('Completa el correo y la clave para continuar.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await onSubmit(normalizedEmail, password);
    } catch (err) {
      setError(parseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="panel login" onSubmit={handleSubmit}>
      <h2>Ingreso POS</h2>
      <label>Email</label>
      <input
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (error) {
            setError('');
          }
        }}
      />
      <label>Clave</label>
      <div className="password-field">
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) {
              setError('');
            }
          }}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setShowPassword((current) => !current)}
          aria-label={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
          title={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
        >
          {showPassword ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 3l18 18" />
              <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
              <path d="M9.4 5.3A10.9 10.9 0 0 1 12 5c5 0 9.3 3 11 7a11.8 11.8 0 0 1-4.2 5.1" />
              <path d="M6.2 6.3A11.8 11.8 0 0 0 1 12c1.7 4 6 7 11 7 1.5 0 2.9-.3 4.2-.8" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <button disabled={loading}>{loading ? 'Ingresando...' : 'Entrar'}</button>
    </form>
  );
}
