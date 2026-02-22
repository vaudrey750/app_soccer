import { api } from './api';

export interface FormationPositionDTO {
    id: number;
    formation_id: number;
    role: string;
    coord_x: number;
    coord_y: number;
    position_label: string;
    priority: number;
}

export interface FormationDTO {
    id: number;
    name: string;
    category: string;
    description: string;
    positions: FormationPositionDTO[];
}

export interface MatchLineupItemDTO {
    id?: string;
    position_id: number;
    member_id: string | null;
    member_name?: string;
    position?: FormationPositionDTO; // Rich object if available
}

export interface MatchLineupDTO {
    event_id: string;
    lineup_published?: boolean;
    formation: FormationDTO | null;
    items: MatchLineupItemDTO[];
}

export interface MatchLineupUpdateDTO {
    formation_id: number;
    items: {
        position_id: number;
        member_id: string;
    }[];
}

export interface ChatMessage {
    id: string;
    sender_name: string;
    message: string;
    created_at: string;
    is_me: boolean;
}

export interface ChatStatus {
    is_closed: boolean;
    closed_at?: string;
}

export const sportService = {
    // Chat
    getMatchChat: async (gameId: string): Promise<ChatMessage[]> => {
        const response = await api.get<ChatMessage[]>(`/sport/games/${gameId}/chat`);
        return response.data;
    },

    postMatchChat: async (gameId: string, message: string): Promise<ChatMessage> => {
        const response = await api.post<ChatMessage>(`/sport/games/${gameId}/chat`, { message });
        return response.data;
    },

    getChatStatus: async (gameId: string): Promise<ChatStatus> => {
        const response = await api.get<ChatStatus>(`/sport/games/${gameId}/chat/status`);
        return response.data;
    },

    toggleChatStatus: async (gameId: string, isClosed: boolean) => {
        const response = await api.post(`/sport/games/${gameId}/chat/status`, { is_closed: isClosed });
        return response.data;
    },

    // Formations
    getFormations: async (): Promise<FormationDTO[]> => {
        const response = await api.get<FormationDTO[]>('/sport/formations');
        return response.data;
    },

    getFormationById: async (id: number): Promise<FormationDTO> => {
        const response = await api.get<FormationDTO>(`/sport/formations/${id}`);
        return response.data;
    },

    // Lineups
    getMatchLineup: async (eventId: string): Promise<MatchLineupDTO> => {
        const response = await api.get<MatchLineupDTO>(`/sport/matches/${eventId}/lineup`);
        return response.data;
    },

    updateMatchLineup: async (eventId: string, lineup: MatchLineupUpdateDTO): Promise<MatchLineupDTO> => {
        const response = await api.put<MatchLineupDTO>(`/sport/matches/${eventId}/lineup`, lineup);
        return response.data;
    },

    publishMatchLineup: async (eventId: string, published: boolean): Promise<boolean> => {
        const response = await api.post(`/sport/matches/${eventId}/lineup/publish`, null, { 
            params: { publish: published } 
        });
        return response.data;
    },

    updateMatchStatus: async (eventId: string, statusId: number): Promise<void> => {
        await api.put(`/sport/matches/${eventId}/status`, {
            status_id: statusId
        });
    }
};
