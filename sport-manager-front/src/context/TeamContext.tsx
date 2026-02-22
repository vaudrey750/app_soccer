import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { memberService, TeamDTO } from '../services/memberService';

interface TeamContextType {
    teams: TeamDTO[];
    selectedTeam: TeamDTO | null; // null means "All Teams"
    selectTeam: (teamId: string | 'all') => void;
    isLoading: boolean;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const TeamProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [teams, setTeams] = useState<TeamDTO[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<TeamDTO | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTeams = async () => {
            if (!user?.id) {
                setTeams([]);
                setIsLoading(false);
                return;
            }

            try {
                // Fetch teams the user belongs to
                // Mocking this behavior if service not ready or using backend endpoint
                const myTeams = await memberService.getMyTeams(user.id);
                setTeams(myTeams);
                
                // Optional: Restore selection from local storage
                const savedTeamId = localStorage.getItem('selectedTeamId');
                if (savedTeamId && savedTeamId !== 'all') {
                    const found = myTeams.find(t => t.team_id === savedTeamId);
                    if (found) {
                        setSelectedTeam(found);
                    } else {
                        // Clear stale selection
                        localStorage.removeItem('selectedTeamId');
                        // Optional: select first team default?
                        // if (myTeams.length > 0) setSelectedTeam(myTeams[0]);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch user teams", error);
                
                // On error, do not set mock data that might cause confusion with real UUIDs
                // Just clear teams if we want to force empty state, OR keep mock but ensure IDs are not used in API calls?
                // Better to leave empty to indicate connectivity issue
                setTeams([]); 
            } finally {
                setIsLoading(false);
            }
        };

        fetchTeams();
    }, [user]);

    const selectTeam = (teamId: string | 'all') => {
        if (teamId === 'all') {
            setSelectedTeam(null);
            localStorage.removeItem('selectedTeamId');
        } else {
            const team = teams.find(t => t.team_id === teamId);
            if (team) {
                setSelectedTeam(team);
                localStorage.setItem('selectedTeamId', teamId);
            }
        }
    };

    return (
        <TeamContext.Provider value={{ teams, selectedTeam, selectTeam, isLoading }}>
            {children}
        </TeamContext.Provider>
    );
};

export const useTeam = () => {
    const context = useContext(TeamContext);
    if (context === undefined) {
        throw new Error('useTeam must be used within a TeamProvider');
    }
    return context;
};
