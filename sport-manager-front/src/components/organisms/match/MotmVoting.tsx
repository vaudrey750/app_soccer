import React from 'react';
import { Star, ThumbsUp } from 'lucide-react';

interface MotmVotingProps {
    players: any[];
    votes: Record<string, number>;
    selectedPlayerId?: string | null;
    onVote: (playerId: string) => void;
    hasVoted: boolean;
    isVoting: boolean;

    // Coach selection (seulement si aucun vote ou égalité)
    canCoachSelect?: boolean;
    coachSelectedPlayerId?: string | null;
    coachSelectableIds?: string[];
    onCoachSelect?: (playerId: string) => void;
    isSelectingCoach?: boolean;
}

export const MotmVoting: React.FC<MotmVotingProps> = ({
    players,
    votes,
    selectedPlayerId,
    onVote,
    hasVoted,
    isVoting,
    canCoachSelect = false,
    coachSelectedPlayerId,
    coachSelectableIds,
    onCoachSelect,
    isSelectingCoach = false,
}) => {
    return (
        <div className="divide-y divide-slate-700/50">
            {players.map(p => (
                <div key={p.id} className="flex items-center justify-between py-4 group">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden shadow-lg">
                                {p.photo_url ? (
                                    <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-lg font-bold text-slate-500">{p.name.charAt(0)}</span>
                                )}
                            </div>
                            
                            {votes[p.id] > 0 && (
                                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-900 flex items-center gap-0.5">
                                    <ThumbsUp size={8} />
                                    {votes[p.id]}
                                </div>
                            )}
                        </div>
                        
                        <div>
                            <div className="font-medium text-white group-hover:text-amber-400 transition-colors text-lg">
                                {p.name}
                            </div>
                            <div className="text-sm text-slate-400">
                                {[p.position, p.number ? `N° ${p.number}` : null].filter(Boolean).join(' • ')}
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        {!hasVoted && (
                            <button 
                                onClick={() => onVote(p.id)}
                                disabled={isVoting}
                                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-3 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 border border-amber-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label={`Voter pour ${p.name}`}
                                title="Voter"
                            >
                                <Star size={16} className="fill-current" />
                            </button>
                        )}
                        {selectedPlayerId && p.id === selectedPlayerId && (
                            <button 
                                onClick={() => onVote(p.id)}
                                disabled={isVoting}
                                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-3 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 border border-amber-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label={`Votre vote: ${p.name}`}
                                title="Votre vote"
                            >
                                <Star size={16} className="fill-current"/>
                            </button>
                        )}

                        {canCoachSelect && (!Array.isArray(coachSelectableIds) || coachSelectableIds.includes(p.id)) && (
                            <button
                                onClick={() => onCoachSelect?.(p.id)}
                                disabled={isSelectingCoach}
                                className={
                                    (coachSelectedPlayerId && p.id === coachSelectedPlayerId)
                                        ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-3 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 border border-emerald-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        : "bg-slate-700/30 hover:bg-slate-700/50 text-slate-200 px-3 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 border border-slate-600/40 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                }
                                aria-label={`Choisir (coach) ${p.name}`}
                                title="Choix coach"
                            >
                                <Star size={16} className={(coachSelectedPlayerId && p.id === coachSelectedPlayerId) ? "fill-current" : ""} />
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
export default MotmVoting;
