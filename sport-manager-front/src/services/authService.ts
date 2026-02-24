import { api } from './api';
import { clearSessionExpiry, touchSession } from '../utils/session';

export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  tenant_id: string;
}

export type TenantSignupRequest = {
    full_name: string;
    email: string;
    password: string;
    club_name: string;
    is_fff_linked: boolean;
    fff_real_club_id?: string;
};

export type SignupResponse = {
    tenant_id: string;
    user_id: string;
    message: string;
};

export type ForgotPasswordResponse = {
  message: string;
};

export type ResetPasswordRequest = {
  token: string;
  new_password: string;
};

export type ResetPasswordResponse = {
  message: string;
};

export const authService = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    // The backend endpoint is likely /saas/login based on legacy code
    const response = await api.post('/saas/login', { email, password });
    
    // Mapping backend response to frontend clean structure
    const data = response.data;
    const names = data.user.full_name ? data.user.full_name.split(' ') : ['Joueur', ''];
    
    const user: User = {
        id: data.user.id,
        email: data.user.email,
        firstName: names[0],
        lastName: names.slice(1).join(' '),
      role: String(data.user.role || 'MEMBER').toUpperCase(),
        tenantId: data.tenant?.id,
    };

    // Store tokens immediately
    localStorage.setItem('token', data.access_token);
    if (data.tenant && data.tenant.id) {
        localStorage.setItem('tenant_id', data.tenant.id);
    }
    localStorage.setItem('user', JSON.stringify(user));

    // Démarre (ou prolonge) la session glissante côté front
    touchSession();

    return {
        token: data.access_token,
        user,
        tenant_id: data.tenant?.id
    };
  },

  signup: async (payload: TenantSignupRequest): Promise<SignupResponse> => {
    const response = await api.post('/saas/signup', payload);
    return response.data;
  },

  forgotPassword: async (email: string): Promise<ForgotPasswordResponse> => {
    const response = await api.post('/saas/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (payload: ResetPasswordRequest): Promise<ResetPasswordResponse> => {
    const response = await api.post('/saas/reset-password', payload);
    return response.data;
  },

  logout: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('tenant_id');
      localStorage.removeItem('user');
      clearSessionExpiry();
  }
};
