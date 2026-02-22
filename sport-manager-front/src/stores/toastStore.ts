import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
    id: string;
    variant: ToastVariant;
    title: string;
    message?: string;
    createdAt: number;
    durationMs: number;
}

type ToastInput = {
    variant: ToastVariant;
    title: string;
    message?: string;
    durationMs?: number;
};

interface ToastState {
    toasts: Toast[];
    show: (toast: ToastInput) => string;
    dismiss: (id: string) => void;
    clear: () => void;
}

const DEFAULT_DURATION_MS = 3500;

const randomId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export const useToastStore = create<ToastState>((set, get) => ({
    toasts: [],
    show: (input) => {
        const id = randomId();
        const durationMs =
            typeof input.durationMs === 'number' && Number.isFinite(input.durationMs)
                ? Math.max(500, input.durationMs)
                : DEFAULT_DURATION_MS;

        const toast: Toast = {
            id,
            variant: input.variant,
            title: input.title,
            message: input.message,
            createdAt: Date.now(),
            durationMs,
        };

        set((state) => ({
            toasts: [toast, ...state.toasts].slice(0, 5),
        }));

        window.setTimeout(() => {
            const stillThere = get().toasts.some((t) => t.id === id);
            if (stillThere) get().dismiss(id);
        }, durationMs);

        return id;
    },
    dismiss: (id) => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    },
    clear: () => set({ toasts: [] }),
}));
