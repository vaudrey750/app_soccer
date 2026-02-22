import { useQuery } from '@tanstack/react-query';
import { eventService } from '../eventService';
import { sportService } from '../sportService';
import { memberService } from '../memberService';

export const useMatchEvent = (id: string | undefined) => {
    return useQuery({
        queryKey: ['matchEvent', id],
        queryFn: () => eventService.getEvent(id!),
        enabled: !!id,
        staleTime: 5000, // 5 seconds
    });
};

export const useMatchLineup = (id: string | undefined) => {
    return useQuery({
        queryKey: ['matchLineup', id],
        queryFn: () => sportService.getMatchLineup(id!),
        enabled: !!id,
        retry: false, // Don't retry if lineup doesn't exist yet
    });
};

export const useFormations = () => {
    return useQuery({
        queryKey: ['formations'],
        queryFn: () => sportService.getFormations(),
        staleTime: Infinity, // Formations rarely change
    });
};

export const useTeamMembers = (teamId: string | undefined) => {
    return useQuery({
        queryKey: ['teamMembers', teamId],
        queryFn: async () => {
            const allMembers = await memberService.getMembers();
            return allMembers.filter(m => m.team_ids?.includes(teamId!));
        },
        enabled: !!teamId,
    });
};
