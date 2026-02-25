import type { ParticipantDTO } from '../services/eventService';

export type PresenceSummary = {
    totalPlayers: number;
    confirmedCount: number;
    uncertainCount: number;
    absentCount: number;
    noResponseCount: number;
    noResponseParticipants: ParticipantDTO[];
};

const isPlayerParticipant = (p: ParticipantDTO) => {
    if (!p.role) return true;
    return p.role === 'MEMBER' || p.role === 'PLAYER';
};

// Participation status mapping (backend seed_types.py + coach selection):
// 2 = CONFIRMED (Présent)
// 1 = PENDING (Incertain)
// 3 = DECLINED (Absent)
// 4 = EXCUSED (Absent)
// 6 = SELECTED (Convoqué, attente réponse) => Sans réponse
// 5 = NO RESPONSE => Sans réponse
// 0 = NONE/UNKNOWN (souvent utilisé localement dans la page Convocations pour compléter la liste)
const isNoResponseStatus = (statusId: number | null | undefined) => statusId === 5 || statusId === 6;

export const getPresenceSummary = (participants: ParticipantDTO[] | undefined): PresenceSummary => {
    const players = (participants ?? []).filter(isPlayerParticipant);

    const confirmed = players.filter((p) => p.status_id === 2).length;
    const uncertain = players.filter((p) => p.status_id === 1).length;
    const absent = players.filter((p) => p.status_id === 3 || p.status_id === 4).length;
    const noResponseParticipants = players
        .filter((p) => isNoResponseStatus(p.status_id))
        .sort((a, b) => {
            const last = (a.last_name ?? '').localeCompare(b.last_name ?? '', 'fr', { sensitivity: 'base' });
            if (last !== 0) return last;
            return (a.first_name ?? '').localeCompare(b.first_name ?? '', 'fr', { sensitivity: 'base' });
        });

    return {
        totalPlayers: players.length,
        confirmedCount: confirmed,
        uncertainCount: uncertain,
        absentCount: absent,
        noResponseCount: noResponseParticipants.length,
        noResponseParticipants,
    };
};
