import { TimelineEventDTO } from '../../services/eventService';
import { FormationDTO } from '../../services/sportService';

const normalizeId = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
        const v = value.trim();
        return v.length > 0 ? v : undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return undefined;
};

const getReplacementInId = (evt: TimelineEventDTO): string | undefined =>
    normalizeId((evt as any)?.player_id) ?? normalizeId((evt as any)?.extra_data?.player_id ?? (evt as any)?.extra_data?.in_member_id);

const getReplacementOutId = (evt: TimelineEventDTO): string | undefined =>
    normalizeId((evt as any)?.assist_id) ?? normalizeId((evt as any)?.extra_data?.assist_id ?? (evt as any)?.extra_data?.out_member_id);

const getRedCardMemberId = (evt: TimelineEventDTO): string | undefined =>
    normalizeId((evt as any)?.player_id) ??
    normalizeId((evt as any)?.assist_id) ??
    normalizeId((evt as any)?.extra_data?.member_id) ??
    normalizeId((evt as any)?.extra_data?.player_id);

export const computePitchState = (args: {
    timeline: TimelineEventDTO[];
    currentLineup: { [positionId: number]: string };
    formations?: FormationDTO[];
    savedLineupId: number | null;
    players: any[];
}) => {
    const { timeline, currentLineup, formations, savedLineupId, players } = args;

    let currentPitch = new Set<string>();
    const currentExcluded = new Set<string>();

    // 1) Lineup -> pitch
    if (savedLineupId && formations && formations.length > 0) {
        const currentFormation = formations.find((f) => f.id === savedLineupId);
        if (currentFormation) {
            const pitchPositions = currentFormation.positions.filter((p) => !p.role.startsWith('B') && p.role !== 'RES');
            pitchPositions.forEach((p) => {
                if (currentLineup[p.id]) currentPitch.add(currentLineup[p.id]);
            });
        }
    } else {
        const available = players
            .filter((p) => p.status === 'present' || p.status === 'selected')
            .map((p) => p.member_id);
        if (available.length > 0) {
            available.forEach((id) => currentPitch.add(id));
        }
    }

    // 2) Timeline replay
    const sorted = [...timeline].sort((a, b) => (a.minute || 0) - (b.minute || 0));
    sorted.forEach((evt) => {
        if (evt.action_type_id === 4) {
            const inId = getReplacementInId(evt);
            const outId = getReplacementOutId(evt);

            // Un joueur exclu ne peut pas être remplacé => ignore
            if (outId && currentExcluded.has(outId)) return;

            // Un joueur exclu ne peut jamais (re)entrer.
            if (inId && !currentExcluded.has(inId)) currentPitch.add(inId);

            if (outId) currentPitch.delete(outId);
        } else if (evt.action_type_id === 3) {
            const redId = getRedCardMemberId(evt);
            if (redId) {
                currentExcluded.add(redId);
                // l'exclu reste sur le terrain
            }
        }
    });

    return { playersOnPitch: currentPitch, excludedPlayers: currentExcluded };
};
