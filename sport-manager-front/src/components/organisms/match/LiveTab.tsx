import React, { useMemo } from 'react';
import { MatchActionManager } from '../MatchActionManager';
import { Card } from '../../atoms/Card';
import { MATCH_ACTIONS } from '../../../constants/match';
import { Trash2 } from 'lucide-react';

interface LiveTabProps {
    event: any;
    allPlayers: any[];
    pitchPlayers: any[];
    benchPlayers: any[];
    excludedMemberIds?: Set<string>;
    handlePlayerSubstitute: (pitchPlayerId: string, benchPlayerId: string) => void;
    handleAddTimelineEvent: (payload: {
        action_type_id: number;
        minute: number;
        player_id?: string;
        assist_id?: string;
        comment?: string;
        is_opponent?: boolean;
    }) => Promise<unknown>;
    handleUpdatePossession: (homePossession: number) => Promise<unknown>;
    handleDeleteTimelineEvent: (eventId: string) => void;
    canManage: boolean | null;
    elapsedTime: number;
    isTimerRunning: boolean;
    formations: any[];
    savedLineupId: number | null;
    currentLineup: { [positionId: number]: string };
}

export const LiveTab: React.FC<LiveTabProps> = ({
    event, allPlayers, pitchPlayers, benchPlayers,
    handlePlayerSubstitute,
    handleAddTimelineEvent, elapsedTime,
    isTimerRunning, formations, savedLineupId, currentLineup,
    handleUpdatePossession,
    handleDeleteTimelineEvent,
    canManage,
    excludedMemberIds,
}) => {
    const allPlayersMemo = useMemo(() => allPlayers ?? [], [allPlayers]);

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

    const timeline = useMemo(() => {
        const raw = (event as any)?.game?.timeline;
        if (!Array.isArray(raw)) return [];
        return [...raw].sort((a: any, b: any) => (b?.minute ?? 0) - (a?.minute ?? 0));
    }, [event]);

    const getPlayerName = (memberId: string | undefined) => {
        if (!memberId) return undefined;
        const p = allPlayersMemo.find((x: any) => x?.member_id === memberId);
        if (!p) return undefined;
        return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || undefined;
    };

    const formatMinute = (m: unknown) => {
        const v = typeof m === 'number' && Number.isFinite(m) ? m : 0;
        return `${Math.max(0, Math.floor(v))}'`;
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            {canManage ? (
                <MatchActionManager 
                    isTimerRunning={isTimerRunning}
                    minute={Math.floor(elapsedTime / 60)}
                    event={event as any}
                    players={pitchPlayers.concat(benchPlayers) as any}
                    playersOnPitch={new Set(pitchPlayers.map((p: any) => p.member_id).filter(Boolean))}
                    excludedPlayerIds={excludedMemberIds}
                    formations={formations}
                    savedLineupId={savedLineupId}
                    currentLineup={currentLineup}
                    onUpdatePossession={async (homePossession) => {
                        await handleUpdatePossession(homePossession);
                    }}
                    onSubmit={async (payload) => {
                        await handleAddTimelineEvent(payload);

                        if (payload?.action_type_id === 4 && !payload?.is_opponent) {
                            const inId = payload?.player_id;
                            const outId = payload?.assist_id;
                            if (typeof inId === 'string' && typeof outId === 'string' && inId && outId) {
                                handlePlayerSubstitute(outId, inId);
                            }
                        }
                    }}
                />
            ) : null}

            <Card className="bg-slate-900 border border-slate-800 text-slate-100">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-100">Timeline</h3>
                    <div className="text-xs text-slate-400">{timeline.length} événement(s)</div>
                </div>

                {timeline.length === 0 ? (
                    <div className="text-sm text-slate-400">Aucun événement pour le moment.</div>
                ) : (
                    <div className="relative">
                        {/* Center line (desktop) */}
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
                                        typeof memberId === 'string' && allPlayersMemo.some((p: any) => p?.member_id === memberId);

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

                                const canDelete = Boolean(canManage && evt?.id);

                                const content = (
                                    <div className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-3">
                                        <div className="flex items-start gap-2">
                                            {Icon ? (
                                                <span className={meta?.text ?? 'text-slate-600'}>
                                                    <Icon size={16} />
                                                </span>
                                            ) : null}
                                            <div className="min-w-0">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="font-semibold text-slate-100 leading-tight">
                                                        {label}
                                                    </div>
                                                    {canDelete ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteTimelineEvent(String(evt.id))}
                                                            className="shrink-0 p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
                                                            aria-label="Supprimer l'événement"
                                                            title="Supprimer"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    ) : null}
                                                </div>

                                                {/* Subtitle like the screenshot (player name / in-out) */}
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
                                                    <div className="mt-2 text-xs text-slate-400 whitespace-pre-wrap">
                                                        {evt.comment}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                );

                                return (
                                    <div key={key} className="relative">
                                        {/* Desktop: left/right layout around center line */}
                                        <div className="hidden sm:flex items-stretch">
                                            <div className="w-1/2 pr-6 flex justify-end">
                                                {side === 'left' ? (
                                                    <div className="max-w-md w-full">
                                                        {content}
                                                    </div>
                                                ) : (
                                                    <div />
                                                )}
                                            </div>

                                            <div className="w-0 relative">
                                                <div className="absolute left-1/2 -translate-x-1/2 top-1">
                                                    <div className="w-9 h-9 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                                                        <span className="text-xs font-bold text-slate-200">{formatMinute(evt?.minute)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="w-1/2 pl-6 flex justify-start">
                                                {side === 'right' ? (
                                                    <div className="max-w-md w-full">
                                                        {content}
                                                    </div>
                                                ) : (
                                                    <div />
                                                )}
                                            </div>
                                        </div>

                                        {/* Mobile: left/right layout depending on team */}
                                        <div
                                            className={side === 'right'
                                                ? 'sm:hidden relative pr-10'
                                                : 'sm:hidden relative pl-10'
                                            }
                                        >
                                            <div
                                                className={side === 'right'
                                                    ? 'absolute right-4 top-0 bottom-0 w-px bg-slate-700/60'
                                                    : 'absolute left-4 top-0 bottom-0 w-px bg-slate-700/60'
                                                }
                                            />
                                            <div className={side === 'right' ? 'absolute right-0 top-1' : 'absolute left-0 top-1'}>
                                                <div className="w-9 h-9 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                                                    <span className="text-xs font-bold text-slate-200">{formatMinute(evt?.minute)}</span>
                                                </div>
                                            </div>
                                            <div className={side === 'right' ? 'ml-auto' : undefined}>
                                                {content}
                                            </div>
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
