import { api } from './api';

export interface MemberDTO {
    member_id: string; 
    first_name: string;
    last_name: string;
    email?: string;
    role: string;
    position?: string;
    club_id: string; 
    team_ids?: string[];
    
    // Extended fields
    phone?: string;
    address?: string;
    city?: string;
    postal_code?: string;
    country?: string;
    medical_certificate_date?: string;
    contribution_status?: string;
    clothing_size?: string;
    photo_url?: string;
}

export interface TeamDTO {
    team_id: string;
    name: string;
    category?: string;
    sex?: string;
}

interface CreateMemberDTO {
    first_name: string;
    last_name: string;
    email?: string;
    role?: string;
    position?: string;
    club_id?: string;
}

export const memberService = {
  getMembers: async (): Promise<MemberDTO[]> => {
    const response = await api.get('/core/members');
    return response.data;
  },

  getMember: async (id: string): Promise<MemberDTO> => {
      const response = await api.get(`/core/members/${id}`);
      return response.data;
  },

  updateMember: async (id: string, data: Partial<CreateMemberDTO> & { phone?: string }): Promise<MemberDTO> => {
      const payload: any = {};
      if (data.first_name) payload.first_name = data.first_name;
      if (data.last_name) payload.last_name = data.last_name;
      if (data.email) payload.email = data.email;
      if (data.phone) payload.phone = data.phone;
      if (data.role) payload.role = data.role;
      if (data.position) payload.position = data.position;
      
      const response = await api.put(`/core/members/${id}`, payload);
      return response.data;
  },

  createMember: async (member: CreateMemberDTO): Promise<MemberDTO> => {
      const response = await api.post('/core/members', member);
      return response.data;
  },

  getMyTeams: async (memberId: string): Promise<TeamDTO[]> => {
      try {
        const response = await api.get(`/core/members/${memberId}/teams`);
        return response.data.map((t: any) => ({
            team_id: t.id,
            name: t.name,
            category: t.category,
            sex: t.gender
        }));
      } catch (error) {
          console.error("Failed to fetch teams", error);
          return [];
      }
  }
};
