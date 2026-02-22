type AuthExpiredListener = () => void;

const listeners = new Set<AuthExpiredListener>();

export const onAuthExpired = (listener: AuthExpiredListener) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const emitAuthExpired = () => {
    for (const listener of listeners) {
        try {
            listener();
        } catch (e) {
            // ne pas casser la chaîne d'events
            console.error('Auth expired listener error', e);
        }
    }
};
