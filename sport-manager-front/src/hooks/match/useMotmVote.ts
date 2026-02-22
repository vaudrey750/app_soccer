import { useCallback, useEffect, useMemo, useState } from 'react';
import { EventDetailDTO } from '../../services/eventService';

const VOTE_WINDOW_SEC = 30 * 60;

const parseApiUtcDateMs = (value: string | null | undefined): number => {
    if (!value) return NaN;
    const trimmed = value.trim();
    const normalizedFraction = trimmed.replace(/(\.\d{3})\d+/, '$1');
    // If API returns a naive ISO string (no timezone), assume UTC.
    const hasTimezone = /[zZ]$|[+-]\d{2}:\d{2}$/.test(normalizedFraction);
    return Date.parse(hasTimezone ? normalizedFraction : `${normalizedFraction}Z`);
};

type VoteMotmFn = (vars: { eventId: string; memberId: string }) => Promise<unknown>;

export const useMotmVote = (
    eventId: string | undefined,
    event: EventDetailDTO | null | undefined,
    canManage: boolean | null,
    voteMotm: VoteMotmFn
) => {
    const [selectedMotmPlayerId, setSelectedMotmPlayerId] = useState<string | null>(null);
    const [motmTimer, setMotmTimer] = useState<number>(0);
    const [isMotmOpen, setIsMotmOpen] = useState(false);
    const [isMotmVoteWindowOpen, setIsMotmVoteWindowOpen] = useState(false);

    const hasVotedMotm = Boolean(event?.my_motm_vote_member_id || selectedMotmPlayerId);

    useEffect(() => {
        // Synchronise l'état local avec la valeur persistée en DB (API)
        const fromApi = event?.my_motm_vote_member_id;
        if (fromApi === undefined) return;
        setSelectedMotmPlayerId(fromApi ?? null);
    }, [event?.my_motm_vote_member_id]);

    const isMatchFinished = useMemo(() => {
        if (!event) return false;
        if (event.status === 'finished') return true;
        if (event.game?.status_id === 2) return true;
        return false;
    }, [event]);

    useEffect(() => {
        const gameId = event?.game?.game_id;
        if (!gameId) return;

        if (!isMatchFinished) {
            setMotmTimer(0);
            setIsMotmOpen(false);
            setIsMotmVoteWindowOpen(false);
            return;
        }

        const localKey = `motm_local_finish_${gameId}`;
        const endDateMs = parseApiUtcDateMs(event?.end_date);
        const hasValidEndDate = Number.isFinite(endDateMs);

        let finishTimeMs: number | null = null;
        if (hasValidEndDate) {
            finishTimeMs = endDateMs;
        } else {
            const stored = localStorage.getItem(localKey);
            if (stored) {
                const parsed = parseInt(stored, 10);
                if (Number.isFinite(parsed)) finishTimeMs = parsed;
            }

            if (finishTimeMs == null) {
                finishTimeMs = Date.now();
                localStorage.setItem(localKey, finishTimeMs.toString());
            }
        }

        const tick = () => {
            const now = Date.now();
            const elapsedSec = Math.max(0, Math.floor((now - (finishTimeMs as number)) / 1000));
            const remaining = VOTE_WINDOW_SEC - elapsedSec;

            const windowOpen = remaining > 0;
            setIsMotmVoteWindowOpen(windowOpen);

            // UI: on n'ouvre la fenêtre de vote que pour les membres qui n'ont pas voté
            const canShowVoteUi = windowOpen && !canManage && !hasVotedMotm;
            setIsMotmOpen(canShowVoteUi);
            setMotmTimer(canShowVoteUi ? remaining : 0);
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [event?.game?.game_id, event?.end_date, canManage, hasVotedMotm, isMatchFinished]);

    const handleVoteMotm = useCallback(
        async (playerMemberId: string) => {
            if (!eventId) return;
            if (!isMotmOpen) return;
            if (canManage) return;
            if (hasVotedMotm) return;

            await voteMotm({ eventId, memberId: playerMemberId });
            setSelectedMotmPlayerId(playerMemberId);
            setIsMotmOpen(false);
            setMotmTimer(0);
        },
        [eventId, isMotmOpen, canManage, hasVotedMotm, voteMotm]
    );

    return { hasVotedMotm, selectedMotmPlayerId, motmTimer, isMotmOpen, isMotmVoteWindowOpen, handleVoteMotm };
};
