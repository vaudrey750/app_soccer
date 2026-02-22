const SESSION_EXPIRES_AT_KEY = 'session_expires_at';

const DEFAULT_IDLE_MINUTES = 60;
// On évite de toucher trop souvent le localStorage (perf + bruit cross-tab)
export const SESSION_TOUCH_THROTTLE_MS = 5_000;

export const getSessionIdleTimeoutMs = () => {
    const raw = (import.meta as any).env?.VITE_SESSION_IDLE_MINUTES;
    const minutes = raw !== undefined ? Number(raw) : NaN;
    const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_IDLE_MINUTES;
    return safeMinutes * 60_000;
};

export const getSessionExpiresAtMs = (): number | null => {
    const raw = localStorage.getItem(SESSION_EXPIRES_AT_KEY);
    if (!raw) return null;
    const ms = Number(raw);
    return Number.isFinite(ms) ? ms : null;
};

export const setSessionExpiresAtMs = (expiresAtMs: number) => {
    localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(expiresAtMs));
};

export const clearSessionExpiry = () => {
    localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
};

export const touchSession = () => {
    const nextExpiresAtMs = Date.now() + getSessionIdleTimeoutMs();
    setSessionExpiresAtMs(nextExpiresAtMs);
    return nextExpiresAtMs;
};

export const isSessionExpired = (nowMs: number = Date.now()) => {
    const expiresAt = getSessionExpiresAtMs();
    if (expiresAt === null) return false;
    return nowMs >= expiresAt;
};
