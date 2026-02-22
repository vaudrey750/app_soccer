import { api } from './api';

export interface PlayerCompetitionStatsDTO {
    competition_name: string;
    matches_played: number;
    goals: number;
    assists: number;
    average_rating?: number;
}

export interface PlayerStatsDTO {
    member_id: string;
    matches_played: number;
    trainings_attended: number;
    trainings_total: number;
    goals: number;
    assists: number;
    minutes_played: number;
    average_rating?: number; // 0-10
    mom_count: number; // Man of the match
    by_competition: PlayerCompetitionStatsDTO[];
}

export interface TeamCompetitionStatsDTO {
    competition_name: string;
    matches_played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_for: number;
    goals_against: number;
}

export interface TeamStatsDTO {
    team_id: string;
    team_name: string;
    matches_played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_for: number;
    goals_against: number;
    clean_sheets: number;
    form: ('W' | 'D' | 'L')[]; // Last 5 games
    by_competition: TeamCompetitionStatsDTO[];
}

export interface LeaderboardEntryDTO {
    member_id: string;
    name: string;
    photo_url?: string;
    value: number;
    rank: number;
}

export interface LeaderboardsDTO {
    top_scorers: LeaderboardEntryDTO[];
    top_assists: LeaderboardEntryDTO[];
    most_active: LeaderboardEntryDTO[]; // Training attendance
}

export interface SquadMemberStatsDTO {
    member_id: string;
    first_name: string;
    last_name: string;
    photo_url?: string;
    position?: string;
    matches_played: number;
    goals: number;
    assists: number;
    trainings_attended: number;
    trainings_total: number;
    average_rating: number;
}

export const statsService = {
    getSquadStats: async (teamId: string): Promise<SquadMemberStatsDTO[]> => {
        try {
            const response = await api.get('/core/stats/squad', { 
                params: { team_id: teamId } 
            });
            return response.data;
        } catch (error) {
            console.error("Failed to fetch squad stats", error);
            return []; // Return empty on error to avoid crashing UI
        }
    },

    getMyStats: async (memberId: string): Promise<PlayerStatsDTO> => {
        // Mock Data until backend supports full competition breakdown
        return new Promise(resolve => setTimeout(() => resolve({
            member_id: memberId,
            matches_played: 14,
            trainings_attended: 42,
            trainings_total: 48,
            goals: 5,
            assists: 3,
            minutes_played: 1120,
            average_rating: 7.2,
            mom_count: 2,
            by_competition: [
                { competition_name: 'Championnat', matches_played: 10, goals: 3, assists: 2, average_rating: 7.0 },
                { competition_name: 'Coupe de France', matches_played: 2, goals: 1, assists: 1, average_rating: 7.8 },
                { competition_name: 'Amical', matches_played: 2, goals: 1, assists: 0, average_rating: 6.5 }
            ]
        }), 600));
    },

    getTeamStats: async (teamId: string): Promise<TeamStatsDTO> => {
        // TODO: Replace with real API call
        // const response = await api.get(\`/stats/team/\${teamId}\`);
        // return response.data;

        // Mock Data
        const isBetterTeam = teamId === 't1';
        return new Promise(resolve => setTimeout(() => resolve({
            team_id: teamId,
            team_name: isBetterTeam ? "Séniors A" : "Vétérans",
            matches_played: 18,
            wins: isBetterTeam ? 12 : 5,
            draws: isBetterTeam ? 3 : 4,
            losses: isBetterTeam ? 3 : 9,
            goals_for: isBetterTeam ? 45 : 22,
            goals_against: isBetterTeam ? 18 : 35,
            clean_sheets: isBetterTeam ? 8 : 2,
            form: isBetterTeam ? ['W', 'W', 'D', 'W', 'L'] : ['L', 'L', 'D', 'W', 'L'],
            by_competition: [
                { 
                    competition_name: 'Championnat', 
                    matches_played: 12, 
                    wins: isBetterTeam ? 8 : 3, 
                    draws: 2, 
                    losses: isBetterTeam ? 2 : 7, 
                    goals_for: isBetterTeam ? 28 : 12, 
                    goals_against: isBetterTeam ? 10 : 25 
                },
                { 
                    competition_name: 'Coupe', 
                    matches_played: 3, 
                    wins: isBetterTeam ? 2 : 0, 
                    draws: 1, 
                    losses: isBetterTeam ? 0 : 2, 
                    goals_for: isBetterTeam ? 8 : 2, 
                    goals_against: isBetterTeam ? 2 : 6 
                },
                { 
                    competition_name: 'Amical', 
                    matches_played: 3, 
                    wins: 2, 
                    draws: 0, 
                    losses: 1, 
                    goals_for: 9, 
                    goals_against: 6 
                }
            ]
        }), 700));
    },

    getLeaderboards: async (): Promise<LeaderboardsDTO> => {
        // TODO: Replace with real API call
        
        // Mock Data
        const mockPlayer = (id: string, name: string, val: number) => ({ member_id: id, name, value: val, rank: 0 });
        
        const scorers = [
            mockPlayer('1', 'Karim B.', 18),
            mockPlayer('2', 'Kylian M.', 15),
            mockPlayer('3', 'Alex L.', 9),
            mockPlayer('4', 'Memphis D.', 7),
            mockPlayer('5', 'User player', 5),
        ].sort((a,b) => b.value - a.value).map((p, i) => ({...p, rank: i+1}));

        const assists = [
            mockPlayer('3', 'Alex L.', 12),
            mockPlayer('6', 'Kevin D.', 10),
            mockPlayer('1', 'Karim B.', 7),
            mockPlayer('5', 'User player', 3),
        ].sort((a,b) => b.value - a.value).map((p, i) => ({...p, rank: i+1}));

        const active = [
            mockPlayer('5', 'User player', 100),
            mockPlayer('6', 'Kevin D.', 98),
            mockPlayer('2', 'Kylian M.', 95),
            mockPlayer('3', 'Alex L.', 80),
        ].sort((a,b) => b.value - a.value).map((p, i) => ({...p, rank: i+1}));

        return new Promise(resolve => setTimeout(() => resolve({
            top_scorers: scorers,
            top_assists: assists,
            most_active: active
        }), 800));
    }
};
