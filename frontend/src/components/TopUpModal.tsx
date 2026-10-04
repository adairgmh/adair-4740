import { useEffect, useRef, useState } from 'react';
import type { UserProfile } from '../services/auth';
import TopUpForm from './TopUpForm';

interface TopUpModalProps {
  user: UserProfile;
  onUpdate: (user: UserProfile) => void;
  onClose: () => void;
}

export default function TopUpModal({ user, onUpdate, onClose }: TopUpModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    dialog.showModal();
    document.body.style.overflow = 'hidden';

    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog ref={dialogRef} id="topup-modal" className="topup-dialog"
      aria-labelledby="topup-title" aria-describedby="topup-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}>
      <div className="modal-toolbar">
        <span className="eyebrow">SALDO SIMULADO</span>
        <button type="button" className="modal-close" aria-label="Cerrar ventana de recarga"
          onClick={onClose} disabled={busy}>
          Cerrar <span aria-hidden="true">×</span>
        </button>
      </div>
      <TopUpForm user={user} onUpdate={onUpdate} onBusyChange={setBusy} />
    </dialog>
  );
}
