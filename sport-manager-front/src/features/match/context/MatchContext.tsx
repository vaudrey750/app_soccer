// src/features/match/context/MatchContext.tsx
import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useMatchEvent as useMatchQuery } from '../../../services/queries/eventQueries';
import { useMatchEventSource } from '../hooks/useMatchEventSource';
import { EventDetailDTO } from '../../../services/eventService';
import { useAuth } from '../../../context/AuthContext';

interface MatchContextType {
    matchId: string;
    event: EventDetailDTO | undefined;
    isLoading: boolean;
    error: any;
    canManage: boolean;
    isManager: boolean;
    isStaff: boolean;
    selectedTeamId: string | undefined;
    user: any;
}

const MatchContext = createContext<MatchContextType | undefined>(undefined);

export const MatchProvider = ({ matchId, children }: { matchId: string, children: ReactNode }) => {
    const { user } = useAuth();
    
    // Permissions Basics
    const isManager = user ? ['ADMIN', 'MANAGER'].includes(user.role) : false;
    const isStaff = user ? ['COACH', 'ASSISTANT', 'PHYSIO'].includes(user.role) : false;
    const canManage = isManager || isStaff;
    const selectedTeamId = (user as any)?.team_id; // Using any to bypass TS check if team_id missing in type

    const { data: event, isLoading, error } = useMatchQuery(matchId);
    
    // Listen for SSE updates (Timer, Goals, etc.)
    useMatchEventSource(matchId);

    const value = useMemo(() => ({
        matchId,
        event,
        isLoading,
        error: error as any,
        canManage,
        isManager,
        isStaff,
        selectedTeamId,
        user
    }), [matchId, event, isLoading, error, canManage, isManager, isStaff, selectedTeamId, user]);

    return (
        <MatchContext.Provider value={value}>
            {children}
        </MatchContext.Provider>
    );
};

export const useMatchContext = () => {
    const context = useContext(MatchContext);
    if (!context) {
        throw new Error('useMatchContext must be used within a MatchProvider');
    }
    return context;
};
