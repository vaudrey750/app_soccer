import { api } from './api';

export type ClubSearchItem = {
    id: string;
    label: string;
};

export type SeasonDTO = {
    name: string;
    start_date?: string | null;
    end_date?: string | null;
};

export const referenceService = {
    searchFffClubs: async (q: string): Promise<ClubSearchItem[]> => {
        const response = await api.get('/reference/clubs/search', {
            params: { q },
        });
        return response.data;
    },

    getActiveSeason: async (): Promise<SeasonDTO | null> => {
        const response = await api.get('/reference/seasons/active');
        const season = response.data as SeasonDTO;
        if (!season?.name) return null;
        return season;
    },

    updateActiveSeason: async (payload: { name?: string; start_date?: string | null; end_date?: string | null }): Promise<SeasonDTO> => {
        const response = await api.put('/reference/seasons/active', payload);
        return response.data;
    },
};
