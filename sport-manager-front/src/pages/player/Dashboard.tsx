import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTeam } from '../../context/TeamContext';
import { eventService, EventDTO } from '../../services/eventService';
import { memberService, MemberDTO } from '../../services/memberService';
import { statsService, PlayerStatsDTO } from '../../services/statsService';
import { Card } from '../../components/atoms/Card';
import { Button } from '../../components/atoms/Button';
import { MapPin, Calendar, Clock, CheckCircle, XCircle, ArrowRight, Trophy, IdCard, Navigation, Target, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { pickFocusEvent } from '../../utils/eventFocus';
import { getMapsSearchUrl } from '../../utils/maps';

const Dashboard: React.FC = () => {
    const { user: authUser } = useAuth();
    const { selectedTeam, teams } = useTeam();
    const navigate = useNavigate();
    const isPlayerRole = ['PLAYER', 'MEMBER'].includes(authUser?.role || '');
    const [nextMatch, setNextMatch] = useState<EventDTO | null>(null);
    const [focusEvent, setFocusEvent] = useState<EventDTO | null>(null);
    const [lastMatches, setLastMatches] = useState<EventDTO[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
    const [userName, setUserName] = useState(authUser?.firstName || 'Joueur');

    const [member, setMember] = useState<MemberDTO | null>(null);
    const [isProfileLoading, setIsProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [profileReloadKey, setProfileReloadKey] = useState(0);

    const [myStats, setMyStats] = useState<PlayerStatsDTO | null>(null);
    const [isStatsLoading, setIsStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [statsReloadKey, setStatsReloadKey] = useState(0);

    const [isUpdatingPresence, setIsUpdatingPresence] = useState(false);
    const [isPresencePanelOpen, setIsPresencePanelOpen] = useState(false);

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

    useEffect(() => {
        const loadProfile = async () => {
            if (!authUser?.id) return;
            setIsProfileLoading(true);
            setProfileError(null);
            try {
                const m = await memberService.getMember(authUser.id);
                setMember(m);
                setUserName(m.first_name || authUser.firstName);
            } catch (e) {
                console.error('Profile load error', e);
                setMember(null);
                setProfileError('Impossible de charger votre profil.');
                setUserName(authUser.firstName || 'Joueur');
            } finally {
                setIsProfileLoading(false);
            }
        };

        loadProfile();
    }, [authUser?.id, authUser?.firstName, profileReloadKey]);

    useEffect(() => {
        const loadMyStats = async () => {
            if (!authUser?.id) return;
            setIsStatsLoading(true);
            setStatsError(null);
            try {
                const s = await statsService.getMyStats(authUser.id);
                setMyStats(s);
            } catch (e) {
                console.error('Stats load error', e);
                setMyStats(null);
                setStatsError('Impossible de charger vos statistiques.');
            } finally {
                setIsStatsLoading(false);
            }
        };

        loadMyStats();
    }, [authUser?.id, statsReloadKey]);

    useEffect(() => {
        const loadDashboard = async () => {
            if (!authUser?.id) return;

            setIsLoading(true);
            setError(null);
            try {
                const allowedTeamIds = teams.map(t => t.team_id);

                const allEvents = await eventService.getEvents(selectedTeam?.team_id, allowedTeamIds);
                const focus = pickFocusEvent(allEvents);
                const focusEvt = focus?.event ?? null;
                setFocusEvent(focusEvt);

                if (focusEvt?.type === 'match') {
                    setNextMatch(focusEvt);
                } else {
                    const match = await eventService.getNextMatch(selectedTeam?.team_id, allowedTeamIds);
                    setNextMatch(match);
                }

                const pastMatches = await eventService.getLastMatches(5, selectedTeam?.team_id, allowedTeamIds);
                setLastMatches(pastMatches);

                setLastUpdatedAt(new Date());
            } catch (error) {
                console.error('Dashboard error', error);
                setError('Impossible de charger le dashboard.');
            } finally {
                setIsLoading(false);
            }
        };

        loadDashboard();
    }, [authUser?.id, selectedTeam, teams, reloadKey]);

    useEffect(() => {
        setIsPresencePanelOpen(false);
    }, [nextMatch?.event_id, nextMatch?.status_id]);

    const handleOpenEvent = (evt: EventDTO) => navigate(`/events/${evt.event_id}`);

    const handlePresence = async (status: 'present' | 'absent' | 'maybe') => {
        if (!nextMatch || !authUser?.id) return;
        try {
            await eventService.setParticipation(nextMatch.event_id, authUser.id, status);
            // Optimistic update
            setNextMatch(prev => prev ? { ...prev, status: status } : null);
        } catch (error) {
            console.error("Failed to set presence", error);
        }
    };

    const handleQuickPresence = async (status: 'present' | 'absent') => {
        if (isUpdatingPresence) return;
        setIsUpdatingPresence(true);
        try {
            await handlePresence(status);
            setIsPresencePanelOpen(false);
        } finally {
            setIsUpdatingPresence(false);
        }
    };

    const getResult = (event: EventDTO) => {
        if (!event.game) return '-';
        const { score_home, score_away, is_home } = event.game;
        if (typeof score_home !== 'number' || typeof score_away !== 'number') return '-';
        
        // Logic: V = Victoire, D = Défaite, N = Nul
        let myScore = is_home ? score_home : score_away;
        let oppScore = is_home ? score_away : score_home;
        
        if (myScore > oppScore) return 'W'; // W for logic
        if (myScore < oppScore) return 'L';
        return 'D';
    };

    const formSequence = lastMatches
        .map((m) => {
            const r = getResult(m);
            if (r === 'W') return 'W' as const;
            if (r === 'L') return 'L' as const;
            if (r === 'D') return 'D' as const;
            return '-' as const;
        })
        .slice(0, 5);

    const ratingFromStats = typeof myStats?.average_rating === 'number' ? myStats.average_rating : undefined;

    const ratingFromRecentMatches = (() => {
        if (!authUser?.id) return undefined;
        const values = lastMatches
            .map((m) => m.participants?.find((p) => p.member_id === authUser.id)?.rating)
            .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
        if (values.length === 0) return undefined;
        const sum = values.reduce((acc, v) => acc + v, 0);
        return sum / values.length;
    })();

    const overallRating = ratingFromStats ?? ratingFromRecentMatches ?? 6.5;
    const careerProgress = computeCareerProgress(myStats);

    const challenges = (() => {
        const weekly = (() => {
            const statusId = nextMatch?.status_id;
            const hasConfirmedPresence = statusId === 2 || statusId === 3 || statusId === 4;
            const title = 'Confirmer ma présence';

            if (!nextMatch || nextMatch.type !== 'match') {
                return {
                    kind: 'weekly' as const,
                    title,
                    description: 'Aucun événement à venir pour confirmer.',
                    done: false,
                };
            }

            return {
                kind: 'weekly' as const,
                title,
                description: hasConfirmedPresence ? 'C’est fait pour le prochain événement.' : 'À faire pour le prochain événement.',
                done: hasConfirmedPresence,
            };
        })();

        const match = (() => {
            if (!focusEvent || focusEvent.type !== 'match') return null;
            const locationValue = focusEvent.location || focusEvent.game?.location;
            const hasLocation = Boolean(locationValue && locationValue.trim().length > 0);
            return {
                kind: 'match' as const,
                title: 'Préparer le match',
                description: hasLocation ? 'Lieu confirmé.' : 'Lieu à confirmer.',
                done: hasLocation,
            };
        })();

        return { weekly, match };
    })();

    const focusTeamName = focusEvent?.team_id ? teams.find(t => t.team_id === focusEvent.team_id)?.name : undefined;
    const shouldShowFocusTeamBadge = Boolean(focusTeamName) && teams.length > 1 && !selectedTeam;

    const openItinerary = (location: string) => {
        const url = getMapsSearchUrl(location);
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const shouldShowQuickPresenceCtas = (() => {
        if (!nextMatch) return false;
        if (!isPlayerRole) return false;
        if (nextMatch.type !== 'match') return false;
        const start = new Date(nextMatch.start_date);
        if (Number.isNaN(start.getTime())) return false;
        if (start <= new Date()) return false;
        return nextMatch.status_id === 1 || nextMatch.status_id === 6;
    })();

    return (
        <div className="p-4 space-y-6 container mx-auto w-full pt-8 pb-24 px-4 sm:px-6 lg:px-8 animate-fade-in">
            {/* --- HEADER --- */}
            <div className="flex flex-col gap-1">
                <span className="text-slate-500 font-medium uppercase tracking-wider text-sm">Bon retour sur le terrain,</span>
                <h1 className="text-2xl font-black text-slate-800">
                    {userName} <span className="text-indigo-600">!</span>
                </h1>
            </div>

            {/* --- QUICK ACTIONS GRID --- */}
            <section>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Card
                        onClick={() => navigate('/calendar')}
                        className="p-4 flex flex-col items-center justify-center gap-2 bg-indigo-50 border-indigo-100 hover:bg-indigo-100 transition-colors cursor-pointer group h-full"
                    >
                        <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                            <Calendar size={20} />
                        </div>
                        <span className="text-xs font-bold text-indigo-900">Calendrier</span>
                    </Card>

                    <Card
                        onClick={() => navigate('/career')}
                        className="p-4 flex flex-col items-center justify-center gap-2 bg-white border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group h-full"
                    >
                        <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-200 group-hover:scale-110 transition-transform">
                            <IdCard size={20} />
                        </div>
                        <span className="text-xs font-bold text-slate-700">Carrière</span>
                    </Card>

                    <Card
                        onClick={() => navigate('/statistics')}
                        className="p-4 flex flex-col items-center justify-center gap-2 bg-white border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group h-full"
                    >
                        <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
                            <Trophy size={20} />
                        </div>
                        <span className="text-xs font-bold text-slate-700">Statistiques</span>
                    </Card>
                </div>
            </section>

            {/* --- ÉVÉNEMENT FOCUS --- */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            Événement focus
                        </h2>
                        {lastUpdatedAt && !isLoading && (
                            <span className="text-xs font-semibold text-slate-500">
                                Dernière mise à jour : {lastUpdatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>
                    {focusEvent && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-indigo-600"
                            onClick={() => navigate('/calendar')}
                        >
                            Voir tout <ArrowRight size={14} className="ml-1" />
                        </Button>
                    )}
                </div>

                {isLoading ? (
                    <Card className="h-44 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
                    </Card>
                ) : error ? (
                    <Card className="text-center py-10">
                        <h3 className="text-lg font-bold text-slate-800 mb-1">Erreur</h3>
                        <p className="text-slate-600 text-sm">{error}</p>
                        <div className="mt-4">
                            <Button variant="secondary" onClick={() => setReloadKey((v) => v + 1)}>
                                Réessayer
                            </Button>
                        </div>
                    </Card>
                ) : focusEvent?.type === 'match' && nextMatch ? (
                    <Card noPadding className="relative overflow-hidden p-5 border-indigo-100 shadow-lg shadow-indigo-500/10">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/12 rounded-full blur-[90px] -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-[70px] translate-y-1/2 -translate-x-1/2" />

                        <div className="relative z-10">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Match</div>
                                        {shouldShowFocusTeamBadge && (
                                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                                                {focusTeamName}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-slate-700 truncate">
                                        {nextMatch.game?.competition_name || 'Compétition'}
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="flex items-center justify-end gap-2 text-slate-600">
                                        <Calendar size={14} />
                                        <span className="text-xs font-bold uppercase tracking-widest">
                                            {new Date(nextMatch.start_date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-slate-700 flex items-center justify-end gap-2">
                                        <Clock size={14} />
                                        {new Date(nextMatch.start_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 grid grid-cols-3 items-center gap-3">
                                <div className="text-center">
                                    <div className="mx-auto w-12 h-12 rounded-full bg-white text-slate-900 flex items-center justify-center font-black border-2 border-indigo-500/60">
                                        {nextMatch.game?.home_team_name?.substring(0, 2) || 'H'}
                                    </div>
                                    <div className="mt-2 text-sm font-black text-slate-800 truncate">
                                        {nextMatch.game?.home_team_name || 'Domicile'}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-black text-slate-900/20 italic">VS</div>
                                    <div className="mt-2 flex flex-col items-center gap-2">
                                        {nextMatch.game?.location ? (
                                            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                                                <MapPin size={12} />
                                                <span className="max-w-[160px] truncate">{nextMatch.game.location}</span>
                                            </div>
                                        ) : (
                                            <div className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                                Lieu à confirmer
                                            </div>
                                        )}

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={!nextMatch.game?.location}
                                            title={!nextMatch.game?.location ? 'Lieu manquant' : 'Ouvrir l’itinéraire'}
                                            onClick={() => nextMatch.game?.location && openItinerary(nextMatch.game.location)}
                                        >
                                            <Navigation size={14} className="mr-2" />
                                            Itinéraire
                                        </Button>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="mx-auto w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-black border-2 border-slate-800">
                                        {nextMatch.game?.away_team_name?.substring(0, 2) || 'A'}
                                    </div>
                                    <div className="mt-2 text-sm font-black text-slate-800 truncate">
                                        {nextMatch.game?.away_team_name || 'Extérieur'}
                                    </div>
                                </div>
                            </div>

                            {/* Présence (1 bouton -> mini panneau) */}
                            {shouldShowQuickPresenceCtas ? (
                                <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Présence</div>
                                            <div className="text-sm font-semibold text-slate-700 truncate">À confirmer</div>
                                        </div>
                                        <div className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg">
                                            Action requise
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <Button
                                            variant="secondary"
                                            className="w-full justify-between"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsPresencePanelOpen((v) => !v);
                                            }}
                                            disabled={isUpdatingPresence}
                                            isLoading={isUpdatingPresence}
                                        >
                                            Confirmer ma présence
                                            <span className="ml-2 text-slate-400">{isPresencePanelOpen ? '—' : '+'}</span>
                                        </Button>

                                        {isPresencePanelOpen && (
                                            <div className="mt-3 grid grid-cols-2 gap-3">
                                                <Button
                                                    variant="secondary"
                                                    className="border-emerald-200/60 hover:border-emerald-200 text-emerald-700 hover:text-emerald-700"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleQuickPresence('present');
                                                    }}
                                                    disabled={isUpdatingPresence}
                                                    isLoading={isUpdatingPresence}
                                                >
                                                    <CheckCircle size={16} className="mr-2" />
                                                    Présent
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    className="border-red-200/60 hover:border-red-200 text-red-600 hover:text-red-600"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleQuickPresence('absent');
                                                    }}
                                                    disabled={isUpdatingPresence}
                                                    isLoading={isUpdatingPresence}
                                                >
                                                    <XCircle size={16} className="mr-2" />
                                                    Absent
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            <div className="mt-5 grid grid-cols-2 gap-3">
                                <Button variant="primary" onClick={() => navigate(`/events/${nextMatch.event_id}`)}>
                                    Ouvrir
                                </Button>
                                <Button variant="ghost" className="text-indigo-600" onClick={() => navigate('/calendar')}>
                                    Calendrier
                                </Button>
                            </div>
                        </div>
                    </Card>
                ) : focusEvent ? (
                    <Card className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleOpenEvent(focusEvent)}>
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        {focusEvent.type === 'training' ? 'Entraînement' : 'Événement'}
                                    </div>
                                    {shouldShowFocusTeamBadge && (
                                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                                            {focusTeamName}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xl font-black text-slate-800 truncate">{focusEvent.title}</div>
                                <div className="mt-2 text-sm font-medium text-slate-500 flex items-center gap-2">
                                    <Calendar size={14} className="text-indigo-400" />
                                    {new Date(focusEvent.start_date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}
                                    <span className="text-slate-300">•</span>
                                    <Clock size={14} className="text-indigo-400" />
                                    {new Date(focusEvent.start_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    {focusEvent.location ? (
                                        <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                            <MapPin size={12} className="text-indigo-400" />
                                            <span className="truncate">{focusEvent.location}</span>
                                        </div>
                                    ) : (
                                        <div className="text-xs font-semibold text-slate-500">Lieu à confirmer</div>
                                    )}

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={!focusEvent.location}
                                        title={!focusEvent.location ? 'Lieu manquant' : 'Ouvrir l’itinéraire'}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!focusEvent.location) return;
                                            openItinerary(focusEvent.location);
                                        }}
                                    >
                                        <Navigation size={14} className="mr-2" />
                                        Itinéraire
                                    </Button>
                                </div>
                            </div>
                            <div className="text-indigo-700 text-sm font-bold bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg">
                                Ouvrir
                            </div>
                        </div>
                    </Card>
                ) : (
                    <Card className="text-center py-12">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                            <Calendar size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1">Aucun événement prévu</h3>
                        <p className="text-slate-600 text-sm">Votre calendrier est vide pour le moment.</p>
                    </Card>
                )}
            </section>

            {/* --- DÉFIS (V1-P1) --- */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <Target className="text-slate-400" size={18} />
                    <h2 className="text-lg font-bold text-slate-800">Défis</h2>
                    <span className="text-xs font-semibold text-slate-500">1 hebdo + 1 match max</span>
                </div>

                {(isProfileLoading || isStatsLoading || isLoading) ? (
                    <Card className="p-6">
                        <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="h-20 bg-slate-200 rounded-2xl" />
                            <div className="h-20 bg-slate-200 rounded-2xl" />
                        </div>
                    </Card>
                ) : (
                    <Card className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-slate-100 bg-white p-4 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hebdo</div>
                                    <div className="mt-1 font-bold text-slate-800 truncate">{challenges.weekly.title}</div>
                                    <div className="mt-1 text-sm text-slate-600">{challenges.weekly.description}</div>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                    {challenges.weekly.done ? (
                                        <CheckCircle2 size={18} className="text-emerald-600" />
                                    ) : (
                                        <Circle size={18} className="text-slate-300" />
                                    )}
                                    <span
                                        className={
                                            'text-xs font-bold px-2 py-1 rounded-full border ' +
                                            (challenges.weekly.done
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                : 'bg-slate-50 text-slate-600 border-slate-100')
                                        }
                                    >
                                        {challenges.weekly.done ? 'Fait' : 'À faire'}
                                    </span>
                                </div>
                            </div>

                            {challenges.match ? (
                                <div className="rounded-2xl border border-slate-100 bg-white p-4 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Match</div>
                                        <div className="mt-1 font-bold text-slate-800 truncate">{challenges.match.title}</div>
                                        <div className="mt-1 text-sm text-slate-600">{challenges.match.description}</div>
                                    </div>
                                    <div className="shrink-0 flex items-center gap-2">
                                        {challenges.match.done ? (
                                            <CheckCircle2 size={18} className="text-emerald-600" />
                                        ) : (
                                            <Circle size={18} className="text-slate-300" />
                                        )}
                                        <span
                                            className={
                                                'text-xs font-bold px-2 py-1 rounded-full border ' +
                                                (challenges.match.done
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                    : 'bg-slate-50 text-slate-600 border-slate-100')
                                            }
                                        >
                                            {challenges.match.done ? 'Fait' : 'À faire'}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-slate-100 bg-white p-4 flex items-center justify-between">
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Match</div>
                                        <div className="mt-1 font-bold text-slate-800 truncate">Aucun défi match</div>
                                        <div className="mt-1 text-sm text-slate-600">Le prochain match définira ce défi.</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                )}
            </section>

            {/* --- MA CARRIÈRE (FUT) --- */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800">Ma carrière</h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-indigo-600"
                        onClick={() => navigate('/career')}
                    >
                        Ouvrir <ArrowRight size={14} className="ml-1" />
                    </Button>
                </div>

                <Card noPadding className="relative overflow-hidden p-5">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[90px] -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-[70px] translate-y-1/2 -translate-x-1/2" />

                    {(isProfileLoading || isStatsLoading) ? (
                        <div className="animate-pulse flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-slate-200" />
                            <div className="flex-1">
                                <div className="h-4 w-40 bg-slate-200 rounded" />
                                <div className="mt-2 h-3 w-24 bg-slate-200 rounded" />
                                <div className="mt-3 h-2 w-full bg-slate-200 rounded" />
                            </div>
                        </div>
                    ) : profileError ? (
                        <div>
                            <div className="font-bold text-slate-800">Erreur</div>
                            <div className="mt-1 text-sm text-slate-600">{profileError}</div>
                            <div className="mt-4">
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        setProfileReloadKey((k) => k + 1);
                                        setStatsReloadKey((k) => k + 1);
                                    }}
                                >
                                    Réessayer
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="inline-flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Progression</span>
                                        <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-full">
                                            NIV {careerProgress.level}
                                        </span>
                                    </div>
                                    <div className="mt-2 text-xl font-black text-slate-800 truncate">
                                        {member ? `${member.first_name} ${member.last_name}`.trim() : userName}
                                    </div>
                                    <div className="mt-1 text-sm font-bold text-slate-600">
                                        Note&nbsp;:
                                        <span className="ml-2 text-slate-800 font-black">{overallRating.toFixed(1)}</span>
                                        <span className="text-slate-500">/10</span>
                                    </div>
                                    <div className="mt-3">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            <span>XP</span>
                                            <span>
                                                {careerProgress.xp.current}/{careerProgress.xp.next}
                                            </span>
                                        </div>
                                        <div className="mt-1 h-2 w-full rounded-full overflow-hidden bg-slate-100">
                                            <div
                                                className="h-2 rounded-full bg-indigo-600"
                                                style={{ width: `${(careerProgress.xp.current / careerProgress.xp.next) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    variant="secondary"
                                    className="shrink-0"
                                    onClick={() => navigate('/career')}
                                >
                                    Voir ma carte
                                </Button>
                            </div>

                            <div className="grid grid-cols-5 gap-2 max-w-[360px]">
                                {formSequence.map((res, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            'w-10 h-8 rounded-xl flex items-center justify-center text-xs font-black border',
                                            res === 'W'
                                                ? 'bg-emerald-500 text-white border-white/10'
                                                : res === 'L'
                                                    ? 'bg-red-500 text-white border-white/10'
                                                    : res === 'D'
                                                        ? 'bg-slate-400 text-white border-white/10'
                                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                        )}
                                        title={res === 'W' ? 'Victoire' : res === 'L' ? 'Défaite' : res === 'D' ? 'Nul' : '—'}
                                    >
                                        {res === 'W' ? 'V' : res === 'L' ? 'D' : res === 'D' ? 'N' : '—'}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}


                    {statsError && !isStatsLoading && (
                        <div className="mt-3 text-xs text-slate-500">{statsError}</div>
                    )}
                </Card>
            </section>
        </div>
    );
}

export default Dashboard;
