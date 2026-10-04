import { useState } from 'react';
import type { UserProfile } from '../services/auth';
import RaceCharts from './RaceCharts';
import TopUpModal from './TopUpModal';

interface DashboardProps {
  user: UserProfile;
  onLogout: () => void;
  error: string;
  onUpdate: (user: UserProfile) => void;
}

export default function Dashboard({ user, onLogout, error, onUpdate }: DashboardProps) {
  const [showTopUp, setShowTopUp] = useState(false);
  const balance = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(user.balance);

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <p className="eyebrow">🐌 A PASO DE CARACOL</p>
        <button className="logout-button" onClick={onLogout}>Cerrar sesión</button>
      </header>
      {error && <p className="error-message" role="alert">{error}</p>}
      <section className="dashboard-welcome" aria-labelledby="welcome-title">
        <p className="eyebrow">TU CUENTA</p>
        <h1 id="welcome-title">Hola, {user.fullName}</h1>
        <p className="account-email">{user.email}</p>
      </section>
      <section className="balance-box dashboard-balance" aria-labelledby="balance-title">
        <h2 id="balance-title">Saldo disponible</h2>
        <strong>{balance}</strong>
        <span>Saldo simulado · MXN</span>
        <button type="button" aria-haspopup="dialog" aria-expanded={showTopUp}
          onClick={() => setShowTopUp(true)}>Cargar saldo con SnailPay</button>
      </section>
      {showTopUp && <TopUpModal user={user} onUpdate={onUpdate} onClose={() => setShowTopUp(false)} />}
      <RaceCharts />
    </main>
  );
}
