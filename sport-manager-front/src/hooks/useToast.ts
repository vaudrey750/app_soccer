import { useCallback } from 'react';
import { useToastStore, type ToastVariant } from '../stores/toastStore';

type ShowArgs = {
    title: string;
    message?: string;
    durationMs?: number;
};

export const useToast = () => {
    const show = useToastStore((s) => s.show);

    const push = useCallback(
        (variant: ToastVariant, args: ShowArgs) => {
            show({
                variant,
                title: args.title,
                message: args.message,
                durationMs: args.durationMs,
            });
        },
        [show]
    );

    return {
        info: (args: ShowArgs) => push('info', args),
        success: (args: ShowArgs) => push('success', args),
        error: (args: ShowArgs) => push('error', args),
    };
};
