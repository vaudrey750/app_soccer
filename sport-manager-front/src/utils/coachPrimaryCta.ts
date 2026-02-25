import type { EventDTO, EventDetailDTO, ParticipantDTO } from '../services/eventService';

export type CoachPrimaryCtaKind =
    | 'open_live'
    | 'finalize_match'
    | 'remind_responses'
    | 'prepare_lineup'
    | 'open_match_center'
    | 'manage_attendance'
    | 'open_event';

export type CoachPrimaryCta = {
    kind: CoachPrimaryCtaKind;
    label: string;
    to: string;
    disabled?: boolean;
    disabledReason?: string;
};

type MinimalEventDetail = Pick<EventDetailDTO, 'event_id' | 'type' | 'start_date' | 'lineup_published' | 'game' | 'participants'>;

const isMatchFinished = (focus: EventDTO, detail: MinimalEventDetail | undefined) => {
    const statusId = detail?.game?.status_id ?? focus.game?.status_id;
    const status = detail?.game?.status ?? focus.game?.status;
    return statusId === 2 || status === 'PLAYED';
};

const isPlayerParticipant = (p: ParticipantDTO) => {
    if (!p.role) return true;
    return p.role === 'MEMBER' || p.role === 'PLAYER';
};

const countNoResponse = (participants: ParticipantDTO[] | undefined) => {
    if (!participants || participants.length === 0) return 0;
    // 6 = convoqué (attente réponse), 5 = sans réponse
    // 1 = incertain (a répondu), 0 = non convoqué / inconnu -> ne doit pas déclencher une relance
    const noResponse = new Set([5, 6]);
    return participants
        .filter(isPlayerParticipant)
        .filter((p) => noResponse.has(p.status_id ?? 0)).length;
};

const shouldPrepareLineup = (focus: EventDTO, detail: MinimalEventDetail | undefined, now: Date) => {
    if (focus.type !== 'match') return false;
    if (detail?.lineup_published) return false;

    const start = new Date(focus.start_date);
    if (Number.isNaN(start.getTime())) return false;
    if (start.getTime() < now.getTime()) return false;

    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.round((startDay - nowDay) / (1000 * 60 * 60 * 24));
    // J-1 / Jour J
    return diffDays === 0 || diffDays === 1;
};

export const getCoachPrimaryCta = (args: {
    focusEvent: EventDTO;
    focusEventDetail?: MinimalEventDetail;
    now?: Date;
    canManageCrossTeam?: boolean;
}): CoachPrimaryCta => {
    const { focusEvent, focusEventDetail } = args;
    const now = args.now ?? new Date();

    const eventId = focusEvent.event_id;
    const isLive = (focusEventDetail?.game?.status_id ?? focusEvent.game?.status_id) === 5;
    const awaitingResponses = countNoResponse(focusEventDetail?.participants);

    if (focusEvent.type === 'match') {
        if (isLive) {
            return {
                kind: 'open_live',
                label: 'Ouvrir le live',
                to: `/match-center/${eventId}?tab=live`,
            };
        }

        if (isMatchFinished(focusEvent, focusEventDetail)) {
            return {
                kind: 'finalize_match',
                label: 'Finaliser le match',
                to: `/match-center/${eventId}?tab=live`,
            };
        }

        if (awaitingResponses > 0) {
            return {
                kind: 'remind_responses',
                label: 'Relancer les réponses',
                to: `/convocations?eventId=${encodeURIComponent(eventId)}`,
            };
        }

        if (shouldPrepareLineup(focusEvent, focusEventDetail, now)) {
            return {
                kind: 'prepare_lineup',
                label: 'Préparer la compo',
                to: `/match-center/${eventId}?tab=tactics`,
            };
        }

        return {
            kind: 'open_match_center',
            label: 'Ouvrir Match Center',
            to: `/match-center/${eventId}`,
        };
    }

    if (focusEvent.type === 'training' || focusEvent.type === 'tournament') {
        return {
            kind: awaitingResponses > 0 ? 'remind_responses' : 'manage_attendance',
            label: awaitingResponses > 0 ? 'Relancer les réponses' : 'Gérer les présences',
            to: `/convocations?eventId=${encodeURIComponent(eventId)}`,
        };
    }

    return {
        kind: 'open_event',
        label: 'Voir le détail',
        to: `/events/${eventId}`,
    };
};
