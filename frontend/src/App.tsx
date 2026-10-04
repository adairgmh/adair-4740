import { useEffect, useState } from 'react';
import AuthForm from './components/AuthForm';
import Dashboard from './components/Dashboard';
import { getAuthSnapshot, logoutUser, SESSION_KEY } from './services/auth';
import { USER_KEY } from './services/registration';
import './App.css';

function App() {
  const [auth, setAuth] = useState(getAuthSnapshot);
  const [logoutError, setLogoutError] = useState('');

  useEffect(() => {
    function syncSession(event: StorageEvent) {
      if (event.key === USER_KEY || event.key === SESSION_KEY || event.key === null) {
        setAuth(getAuthSnapshot());
        setLogoutError('');
      }
    }
    window.addEventListener('storage', syncSession);
    return () => window.removeEventListener('storage', syncSession);
  }, []);

  function handleLogout() {
    try {
      logoutUser();
      setAuth(getAuthSnapshot());
      setLogoutError('');
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'No se pudo cerrar la sesión.');
    }
  }

  if (!auth.user) {
    return <AuthForm key={String(auth.hasAccount)} hasAccount={auth.hasAccount} notice={auth.error}
      onLogin={(user) => setAuth({ user, hasAccount: true, error: '' })} />;
  }

  return <Dashboard user={auth.user} onLogout={handleLogout} error={logoutError}
    onUpdate={(user) => setAuth({ user, hasAccount: true, error: '' })} />;
}

export default App;
