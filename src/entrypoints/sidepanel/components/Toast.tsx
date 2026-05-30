import { useEffect } from 'react';
import { useUIStore } from '@/shared/store';
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/shared/utils/helpers';

export default function Toast() {
  const { toastMessage, toastType, clearToast } = useUIStore();

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        clearToast();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, clearToast]);

  if (!toastMessage) return null;

  const icons = {
    success: CheckCircle2,
    error: AlertTriangle,
    info: Info
  };

  const Icon = icons[toastType];
  const tone = {
    success: {
      border: 'border-emerald-200',
      icon: 'text-emerald-700',
      stripe: 'bg-emerald-500',
    },
    error: {
      border: 'border-rose-200',
      icon: 'text-rose-700',
      stripe: 'bg-rose-500',
    },
    info: {
      border: 'border-sky-200',
      icon: 'text-sky-700',
      stripe: 'bg-sky-500',
    }
  }[toastType];

  return (
    <div className="fixed left-3 right-3 top-3 z-50 animate-slide-down" role="status" aria-live="polite">
      <div className={cn(
        'relative flex min-h-[52px] overflow-hidden rounded-lg border bg-white shadow-lg shadow-slate-900/15',
        tone.border
      )}>
        <div className={cn('w-1 shrink-0', tone.stripe)} />
        <div className="flex min-w-0 flex-1 items-start gap-2 px-3 py-3">
          <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', tone.icon)} />
          <span className="min-w-0 flex-1 text-sm leading-5 text-slate-700">{toastMessage}</span>
        </div>
        <button
          type="button"
          onClick={clearToast}
          className="flex min-h-[44px] w-11 shrink-0 items-center justify-center text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
          aria-label="关闭提示"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
