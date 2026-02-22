import React, { useMemo, useState } from 'react';
import { Trophy, Star, Activity, Users, Shield, Target, Zap } from 'lucide-react';
import PlayerRatings from './PlayerRatings';
import { Card } from '../../atoms/Card';
import { MATCH_ACTIONS } from '../../../constants/match';

interface PostMatchPanelProps {
    event: any;
    players: any[];
    matchStats: any;
    canManage: boolean | null;
    onSaveRatings: (ratings: Record<string, number>) => Promise<void>;
    isSavingRatings: boolean;
}

export const PostMatchPanel: React.FC<PostMatchPanelProps> = ({
    event, players, matchStats, canManage, onSaveRatings, isSavingRatings
}) => {
    const [pendingRatings, setPendingRatings] = useState<Record<string, number>>({});

    const parseBoolish = (value: unknown): boolean | undefined => {
        if (value === true || value === 1) return true;
        if (value === false || value === 0) return false;
        if (typeof value === 'string') {
            const v = value.trim().toLowerCase();
            if (v === '1' || v === 'true') return true;
            if (v === '0' || v === 'false') return false;
        }
        return undefined;
    };

    const ourIsHome = parseBoolish((event as any)?.game?.is_home) ?? true;

    const isFinished = event?.game?.status_id === 2 || event?.game?.status === 'PLAYED';

    const timeline = useMemo(() => {
        const raw = (event as any)?.game?.timeline;
        if (!Array.isArray(raw)) return [];
        return [...raw].sort((a: any, b: any) => (b?.minute ?? 0) - (a?.minute ?? 0));
    }, [event]);

    const getPlayerName = (memberId: string | undefined) => {
        if (!memberId) return undefined;
        const p = players.find((x: any) => x?.member_id === memberId);
        if (!p) return undefined;
        const first = (p.first_name ?? '').trim();
        const last = (p.last_name ?? '').trim();
        return `${first} ${last}`.trim() || undefined;
    };

    const formatMinute = (m: unknown) => {
        const v = typeof m === 'number' && Number.isFinite(m) ? m : 0;
        return `${Math.max(0, Math.floor(v))}'`;
    };

    const ratedPlayers = useMemo(() => {
        return players.map(p => ({
            ...p,
            rating: typeof pendingRatings[p.id] === 'number' ? pendingRatings[p.id] : p.rating,
        }));
    }, [players, pendingRatings]);

    const getMotmPlayer = () => {
        if (!event.motm_id) return null;
        return players.find(p => p.id === event.motm_id);
    };

    const motmPlayer = getMotmPlayer();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* En-tête Fin de Match */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700/50 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 mix-blend-overlay"></div>
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl"></div>
                
                <div className="relative z-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mb-4 ring-4 ring-emerald-500/10">
                        <Trophy size={32} />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2">Match Terminé</h2>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Homme du Match */}
                <div className="lg:col-span-1 bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
                            <Star size={20} className="fill-current" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Homme du Match</h3>
                    </div>

                    {motmPlayer ? (
                        <div className="flex flex-col items-center text-center p-6 bg-slate-900/50 rounded-xl border border-amber-500/20 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            
                            <div className="relative mb-4">
                                <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-amber-500/30 flex items-center justify-center overflow-hidden shadow-lg shadow-amber-500/10">
                                    {motmPlayer.photo_url ? (
                                        <img src={motmPlayer.photo_url} alt={motmPlayer.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-3xl font-bold text-slate-600">
                                            {motmPlayer.name.charAt(0)}
                                        </span>
                                    )}
                                </div>
                                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white shadow-lg border-2 border-slate-900">
                                    <Star size={14} className="fill-current" />
                                </div>
                            </div>
                            
                            <h4 className="text-xl font-bold text-white mb-1">{motmPlayer.name}</h4>
                            <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                                <span className="px-2 py-0.5 bg-slate-800 rounded text-xs font-medium border border-slate-700">
                                    {motmPlayer.position}
                                </span>
                                {motmPlayer.number && (
                                    <>
                                        <span>•</span>
                                        <span>N° {motmPlayer.number}</span>
                                    </>
                                )}
                            </div>

                            <div className="w-full grid grid-cols-2 gap-2 mt-2">
                                <div className="bg-slate-800/80 rounded-lg p-2 text-center">
                                    <div className="text-xs text-slate-400 mb-1">Note</div>
                                    <div className="text-lg font-bold text-amber-400">
                                        {typeof motmPlayer.rating === 'number' ? motmPlayer.rating.toFixed(1) : '-'}
                                    </div>
                                </div>
                                <div className="bg-slate-800/80 rounded-lg p-2 text-center">
                                    <div className="text-xs text-slate-400 mb-1">Votes</div>
                                    <div className="text-lg font-bold text-white">
                                        {event.motm_votes?.[motmPlayer.id] || 0}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800 border-dashed">
                            <Star size={32} className="mb-3 opacity-20" />
                            <p>Aucun homme du match désigné</p>
                        </div>
                    )}
                </div>

                {/* Statistiques Globales */}
                <div className="lg:col-span-2 bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                            <Activity size={20} />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Statistiques de l'Équipe</h3>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center group hover:bg-slate-800/80 transition-colors">
                            <Target size={24} className="text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                            <div className="text-2xl font-bold text-white mb-1">{matchStats.goals}</div>
                            <div className="text-xs text-slate-400 uppercase tracking-wider">Buts</div>
                        </div>
                        
                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center group hover:bg-slate-800/80 transition-colors">
                            <Zap size={24} className="text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                            <div className="text-2xl font-bold text-white mb-1">{matchStats.assists ?? 0}</div>
                            <div className="text-xs text-slate-400 uppercase tracking-wider">Passes D.</div>
                        </div>
                        
                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center group hover:bg-slate-800/80 transition-colors">
                            <Shield size={24} className="text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                            <div className="text-2xl font-bold text-white mb-1">{matchStats.saves ?? 0}</div>
                            <div className="text-xs text-slate-400 uppercase tracking-wider">Arrêts</div>
                        </div>
                        
                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center group hover:bg-slate-800/80 transition-colors">
                            <Users size={24} className="text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                            <div className="text-2xl font-bold text-white mb-1">{matchStats.subs}</div>
                            <div className="text-xs text-slate-400 uppercase tracking-wider">Remplacements</div>
                        </div>
                    </div>

                    {isFinished && canManage && (
                        <div className="mt-6 bg-slate-900/50 rounded-xl p-5 border border-slate-700/50">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <h4 className="text-sm font-medium text-slate-300">Notes des joueurs (coach)</h4>
                                <button
                                    onClick={() => onSaveRatings(pendingRatings)}
                                    disabled={isSavingRatings || Object.keys(pendingRatings).length === 0}
                                    className="px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSavingRatings ? 'Enregistrement…' : 'Enregistrer'}
                                </button>
                            </div>

                            <PlayerRatings
                                players={ratedPlayers}
                                onUpdateRatings={setPendingRatings}
                                readOnly={false}
                            />
                        </div>
                    )}

                </div>
            </div>

            <Card className="bg-slate-900 border border-slate-800 text-slate-100">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-100">Timeline</h3>
                    <div className="text-xs text-slate-400">{timeline.length} événement(s)</div>
                </div>

                {timeline.length === 0 ? (
                    <div className="text-sm text-slate-400">Aucun événement pour le moment.</div>
                ) : (
                    <div className="relative">
                        <div className="hidden sm:block absolute left-1/2 top-0 bottom-0 w-px bg-slate-700/60 -translate-x-1/2" />

                        <div className="space-y-6">
                            {timeline.map((evt: any, idx: number) => {
                                const meta = MATCH_ACTIONS.find(a => a.id === evt.action_type_id);
                                const Icon = meta?.icon;
                                const label = meta?.label ?? `Action #${evt.action_type_id}`;

                                const isHomeEventFlag = parseBoolish(evt?.is_home_event);
                                const isOpponentFlag = parseBoolish(evt?.is_opponent);

                                let isHomeEventComputed: boolean | undefined =
                                    isHomeEventFlag !== undefined
                                        ? isHomeEventFlag
                                        : (isOpponentFlag !== undefined ? (isOpponentFlag ? !ourIsHome : ourIsHome) : undefined);

                                if (isHomeEventComputed === undefined) {
                                    const isOurMember = (memberId: unknown) =>
                                        typeof memberId === 'string' && players.some((p: any) => p?.member_id === memberId);

                                    if (isOurMember(evt?.player_id) || isOurMember(evt?.assist_id)) {
                                        isHomeEventComputed = ourIsHome;
                                    } else if (evt?.player_id || evt?.assist_id) {
                                        isHomeEventComputed = !ourIsHome;
                                    }
                                }

                                const isOpponent = isOpponentFlag !== undefined
                                    ? isOpponentFlag
                                    : (isHomeEventComputed !== undefined ? (isHomeEventComputed !== ourIsHome) : false);

                                const side: 'left' | 'right' =
                                    isHomeEventComputed === undefined
                                        ? (idx % 2 === 0 ? 'left' : 'right')
                                        : (isHomeEventComputed ? 'left' : 'right');

                                const playerName = evt?.player_name ?? getPlayerName(evt?.player_id);
                                const assistName = evt?.assist_name ?? getPlayerName(evt?.assist_id);

                                const hasComment = typeof evt?.comment === 'string' && evt.comment.trim().length > 0;

                                const key = evt?.id
                                    ? `evt-${String(evt.id)}`
                                    : `evt-${idx}-${evt?.minute ?? ''}-${evt?.action_type_id ?? ''}-${evt?.player_id ?? ''}-${evt?.assist_id ?? ''}-${evt?.comment ?? ''}`;

                                const content = (
                                    <div className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-3">
                                        <div className="flex items-start gap-2">
                                            {Icon ? (
                                                <span className={meta?.text ?? 'text-slate-600'}>
                                                    <Icon size={16} />
                                                </span>
                                            ) : null}
                                            <div className="min-w-0">
                                                <div className="font-semibold text-slate-100 leading-tight">{label}</div>

                                                {evt?.action_type_id === 4 ? (
                                                    <div className="mt-1 text-sm leading-snug">
                                                        <div className="text-emerald-300 font-semibold">
                                                            Entrée{playerName ? ` : ${playerName}` : ' : —'}
                                                        </div>
                                                        <div className="text-red-300 font-semibold">
                                                            Sortie{assistName ? ` : ${assistName}` : ' : —'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="mt-1 text-sm text-slate-300 leading-snug">
                                                        {isOpponent ? (
                                                            <span className="font-semibold text-slate-300">Adversaire</span>
                                                        ) : playerName ? (
                                                            <span className="font-semibold text-slate-100">{playerName}</span>
                                                        ) : null}
                                                        {!isOpponent && assistName ? (
                                                            <span className="text-slate-400">{` · passe : ${assistName}`}</span>
                                                        ) : null}
                                                    </div>
                                                )}

                                                {hasComment ? (
                                                    <div className="mt-2 text-xs text-slate-400 whitespace-pre-wrap">{evt.comment}</div>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                );

                                return (
                                    <div key={key} className="relative">
                                        <div className="hidden sm:flex items-stretch">
                                            <div className="w-1/2 pr-6 flex justify-end">
                                                {side === 'left' ? <div className="max-w-md w-full">{content}</div> : <div />}
                                            </div>

                                            <div className="w-0 relative">
                                                <div className="absolute left-1/2 -translate-x-1/2 top-1">
                                                    <div className="w-9 h-9 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                                                        <span className="text-xs font-bold text-slate-200">{formatMinute(evt?.minute)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="w-1/2 pl-6 flex justify-start">
                                                {side === 'right' ? <div className="max-w-md w-full">{content}</div> : <div />}
                                            </div>
                                        </div>

                                        <div className="sm:hidden relative pl-10">
                                            <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-700/60" />
                                            <div className="absolute left-0 top-1">
                                                <div className="w-9 h-9 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                                                    <span className="text-xs font-bold text-slate-200">{formatMinute(evt?.minute)}</span>
                                                </div>
                                            </div>
                                            {content}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};
