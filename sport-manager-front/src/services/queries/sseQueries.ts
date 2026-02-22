import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EventDetailDTO } from '../eventService';

export const useGameSse = (gameId: string | undefined, eventId: string | undefined) => {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!gameId || !eventId) return;

        const apiUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000/api/v1';
        let sseUrl = '';
        if (apiUrl.startsWith('http')) {
             sseUrl = apiUrl;
        } else if (apiUrl.startsWith('/')) {
             sseUrl = `${window.location.protocol}//${window.location.host}${apiUrl}`;
        } else {
             sseUrl = 'http://localhost:8000/api/v1';
        }
        sseUrl = `${sseUrl}/sport/games/${gameId}/sse`;

        const eventSource = new EventSource(sseUrl);
        
        eventSource.onmessage = (evt) => {
             if (evt.data === ": keep-alive") return;
             
             try {
                const data = JSON.parse(evt.data);
                if (data.type === 'game_update') {
                    // Update local cache optimistically
                    queryClient.setQueryData(['matchEvent', eventId], (oldData: EventDetailDTO | undefined) => {
                        if (!oldData || !oldData.game) return oldData;

                        if (data.action === 'match_reset') {
                            return {
                                ...oldData,
                                end_date: undefined,
                                my_motm_vote_member_id: null,
                                motm_id: null,
                                coach_motm_member_id: null,
                                participants: (oldData.participants || []).map((p) => ({
                                    ...p,
                                    rating: undefined,
                                    motm_votes: 0,
                                })),
                                // Certains écrans utilisent une map `event.motm_votes`
                                ...(typeof (oldData as any).motm_votes === 'object' && (oldData as any).motm_votes
                                    ? { motm_votes: {} as any }
                                    : {}),
                                game: {
                                    ...oldData.game,
                                    score_home: 0,
                                    score_away: 0,
                                    possession_home: null,
                                    status_id: 1,
                                    timer_start_at: undefined,
                                    elapsed_time_at_start: 0,
                                },
                            };
                        }

                        if (data.action === 'motm_selected') {
                            return {
                                ...oldData,
                                motm_id: data.motm_id ?? oldData.motm_id,
                                coach_motm_member_id: data.coach_motm_member_id ?? oldData.coach_motm_member_id,
                            } as any;
                        }

                        if (data.action === 'motm_vote') {
                            const votedId = data.member_id;
                            if (!votedId) return oldData;

                            const totalVotes = typeof data.total_votes === 'number' ? data.total_votes : undefined;
                            return {
                                ...oldData,
                                participants: (oldData.participants || []).map((p) => {
                                    if (p.member_id !== votedId) return p;
                                    const next = typeof totalVotes === 'number'
                                        ? totalVotes
                                        : ((p.motm_votes ?? 0) + 1);
                                    return { ...p, motm_votes: next };
                                }),
                            };
                        }

                        return {
                            ...oldData,
                            game: {
                                ...oldData.game,
                                score_home: data.score_home ?? oldData.game.score_home,
                                score_away: data.score_away ?? oldData.game.score_away,
                                status_id: data.status_id ?? oldData.game.status_id,
                                possession_home: data.possession_home ?? oldData.game.possession_home
                            }
                        };
                    });

                    // Invalidate to fetch full details (timeline, etc.)
                    queryClient.invalidateQueries({ queryKey: ['matchEvent', eventId] });
                    // Lineup est une query séparée utilisée par l'onglet Compo
                    queryClient.invalidateQueries({ queryKey: ['matchLineup', eventId] });
                }
             } catch (e) { 
                 console.error("SSE Parse Error", e); 
             }
        };

        eventSource.onerror = (err) => {
             console.error("SSE Error", err);
        };

        return () => {
             eventSource.close();
        };
    }, [gameId, eventId, queryClient]);
};
