import React, { useMemo } from 'react';
import { TacticsBoard } from '../TacticsBoard';
import { cn } from '../../../utils/cn';

interface TacticsTabProps {
    event: any;
    players: any[];
    formations: any[];
    selectedFormation: string;
    lineupPublished?: boolean;
    handleSetLineupPublished: (nextPublished: boolean) => void;
    isPublishingLineup: boolean;
    canManage: boolean | null;
    currentLineup: { [positionId: number]: string };
    onSaveLineup: (formationId: number, lineup: { [positionId: number]: string }) => void;
    excludedMemberIds?: Set<string>;
}

export const TacticsTab: React.FC<TacticsTabProps> = ({
    event, players, formations, selectedFormation,
    lineupPublished,
    handleSetLineupPublished, isPublishingLineup, canManage,
    currentLineup, onSaveLineup,
    excludedMemberIds
}) => {
    const isLineupPublished = Boolean(lineupPublished ?? event?.lineup_published);
    const goalCountsByPlayerId = useMemo(() => {
        const timeline = (event as any)?.game?.timeline;
        if (!Array.isArray(timeline)) return {} as Record<string, number>;

        return timeline.reduce((acc: Record<string, number>, t: any) => {
            if (t?.action_type_id !== 1) return acc;
            if (t?.is_opponent) return acc;
            const playerId = typeof t?.player_id === 'string' ? t.player_id : undefined;
            if (!playerId) return acc;
            acc[playerId] = (acc[playerId] ?? 0) + 1;
            return acc;
        }, {});
    }, [event]);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <TacticsBoard 
                players={players as any}
                formations={formations as any}
                initialFormationId={selectedFormation ? parseInt(selectedFormation) : undefined}
                initialLineup={currentLineup}
                motmMemberId={event?.motm_id ?? null}
                goalCountsByPlayerId={goalCountsByPlayerId}
                excludedPlayerIds={excludedMemberIds}
                onSave={onSaveLineup}
                readOnly={!canManage || event.game?.status === 'PLAYED' || event.game?.status === 'CANCELLED'}
            />
            
            {canManage && event.game?.status !== 'PLAYED' && event.game?.status !== 'CANCELLED' && (
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={() => handleSetLineupPublished(!isLineupPublished)}
                        disabled={isPublishingLineup}
                        className={cn(
                            "py-2.5 px-6 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg",
                            isLineupPublished
                                ? "bg-rose-600 hover:bg-rose-500 shadow-rose-900/20"
                                : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20"
                        )}
                    >
                        {isPublishingLineup ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : isLineupPublished ? (
                            'Cacher la composition'
                        ) : (
                            'Publier la composition'
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};
