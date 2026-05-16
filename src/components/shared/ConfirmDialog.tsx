import { AlertTriangle, X } from 'lucide-react';
import type { ReactNode } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  icon?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const variantStyles = {
  danger:  'bg-red-500/15 text-red-400 hover:bg-red-500/25',
  warning: 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25',
  default: 'bg-[#fdb913] text-black hover:bg-[#e5a710]',
};

export function ConfirmDialog({
  open, title, description, icon, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'default', onConfirm, onCancel, loading = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl animate-in fade-in-0 zoom-in-95">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            {icon ?? <AlertTriangle className="h-5 w-5 text-amber-400" />}
            {title}
          </h3>
          <button onClick={onCancel} className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        {description && <p className="text-sm text-neutral-400 mb-5">{description}</p>}
        <div className="flex items-center gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800 disabled:opacity-50">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${variantStyles[variant]}`}>
            {loading ? (
              <span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Processing…</span>
            ) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
