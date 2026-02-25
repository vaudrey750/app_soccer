import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useTeam } from '../../context/TeamContext';
import { memberService, MemberDTO } from '../../services/memberService';
import { statsService, PlayerStatsDTO } from '../../services/statsService';
import { eventService, EventDTO } from '../../services/eventService';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { FUTCard } from '../../components/molecules/FUTCard';
import { cn } from '../../utils/cn';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const computeCareerProgress = (stats: PlayerStatsDTO | null) => {
    if (!stats) {
        return { level: 1, xp: { current: 0, next: 1000 } };
    }

    const xpTotal =
        stats.matches_played * 120 +
        stats.trainings_attended * 25 +
        stats.goals * 60 +
        stats.assists * 45 +
        stats.mom_count * 80;

    const level = Math.floor(xpTotal / 1000) + 1;
    const current = xpTotal % 1000;
    return { level, xp: { current, next: 1000 } };
};

const getResult = (event: EventDTO) => {
    if (!event.game) return '-';
    const { score_home, score_away, is_home } = event.game;
    if (typeof score_home !== 'number' || typeof score_away !== 'number') return '-';

    const myScore = is_home ? score_home : score_away;
    const oppScore = is_home ? score_away : score_home;

    if (myScore > oppScore) return 'W';
    if (myScore < oppScore) return 'L';
    return 'D';
};

const Career: React.FC = () => {
    const { user: authUser } = useAuth();
    const { selectedTeam, teams } = useTeam();
    const navigate = useNavigate();

    const [member, setMember] = useState<MemberDTO | null>(null);
    const [myStats, setMyStats] = useState<PlayerStatsDTO | null>(null);
    const [lastMatches, setLastMatches] = useState<EventDTO[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const allowedTeamIds = useMemo(() => teams.map((t) => t.team_id), [teams]);

    useEffect(() => {
        const load = async () => {
            if (!authUser?.id) return;
            setIsLoading(true);
            setError(null);
            try {
                const [m, s, matches] = await Promise.all([
                    memberService.getMember(authUser.id),
                    statsService.getMyStats(authUser.id),
                    eventService.getLastMatches(5, selectedTeam?.team_id, allowedTeamIds),
                ]);
                setMember(m);
                setMyStats(s);
                setLastMatches(matches);
            } catch (e) {
                console.error('Career load error', e);
                setError('Impossible de charger votre carrière.');
                setMember(null);
                setMyStats(null);
                setLastMatches([]);
            } finally {
                setIsLoading(false);
            }
        };

        load();
    }, [authUser?.id, selectedTeam?.team_id, allowedTeamIds]);

    const userName = member ? `${member.first_name} ${member.last_name}`.trim() : (authUser?.firstName || 'Joueur');

    const ratingFromStats = typeof myStats?.average_rating === 'number' ? myStats.average_rating : undefined;
    const overallRating = ratingFromStats ?? 6.5;
    const careerProgress = computeCareerProgress(myStats);

    const formSequence = lastMatches
        .map((m) => {
            const r = getResult(m);
            if (r === 'W') return 'W' as const;
            if (r === 'L') return 'L' as const;
            if (r === 'D') return 'D' as const;
            return '-' as const;
        })
        .slice(0, 5);

    const xpCurrent = clamp(careerProgress.xp.current, 0, careerProgress.xp.next);
    const xpNext = careerProgress.xp.next;

    return (
        <div className="p-4 space-y-6 container mx-auto w-full pt-8 pb-24 px-4 sm:px-6 lg:px-8 animate-fade-in">
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 rounded-xl bg-white border border-slate-100 hover:bg-slate-50 transition"
                    aria-label="Retour"
                >
                    <ArrowLeft size={18} className="text-slate-700" />
                </button>
                <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Menu</div>
                    <h1 className="text-2xl font-black text-slate-800 truncate">Carrière</h1>
                </div>
            </div>

            <section className="space-y-4">
                <Card noPadding className="relative overflow-hidden p-5">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[90px] -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[70px] translate-y-1/2 -translate-x-1/2" />

                    {isLoading ? (
                        <div className="animate-pulse flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-slate-200" />
                            <div className="flex-1">
                                <div className="h-4 w-40 bg-slate-200 rounded" />
                                <div className="mt-2 h-3 w-24 bg-slate-200 rounded" />
                                <div className="mt-3 h-2 w-full bg-slate-200 rounded" />
                            </div>
                        </div>
                    ) : error ? (
                        <div>
                            <div className="font-bold text-slate-800">Erreur</div>
                            <div className="mt-1 text-sm text-slate-600">{error}</div>
                            <div className="mt-4">
                                <Button variant="secondary" onClick={() => window.location.reload()}>
                                    Réessayer
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <FUTCard
                                variant="compact"
                                showActions
                                skin="gold"
                                player={{
                                    name: userName,
                                    position: member?.position || 'Joueur',
                                    photo_url: member?.photo_url,
                                }}
                                rating={overallRating}
                                form={formSequence}
                                level={careerProgress.level}
                                xp={careerProgress.xp}
                            />

                            {myStats && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-[560px] mx-auto">
                                    <div className="rounded-2xl border border-slate-100 bg-white p-4">
                                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Note</div>
                                        <div className="mt-1 text-xl font-black text-slate-800">
                                            {typeof myStats.average_rating === 'number' ? myStats.average_rating.toFixed(1) : '—'}
                                            <span className="text-xs font-bold text-slate-500">/10</span>
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-slate-100 bg-white p-4">
                                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Matchs</div>
                                        <div className="mt-1 text-xl font-black text-slate-800">{myStats.matches_played}</div>
                                    </div>
                                    <div className="rounded-2xl border border-slate-100 bg-white p-4">
                                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Buts</div>
                                        <div className="mt-1 text-xl font-black text-slate-800">{myStats.goals}</div>
                                    </div>
                                    <div className="rounded-2xl border border-slate-100 bg-white p-4">
                                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Passes</div>
                                        <div className="mt-1 text-xl font-black text-slate-800">{myStats.assists}</div>
                                    </div>
                                    <div className="rounded-2xl border border-slate-100 bg-white p-4">
                                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Assiduité</div>
                                        <div className="mt-1 text-xl font-black text-slate-800">
                                            {myStats.trainings_total > 0
                                                ? `${Math.round((myStats.trainings_attended / myStats.trainings_total) * 100)}%`
                                                : '—'}
                                        </div>
                                        <div className="mt-1 text-xs font-bold text-slate-500">
                                            {myStats.trainings_attended}/{myStats.trainings_total} entraînements
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-slate-100 bg-white p-4">
                                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">MOM</div>
                                        <div className="mt-1 text-xl font-black text-slate-800">{myStats.mom_count}</div>
                                    </div>
                                </div>
                            )}

                            <div className="max-w-[560px] mx-auto rounded-2xl border border-slate-100 bg-white p-4">
                                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                    <span>Progression</span>
                                    <span className={cn('font-black', 'text-slate-800')}>NIV {careerProgress.level}</span>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-500">
                                    <span>XP</span>
                                    <span>
                                        {xpCurrent}/{xpNext}
                                    </span>
                                </div>
                                <div className="mt-2 h-2 w-full rounded-full overflow-hidden bg-slate-100">
                                    <div
                                        className="h-2 rounded-full bg-indigo-600"
                                        style={{ width: `${(xpCurrent / xpNext) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            </section>
        </div>
    );
};

export default Career;
