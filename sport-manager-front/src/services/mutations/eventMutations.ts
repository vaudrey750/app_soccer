import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eventService } from '../eventService';
import { sportService } from '../sportService';

export const useUpdateMatchStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ eventId, statusId }: { eventId: string; statusId: number }) => 
            sportService.updateMatchStatus(eventId, statusId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['matchEvent', variables.eventId] });
        },
    });
};

export const useAddTimelineEvent = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ eventId, payload }: { eventId: string; payload: any }) => 
            eventService.addTimelineEvent(eventId, payload),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['matchEvent', variables.eventId] });
        },
    });
};

export const useDeleteTimelineEvent = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ eventId, timelineId }: { eventId: string; timelineId: string }) => 
            eventService.deleteTimelineEvent(eventId, timelineId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['matchEvent', variables.eventId] });
        },
    });
};

export const useUpdateMatchPossession = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ eventId, homePossession }: { eventId: string; homePossession: number }) =>
            eventService.updateMatchPossession(eventId, homePossession),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['matchEvent', variables.eventId] });
        },
    });
};

export const useUpdatePlayerRatings = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ eventId, payload }: { eventId: string; payload: any[] }) => 
            eventService.updatePlayerRatings(eventId, payload),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['matchEvent', variables.eventId] });
        },
    });
};

export const useVoteMotm = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ eventId, memberId }: { eventId: string; memberId: string }) => 
            eventService.voteForMotm(eventId, memberId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['matchEvent', variables.eventId] });
        },
    });
};

export const useResetMatch = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ eventId }: { eventId: string }) => eventService.resetMatch(eventId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['matchEvent', variables.eventId] });
        },
    });
};

export const useSelectMotmByCoach = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ eventId, memberId }: { eventId: string; memberId: string }) =>
            eventService.selectMotmByCoach(eventId, memberId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['matchEvent', variables.eventId] });
        },
    });
};

export const useUpdateMatchLineup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ eventId, payload }: { eventId: string; payload: any }) => 
            sportService.updateMatchLineup(eventId, payload),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['matchLineup', variables.eventId] });
        },
    });
};

export const usePublishMatchLineup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ eventId, isPublished }: { eventId: string; isPublished: boolean }) => 
            sportService.publishMatchLineup(eventId, isPublished),
        onSuccess: (_, variables) => {
            queryClient.setQueryData(['matchLineup', variables.eventId], (prev: any) => {
                if (!prev) return prev;
                return { ...prev, lineup_published: variables.isPublished };
            });
            queryClient.setQueryData(['matchEvent', variables.eventId], (prev: any) => {
                if (!prev) return prev;
                return { ...prev, lineup_published: variables.isPublished };
            });
            queryClient.invalidateQueries({ queryKey: ['matchLineup', variables.eventId] });
            queryClient.invalidateQueries({ queryKey: ['matchEvent', variables.eventId] });
        },
    });
};
