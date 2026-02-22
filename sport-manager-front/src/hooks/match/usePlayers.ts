import { useMemo } from 'react';
import { EventDetailDTO } from '../../services/eventService';
import { MemberDTO } from '../../services/memberService';
import { MatchLineupDTO } from '../../services/sportService';

export const usePlayers = (
    event: EventDetailDTO | null | undefined,
    teamMembers: MemberDTO[] | undefined,
    matchLineup?: MatchLineupDTO | null
) => {
    const lineupMemberIdSet = useMemo(() => {
        const ids = new Set<string>();
        (matchLineup?.items || []).forEach(i => {
            if (i.member_id) ids.add(i.member_id);
        });
        return ids;
    }, [matchLineup?.items]);

    const sourceList = useMemo(() => {
        // Si une compo existe (items non vides), elle définit l'effectif pertinent.
        // On préfère filtrer depuis teamMembers (plus complet) si disponible.
        if (lineupMemberIdSet.size > 0) {
            if (teamMembers && teamMembers.length > 0) {
                return teamMembers.filter(m => lineupMemberIdSet.has(m.member_id));
            }
            if (event?.participants && event.participants.length > 0) {
                return event.participants.filter(p => lineupMemberIdSet.has(p.member_id));
            }
        }

        // Sinon: logique existante basée sur participants (sélection/presence) puis roster.
        if (event?.participants && event.participants.length > 0) {
            const selectedParticipants = event.participants.filter(
                p => p.status === 'present' || p.status === 'selected'
            );
            return selectedParticipants.length > 0 ? selectedParticipants : event.participants;
        }

        return teamMembers || [];
    }, [teamMembers, event?.participants, lineupMemberIdSet]);

    const players = useMemo(() => {
        return sourceList.map(m => {
            const isMember = 'team_ids' in m; 
            const participantInfo = event?.participants?.find(ep => ep.member_id === m.member_id);
    
            return {
                id: m.member_id,
                member_id: m.member_id,
                first_name: m.first_name,
                last_name: m.last_name,
                name: `${m.first_name} ${m.last_name}`,
                position: isMember ? (m as MemberDTO).position : ((m as any).position || (m as any).role),
                photo_url: m.photo_url,
                status: participantInfo?.status || 'none',
                rating: participantInfo?.rating,
                motm_votes: participantInfo?.motm_votes,
            };
        });
    }, [sourceList, event?.participants]);

    return players;
};
