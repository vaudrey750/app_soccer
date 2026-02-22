import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useToastStore } from '../../stores/toastStore';

export const ToastHost: React.FC = () => {
    const toasts = useToastStore((s) => s.toasts);
    const dismiss = useToastStore((s) => s.dismiss);

    if (!toasts || toasts.length === 0) return null;

    const variantClass = (variant: string) => {
        switch (variant) {
            case 'success':
                return 'border-emerald-200 bg-emerald-50 text-emerald-900';
            case 'error':
                return 'border-rose-200 bg-rose-50 text-rose-900';
            default:
                return 'border-slate-200 bg-white text-slate-900';
        }
    };

    return (
        <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 w-[min(92vw,420px)]">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    className={cn(
                        'rounded-2xl border shadow-lg px-4 py-3 flex items-start gap-3',
                        variantClass(t.variant)
                    )}
                    role="status"
                    aria-live="polite"
                >
                    <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm leading-tight">{t.title}</div>
                        {t.message ? (
                            <div className="mt-1 text-xs opacity-80 whitespace-pre-wrap">{t.message}</div>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={() => dismiss(t.id)}
                        className="shrink-0 p-1 rounded-md hover:bg-black/5 transition-colors"
                        aria-label="Fermer"
                        title="Fermer"
                    >
                        <X size={16} />
                    </button>
                </div>
            ))}
        </div>
    );
};
