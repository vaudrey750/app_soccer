export type UserRole = 'ADMIN' | 'PRESIDENT' | 'COACH' | 'PLAYER' | 'ASSISTANT' | 'FRIEND' | 'STAFF' | 'OCCASIONAL' | 'MEMBER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  phone?: string;
  role: UserRole | string; // Allow for future roles
  photoUrl?: string;
  position?: string;
  fffLicenseId?: string;
}
