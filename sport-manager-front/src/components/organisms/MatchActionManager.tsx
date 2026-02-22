import React, { useState } from 'react';
import { Card } from '../../components/atoms/Card';
import { ArrowLeft, Save } from 'lucide-react';
import { cn } from '../../utils/cn';
import { MATCH_ACTIONS } from '../../constants/match';
import { EventDetailDTO } from '../../services/eventService';
import { FormationDTO } from '../../services/sportService';

interface Player {
    member_id: string;
    first_name: string;
    last_name: string;
    status: string;
}

interface MatchActionManagerProps {
    isTimerRunning: boolean;
    minute: number;
    event: EventDetailDTO;
    players: Player[];
    playersOnPitch: Set<string>;
    excludedPlayerIds?: Set<string>;
    formations: FormationDTO[];
    savedLineupId: number | null;
    currentLineup: { [positionId: number]: string };
    onSubmit: (payload: any) => Promise<void>;
    onUpdatePossession?: (homePossession: number) => Promise<void>;
}

export const MatchActionManager: React.FC<MatchActionManagerProps> = ({
    isTimerRunning,
    minute,
    event,
    players,
    playersOnPitch,
    excludedPlayerIds,
    formations,
    savedLineupId,
    currentLineup,
    onSubmit,
    onUpdatePossession
}) => {
    const [selectedAction, setSelectedAction] = useState<number | null>(null);
    const [selectedPlayer, setSelectedPlayer] = useState<string>('');
    const [selectedAssist, setSelectedAssist] = useState<string>('');
    const [selectedSubOut, setSelectedSubOut] = useState<string>('');
    const [comment, setComment] = useState("");
    const [isOpponentAction, setIsOpponentAction] = useState(false);
    const [ourPossessionPct, setOurPossessionPct] = useState<number>(50);

    const ourIsHome = Boolean(event?.game?.is_home ?? true);
    const ourTeamName = ourIsHome ? (event.game?.home_team_name ?? 'Nous') : (event.game?.away_team_name ?? 'Nous');
    const oppTeamName = ourIsHome ? (event.game?.away_team_name ?? 'Adversaire') : (event.game?.home_team_name ?? 'Adversaire');

    // Filter visible actions based on game state (simple simulation of 'visibleActions')
    // In original code, visibleActions was based on canManage only. 
    // Here we assume this component is only rendered if canManage, so all actions are potentially visible.
    
    const handleActionClick = (actionId: number) => {
        setSelectedAction(actionId);
        setSelectedPlayer('');
        setSelectedAssist('');
        setSelectedSubOut('');
        setComment('');
        setIsOpponentAction(false);
        if (actionId === 18) {
            const currentHomePoss = (event?.game as any)?.possession_home;
            if (typeof currentHomePoss === 'number' && Number.isFinite(currentHomePoss)) {
                const clamped = Math.max(0, Math.min(100, Math.round(currentHomePoss)));
                setOurPossessionPct(ourIsHome ? clamped : 100 - clamped);
            } else {
                setOurPossessionPct(50);
            }
        }
    };

    const handleSubmit = async () => {
        if (selectedAction == null) return;

        const isPossessionAction = selectedAction === 18;
        const payload: any = {
            action_type_id: selectedAction,
            minute: minute > 0 ? minute : 1, // Default to 1st minute if 0
            comment: comment || undefined,
            is_opponent: isOpponentAction
        };

        if (isPossessionAction) {
            const clampedOur = Math.max(0, Math.min(100, Math.round(ourPossessionPct)));
            const homePossession = ourIsHome ? clampedOur : 100 - clampedOur;

            // Possession = stat au niveau match (pas timeline)
            if (onUpdatePossession) {
                await onUpdatePossession(homePossession);
            } else {
                // Fallback legacy si pas câblé côté parent
                payload.possession = clampedOur;
                await onSubmit(payload);
            }
            setSelectedAction(null);
            return;
        }
        
        if (!isOpponentAction) {
             if (selectedAction === 4) { // Replacement
                 if (excludedPlayerIds?.has(selectedSubOut)) return;
                 payload.player_id = selectedPlayer; // IN
                 payload.assist_id = selectedSubOut; // OUT (using assist_id field)
             } else {
                 payload.player_id = selectedPlayer;
                 if (selectedAssist) payload.assist_id = selectedAssist;
             }
        }
        
        await onSubmit(payload);
        setSelectedAction(null); // Reset after submit
    };

    const isPossessionAction = selectedAction === 18;
    const isSubAction = selectedAction === 4;
    const requiresPlayer = selectedAction != null && [1, 2, 3, 5, 6].includes(selectedAction);
    const clampedOurPossession = Math.max(0, Math.min(100, Math.round(ourPossessionPct)));
    const displayedPossession = isOpponentAction ? 100 - clampedOurPossession : clampedOurPossession;

    return (
        <>
            {/* ACTIONS GRID */}
            <div className="bg-white rounded-2xl shadow-xl p-4 mb-6 border border-slate-100/50 backdrop-blur-xl">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {MATCH_ACTIONS.map((action) => (
                        <button 
                            key={action.id}
                            disabled={!isTimerRunning} 
                            onClick={() => handleActionClick(action.id)}
                            className={cn(
                                "flex flex-col items-center justify-center gap-2 py-4 rounded-xl transition duration-200 group border border-transparent",
                                (!isTimerRunning) ? "opacity-50 grayscale cursor-not-allowed" : "hover:bg-slate-50 hover:border-slate-100 active:bg-slate-100 active:scale-95 shadow-sm bg-slate-50/50"
                            )}
                        >
                            <div className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md transform transition-transform", 
                                (isTimerRunning) && "group-hover:scale-110",
                                action.color
                            )}>
                                <action.icon size={24} />
                            </div>
                            <span className="text-xs font-bold text-slate-600 leading-tight text-center px-1">{action.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ACTION FORM MODAL (Inline) */}
            {selectedAction && (
                <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <Card className="p-5 border-l-4 border-indigo-500 shadow-xl relative overflow-hidden bg-white/95 backdrop-blur">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                                <div className={cn("w-2 h-2 rounded-full", MATCH_ACTIONS.find(a => a.id === selectedAction)?.color)}></div>
                                <h3 className="font-bold text-slate-800">
                                    {MATCH_ACTIONS.find(a => a.id === selectedAction)?.label} <span className="text-slate-400 font-normal">à la {minute}'</span>
                                </h3>
                            </div>
                            <button onClick={() => setSelectedAction(null)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition"><ArrowLeft size={18} /></button>
                        </div>

                        {/* Team Selection Toggle */}
                        <div className="flex p-1 bg-slate-100 rounded-lg mb-4">
                            <button
                                onClick={() => setIsOpponentAction(false)}
                                className={cn(
                                    "flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all",
                                    !isOpponentAction ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                {ourTeamName} (Nous)
                            </button>
                            <button
                                onClick={() => setIsOpponentAction(true)}
                                className={cn(
                                    "flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all",
                                    isOpponentAction ? "bg-white text-rose-500 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                Adversaire ({oppTeamName})
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {isOpponentAction ? (
                                isPossessionAction ? (
                                    <div>
                                        <div className="flex items-end justify-between gap-3">
                                            <div className="min-w-0">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Possession</label>
                                                <div className="mt-1 flex items-center gap-3 text-sm font-bold">
                                                    <span className={cn("truncate", !isOpponentAction ? "text-indigo-600" : "text-slate-600")}>
                                                        {ourTeamName}: {clampedOurPossession}%
                                                    </span>
                                                    <span className={cn("truncate", isOpponentAction ? "text-rose-600" : "text-slate-600")}>
                                                        {oppTeamName}: {100 - clampedOurPossession}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-sm font-bold text-slate-700 whitespace-nowrap">{displayedPossession}%</div>
                                        </div>

                                        <div className="mt-3">
                                            <input
                                                type="range"
                                                min={0}
                                                max={100}
                                                step={1}
                                                value={displayedPossession}
                                                onChange={(e) => {
                                                    const v = Math.max(0, Math.min(100, Math.round(Number(e.target.value))));
                                                    setOurPossessionPct(isOpponentAction ? 100 - v : v);
                                                }}
                                                className="w-full"
                                                aria-label="Possession"
                                            />

                                            <div className="mt-2 h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                                <div className="h-full bg-indigo-500" style={{ width: `${clampedOurPossession}%` }} />
                                                <div className="h-full bg-rose-500" style={{ width: `${100 - clampedOurPossession}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 text-rose-700 text-sm font-medium">
                                        Action pour l'équipe adverse.
                                    </div>
                                )
                            ) : (
                                <>
                                {isPossessionAction ? (
                                    <div>
                                        <div className="flex items-end justify-between gap-3">
                                            <div className="min-w-0">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Possession</label>
                                                <div className="mt-1 flex items-center gap-3 text-sm font-bold">
                                                    <span className={cn("truncate", !isOpponentAction ? "text-indigo-600" : "text-slate-600")}>
                                                        {ourTeamName}: {clampedOurPossession}%
                                                    </span>
                                                    <span className={cn("truncate", isOpponentAction ? "text-rose-600" : "text-slate-600")}>
                                                        {oppTeamName}: {100 - clampedOurPossession}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-sm font-bold text-slate-700 whitespace-nowrap">{displayedPossession}%</div>
                                        </div>

                                        <div className="mt-3">
                                            <input
                                                type="range"
                                                min={0}
                                                max={100}
                                                step={1}
                                                value={displayedPossession}
                                                onChange={(e) => {
                                                    const v = Math.max(0, Math.min(100, Math.round(Number(e.target.value))));
                                                    setOurPossessionPct(isOpponentAction ? 100 - v : v);
                                                }}
                                                className="w-full"
                                                aria-label="Possession"
                                            />

                                            <div className="mt-2 h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                                <div className="h-full bg-indigo-500" style={{ width: `${clampedOurPossession}%` }} />
                                                <div className="h-full bg-rose-500" style={{ width: `${100 - clampedOurPossession}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                ) : selectedAction === 17 ? (
                                    <div className="space-y-3 mb-4">
                                        <div>
                                            <label className="block text-xs font-bold text-orange-500 mb-1.5 uppercase tracking-wide">Type d'action</label>
                                            <div className="flex flex-wrap gap-2">
                                                {["Arrêt Gardien", "Poteau", "Grosse Occasion", "Note Tactique", "Autre"].map(label => (
                                                    <button
                                                        key={label}
                                                        onClick={() => setComment(label)}
                                                        className={cn(
                                                            "px-3 py-2 text-xs font-bold rounded-lg border transition-all",
                                                            comment === label 
                                                                ? "bg-orange-100 border-orange-300 text-orange-700 shadow-sm transform scale-105" 
                                                                : "bg-white border-slate-200 text-slate-600 hover:border-orange-200 hover:text-orange-600"
                                                        )}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Joueur Concerné (Optionnel)</label>
                                            <select 
                                                className="w-full p-3 bg-slate-50 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                                                aria-label="Joueur concerné"
                                                value={selectedPlayer}
                                                onChange={(e) => setSelectedPlayer(e.target.value)}
                                            >
                                                <option value="">Sélectionner un joueur...</option>
                                                {players.map(p => (
                                                    <option key={p.member_id} value={p.member_id}>
                                                        {p.first_name} {p.last_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ) : selectedAction === 4 ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Player OUT */}
                                            <div>
                                                <label className="block text-xs font-bold text-red-500 mb-1.5 uppercase tracking-wide">Joueur Sortant (OUT)</label>
                                                <select 
                                                    className="w-full p-3 bg-red-50 rounded-xl border border-red-100 text-sm font-bold text-red-700 focus:ring-2 focus:ring-red-200 outline-none"
                                                    aria-label="Joueur sortant"
                                                    value={selectedSubOut}
                                                    onChange={(e) => setSelectedSubOut(e.target.value)}
                                                >
                                                    <option value="">Sélectionner...</option>
                                                    {players
                                                        .filter(p => playersOnPitch.has(p.member_id) && !excludedPlayerIds?.has(p.member_id))
                                                        .map(p => (
                                                        <option key={p.member_id} value={p.member_id}>
                                                            {p.first_name} {p.last_name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Player IN */}
                                            <div>
                                                <label className="block text-xs font-bold text-emerald-500 mb-1.5 uppercase tracking-wide">Joueur Entrant (IN)</label>
                                                <select 
                                                    className="w-full p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-200 outline-none"
                                                    aria-label="Joueur entrant"
                                                    value={selectedPlayer}
                                                    onChange={(e) => setSelectedPlayer(e.target.value)}
                                                >
                                                    <option value="">Sélectionner...</option>
                                                    {players.filter(p => {
                                                        // Must not be on pitch
                                                        if (playersOnPitch.has(p.member_id)) return false;

                                                        // Must not be excluded
                                                        if (excludedPlayerIds?.has(p.member_id)) return false;
                                                        
                                                        // Must be present
                                                        if (p.status !== 'present') return false;

                                                        // Must be on the bench
                                                        // Check if this player is in the current lineup at a Bench position
                                                        // 1. Find the position ID occupied by this player in currentLineup
                                                        const userPosIdStr = Object.keys(currentLineup).find(k => currentLineup[parseInt(k)] === p.member_id);
                                                        if (!userPosIdStr) return false; // Not in lineup at all
                                                        
                                                        // 2. Check if that position is a bench position
                                                        const formation = formations.find(f => f.id === savedLineupId);
                                                        if (!formation) return false;
                                                        
                                                        const positionDef = formation.positions.find(pos => pos.id === parseInt(userPosIdStr));
                                                        return positionDef?.role === 'B' || positionDef?.role.startsWith('B');

                                                    }).map(p => (
                                                        <option key={p.member_id} value={p.member_id}>
                                                            {p.first_name} {p.last_name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Joueur Concerné</label>
                                        <select 
                                            className="w-full p-3 bg-slate-50 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                            aria-label="Joueur concerné"
                                            value={selectedPlayer}
                                            onChange={(e) => setSelectedPlayer(e.target.value)}
                                        >
                                            <option value="">Sélectionner un joueur...</option>
                                            {/* Show only players on pitch for active actions (Goals, Cards) */}
                                            {players
                                                .filter(p => playersOnPitch.has(p.member_id))
                                                .map(p => (
                                                <option key={p.member_id} value={p.member_id}>
                                                    {p.first_name} {p.last_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {selectedAction === 1 && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Passeur (Optionnel)</label>
                                        <select 
                                            className="w-full p-3 bg-slate-50 rounded-xl border-slate-200 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                            aria-label="Passeur"
                                            value={selectedAssist}
                                            onChange={(e) => setSelectedAssist(e.target.value)}
                                        >
                                            <option value="">Aucun passeur</option>
                                            {players
                                                .filter(p => playersOnPitch.has(p.member_id) && p.member_id !== selectedPlayer) // Cannot assist oneself
                                                .map(p => (
                                                <option key={p.member_id} value={p.member_id}>
                                                    {p.first_name} {p.last_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                </>
                            )}
                            
                            {!isPossessionAction && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Commentaire (Optionnel)</label>
                                    <textarea
                                        className="w-full p-3 bg-slate-50 rounded-xl border-slate-200 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all outline-none resize-none"
                                        rows={2}
                                        placeholder="Ajouter un commentaire..."
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            )}

                            <button 
                                onClick={handleSubmit} 
                                data-testid="match-action-submit"
                                disabled={
                                    (!isOpponentAction && requiresPlayer && !selectedPlayer) ||
                                    (!isOpponentAction && isSubAction && (!selectedPlayer || !selectedSubOut || Boolean(excludedPlayerIds?.has(selectedSubOut))))
                                }
                                className={cn(
                                    "w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2",
                                    isOpponentAction && "bg-rose-500 hover:bg-rose-600 shadow-rose-200"
                                )}
                            >
                                <Save size={18} />
                                {isPossessionAction ? "Enregistrer la possession" : selectedAction === 4 && isOpponentAction ? "Noter Remplacement Adversaire" : "Enregistrer l'action"}
                            </button>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
};
