// Implements SPEC §19.5 Toast component
import React from 'react';
import { useStore } from '@/state/store';
import { Info, CheckCircle, AlertTriangle, AlertCircle, X } from 'lucide-react';

export const Toast: React.FC = () => {
  const toast = useStore((state) => state.toast);
  const clearToast = useStore((state) => state.clearToast);

  if (!toast) return null;

  const iconMap = {
    info: <Info size={18} color="var(--info)" />,
    success: <CheckCircle size={18} color="var(--win)" />,
    warning: <AlertTriangle size={18} color="var(--warning)" />,
    error: <AlertCircle size={18} color="var(--danger)" />,
  };

  const borderMap = {
    info: 'var(--info)',
    success: 'var(--win)',
    warning: 'var(--warning)',
    error: 'var(--danger)',
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 1100,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${borderMap[toast.type]}`,
        borderRadius: 'var(--radius-m)',
        padding: '12px 16px',
        boxShadow: 'var(--shadow-2)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        maxWidth: '380px',
        animation: 'toast-enter var(--dur-fast) var(--ease)',
      }}
    >
      {iconMap[toast.type]}
      <div style={{ fontSize: '14px', flex: 1 }}>{toast.message}</div>
      <button
        onClick={clearToast}
        aria-label="Dismiss toast"
        style={{ color: 'var(--text-dim)', padding: '2px' }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
