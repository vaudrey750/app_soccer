import { useState, useEffect } from 'react';
import { TimelineEventDTO } from '../../services/eventService';
import { FormationDTO } from '../../services/sportService';
import { computePitchState } from './pitchStateModel';

export const usePitchState = (
    timeline: TimelineEventDTO[],
    currentLineup: { [positionId: number]: string },
    formations: FormationDTO[] | undefined,
    savedLineupId: number | null,
    players: any[]
) => {
    const [playersOnPitch, setPlayersOnPitch] = useState<Set<string>>(new Set());
    const [excludedPlayers, setExcludedPlayers] = useState<Set<string>>(new Set());

    useEffect(() => {
        const rebuildPitch = () => {
             const { playersOnPitch: currentPitch, excludedPlayers: currentExcluded } = computePitchState({
                 timeline,
                 currentLineup,
                 formations,
                 savedLineupId,
                 players,
             });
             
             setPlayersOnPitch(prev => {
                 if (prev.size === currentPitch.size && [...prev].every(id => currentPitch.has(id))) {
                     return prev;
                 }
                 return currentPitch;
             });

             setExcludedPlayers(prev => {
                 if (prev.size === currentExcluded.size && [...prev].every(id => currentExcluded.has(id))) {
                     return prev;
                 }
                 return currentExcluded;
             });
        };
        
        rebuildPitch();
    }, [timeline, currentLineup, formations, savedLineupId, players.length]);

    return { playersOnPitch, excludedPlayers };
};
