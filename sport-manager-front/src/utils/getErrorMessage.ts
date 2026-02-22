export const getErrorMessage = (err: unknown, fallback = 'Une erreur est survenue.') => {
    const anyErr = err as any;
    const detail = anyErr?.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;

    const message = anyErr?.message;
    if (typeof message === 'string' && message.trim()) return message;

    const dataMessage = anyErr?.response?.data?.message;
    if (typeof dataMessage === 'string' && dataMessage.trim()) return dataMessage;

    return fallback;
};
