import { describe, expect, it } from 'vitest';
import { getCoachPrimaryCta } from '../src/utils/coachPrimaryCta';
import type { EventDTO, EventDetailDTO } from '../src/services/eventService';

const evt = (partial: Partial<EventDTO>): EventDTO => ({
    event_id: partial.event_id ?? 'e',
    title: partial.title ?? 'Evt',
    start_date: partial.start_date ?? new Date().toISOString(),
    type: partial.type ?? 'other',
    status: partial.status ?? 'none',
    status_id: partial.status_id,
    end_date: partial.end_date,
    team_id: partial.team_id,
    location: partial.location,
    description: partial.description,
    lineup_published: partial.lineup_published,
    game: partial.game,
    participants: partial.participants,
});

const detail = (partial: Partial<EventDetailDTO>): EventDetailDTO => ({
    ...(evt(partial) as any),
    participants: partial.participants ?? [],
    my_motm_vote_member_id: partial.my_motm_vote_member_id ?? null,
    motm_id: partial.motm_id ?? null,
    coach_motm_member_id: partial.coach_motm_member_id ?? null,
});

describe('getCoachPrimaryCta', () => {
    it('retourne "Ouvrir le live" si match live', () => {
        const focus = evt({
            event_id: 'm1',
            type: 'match',
            start_date: '2026-01-01T11:00:00.000Z',
            game: { game_id: 'g', is_home: true, status_id: 5 },
        });

        const cta = getCoachPrimaryCta({ focusEvent: focus });
        expect(cta.kind).toBe('open_live');
        expect(cta.to).toContain('/match-center/m1');
        expect(cta.to).toContain('tab=live');
    });

    it('retourne "Relancer les réponses" si des joueurs attendent', () => {
        const focus = evt({
            event_id: 'm2',
            type: 'match',
            start_date: '2026-01-02T18:00:00.000Z',
            game: { game_id: 'g2', is_home: true, status_id: 1 },
        });
        const d = detail({
            event_id: 'm2',
            type: 'match',
            start_date: focus.start_date,
            participants: [
                { member_id: 'p1', first_name: 'A', last_name: 'B', status: 'selected', status_id: 6 },
                { member_id: 'p2', first_name: 'C', last_name: 'D', status: 'present', status_id: 2 },
            ],
        });

        const cta = getCoachPrimaryCta({ focusEvent: focus, focusEventDetail: d });
        expect(cta.kind).toBe('remind_responses');
        expect(cta.to).toContain('/convocations');
        expect(cta.to).toContain('eventId=m2');
    });

    it('retourne "Finaliser le match" si match terminé', () => {
        const focus = evt({
            event_id: 'm_finished',
            type: 'match',
            start_date: '2026-01-02T18:00:00.000Z',
            game: { game_id: 'g_finished', is_home: true, status_id: 2 },
        });

        const cta = getCoachPrimaryCta({ focusEvent: focus });
        expect(cta.kind).toBe('finalize_match');
        expect(cta.label).toBe('Finaliser le match');
        expect(cta.to).toContain('/match-center/m_finished');
        expect(cta.to).toContain('tab=live');
    });

    it('ne retourne pas "Relancer" si seulement des incertains (statut 1)', () => {
        const focus = evt({
            event_id: 'm2b',
            type: 'match',
            start_date: '2026-01-02T18:00:00.000Z',
            game: { game_id: 'g2b', is_home: true, status_id: 1 },
        });
        const d = detail({
            event_id: 'm2b',
            type: 'match',
            start_date: focus.start_date,
            participants: [
                { member_id: 'p1', first_name: 'A', last_name: 'B', status: 'maybe', status_id: 1 },
                { member_id: 'p2', first_name: 'C', last_name: 'D', status: 'present', status_id: 2 },
            ],
        });

        const cta = getCoachPrimaryCta({ focusEvent: focus, focusEventDetail: d });
        expect(cta.kind).not.toBe('remind_responses');
    });

    it('retourne "Préparer la compo" si match proche et compo non publiée', () => {
        const now = new Date('2026-01-01T12:00:00.000Z');
        const focus = evt({
            event_id: 'm3',
            type: 'match',
            start_date: '2026-01-02T06:00:00.000Z', // +18h
            game: { game_id: 'g3', is_home: true, status_id: 1 },
        });
        const d = detail({
            event_id: 'm3',
            type: 'match',
            start_date: focus.start_date,
            lineup_published: false,
            participants: [],
        });

        const cta = getCoachPrimaryCta({ focusEvent: focus, focusEventDetail: d, now });
        expect(cta.kind).toBe('prepare_lineup');
        expect(cta.to).toContain('/match-center/m3');
        expect(cta.to).toContain('tab=tactics');
    });
});
