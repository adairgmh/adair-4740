import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { UserProfile } from '../services/auth';
import { APPROVED_CARD, DECLINED_CARD, submitTopUp } from '../services/payments';
import type { PaymentScenario } from '../types/payment';

interface TopUpFormProps {
  user: UserProfile;
  onUpdate: (user: UserProfile) => void;
  onBusyChange: (busy: boolean) => void;
}

export default function TopUpForm({ user, onUpdate, onBusyChange }: TopUpFormProps) {
  const [scenario, setScenario] = useState<PaymentScenario>('approved');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const fields = new FormData(event.currentTarget);
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    onBusyChange(true);
    setFeedback(null);
    try {
      const result = await submitTopUp({
        amount: Number(fields.get('amount')),
        cardholderName: String(fields.get('cardholderName') ?? ''),
        scenario,
      }, user, { signal: controller.signal });
      if (controller.signal.aborted) return;
      onUpdate(result.user);
      const success = result.record.response.status === 'approved';
      setFeedback({
        success,
        message: success
          ? `Recarga aprobada. Tu saldo ahora es ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(result.user.balance)}.`
          : result.record.response.message,
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        setFeedback({ success: false, message: error instanceof Error ? error.message : 'No se pudo completar la recarga.' });
      }
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  }

  return (
    <section id="topup-form" className="topup-card" aria-labelledby="topup-title">
      <p className="eyebrow">SNAILPAY</p>
      <h2 id="topup-title">Carga saldo de prueba</h2>
      <p id="topup-description" className="chart-description">Solo se utilizan datos ficticios. No se realizan cobros reales.</p>
      <form onSubmit={handleSubmit} aria-busy={busy}>
        <fieldset disabled={busy}>
          <label htmlFor="scenario">Resultado simulado</label>
          <select id="scenario" value={scenario} onChange={(event) => {
            setScenario(event.target.value as PaymentScenario);
            setFeedback(null);
          }}>
            <option value="approved">Recarga aprobada</option>
            <option value="declined">Tarjeta rechazada</option>
            <option value="system_error">Error del sistema</option>
            <option value="timeout">Tiempo de espera agotado</option>
          </select>

          <div className="topup-fields">
            <div>
              <label htmlFor="amount">Monto en MXN</label>
              <input id="amount" name="amount" type="number" min="0.01" step="0.01" defaultValue="100" required />
            </div>
            <div>
              <label htmlFor="cardholderName">Nombre del titular</label>
              <input id="cardholderName" name="cardholderName" defaultValue={user.fullName} required autoComplete="off" />
            </div>
          </div>

          <label htmlFor="testCard">Número de tarjeta ficticia</label>
          <input id="testCard" value={scenario === 'declined' ? DECLINED_CARD : APPROVED_CARD} readOnly aria-describedby="test-card-help" />
          <small id="test-card-help">La tarjeta cambia según el resultado seleccionado.</small>
          <div className="topup-fields">
            <div><label htmlFor="testExpiration">Vencimiento ficticio</label><input id="testExpiration" value="12/26" readOnly /></div>
            <div><label htmlFor="testCvv">CVV ficticio</label><input id="testCvv" value="543" readOnly /></div>
          </div>
          <button type="submit">{busy ? 'Procesando recarga…' : 'Recargar saldo simulado'}</button>
        </fieldset>
        {busy && <p role="status" className="chart-description">Esperando a SnailPay. Esto puede tardar hasta 5 segundos.</p>}
        {feedback && <p role={feedback.success ? 'status' : 'alert'} className={feedback.success ? 'success-message' : 'error-message'}>{feedback.message}</p>}
      </form>
    </section>
  );
}
