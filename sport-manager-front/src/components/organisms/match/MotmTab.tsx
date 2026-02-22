import React from 'react';
import { Star } from 'lucide-react';
import MotmVoting from './MotmVoting';

interface MotmTabProps {
    event: any;
    players: any[];
    hasVoted: boolean;
    selectedPlayerId?: string | null;
    handleVoteMotm: (playerId: string) => void;
    isVotingMotm: boolean;
    motmTimer?: number;
    isMotmOpen?: boolean;
    isMotmVoteWindowOpen?: boolean;
    canManage?: boolean | null;
    onCoachSelectMotm?: (playerId: string) => Promise<void> | void;
    isSelectingCoachMotm?: boolean;
}

export const MotmTab: React.FC<MotmTabProps> = ({
    event,
    players,
    hasVoted,
    selectedPlayerId,
    handleVoteMotm,
    isVotingMotm,
    motmTimer = 0,
    isMotmOpen = false,
    isMotmVoteWindowOpen = false,
    canManage = null,
    onCoachSelectMotm,
    isSelectingCoachMotm = false,
}) => {
    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const canVote = isMotmOpen && !canManage && !hasVoted;

    const isMatchFinished = Boolean(
        event?.status === 'finished' || event?.game?.status_id === 2 || event?.game?.status === 'PLAYED'
    );

    const votesMap: Record<string, number> = (players || []).reduce((acc: any, p: any) => {
        const key = p?.id;
        if (!key) return acc;
        const v = typeof p?.motm_votes === 'number' && Number.isFinite(p.motm_votes) ? p.motm_votes : 0;
        acc[key] = v;
        return acc;
    }, {} as Record<string, number>);

    const { totalVotes, topTiedIds } = (() => {
        const values = Object.values(votesMap);
        const total = values.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
        const max = values.length > 0 ? Math.max(...values) : 0;
        const tied = max > 0
            ? Object.entries(votesMap).filter(([, v]) => v === max).map(([id]) => id)
            : [];
        return { totalVotes: total, topTiedIds: tied };
    })();

    const coachSelectableIds = topTiedIds.length > 1 ? topTiedIds : undefined;

    const canCoachSelect = Boolean(
        canManage &&
        isMatchFinished &&
        !isMotmVoteWindowOpen &&
        (totalVotes === 0 || topTiedIds.length > 1) &&
        typeof onCoachSelectMotm === 'function'
    );

    const coachSelectedPlayerId = (event?.coach_motm_member_id ?? null) as string | null;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 backdrop-blur-sm flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
                    <Star size={20} className="fill-current" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-white">Homme du Match</h3>
                    <p className="text-sm text-slate-400">
                        Votez pour le meilleur joueur de la rencontre
                    </p>
                </div>
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 backdrop-blur-sm flex items-center justify-between">
                <div className="text-sm text-slate-300">
                    {canManage
                        ? "Vote réservé aux membres"
                        : hasVoted
                            ? "Vote enregistré"
                            : isMotmOpen
                                ? "Votes ouverts"
                                : "Votes fermés"}
                </div>
                {!canManage && !hasVoted && (
                    <div className="text-sm font-mono font-bold text-amber-400">
                        {isMotmOpen ? formatTime(motmTimer) : '00:00'}
                    </div>
                )}
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
                <MotmVoting 
                    players={players}
                    votes={votesMap}
                    selectedPlayerId={selectedPlayerId}
                    onVote={(playerId) => {
                        if (!canVote) return;
                        handleVoteMotm(playerId);
                    }}
                    hasVoted={!canVote}
                    isVoting={isVotingMotm}
                    canCoachSelect={canCoachSelect}
                    coachSelectedPlayerId={coachSelectedPlayerId}
                    coachSelectableIds={coachSelectableIds}
                    onCoachSelect={async (playerId) => {
                        if (!canCoachSelect) return;
                        await onCoachSelectMotm?.(playerId);
                    }}
                    isSelectingCoach={isSelectingCoachMotm}
                />
            </div>
        </div>
    );
};
