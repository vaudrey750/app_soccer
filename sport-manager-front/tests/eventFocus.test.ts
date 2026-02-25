import { describe, expect, it } from 'vitest';
import { pickFocusEvent } from '../src/utils/eventFocus';
import type { EventDTO } from '../src/services/eventService';

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

describe('pickFocusEvent', () => {
    it('prioritise un match LIVE', () => {
        const now = new Date('2026-01-01T12:00:00.000Z');
        const liveMatch = evt({
            event_id: 'm_live',
            type: 'match',
            start_date: '2026-01-01T11:30:00.000Z',
            game: { game_id: 'g', is_home: true, status_id: 5 },
        });
        const trainingSoon = evt({
            event_id: 't1',
            type: 'training',
            start_date: '2026-01-01T12:10:00.000Z',
        });

        const res = pickFocusEvent([trainingSoon, liveMatch], now);
        expect(res?.event.event_id).toBe('m_live');
        expect(res?.reason).toBe('live_match');
    });

    it('prioritise un match à venir vs entraînement à venir (si aucun live)', () => {
        const now = new Date('2026-01-01T12:00:00.000Z');
        const matchLater = evt({
            event_id: 'm1',
            type: 'match',
            start_date: '2026-01-01T14:00:00.000Z',
            game: { game_id: 'g1', is_home: true },
        });
        const trainingSoon = evt({
            event_id: 't1',
            type: 'training',
            start_date: '2026-01-01T12:10:00.000Z',
        });

        const res = pickFocusEvent([trainingSoon, matchLater], now);
        expect(res?.event.event_id).toBe('m1');
    });

    it('choisit le plus proche dans le même type', () => {
        const now = new Date('2026-01-01T12:00:00.000Z');
        const mSoon = evt({
            event_id: 'm_soon',
            type: 'match',
            start_date: '2026-01-01T12:30:00.000Z',
            game: { game_id: 'g2', is_home: true },
        });
        const mLater = evt({
            event_id: 'm_later',
            type: 'match',
            start_date: '2026-01-01T13:30:00.000Z',
            game: { game_id: 'g3', is_home: true },
        });

        const res = pickFocusEvent([mLater, mSoon], now);
        expect(res?.event.event_id).toBe('m_soon');
    });
});
