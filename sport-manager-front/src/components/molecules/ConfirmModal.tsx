import React from 'react';
import { Modal } from './Modal';
import { cn } from '../../utils/cn';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDanger?: boolean;
    isConfirmLoading?: boolean;
    onConfirm: () => void | Promise<void>;
    onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    isDanger,
    isConfirmLoading,
    onConfirm,
    onClose,
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            {message ? (
                <div className="text-sm text-slate-600 whitespace-pre-wrap">{message}</div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
                >
                    {cancelLabel}
                </button>
                <button
                    type="button"
                    disabled={Boolean(isConfirmLoading)}
                    onClick={onConfirm}
                    className={cn(
                        'px-4 py-2 rounded-xl font-bold text-sm transition-colors',
                        isDanger
                            ? 'bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-60'
                            : 'bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60'
                    )}
                >
                    {isConfirmLoading ? '...' : confirmLabel}
                </button>
            </div>
        </Modal>
    );
};
