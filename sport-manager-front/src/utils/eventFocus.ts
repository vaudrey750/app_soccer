import type { EventDTO } from '../services/eventService';

export type FocusReason =
    | 'live_match'
    | 'upcoming_match'
    | 'upcoming_training'
    | 'upcoming_other';

export interface FocusResult {
    event: EventDTO;
    reason: FocusReason;
}

const HOURS_4_MS = 4 * 60 * 60 * 1000;

const getEventStartMs = (evt: EventDTO): number => new Date(evt.start_date).getTime();

const isLiveMatch = (evt: EventDTO, nowMs: number): boolean => {
    if (evt.type !== 'match') return false;
    if (evt.game?.status_id === 5) return true;

    // Fallback heuristic: treat a very recent match as “live-ish” for focus.
    const startMs = getEventStartMs(evt);
    return startMs <= nowMs && nowMs - startMs <= HOURS_4_MS;
};

const typeBaseScore = (type: EventDTO['type']): { base: number; reason: FocusReason } => {
    if (type === 'match') return { base: 900_000, reason: 'upcoming_match' };
    if (type === 'training') return { base: 800_000, reason: 'upcoming_training' };
    return { base: 700_000, reason: 'upcoming_other' };
};

/**
 * Picks a single “focus event” from a list.
 * Priority:
 * 1) Live match (game.status_id === 5 or started within ~4h)
 * 2) Upcoming event, scoring by type (match > training > other) and proximity in time.
 */
export const pickFocusEvent = (events: EventDTO[], now: Date = new Date()): FocusResult | null => {
    const nowMs = now.getTime();
    const candidates = events
        .filter(e => Boolean(e?.start_date))
        .filter(e => {
            const startMs = getEventStartMs(e);
            // Upcoming or started recently (to keep “live” matches in the pool).
            return startMs >= nowMs || nowMs - startMs <= HOURS_4_MS;
        });

    if (candidates.length === 0) return null;

    const liveMatches = candidates
        .filter(e => isLiveMatch(e, nowMs))
        .sort((a, b) => getEventStartMs(a) - getEventStartMs(b));
    if (liveMatches.length > 0) return { event: liveMatches[0], reason: 'live_match' };

    let best: { score: number; evt: EventDTO; reason: FocusReason } | null = null;
    for (const evt of candidates) {
        const startMs = getEventStartMs(evt);
        const deltaMinutes = Math.max(0, Math.round((startMs - nowMs) / 60000));
        const { base, reason } = typeBaseScore(evt.type);
        const score = base - deltaMinutes; // earlier beats later within same type

        if (!best || score > best.score) {
            best = { score, evt, reason };
            continue;
        }

        // Tie-breaker: earlier start wins
        if (score === best.score && startMs < getEventStartMs(best.evt)) {
            best = { score, evt, reason };
        }
    }

    return best ? { event: best.evt, reason: best.reason } : null;
};
