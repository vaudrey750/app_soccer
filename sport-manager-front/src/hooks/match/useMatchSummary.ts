import { useMemo } from 'react';
import { TimelineEventDTO, EventDetailDTO } from '../../services/eventService';

export const useMatchSummary = (timeline: TimelineEventDTO[], event: EventDetailDTO | null | undefined) => {
    const possession = useMemo(() => {
        const ourIsHome = Boolean(event?.game?.is_home ?? true);
        const isHomeEvent = (t: Pick<TimelineEventDTO, 'is_home_event' | 'is_opponent'>) => {
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

        let home = 50;
        let away = 50;

        const gamePossessionHome = event?.game?.possession_home;
        if (typeof gamePossessionHome === 'number' && Number.isFinite(gamePossessionHome)) {
            const pct = clampPct(gamePossessionHome);
            home = pct;
            away = 100 - pct;
        } else {
            // Fallback rétro-compat : ancienne possession stockée en timeline (action 18)
            const latest = [...timeline]
                .filter(t => t.action_type_id === 18)
                .sort((a, b) => (Number(b.minute ?? 0) - Number(a.minute ?? 0)));

            if (latest.length > 0) {
                const evt = latest[0];
                const raw = typeof (evt as any)?.extra_data?.possession === 'number'
                    ? (evt as any).extra_data.possession
                    : parsePctFromComment(evt.comment);

                if (typeof raw === 'number' && Number.isFinite(raw)) {
                    const pct = clampPct(raw);
                    if (isHomeEvent(evt)) {
                        home = pct;
                        away = 100 - pct;
                    } else {
                        away = pct;
                        home = 100 - pct;
                    }
                }
            }
        }

        const our = ourIsHome ? home : away;
        const opp = 100 - our;
        return { our, opp };
    }, [event?.game?.is_home, event?.game?.possession_home, timeline]);
    const matchStats = useMemo(() => {
        return {
            goals: timeline.filter(t => t.action_type_id === 1).length,
            yellowCards: timeline.filter(t => t.action_type_id === 2).length,
            redCards: timeline.filter(t => t.action_type_id === 3).length,
            subs: timeline.filter(t => t.action_type_id === 4).length,
        };
    }, [timeline]);
    const summaryText = useMemo(() => {
        if (!event?.game) return '';

        const homeScore = timeline.filter(t => t.action_type_id === 1 && !t.is_opponent).length;
        const awayScore = timeline.filter(t => t.action_type_id === 1 && t.is_opponent).length;
        
        const homeGoals = timeline.filter(t => t.action_type_id === 1 && !t.is_opponent);
        const awayGoals = timeline.filter(t => t.action_type_id === 1 && t.is_opponent);
        const cards = timeline.filter(t => t.action_type_id === 2 || t.action_type_id === 3);
        const highlights = timeline.filter(t => t.action_type_id === 17);
        
        const dateStr = event.game.date ? new Date(event.game.date).toLocaleDateString('fr-FR') : "Date inconnue";
        
        let text = `MATCH: ${event.game.home_team_name} vs ${event.game.away_team_name}\n`;
        text += `DATE: ${dateStr}\n`;
        text += `SCORE FINAL: ${homeScore} - ${awayScore}\n\n`;
        
        text += `⚽ BUTEURS (${event.game.home_team_name}):\n`;
        if (homeGoals.length > 0) {
            homeGoals.forEach(g => {
                text += `- ${g.minute}': ${g.player_name || 'Inconnu'} ${g.assist_name ? `(Passe: ${g.assist_name})` : ''}\n`;
            });
        } else {
            text += "Aucun but.\n";
        }
        
        text += `\n⚽ BUTEURS ADVERSES:\n`;
        if (awayGoals.length > 0) {
            awayGoals.forEach(g => text += `- ${g.minute}'\n`);
        } else {
            text += "Aucun but.\n";
        }
        
        if (cards.length > 0) {
            text += `\n🟨🟥 SANCTIONS:\n`;
            cards.forEach(c => {
                const type = c.action_type_id === 2 ? "Jaune" : "Rouge";
                text += `- ${c.minute}': ${c.player_name} (${type})\n`;
            });
        }
        
        if (highlights.length > 0) {
            text += `\n🔥 FAITS MARQUANTS:\n`;
            highlights.forEach(h => {
                const actionComment = h.comment || (h.extra_data as any)?.comment || 'Action notable';
                text += `- ${h.minute}': ${actionComment} ${h.player_name ? `(${h.player_name})` : ''}\n`;
            });
        }
        
        text += `\n📊 STATS:\n`;
        text += `- Possession: ${possession.our}% / ${possession.opp}%\n`;
        text += `- Tirs: ${timeline.filter(t => t.action_type_id === 5).length}\n`;
        text += `- Tirs Cadrés: ${timeline.filter(t => t.action_type_id === 6).length}\n`;

        return text;
    }, [timeline, event?.game, possession]);

    const stats = useMemo(() => {
        return {
            goals: timeline.filter(e => e.action_type_id === 1).length,
            yellowCards: timeline.filter(e => e.action_type_id === 2).length,
            redCards: timeline.filter(e => e.action_type_id === 3).length,
            subs: timeline.filter(e => e.action_type_id === 4).length,
        };
    }, [timeline]);

    return { summaryText, stats, matchStats };
};
