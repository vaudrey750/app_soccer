import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { onAuthExpired } from '../services/authEvents';
import {
    getSessionExpiresAtMs,
    isSessionExpired,
    SESSION_TOUCH_THROTTLE_MS,
    touchSession,
} from '../utils/session';

const CHECK_INTERVAL_MS = 5_000;

export const SessionManager = () => {
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();

    const lastTouchMsRef = useRef<number>(0);

    const logoutAndRedirect = () => {
        logout();
        navigate('/login', { replace: true });
    };

    useEffect(() => {
        if (!isAuthenticated) return;

        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        if (!token || !user) {
            logoutAndRedirect();
            return;
        }

        // Rétro-compat : si un utilisateur est déjà loggé mais sans expiry (ancienne version)
        if (getSessionExpiresAtMs() === null) {
            touchSession();
            lastTouchMsRef.current = Date.now();
        }

        const handleActivity = () => {
            const tokenNow = localStorage.getItem('token');
            const userNow = localStorage.getItem('user');
            if (!tokenNow || !userNow) {
                logoutAndRedirect();
                return;
            }

            // Pas de prolongation si on est déjà expiré
            if (isSessionExpired()) {
                logoutAndRedirect();
                return;
            }

            const now = Date.now();
            if (now - lastTouchMsRef.current < SESSION_TOUCH_THROTTLE_MS) return;

            touchSession();
            lastTouchMsRef.current = now;
        };

        // “Action sur l'interface” => on écoute des signaux d'interaction utilisateur
        const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
        for (const evt of events) {
            window.addEventListener(evt, handleActivity, { passive: true });
        }

        const intervalId = window.setInterval(() => {
            const tokenNow = localStorage.getItem('token');
            const userNow = localStorage.getItem('user');
            if (!tokenNow || !userNow || isSessionExpired()) {
                logoutAndRedirect();
            }
        }, CHECK_INTERVAL_MS);

        const unsubscribe = onAuthExpired(() => {
            // typiquement déclenché par une 401 (token expiré)
            logoutAndRedirect();
        });

        const handleStorage = (e: StorageEvent) => {
            if (!e.key) return;
            if (e.key === 'token' || e.key === 'user' || e.key === 'session_expires_at') {
                // Si un autre onglet a logout, ou si l'expiration a été supprimée
                const token = localStorage.getItem('token');
                const user = localStorage.getItem('user');

                if (!token || !user || isSessionExpired()) {
                    logoutAndRedirect();
                }
            }
        };
        window.addEventListener('storage', handleStorage);

        return () => {
            for (const evt of events) {
                window.removeEventListener(evt, handleActivity);
            }
            window.clearInterval(intervalId);
            unsubscribe();
            window.removeEventListener('storage', handleStorage);
        };
    }, [isAuthenticated, logout, navigate]);

    return null;
};
