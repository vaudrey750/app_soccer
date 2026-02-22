import { describe, it, expect } from 'vitest';
import { computePitchState } from '../src/hooks/match/pitchStateModel';
import type { FormationDTO } from '../src/services/sportService';
import type { TimelineEventDTO } from '../src/services/eventService';

const formation: FormationDTO = {
    id: 10,
    name: 'Test',
    category: 'test',
    description: 'test',
    positions: [
        {
            id: 1,
            formation_id: 10,
            role: 'GK',
            coord_x: 0,
            coord_y: 0,
            position_label: 'GK',
            priority: 1,
        },
        {
            id: 2,
            formation_id: 10,
            role: 'DEF',
            coord_x: 0,
            coord_y: 0,
            position_label: 'DEF',
            priority: 2,
        },
        {
            id: 50,
            formation_id: 10,
            role: 'B1',
            coord_x: 0,
            coord_y: 0,
            position_label: 'B1',
            priority: 50,
        },
    ],
};

describe('computePitchState', () => {
    it('applique un remplacement (OUT sort du terrain, IN entre)', () => {
        const lineup = { 1: 'A', 2: 'B', 50: 'C' };
        const timeline: TimelineEventDTO[] = [
            { id: 't1', minute: 10, action_type_id: 4, player_id: 'C', assist_id: 'A' },
        ];

        const { playersOnPitch, excludedPlayers } = computePitchState({
            timeline,
            currentLineup: lineup,
            formations: [formation],
            savedLineupId: 10,
            players: [],
        });

        expect(excludedPlayers.size).toBe(0);
        expect(playersOnPitch.has('B')).toBe(true);
        expect(playersOnPitch.has('C')).toBe(true);
        expect(playersOnPitch.has('A')).toBe(false);
    });

    it('un joueur exclu (rouge) reste sur le terrain et ne peut pas être remplacé', () => {
        const lineup = { 1: 'A', 2: 'B', 50: 'C' };
        const timeline: TimelineEventDTO[] = [
            { id: 'r1', minute: 5, action_type_id: 3, player_id: 'B' },
            // tentative de remplacement de B (doit être ignorée)
            { id: 's1', minute: 6, action_type_id: 4, player_id: 'C', assist_id: 'B' },
        ];

        const { playersOnPitch, excludedPlayers } = computePitchState({
            timeline,
            currentLineup: lineup,
            formations: [formation],
            savedLineupId: 10,
            players: [],
        });

        expect(excludedPlayers.has('B')).toBe(true);
        // B reste sur le terrain
        expect(playersOnPitch.has('B')).toBe(true);
        // et C ne doit pas entrer via ce remplacement
        expect(playersOnPitch.has('C')).toBe(false);
    });

    it('un joueur exclu ne peut pas (re)entrer via remplacement', () => {
        const lineup = { 1: 'A', 2: 'B', 50: 'C' };
        const timeline: TimelineEventDTO[] = [
            { id: 'r1', minute: 5, action_type_id: 3, player_id: 'C' },
            // tentative de faire entrer C
            { id: 's1', minute: 6, action_type_id: 4, player_id: 'C', assist_id: 'A' },
        ];

        const { playersOnPitch, excludedPlayers } = computePitchState({
            timeline,
            currentLineup: lineup,
            formations: [formation],
            savedLineupId: 10,
            players: [],
        });

        expect(excludedPlayers.has('C')).toBe(true);
        // C était sur le banc, donc ne doit pas être ajouté
        expect(playersOnPitch.has('C')).toBe(false);
        // A sort du terrain car il n'est pas exclu
        expect(playersOnPitch.has('A')).toBe(false);
    });
});
