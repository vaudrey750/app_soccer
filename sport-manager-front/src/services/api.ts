import axios, { InternalAxiosRequestConfig, AxiosError } from 'axios';
import { emitAuthExpired } from './authEvents';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const tenantId = localStorage.getItem('tenant_id');
    const token = localStorage.getItem('token');
    
    if (tenantId) {
      config.headers.set('X-Tenant-ID', tenantId);
    }
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    if (status === 401) {
      // Token expiré / non valide : on force une déconnexion globale.
      emitAuthExpired();
    }
    return Promise.reject(error);
  }
);
