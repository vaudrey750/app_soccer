import { describe, expect, it } from 'vitest';
import { getPresenceSummary } from '../src/utils/presenceSummary';
import type { ParticipantDTO } from '../src/services/eventService';

const p = (partial: Partial<ParticipantDTO>): ParticipantDTO => ({
    member_id: partial.member_id ?? 'm',
    first_name: partial.first_name ?? 'Prenom',
    last_name: partial.last_name ?? 'Nom',
    role: partial.role,
    photo_url: partial.photo_url,
    position: partial.position,
    status: partial.status ?? 'none',
    status_id: partial.status_id ?? 0,
    rating: partial.rating,
    motm_votes: partial.motm_votes,
});

describe('getPresenceSummary', () => {
    it('calcule les 4 catégories selon status_id', () => {
        const summary = getPresenceSummary([
            p({ member_id: 'a', status_id: 2 }),
            p({ member_id: 'b', status_id: 1 }),
            p({ member_id: 'c', status_id: 3 }),
            p({ member_id: 'd', status_id: 4 }),
            p({ member_id: 'e', status_id: 6 }),
            p({ member_id: 'f', status_id: 5 }),
        ]);

        expect(summary.totalPlayers).toBe(6);
        expect(summary.confirmedCount).toBe(1);
        expect(summary.uncertainCount).toBe(1);
        expect(summary.absentCount).toBe(2);
        expect(summary.noResponseCount).toBe(2);
    });

    it('ignore les non-joueurs (coach/admin) si role renseigné', () => {
        const summary = getPresenceSummary([
            p({ member_id: 'a', role: 'COACH', status_id: 6 }),
            p({ member_id: 'b', role: 'PLAYER', status_id: 6 }),
        ]);

        expect(summary.totalPlayers).toBe(1);
        expect(summary.noResponseCount).toBe(1);
        expect(summary.noResponseParticipants[0]?.member_id).toBe('b');
    });

    it('trie les sans réponse par nom/prénom (ordre alphabétique)', () => {
        const summary = getPresenceSummary([
            p({ member_id: 'a', first_name: 'Zoé', last_name: 'Dupont', status_id: 6 }),
            p({ member_id: 'b', first_name: 'Alex', last_name: 'Bernard', status_id: 5 }),
            p({ member_id: 'c', first_name: 'Bruno', last_name: 'Bernard', status_id: 6 }),
        ]);

        expect(summary.noResponseParticipants.map((x) => x.member_id)).toEqual(['b', 'c', 'a']);
    });
});
