import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/atoms/Card';
import { useAuth } from '../../context/AuthContext';
import { useTeam } from '../../context/TeamContext';
import { eventService, EventDTO } from '../../services/eventService';
import { Calendar, ClipboardList, Activity, ChevronRight, MapPin, Clock, TrendingUp, CheckCircle2, Circle, Users, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { pickFocusEvent } from '../../utils/eventFocus';
import type { EventDetailDTO } from '../../services/eventService';
import { getCoachPrimaryCta } from '../../utils/coachPrimaryCta';
import { useToast } from '../../hooks/useToast';
import { getPresenceSummary } from '../../utils/presenceSummary';
import { ConfirmModal } from '../../components/molecules/ConfirmModal';

const CoachDashboard: React.FC = () => {
    const { user } = useAuth();
    const { selectedTeam, teams, isLoading: isTeamsLoading } = useTeam();
    const navigate = useNavigate();
    const toast = useToast();
    const [nextMatch, setNextMatch] = useState<EventDTO | null>(null);
    const [events, setEvents] = useState<EventDTO[]>([]);
    const [clubWeekendEvents, setClubWeekendEvents] = useState<EventDTO[]>([]);
    const [focusEvent, setFocusEvent] = useState<EventDTO | null>(null);
    const [focusEventDetail, setFocusEventDetail] = useState<EventDetailDTO | null>(null);
    const [isFocusDetailLoading, setIsFocusDetailLoading] = useState(false);
    const [focusDetailError, setFocusDetailError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
    const [remindModalOpen, setRemindModalOpen] = useState(false);

    const isClubMode = !selectedTeam;
    const weekendRange = useMemo(() => {
        const now = new Date();
        const day = now.getDay(); // 0=dimanche ... 6=samedi
        const daysUntilSaturday = (6 - day + 7) % 7;

        const start = new Date(now);
        start.setDate(now.getDate() + daysUntilSaturday);
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(start.getDate() + 1);
        end.setHours(23, 59, 59, 999);

        return { start, end };
    }, []);

    useEffect(() => {
        const loadData = async () => {
            if (isTeamsLoading) return;
            setIsLoading(true);
            setError(null);
            try {
                // Determine filter for teams
                const teamId = selectedTeam?.team_id;
                const allowedTeamIds = teams.map(t => t.team_id);
                
                // Fetch next match (filtered)
                // Note: eventService.getNextMatch now returns Promise<EventDTO | null> but implementation might fetch all events then filter
                // Ideally backend endpoint for "next-match" handles this
                // But current mock service does client-side filtering which is fine for now
                const match = await eventService.getNextMatch(teamId, allowedTeamIds);
                setNextMatch(match);

                // Fetch upcoming events (filtered)
                const allEvents = await eventService.getEvents(teamId, allowedTeamIds);

                // V2-C1 — Synthèse week-end (visible uniquement en mode Club)
                if (!teamId) {
                    const weekendEvents = allEvents
                        .filter((e) => {
                            const start = new Date(e.start_date);
                            if (Number.isNaN(start.getTime())) return false;
                            return start >= weekendRange.start && start <= weekendRange.end;
                        })
                        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                        .slice(0, 10);
                    setClubWeekendEvents(weekendEvents);
                } else {
                    setClubWeekendEvents([]);
                }

                // Focus event: live match first, else upcoming by type+proximity
                const focus = pickFocusEvent(allEvents);
                setFocusEvent(focus?.event ?? null);
                
                // Filter future events and sort
                const futureEvents = allEvents
                    .filter(e => new Date(e.start_date) >= new Date())
                    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                    .slice(0, 5);
                setEvents(futureEvents);

                setLastUpdatedAt(new Date());
            } catch (e) {
                console.error("Failed to load coach dashboard data", e);
                setError("Impossible de charger le dashboard.");
            } finally {
                setIsLoading(false);
            }
        };
        
        // Only trigger load if teams are loaded (or if we know user has no teams)
        // If 'teams' is empty but isLoading is true, wait.
        // Assuming context sets 'isLoading' properly or 'teams' is populated.
        loadData();
    }, [selectedTeam, teams, isTeamsLoading, reloadKey, weekendRange.start, weekendRange.end]); // Re-run when team selection, available teams, or retry changes

    useEffect(() => {
        const loadFocusDetail = async () => {
            if (!focusEvent) {
                setFocusEventDetail(null);
                setFocusDetailError(null);
                setIsFocusDetailLoading(false);
                return;
            }
            setIsFocusDetailLoading(true);
            setFocusDetailError(null);
            try {
                const detail = await eventService.getEvent(focusEvent.event_id, selectedTeam?.team_id);
                setFocusEventDetail(detail);
            } catch (e) {
                console.warn('Failed to load focus event detail', e);
                setFocusEventDetail(null);
                setFocusDetailError("Impossible de charger les présences.");
            } finally {
                setIsFocusDetailLoading(false);
            }
        };

        loadFocusDetail();
    }, [focusEvent?.event_id, selectedTeam?.team_id]);

    const handleMatchCenterClick = () => {
        if (nextMatch) {
            navigate(`/match-center/${nextMatch.event_id}`);
        } else {
            // Maybe navigate to calendar if no immediate match
            navigate('/calendar');
        }
    };

    const handleOpenEvent = (evt: EventDTO) => {
        if (evt.type === 'match') {
            navigate(`/match-center/${evt.event_id}`);
            return;
        }
        navigate(`/events/${evt.event_id}`);
    };

    const focusCta = focusEvent
        ? getCoachPrimaryCta({ focusEvent, focusEventDetail: focusEventDetail ?? undefined })
        : null;

    const focusTeamName = focusEvent?.team_id
        ? teams.find((t) => t.team_id === focusEvent.team_id)?.name
        : undefined;

    const isSensitiveAction = focusCta?.kind === 'remind_responses' || focusCta?.kind === 'prepare_lineup' || focusCta?.kind === 'finalize_match';
    const isCtaDisabled = Boolean(isClubMode && isSensitiveAction);
    const ctaDisabledReason = 'Sélectionnez une équipe (bandeau en haut) pour agir.';

    const weekendLabel = `${format(weekendRange.start, 'EEE d MMM', { locale: fr })} → ${format(weekendRange.end, 'EEE d MMM', { locale: fr })}`;

    const presence = focusEventDetail ? getPresenceSummary(focusEventDetail.participants) : null;
    const presenceTotal = presence?.totalPlayers ?? 0;
    const confirmedPct = presenceTotal ? Math.round((presence!.confirmedCount / presenceTotal) * 100) : 0;
    const uncertainPct = presenceTotal ? Math.round((presence!.uncertainCount / presenceTotal) * 100) : 0;
    const absentPct = presenceTotal ? Math.round((presence!.absentCount / presenceTotal) * 100) : 0;
    const noResponsePct = Math.max(0, 100 - confirmedPct - uncertainPct - absentPct);
    const noResponseTop3 = presence?.noResponseParticipants.slice(0, 3) ?? [];
    const remainingNoResponse = Math.max(0, (presence?.noResponseCount ?? 0) - noResponseTop3.length);
    const canRemind = Boolean(!isClubMode && (presence?.noResponseCount ?? 0) > 0);

    const isFocusMatchFinished = (() => {
        if (!focusEvent || focusEvent.type !== 'match') return false;
        const statusId = focusEventDetail?.game?.status_id ?? focusEvent.game?.status_id;
        const status = focusEventDetail?.game?.status ?? focusEvent.game?.status;
        return statusId === 2 || status === 'PLAYED';
    })();

    const finalizeHints = (() => {
        const focus = focusEvent;
        if (!focus || focus.type !== 'match') return [] as string[];
        if (!isFocusMatchFinished) return [] as string[];

        const hints: string[] = [];

        const players = focusEventDetail?.participants ?? [];
        const ratedCount = players.filter((p) => typeof p.rating === 'number' && Number.isFinite(p.rating)).length;
        if (players.length > 0 && ratedCount < players.length) {
            hints.push('Notes à saisir');
        }

        const hasMotm = Boolean(focusEventDetail?.motm_id || focusEventDetail?.coach_motm_member_id);
        if (!hasMotm) {
            hints.push('MOTM à désigner');
        }

        const scoreHome = focusEventDetail?.game?.score_home ?? focus.game?.score_home;
        const scoreAway = focusEventDetail?.game?.score_away ?? focus.game?.score_away;
        if (typeof scoreHome !== 'number' || typeof scoreAway !== 'number') {
            hints.push('Score à vérifier');
        }

        const timeline = focusEventDetail?.game?.timeline ?? focus.game?.timeline;
        if (Array.isArray(timeline) && timeline.length === 0) {
            hints.push('Timeline vide');
        }

        return hints.slice(0, 3);
    })();

    const checklist = (() => {
        if (!focusEvent) return null;

        const safeParse = (iso: string) => {
            const d = new Date(iso);
            return Number.isNaN(d.getTime()) ? null : d;
        };

        const start = safeParse(focusEvent.start_date);
        const now = new Date();
        const startDayMs = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() : null;
        const nowDayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const diffDays = startDayMs !== null ? Math.round((startDayMs - nowDayMs) / (1000 * 60 * 60 * 24)) : null;

        const locationValue = focusEvent.location || focusEvent.game?.location;
        const hasLocation = Boolean(locationValue && locationValue.trim().length > 0);

        const participantsCount = focusEventDetail?.participants?.length ?? 0;
        const hasParticipants = participantsCount > 0;

        const hasDescription = Boolean(focusEvent.description && focusEvent.description.trim().length > 0);

        const noResponseCount = presence?.noResponseCount;
        const presenceFollowed = typeof noResponseCount === 'number' ? noResponseCount === 0 : false;

        const lineupPublished = Boolean(focusEventDetail?.lineup_published ?? focusEvent.lineup_published);

        const items: Array<{ key: string; label: string; done: boolean; icon: React.ReactNode }> = [
            {
                key: 'participants',
                label: 'Convocations prêtes',
                done: hasParticipants,
                icon: <Users size={16} className="text-slate-400" />,
            },
            {
                key: 'location',
                label: 'Lieu confirmé',
                done: hasLocation,
                icon: <MapPin size={16} className="text-slate-400" />,
            },
            {
                key: 'description',
                label: 'Infos renseignées',
                done: hasDescription,
                icon: <FileText size={16} className="text-slate-400" />,
            },
            {
                key: 'presence',
                label: 'Présences suivies',
                done: presenceFollowed,
                icon: <ClipboardList size={16} className="text-slate-400" />,
            },
        ];

        if (focusEvent.type === 'match') {
            items.push({
                key: 'lineup',
                label: 'Compo publiée',
                done: lineupPublished,
                icon: <Activity size={16} className="text-slate-400" />,
            });
        }

        return {
            diffDays,
            titleSuffix:
                typeof diffDays === 'number'
                    ? (diffDays > 2 ? ' (bientôt)' : diffDays >= 0 ? ' (J‑2 → J)' : ' (passé)')
                    : '',
            items: items.slice(0, 6),
        };
    })();

    return (
        <div className="p-4 space-y-6 container mx-auto w-full pt-8 pb-24 px-4 sm:px-6 lg:px-8">
            <header className="flex flex-col gap-1 mb-2">
                <h1 className="text-2xl font-black text-slate-800">
                    Bonjour, {user?.firstName} 👋
                </h1>
                <p className="text-sm font-medium text-slate-500">
                    Espace Coach - FC Test
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Column */}
                <div className="lg:col-span-2 space-y-8">
                    {/* QUICK ACTIONS GRID */}
                    <section>
                         <h2 className="text-lg font-bold text-slate-800 mb-3 block lg:hidden">Actions Rapides</h2>
                         <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <Card 
                                onClick={() => {
                                    if (!selectedTeam) {
                                        toast.info({
                                            title: 'Choisissez une équipe',
                                            message: 'Sélectionnez une équipe (bandeau en haut) pour créer un événement.',
                                        });
                                        return;
                                    }
                                    navigate('/events/new');
                                }}
                                className="p-4 flex flex-col items-center justify-center gap-2 bg-indigo-50 border-indigo-100 hover:bg-indigo-100 transition-colors cursor-pointer group h-full">
                                <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                                    <Calendar size={20} />
                                </div>
                                <span className="text-xs font-bold text-indigo-900">Nouvel Événement</span>
                            </Card>
                            <Card 
                                onClick={() => navigate('/convocations')}
                                className="p-4 flex flex-col items-center justify-center gap-2 bg-white border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group h-full">
                                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform">
                                    <ClipboardList size={20} />
                                </div>
                                <span className="text-xs font-bold text-slate-700">Convocations</span>
                            </Card>
                            <Card 
                                onClick={() => navigate('/statistics')}
                                className="p-4 flex flex-col items-center justify-center gap-2 bg-white border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group h-full">
                                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
                                    <TrendingUp size={20} />
                                </div>
                                <span className="text-xs font-bold text-slate-700">Statistiques</span>
                            </Card>
                            <Card 
                                onClick={handleMatchCenterClick}
                                className="p-4 flex flex-col items-center justify-center gap-2 bg-white border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group h-full"
                            >
                                <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-200 group-hover:scale-110 transition-transform relative">
                                    <Activity size={20} />
                                    {nextMatch && (
                                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                                    )}
                                </div>
                                <span className="text-xs font-bold text-slate-700">Match Center</span>
                            </Card>
                        </div>
                    </section>

                    {/* V2-C1 — Synthèse week-end multi-équipes (mode Club) */}
                    {isClubMode && (
                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-lg font-bold text-slate-800">Synthèse week‑end</h2>
                                    <span className="text-xs font-semibold text-slate-500">{weekendLabel}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => navigate('/calendar')}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                                >
                                    Voir calendrier
                                </button>
                            </div>

                            {isLoading ? (
                                <Card className="p-6">
                                    <div className="animate-pulse grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="h-20 bg-slate-200 rounded-2xl" />
                                        <div className="h-20 bg-slate-200 rounded-2xl" />
                                    </div>
                                </Card>
                            ) : error ? (
                                <Card className="p-6">
                                    <p className="text-sm font-medium text-slate-600">{error}</p>
                                    <button
                                        onClick={() => setReloadKey((v) => v + 1)}
                                        className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                                    >
                                        Réessayer
                                    </button>
                                </Card>
                            ) : clubWeekendEvents.length === 0 ? (
                                <Card className="p-6">
                                    <p className="text-sm font-medium text-slate-600">Aucun événement prévu ce week‑end.</p>
                                    <p className="mt-1 text-xs text-slate-500">Passez en mode équipe pour agir sur un événement.</p>
                                </Card>
                            ) : (
                                <Card className="p-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {clubWeekendEvents.map((evt) => {
                                            const teamName = teams.find((t) => t.team_id === evt.team_id)?.name ?? `Équipe ${evt.team_id}`;
                                            const start = parseISO(evt.start_date);
                                            const locationValue = evt.location || evt.game?.location;
                                            const hasLocation = Boolean(locationValue && locationValue.trim().length > 0);
                                            const statusId = evt.game?.status_id;
                                            const status = evt.game?.status;
                                            const isLive = statusId === 5 || status === 'LIVE';

                                            return (
                                                <div
                                                    key={evt.event_id}
                                                    onClick={() => handleOpenEvent(evt)}
                                                    className="rounded-2xl border border-slate-100 bg-white p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                                    {evt.type === 'match' ? 'Match' : evt.type === 'training' ? 'Entraînement' : 'Événement'}
                                                                </span>
                                                                <span className="px-2 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-100 text-xs font-bold">
                                                                    {teamName}
                                                                </span>
                                                                {isLive && (
                                                                    <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100 text-xs font-bold">
                                                                        LIVE
                                                                    </span>
                                                                )}
                                                                {!hasLocation && (
                                                                    <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 text-xs font-bold">
                                                                        Lieu à confirmer
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="mt-2 font-black text-slate-800 truncate">
                                                                {evt.type === 'match'
                                                                    ? `${evt.game?.home_team_name ?? 'Équipe'} vs ${evt.game?.away_team_name ?? 'Adversaire'}`
                                                                    : evt.title}
                                                            </div>
                                                            <div className="mt-1 text-xs font-medium text-slate-500 flex items-center gap-2">
                                                                <Clock size={14} className="text-slate-400" />
                                                                {format(start, 'EEE HH:mm', { locale: fr })}
                                                                <span className="text-slate-300">•</span>
                                                                <MapPin size={14} className="text-slate-400" />
                                                                <span className="truncate">{hasLocation ? locationValue : '—'}</span>
                                                            </div>
                                                        </div>
                                                        <ChevronRight size={18} className="text-slate-300 mt-1 shrink-0" />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </Card>
                            )}
                        </section>
                    )}
                    
                    {/* NEXT MATCH HERO (If any) */}
                    {isLoading ? (
                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-lg font-bold text-slate-800">Événement Focus</h2>
                                {lastUpdatedAt && (
                                    <span className="text-xs font-semibold text-slate-500">
                                        Dernière mise à jour : {lastUpdatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                            <Card className="p-6">
                                <div className="animate-pulse space-y-4">
                                    <div className="h-4 w-24 bg-slate-200 rounded" />
                                    <div className="h-8 w-full bg-slate-200 rounded" />
                                    <div className="h-4 w-2/3 bg-slate-200 rounded" />
                                    <div className="h-9 w-40 bg-slate-200 rounded" />
                                </div>
                            </Card>
                        </section>
                    ) : error ? (
                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-lg font-bold text-slate-800">Événement Focus</h2>
                                {lastUpdatedAt && (
                                    <span className="text-xs font-semibold text-slate-500">
                                        Dernière mise à jour : {lastUpdatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                            <Card className="p-6">
                                <p className="text-sm font-medium text-slate-600">{error}</p>
                                <button
                                    onClick={() => setReloadKey((v) => v + 1)}
                                    className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                                >
                                    Réessayer
                                </button>
                            </Card>
                        </section>
                    ) : focusEvent?.type === 'match' ? (
                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-lg font-bold text-slate-800">Événement Focus</h2>
                                {lastUpdatedAt && (
                                    <span className="text-xs font-semibold text-slate-500">
                                        Dernière mise à jour : {lastUpdatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                            <Card
                                onClick={() => {
                                    if (!focusCta) {
                                        handleOpenEvent(focusEvent);
                                        return;
                                    }
                                    if (isCtaDisabled) {
                                        toast.info({ title: 'Action indisponible', message: ctaDisabledReason });
                                        return;
                                    }
                                    navigate(focusCta.to);
                                }}
                                className="p-0 overflow-hidden cursor-pointer active:scale-[0.99] hover:shadow-xl transition-all shadow-lg shadow-indigo-500/10 border-indigo-100"
                            >
                                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 sm:p-8 text-white relative">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold backdrop-blur-sm uppercase tracking-wider shadow-sm">
                                                {focusEvent.game?.competition_name || 'Championnat'}
                                            </span>
                                            {focusTeamName && (
                                                <span className="px-3 py-1 bg-white/15 rounded-full text-xs font-bold backdrop-blur-sm shadow-sm">
                                                    {focusTeamName}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full backdrop-blur-md">
                                            <Clock size={14} className="opacity-80"/>
                                            <span className="font-mono font-bold">
                                                {format(parseISO(focusEvent.start_date), 'HH:mm')}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between gap-4 sm:gap-8">
                                        <div className="text-center flex-1">
                                            <div className="font-black text-xl sm:text-3xl leading-tight mb-2 truncate">
                                                {focusEvent.game?.home_team_name}
                                            </div>
                                            <div className="text-xs font-medium opacity-60 uppercase tracking-widest">Domicile</div>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <div className="text-center font-black text-2xl sm:text-4xl opacity-40 italic">VS</div>
                                        </div>
                                        <div className="text-center flex-1">
                                            <div className="font-black text-xl sm:text-3xl leading-tight mb-2 truncate">
                                                {focusEvent.game?.away_team_name}
                                            </div>
                                            <div className="text-xs font-medium opacity-60 uppercase tracking-widest">Extérieur</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white p-4 flex justify-between items-center border-t border-slate-100">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                                            <Calendar size={16} className="text-indigo-400" />
                                            {format(parseISO(focusEvent.start_date), 'EEEE d MMMM yyyy', { locale: fr })}
                                            <span className="text-slate-300 mx-2">|</span>
                                            <MapPin size={16} className="text-indigo-400" />
                                            {focusEvent.location || 'Lieu à confirmer'}
                                        </div>

                                        {isFocusMatchFinished && finalizeHints.length > 0 && (
                                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
                                                <span className="text-slate-500">À finaliser :</span>
                                                {finalizeHints.map((h) => (
                                                    <span
                                                        key={h}
                                                        className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100"
                                                    >
                                                        {h}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!focusCta) return;
                                            if (isCtaDisabled) {
                                                toast.info({ title: 'Action indisponible', message: ctaDisabledReason });
                                                return;
                                            }
                                            navigate(focusCta.to);
                                        }}
                                        disabled={!focusCta}
                                        className={
                                            `flex items-center gap-1 text-sm font-bold group px-3 py-1.5 rounded-lg transition-colors ` +
                                            (isCtaDisabled
                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100')
                                        }
                                        aria-disabled={isCtaDisabled}
                                        title={isCtaDisabled ? ctaDisabledReason : undefined}
                                    >
                                        {focusCta?.label ?? 'Ouvrir Match Center'}
                                        <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </Card>
                        </section>
                    ) : focusEvent ? (
                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-lg font-bold text-slate-800">Événement Focus</h2>
                                {lastUpdatedAt && (
                                    <span className="text-xs font-semibold text-slate-500">
                                        Dernière mise à jour : {lastUpdatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                            <Card
                                onClick={() => {
                                    if (!focusCta) {
                                        handleOpenEvent(focusEvent);
                                        return;
                                    }
                                    if (isCtaDisabled) {
                                        toast.info({ title: 'Action indisponible', message: ctaDisabledReason });
                                        return;
                                    }
                                    navigate(focusCta.to);
                                }}
                                className="p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {focusEvent.type === 'training' ? 'Entraînement' : 'Événement'}
                                        </div>
                                        <div className="text-lg font-black text-slate-800 truncate">{focusEvent.title}</div>
                                        <div className="mt-1 text-sm font-medium text-slate-500">
                                            {format(parseISO(focusEvent.start_date), 'EEEE d MMMM yyyy • HH:mm', { locale: fr })}
                                        </div>
                                        {focusEvent.location && (
                                            <div className="mt-1 text-xs font-medium text-slate-400 flex items-center gap-1">
                                                <MapPin size={12} />
                                                <span className="truncate">{focusEvent.location}</span>
                                            </div>
                                        )}
                                        {!focusEvent.location && (
                                            <div className="mt-1 text-xs font-medium text-slate-400 flex items-center gap-1">
                                                <MapPin size={12} />
                                                <span className="truncate">Lieu à confirmer</span>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!focusCta) return;
                                            if (isCtaDisabled) {
                                                toast.info({ title: 'Action indisponible', message: ctaDisabledReason });
                                                return;
                                            }
                                            navigate(focusCta.to);
                                        }}
                                        disabled={!focusCta}
                                        className={
                                            `flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-lg transition-colors ` +
                                            (isCtaDisabled
                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100')
                                        }
                                        aria-disabled={isCtaDisabled}
                                        title={isCtaDisabled ? ctaDisabledReason : undefined}
                                    >
                                        {focusCta?.label ?? 'Voir détail'}
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </Card>
                        </section>
                    ) : (
                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-lg font-bold text-slate-800">Événement Focus</h2>
                                {lastUpdatedAt && (
                                    <span className="text-xs font-semibold text-slate-500">
                                        Dernière mise à jour : {lastUpdatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                            <Card className="p-6">
                                <p className="text-sm font-medium text-slate-600">Aucun événement à venir.</p>
                                <button
                                    onClick={() => {
                                        if (!selectedTeam) {
                                            toast.info({
                                                title: 'Choisissez une équipe',
                                                message: 'Sélectionnez une équipe (bandeau en haut) pour créer un événement.',
                                            });
                                            return;
                                        }
                                        navigate('/events/new');
                                    }}
                                    className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                                >
                                    Créer un événement
                                </button>
                            </Card>
                        </section>
                    )}

                    {/* MVP-C2 — Bloc Présences */}
                    {(!isLoading && !error && focusEvent) ? (
                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-lg font-bold text-slate-800">Présences</h2>
                                    {lastUpdatedAt && (
                                        <span className="text-xs font-semibold text-slate-500">
                                            Dernière mise à jour : {lastUpdatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => navigate(`/convocations?eventId=${encodeURIComponent(focusEvent.event_id)}`)}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                                >
                                    Voir tout
                                </button>
                            </div>
                            <Card className="p-6">
                                {isFocusDetailLoading ? (
                                    <div className="animate-pulse space-y-4">
                                        <div className="h-3 w-full bg-slate-200 rounded-full" />
                                        <div className="h-4 w-2/3 bg-slate-200 rounded" />
                                        <div className="h-4 w-1/2 bg-slate-200 rounded" />
                                    </div>
                                ) : focusDetailError ? (
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-slate-600">{focusDetailError}</p>
                                            <p className="mt-1 text-xs text-slate-500">Vous pouvez ouvrir les convocations pour voir le détail.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/convocations?eventId=${encodeURIComponent(focusEvent.event_id)}`)}
                                            className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs hover:bg-indigo-100 transition-colors"
                                        >
                                            Ouvrir
                                        </button>
                                    </div>
                                ) : !presence ? (
                                    <p className="text-sm text-slate-600">Présences indisponibles.</p>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="h-3 w-full rounded-full overflow-hidden bg-slate-100 flex">
                                                    <div
                                                        className="h-full bg-emerald-500"
                                                        style={{ width: `${confirmedPct}%` }}
                                                        aria-label="Confirmés"
                                                    />
                                                    <div
                                                        className="h-full bg-amber-400"
                                                        style={{ width: `${uncertainPct}%` }}
                                                        aria-label="Incertains"
                                                    />
                                                    <div
                                                        className="h-full bg-rose-500"
                                                        style={{ width: `${absentPct}%` }}
                                                        aria-label="Absents"
                                                    />
                                                    <div
                                                        className="h-full bg-slate-400"
                                                        style={{ width: `${noResponsePct}%` }}
                                                        aria-label="Sans réponse"
                                                    />
                                                </div>

                                                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
                                                    <div className="flex items-center gap-2 text-slate-700">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                                        Confirmés ({presence.confirmedCount})
                                                    </div>
                                                    <div className="flex items-center gap-2 text-slate-700">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                                        Incertains ({presence.uncertainCount})
                                                    </div>
                                                    <div className="flex items-center gap-2 text-slate-700">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                                                        Absents ({presence.absentCount})
                                                    </div>
                                                    <div className="flex items-center gap-2 text-slate-700">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                                                        Sans réponse ({presence.noResponseCount})
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (isClubMode) {
                                                        toast.info({ title: 'Choisissez une équipe', message: ctaDisabledReason });
                                                        return;
                                                    }
                                                    setRemindModalOpen(true);
                                                }}
                                                disabled={!canRemind}
                                                className={
                                                    'shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition-colors ' +
                                                    (canRemind
                                                        ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed')
                                                }
                                                title={
                                                    isClubMode
                                                        ? ctaDisabledReason
                                                        : (presence.noResponseCount === 0 ? 'Aucune relance nécessaire' : undefined)
                                                }
                                                aria-disabled={!canRemind}
                                            >
                                                Relancer
                                            </button>
                                        </div>

                                        <div className="mt-5">
                                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sans réponse</div>
                                            {presence.noResponseCount === 0 ? (
                                                <div className="mt-2 text-sm font-medium text-slate-600">Tout le monde a répondu.</div>
                                            ) : (
                                                <div className="mt-2 space-y-1">
                                                    {noResponseTop3.map((p) => (
                                                        <div key={p.member_id} className="text-sm font-semibold text-slate-700">
                                                            {p.first_name} {p.last_name}
                                                        </div>
                                                    ))}
                                                    {remainingNoResponse > 0 ? (
                                                        <div className="text-xs font-medium text-slate-500">+ {remainingNoResponse} autre(s)</div>
                                                    ) : null}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </Card>
                        </section>
                    ) : null}

                    {/* V1-C1 — Checklist de préparation (J-2 → J) */}
                    {(!isLoading && !error && focusEvent && checklist) ? (
                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-lg font-bold text-slate-800">Checklist préparation{checklist.titleSuffix}</h2>
                                    {isClubMode && focusTeamName && (
                                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-full">
                                            {focusTeamName}
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs font-semibold text-slate-500">4–6 items max</span>
                            </div>

                            <Card className="p-6">
                                {isFocusDetailLoading ? (
                                    <div className="animate-pulse space-y-3">
                                        {[0, 1, 2, 3].map((i) => (
                                            <div key={i} className="h-10 w-full bg-slate-200 rounded-xl" />
                                        ))}
                                    </div>
                                ) : focusDetailError ? (
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-slate-600">{focusDetailError}</p>
                                            <p className="mt-1 text-xs text-slate-500">La checklist reste disponible, mais certains items peuvent être incomplets.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setReloadKey((v) => v + 1)}
                                            className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs hover:bg-indigo-100 transition-colors"
                                        >
                                            Réessayer
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {checklist.items.map((item) => (
                                            <div
                                                key={item.key}
                                                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="shrink-0">{item.icon}</div>
                                                    <div className="font-semibold text-slate-700 truncate">{item.label}</div>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-2">
                                                    {item.done ? (
                                                        <CheckCircle2 size={18} className="text-emerald-600" />
                                                    ) : (
                                                        <Circle size={18} className="text-slate-300" />
                                                    )}
                                                    <span
                                                        className={
                                                            'text-xs font-bold px-2 py-1 rounded-full border ' +
                                                            (item.done
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                                : 'bg-slate-50 text-slate-600 border-slate-100')
                                                        }
                                                    >
                                                        {item.done ? 'Fait' : 'À faire'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        </section>
                    ) : null}
                </div>

                {/* Right Column (Agenda) */}
                <div className="lg:col-span-1">
                    <section className="h-full">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-bold text-slate-800">Agenda</h2>
                            <button
                                onClick={() => navigate('/calendar')}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                            >
                                Tout voir
                            </button>
                        </div>
                        <div className="space-y-3">
                            {isLoading ? (
                                <>
                                    {[0, 1, 2].map((i) => (
                                        <Card key={i} className="p-3">
                                            <div className="animate-pulse flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-lg bg-slate-200" />
                                                <div className="flex-1">
                                                    <div className="h-4 w-2/3 bg-slate-200 rounded" />
                                                    <div className="mt-2 h-3 w-1/2 bg-slate-200 rounded" />
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </>
                            ) : error ? (
                                <Card className="p-6">
                                    <p className="text-sm font-medium text-slate-600">{error}</p>
                                    <button
                                        onClick={() => setReloadKey((v) => v + 1)}
                                        className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                                    >
                                        Réessayer
                                    </button>
                                </Card>
                            ) : events.length === 0 ? (
                                <div className="text-sm text-slate-500 italic text-center py-12 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200">
                                    Aucun événement futur
                                </div>
                            ) : (
                                events.map(evt => (
                                    <Card
                                        key={evt.event_id}
                                        onClick={() => handleOpenEvent(evt)}
                                        className="p-3 flex items-center gap-4 hover:bg-slate-50 transition border-l-4 border-l-transparent hover:border-l-blue-500 cursor-pointer group"
                                    >
                                        <div className="flex flex-col items-center text-slate-500 min-w-[48px] px-2 py-1 rounded-lg bg-slate-50 group-hover:bg-white transition-colors">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{format(parseISO(evt.start_date), 'MMM', { locale: fr })}</span>
                                            <span className="text-xl font-black text-slate-800">{format(parseISO(evt.start_date), 'dd')}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-slate-700 text-sm truncate group-hover:text-blue-600 transition-colors">{evt.title}</h4>
                                            <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-1">
                                                <div className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {format(parseISO(evt.start_date), 'HH:mm')}
                                                </div>
                                                {evt.location && (
                                                    <>
                                                        <span className="text-slate-300">•</span>
                                                        <div className="flex items-center gap-1 truncate">
                                                            <MapPin size={12} />
                                                            <span className="truncate">{evt.location}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronRight size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
                                    </Card>
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </div>

            <ConfirmModal
                isOpen={remindModalOpen}
                title="Relancer les réponses"
                message={
                    focusEvent && presence
                        ? `Équipe : ${focusTeamName ?? '—'}\nDestinataires : ${presence.noResponseCount} joueur(s)\n\nVous allez ouvrir les convocations de cet événement pour effectuer la relance.`
                        : undefined
                }
                confirmLabel="Ouvrir les convocations"
                cancelLabel="Annuler"
                onClose={() => setRemindModalOpen(false)}
                onConfirm={() => {
                    if (!focusEvent) return;
                    setRemindModalOpen(false);
                    navigate(`/convocations?eventId=${encodeURIComponent(focusEvent.event_id)}`);
                }}
            />
        </div>
    );
};

export default CoachDashboard;
