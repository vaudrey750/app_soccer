import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';

interface StatsTabProps {
    event: any;
}

export const StatsTab: React.FC<StatsTabProps> = ({
    event
}) => {
    const timeline = (event?.game?.timeline ?? []) as Array<{
        action_type_id: number;
        minute?: number;
        is_opponent?: boolean;
        is_home_event?: boolean;
        comment?: string;
        extra_data?: any;
    }>;

    const ourIsHome = Boolean(event?.game?.is_home ?? true);
    const homeTeamName = (event?.game?.home_team_name ?? 'Domicile') as string;
    const awayTeamName = (event?.game?.away_team_name ?? 'Extérieur') as string;

    const stats = useMemo(() => {
        const isHomeEvent = (t: { is_opponent?: boolean; is_home_event?: boolean }) => {
            if (typeof t.is_home_event === 'boolean') return t.is_home_event;
            if (t.is_opponent === true) return !ourIsHome;
            return ourIsHome;
        };

        const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
        const parsePctFromComment = (c: unknown): number | null => {
            if (typeof c !== 'string') return null;
            const m = c.match(/(\d{1,3})/);
            if (!m) return null;
            const n = Number(m[1]);
            if (!Number.isFinite(n)) return null;
            return clampPct(n);
        };

        let possessionHome = 50;
        let possessionAway = 50;

        const gamePossessionHome = (event?.game as any)?.possession_home;
        if (typeof gamePossessionHome === 'number' && Number.isFinite(gamePossessionHome)) {
            const pct = clampPct(gamePossessionHome);
            possessionHome = pct;
            possessionAway = 100 - pct;
        } else {
            // Fallback rétro-compat : ancienne possession stockée en timeline (action 18)
            const latestPossessionEvt = [...timeline]
                .filter(t => t.action_type_id === 18)
                .sort((a, b) => (Number(b.minute ?? 0) - Number(a.minute ?? 0)));

            if (latestPossessionEvt.length > 0) {
                const evt = latestPossessionEvt[0];
                const raw = typeof evt?.extra_data?.possession === 'number'
                    ? evt.extra_data.possession
                    : parsePctFromComment(evt.comment);

                if (typeof raw === 'number' && Number.isFinite(raw)) {
                    const pct = clampPct(raw);
                    const homeSide = isHomeEvent(evt);
                    if (homeSide) {
                        possessionHome = pct;
                        possessionAway = 100 - pct;
                    } else {
                        possessionAway = pct;
                        possessionHome = 100 - pct;
                    }
                }
            }
        }

        const count = (actionTypeId: number, side: 'home' | 'away') =>
            timeline.filter(t => {
                if (t.action_type_id !== actionTypeId) return false;
                const isHome = isHomeEvent(t);
                return side === 'home' ? isHome : !isHome;
            }).length;

        const goalsHome = count(1, 'home');
        const goalsAway = count(1, 'away');
        const scoreHome = (event?.game?.score_home ?? goalsHome) as number;
        const scoreAway = (event?.game?.score_away ?? goalsAway) as number;

        return {
            scoreHome,
            scoreAway,
            possession: { home: possessionHome, away: possessionAway },
            goals: { home: goalsHome, away: goalsAway },
            shots: { home: count(5, 'home'), away: count(5, 'away') },
            shotsOnTarget: { home: count(6, 'home'), away: count(6, 'away') },
            yellowCards: { home: count(2, 'home'), away: count(2, 'away') },
            redCards: { home: count(3, 'home'), away: count(3, 'away') },
            subs: { home: count(4, 'home'), away: count(4, 'away') },
            highlights: { home: count(17, 'home'), away: count(17, 'away') },
        };
    }, [event?.game?.possession_home, event?.game?.score_away, event?.game?.score_home, ourIsHome, timeline]);

    const rows = [
        { label: 'Possession', values: { home: `${stats.possession.home}%`, away: `${stats.possession.away}%` } },
        { label: 'Buts', values: stats.goals },
        { label: 'Tirs', values: stats.shots },
        { label: 'Tirs cadrés', values: stats.shotsOnTarget },
        { label: 'Cartons jaunes', values: stats.yellowCards },
        { label: 'Cartons rouges', values: stats.redCards },
        { label: 'Remplacements', values: stats.subs },
        { label: 'Faits de jeu', values: stats.highlights },
    ] as const;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 backdrop-blur-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                        <Activity size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Statistiques du match</h3>
                        <p className="text-sm text-slate-400">Récap global basé sur les événements saisis</p>
                    </div>
                </div>
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
                <div className="space-y-4">
                    <div className="grid grid-cols-3 items-end gap-3 pb-3 border-b border-slate-700/50">
                        <div className="text-sm font-semibold text-white truncate">{homeTeamName}</div>
                        <div className="text-center text-xs text-slate-500 uppercase tracking-wider">Score</div>
                        <div className="text-sm font-semibold text-white text-right truncate">{awayTeamName}</div>
                        <div className="text-2xl font-bold text-white">{stats.scoreHome}</div>
                        <div className="text-center text-slate-400">-</div>
                        <div className="text-2xl font-bold text-white text-right">{stats.scoreAway}</div>
                    </div>

                    <div className="space-y-2">
                        {rows.map(row => (
                            <div
                                key={row.label}
                                className="grid grid-cols-3 items-center gap-3 bg-slate-900/30 rounded-xl border border-slate-700/40 px-4 py-3"
                            >
                                <div className="text-white font-medium">{row.values.home as any}</div>
                                <div className="text-center text-sm text-slate-400">{row.label}</div>
                                <div className="text-white font-medium text-right">{row.values.away as any}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
