import { useEffect, useState, type ReactNode } from 'react';
import { speak } from '../lib/speech';

export function SpeakButton({ text, rate, pitch, label, className = '' }: { text: string; rate?: number; pitch?: number; label?: string; className?: string }) {
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      className={`btn-icon ${on ? 'is-on' : ''} ${className}`}
      title={`Listen: ${text}`}
      aria-label={`Listen to ${text}`}
      onClick={(e) => {
        e.stopPropagation();
        setOn(true);
        speak(text, { rate, pitch, onEnd: () => setOn(false) });
      }}
    >
      🔊{label ? <span>{label}</span> : null}
    </button>
  );
}

export function Loading({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="loading">
      <span className="spinner" /> {text}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return <div className="alert alert--error">{error instanceof Error ? error.message : String(error)}</div>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal__head">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

export function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress__fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="badge">–</span>;
  const cls = score >= 85 ? 'good' : score >= 60 ? 'ok' : 'low';
  return <span className={`badge badge--${cls}`}>{score}</span>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" />
      <span>{label}</span>
    </label>
  );
}

export const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString() : '–');
export const fmtDateTime = (s?: string | null) => (s ? new Date(s).toLocaleString() : '–');
