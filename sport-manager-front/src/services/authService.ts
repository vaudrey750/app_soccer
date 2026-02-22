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

  logout: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('tenant_id');
      localStorage.removeItem('user');
      clearSessionExpiry();
  }
};
