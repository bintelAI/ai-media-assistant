import { useEffect } from 'react';
import { useUIStore } from '@/shared/store';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
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
    success: CheckCircle,
    error: AlertCircle,
    info: Info
  };

  const Icon = icons[toastType];

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg',
        toastType === 'success' && 'bg-green-500 text-white',
        toastType === 'error' && 'bg-red-500 text-white',
        toastType === 'info' && 'bg-blue-500 text-white'
      )}>
        <Icon className="w-4 h-4" />
        <span className="text-sm">{toastMessage}</span>
        <button onClick={clearToast} className="ml-2 hover:opacity-80">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
