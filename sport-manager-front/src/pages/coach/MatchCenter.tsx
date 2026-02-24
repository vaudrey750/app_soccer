import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { applySubstitutionToLineup } from '../../utils/lineup';

// Hooks
import { useMatchEvent, useMatchLineup, useFormations, useTeamMembers } from '../../services/queries/eventQueries';
import { useUpdateMatchStatus, useAddTimelineEvent, useDeleteTimelineEvent, useUpdateMatchPossession, useVoteMotm, useUpdateMatchLineup, usePublishMatchLineup, useUpdatePlayerRatings, useResetMatch, useSelectMotmByCoach } from '../../services/mutations/eventMutations';
import { useGameSse } from '../../services/queries/sseQueries';
import { usePlayers } from '../../hooks/match/usePlayers';
import { usePitchState } from '../../hooks/match/usePitchState';
import { useMatchTimer } from '../../hooks/match/useMatchTimer';
import { useStoppageTime } from '../../hooks/match/useStoppageTime';
import { useMotmVote } from '../../hooks/match/useMotmVote';
import { useMatchSummary } from '../../hooks/match/useMatchSummary';

// Components
import { MatchHeader } from '../../components/organisms/match/MatchHeader';
import { MatchTabs } from '../../components/organisms/match/MatchTabs';
import { TacticsTab } from '../../components/organisms/match/TacticsTab';
import { LiveTab } from '../../components/organisms/match/LiveTab';
import { StatsTab } from '../../components/organisms/match/StatsTab';
import { MotmTab } from '../../components/organisms/match/MotmTab';
import { PostMatchPanel } from '../../components/organisms/match/PostMatchPanel';
import { FloatingChat } from '../../components/organisms/match/FloatingChat';

const MatchCenter: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const liveAllowedRoles = useMemo(() => new Set(['COACH', 'PRESIDENT', 'ASSISTANT', 'ADMIN']), []);
    const canManage = !!user && liveAllowedRoles.has(user.role);
    const toast = useToast();

    // UI State
    const [activeTab, setActiveTab] = useState<'tactics' | 'live' | 'stats' | 'motm'>('live');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [selectedFormation, setSelectedFormation] = useState<string>('');
    const [currentLineup, setCurrentLineup] = useState<{ [positionId: number]: string }>({});

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'tactics' || tab === 'live' || tab === 'stats' || tab === 'motm') {
            setActiveTab(tab);
        }
    }, [searchParams]);

    // Data Fetching
    const { data: event, isLoading: isEventLoading, isError: isEventError } = useMatchEvent(id);
    const { data: matchLineup, isLoading: isLineupLoading } = useMatchLineup(id);
    const { data: formations = [], isLoading: isFormationsLoading } = useFormations();
    const { data: teamMembers = [], isLoading: isMembersLoading } = useTeamMembers(event?.team_id);

    // Mutations
    const updateStatusMutation = useUpdateMatchStatus();
    const addTimelineEventMutation = useAddTimelineEvent();
    const deleteTimelineEventMutation = useDeleteTimelineEvent();
    const voteMotmMutation = useVoteMotm();
    const updateRatingsMutation = useUpdatePlayerRatings();
    const updateLineupMutation = useUpdateMatchLineup();
    const publishLineupMutation = usePublishMatchLineup();
    const updatePossessionMutation = useUpdateMatchPossession();
    const resetMatchMutation = useResetMatch();

    // SSE
    useGameSse(event?.game?.game_id, id);

    const selectMotmByCoachMutation = useSelectMotmByCoach();
    // Custom Hooks
    const players = usePlayers(event, teamMembers, matchLineup);
    const timeline = event?.game?.timeline || [];
    const { playersOnPitch, excludedPlayers } = usePitchState(timeline, currentLineup, formations, selectedFormation ? parseInt(selectedFormation) : null, players);
    const { elapsedTime, isTimerRunning, setElapsedTime } = useMatchTimer(event);
    const { stoppageStart, accumulatedStoppage, additionalTime, setAdditionalTime, toggleStoppage, resetStoppage } = useStoppageTime(id);
    const { hasVotedMotm, selectedMotmPlayerId, motmTimer, isMotmOpen, isMotmVoteWindowOpen, handleVoteMotm } = useMotmVote(
        id,
        event,
        canManage,
        async (vars) => {
            try {
                await voteMotmMutation.mutateAsync(vars);
                toast.success({ title: 'Vote enregistré' });
            } catch (err) {
                toast.error({ title: 'Vote impossible', message: getErrorMessage(err) });
                throw err;
            }
        }
    );
    const { matchStats } = useMatchSummary(timeline, event);

    const excludedMemberIds = useMemo(() => {
        const ourIds = new Set((players || []).map((p: any) => p?.member_id).filter(Boolean));
        const result = new Set<string>();
        excludedPlayers.forEach((memberId) => {
            if (ourIds.has(memberId)) result.add(memberId);
        });
        return result;
    }, [excludedPlayers, players]);

    const pitchPlayers = useMemo(() => {
        if (!players || players.length === 0) return [];
        return players.filter((p: any) => {
            const memberId = p?.member_id;
            if (!memberId) return false;
            return playersOnPitch.has(memberId);
        });
    }, [players, playersOnPitch]);

    const benchPlayers = useMemo(() => {
        if (!players || players.length === 0) return [];
        return players.filter((p: any) => {
            const memberId = p?.member_id;
            if (!memberId) return false;
            return !playersOnPitch.has(memberId);
        });
    }, [players, playersOnPitch]);

    const tacticsPlayers = useMemo(() => {
        if (!players || players.length === 0) return [];
        return players.filter((p: any) => Boolean(p?.member_id));
    }, [players]);

    const tacticsLineup = useMemo(() => {
        return currentLineup;
    }, [currentLineup]);

    useEffect(() => {
        // Source de vérité: /sport/matches/:id/lineup
        if (matchLineup?.formation?.id && !selectedFormation) {
            setSelectedFormation(matchLineup.formation.id.toString());
            return;
        }

        // Fallback legacy (au cas où le backend ne renvoie pas la formation)
        if ((event?.game as any)?.formation_id && !selectedFormation) {
            setSelectedFormation((event?.game as any).formation_id.toString());
        }
    }, [matchLineup?.formation?.id, (event?.game as any)?.formation_id, selectedFormation]);

    useEffect(() => {
        // Source de vérité: /sport/matches/:id/lineup
        if (matchLineup?.items && Object.keys(currentLineup).length === 0) {
            const mapping: { [positionId: number]: string } = {};
            matchLineup.items.forEach(i => {
                if (i.member_id) mapping[i.position_id] = i.member_id;
            });
            if (Object.keys(mapping).length > 0) {
                setCurrentLineup(mapping);
                return;
            }
        }

        // Fallback legacy
        if ((event?.game as any)?.lineup && Object.keys(currentLineup).length === 0) {
            setCurrentLineup((event?.game as any).lineup);
        }
    }, [matchLineup?.items, (event?.game as any)?.lineup, currentLineup]);

    const kickoffGuard = useMemo(() => {
        if (!canManage) return { ok: true as const, reason: '' };

        const isLive = event?.game?.status_id === 5 || event?.game?.status === 'LIVE';
        const isFinished = event?.game?.status_id === 2 || event?.game?.status === 'PLAYED';
        if (isLive || isFinished) return { ok: true as const, reason: '' };

        const formationId = selectedFormation ? parseInt(selectedFormation, 10) : NaN;
        if (!Number.isFinite(formationId)) {
            return {
                ok: false as const,
                reason: 'Choisissez une formation et renseignez les 11 titulaires avant de lancer le live.',
            };
        }

        const formation = (formations || []).find((f: any) => f?.id === formationId);
        if (!formation || !Array.isArray((formation as any).positions)) {
            return {
                ok: false as const,
                reason: 'Formation introuvable. Revenez à la compo et sélectionnez une formation.',
            };
        }

        const pitchPositions = (formation as any).positions.filter(
            (p: any) => typeof p?.role === 'string' && !p.role.startsWith('B') && p.role !== 'RES'
        );
        const requiredCount = pitchPositions.length || 11;
        const assignedIds = pitchPositions
            .map((p: any) => currentLineup[p.id])
            .filter((v: any): v is string => typeof v === 'string' && v.trim().length > 0);
        const unique = new Set(assignedIds);

        if (assignedIds.length !== requiredCount) {
            const missing = Math.max(0, requiredCount - assignedIds.length);
            return {
                ok: false as const,
                reason: `Compo incomplète : il manque ${missing} joueur(s) sur le terrain.`,
            };
        }

        if (unique.size !== requiredCount) {
            return {
                ok: false as const,
                reason: 'Compo invalide : un joueur est placé plusieurs fois sur le terrain.',
            };
        }

        return { ok: true as const, reason: '' };
    }, [canManage, currentLineup, event?.game?.status, event?.game?.status_id, formations, selectedFormation]);

    // Handlers
    const handleStatusChange = async (newStatusId: number) => {
        if (!id) return;
        if (newStatusId === 5 && !kickoffGuard.ok) {
            toast.info({ title: 'Compo requise', message: kickoffGuard.reason });
            setActiveTab('tactics');
            return;
        }
        try {
            await updateStatusMutation.mutateAsync({ eventId: id, statusId: newStatusId });
        } catch (err) {
            toast.error({ title: 'Statut non mis à jour', message: getErrorMessage(err) });
        }
    };

    const handleResetMatch = async () => {
        if (!id) return;
        try {
            resetStoppage();
            setElapsedTime(0);
            await resetMatchMutation.mutateAsync({ eventId: id });
            toast.success({ title: 'Match réinitialisé' });
        } catch (err: any) {
            toast.error({ title: 'Réinitialisation impossible', message: getErrorMessage(err, 'Réinitialisation impossible.') });
        }
    };

    const handleSaveLineup = async (formationId: number, lineup: { [positionId: number]: string }) => {
        if (!id) return;
        const items = Object.entries(lineup).map(([positionId, memberId]) => ({
            position_id: Number(positionId),
            member_id: memberId,
        }));

        try {
            await updateLineupMutation.mutateAsync({
                eventId: id!,
                payload: {
                    formation_id: formationId,
                    items,
                },
            });
            setCurrentLineup(lineup);
            setSelectedFormation(formationId.toString());
            toast.success({ title: 'Compo enregistrée' });
        } catch (err) {
            toast.error({ title: 'Compo non enregistrée', message: getErrorMessage(err) });
            throw err;
        }
    };

    const handleSetLineupPublished = async (nextPublished: boolean) => {
        if (!id) return;
        try {
            await publishLineupMutation.mutateAsync({ eventId: id!, isPublished: nextPublished });
            toast.success({ title: nextPublished ? 'Compo publiée' : 'Compo cachée' });
        } catch (err) {
            toast.error({
                title: nextPublished ? 'Publication impossible' : 'Masquage impossible',
                message: getErrorMessage(err),
            });
        }
    };

    const handlePlayerSubstitute = async (pitchPlayerId: string, benchPlayerId: string) => {
        if (!id) return;

        // Update local lineup immediately (swap positions if the incoming player is already assigned to a bench position)
        const applied = applySubstitutionToLineup(currentLineup, pitchPlayerId, benchPlayerId);
        if (!applied.ok) {
            toast.error({ title: 'Substitution impossible', message: 'Sortant introuvable dans la compo.' });
            return;
        }

        const nextLineup = applied.nextLineup;
        setCurrentLineup(nextLineup);

        const formationId = selectedFormation
            ? parseInt(selectedFormation)
            : (matchLineup?.formation?.id ?? ((event?.game as any)?.formation_id as number | undefined));

        if (!formationId || !Number.isFinite(formationId)) {
            toast.info({ title: 'Substitution appliquée', message: "Compo mise à jour localement (formation inconnue, pas de sauvegarde serveur)." });
            return;
        }

        const items = Object.entries(nextLineup).map(([positionId, memberId]) => ({
            position_id: Number(positionId),
            member_id: memberId,
        }));

        try {
            await updateLineupMutation.mutateAsync({
                eventId: id,
                payload: { formation_id: formationId, items },
            });
            toast.success({ title: 'Substitution enregistrée' });
        } catch (err) {
            toast.error({
                title: 'Substitution non sauvegardée',
                message: getErrorMessage(err, "La compo a été mise à jour localement, mais la sauvegarde a échoué."),
            });
        }
    };

    const isMatchFinished = event?.game?.status_id === 2 || event?.game?.status === 'PLAYED';

    const { totalMotmVotes, isMotmTie } = useMemo(() => {
        const values = (players || []).map((p: any) => (typeof p?.motm_votes === 'number' && Number.isFinite(p.motm_votes) ? p.motm_votes : 0));
        const total = values.reduce((s: number, v: number) => s + v, 0);
        const max = values.length > 0 ? Math.max(...values) : 0;
        const tiedCount = max > 0 ? values.filter(v => v === max).length : 0;
        return { totalMotmVotes: total, isMotmTie: max > 0 && tiedCount > 1 };
    }, [players]);

    if (isEventLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (isEventError || !event) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
                <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-slate-200">
                    <div className="font-bold text-white">Impossible de charger le match</div>
                    <div className="mt-2 text-sm text-slate-400">Vérifiez votre connexion et réessayez.</div>
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors font-bold"
                    >
                        Retour
                    </button>
                </div>
            </div>
        );
    }

    const showMotmTabForCoach = Boolean(
        canManage &&
        isMatchFinished &&
        !isMotmVoteWindowOpen &&
        (totalMotmVotes === 0 || isMotmTie)
    );

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 pb-24">
            {/* Top Navigation */}
            <div className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 px-4 py-3 flex items-center justify-between">
                <button 
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="font-bold text-white tracking-wide">
                    {event.title}
                </div>
                <div className="w-10" /> {/* Spacer */}
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                <MatchHeader 
                    event={event as any}
                    elapsedTime={elapsedTime}
                    isTimerRunning={isTimerRunning}
                    canManage={canManage}
                    additionalTime={additionalTime}
                    accumulatedStoppage={accumulatedStoppage}
                    stoppageStart={stoppageStart}
                    onToggleStoppage={toggleStoppage}
                    onSetAdditionalTime={setAdditionalTime}
                    onUpdateStatus={handleStatusChange}
                    onResetMatch={handleResetMatch}
                    hasTimeline={timeline.length > 0}
                    canStartLive={kickoffGuard.ok}
                    startLiveDisabledReason={kickoffGuard.ok ? undefined : kickoffGuard.reason}
                />

                <MatchTabs 
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    canManage={canManage}
                    isMotmOpen={isMotmOpen}
                    hasVotedMotm={hasVotedMotm}
                    isMatchFinished={isMatchFinished}
                    showMotmTabForCoach={showMotmTabForCoach}
                />

                {/* Tab Content */}
                <div className="mt-6">
                    {activeTab === 'tactics' && (
                        isFormationsLoading ? (
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-slate-200">
                                <div className="font-bold">Chargement des formations…</div>
                                <div className="mt-2 text-sm text-slate-400">Veuillez patienter.</div>
                            </div>
                        ) : (
                        <TacticsTab 
                            event={event as any}
                            players={tacticsPlayers as any}
                            formations={formations as any}
                            selectedFormation={selectedFormation}
                            lineupPublished={Boolean(matchLineup?.lineup_published ?? (event as any)?.lineup_published)}
                            handleSetLineupPublished={handleSetLineupPublished}
                            isPublishingLineup={publishLineupMutation.isPending}
                            canManage={canManage}
                            currentLineup={tacticsLineup}
                            onSaveLineup={handleSaveLineup}
                            excludedMemberIds={excludedMemberIds}
                        />
                        )
                    )}

                    {activeTab === 'live' && !isMatchFinished && (
                        (isMembersLoading || isFormationsLoading || isLineupLoading) && (players?.length ?? 0) === 0 ? (
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-slate-200">
                                <div className="font-bold">Chargement du live…</div>
                                <div className="mt-2 text-sm text-slate-400">Joueurs / formations en cours de chargement.</div>
                            </div>
                        ) : (
                        <LiveTab 
                            event={event as any}
                            allPlayers={players as any}
                            pitchPlayers={pitchPlayers as any}
                            benchPlayers={benchPlayers as any}
                            excludedMemberIds={excludedMemberIds}
                            handlePlayerSubstitute={handlePlayerSubstitute}
                            handleAddTimelineEvent={async (payload) => {
                                try {
                                    await addTimelineEventMutation.mutateAsync({ eventId: id!, payload });
                                } catch (err) {
                                    toast.error({ title: 'Action non enregistrée', message: getErrorMessage(err) });
                                    throw err;
                                }
                            }}
                            handleUpdatePossession={async (homePossession) => {
                                try {
                                    await updatePossessionMutation.mutateAsync({ eventId: id!, homePossession });
                                } catch (err) {
                                    toast.error({ title: 'Possession non enregistrée', message: getErrorMessage(err) });
                                    throw err;
                                }
                            }}
                            canManage={canManage}
                            elapsedTime={elapsedTime}
                            isTimerRunning={isTimerRunning}
                            formations={formations}
                            savedLineupId={selectedFormation ? parseInt(selectedFormation) : null}
                            currentLineup={currentLineup}
                            handleDeleteTimelineEvent={(timelineId) => {
                                if (!id) return;
                                deleteTimelineEventMutation
                                    .mutateAsync({ eventId: id, timelineId })
                                    .catch((err) => toast.error({ title: "Suppression impossible", message: getErrorMessage(err) }));
                            }}
                        />
                        )
                    )}

                    {activeTab === 'live' && isMatchFinished && (
                        <PostMatchPanel 
                            event={event as any}
                            players={players as any}
                            matchStats={matchStats}
                            canManage={canManage}
                            isSavingRatings={updateRatingsMutation.isPending}
                            onSaveRatings={async (ratings) => {
                                if (!id) return;
                                if (!isMatchFinished) return;

                                const isUuid = (value: string) =>
                                    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

                                const payload = Object.entries(ratings)
                                    .filter(([memberId, rating]) => isUuid(memberId) && typeof rating === 'number' && Number.isFinite(rating))
                                    .map(([memberId, rating]) => ({
                                        member_id: memberId,
                                        rating,
                                    }));

                                if (payload.length === 0) return;
                                try {
                                    await updateRatingsMutation.mutateAsync({ eventId: id, payload });
                                    toast.success({ title: 'Notes enregistrées' });
                                } catch (err) {
                                    toast.error({ title: 'Notes non enregistrées', message: getErrorMessage(err) });
                                }
                            }}
                        />
                    )}

                    {activeTab === 'stats' && (
                        (isMembersLoading && (players?.length ?? 0) === 0) ? (
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-slate-200">
                                <div className="font-bold">Chargement des statistiques…</div>
                                <div className="mt-2 text-sm text-slate-400">Joueurs en cours de chargement.</div>
                            </div>
                        ) : (
                            <StatsTab 
                                event={event as any}
                            />
                        )
                    )}

                    {activeTab === 'motm' && (
                        (isMembersLoading && (players?.length ?? 0) === 0) ? (
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-slate-200">
                                <div className="font-bold">Chargement…</div>
                                <div className="mt-2 text-sm text-slate-400">Joueurs en cours de chargement.</div>
                            </div>
                        ) : (
                            <MotmTab 
                                event={event as any}
                                players={players as any}
                                hasVoted={hasVotedMotm}
                                selectedPlayerId={selectedMotmPlayerId}
                                handleVoteMotm={handleVoteMotm}
                                isVotingMotm={voteMotmMutation.isPending}
                                motmTimer={motmTimer}
                                isMotmOpen={isMotmOpen}
                                isMotmVoteWindowOpen={isMotmVoteWindowOpen}
                                canManage={canManage}
                                onCoachSelectMotm={async (playerId) => {
                                    if (!id) return;
                                    try {
                                        await selectMotmByCoachMutation.mutateAsync({ eventId: id, memberId: playerId });
                                        toast.success({ title: 'Homme du match sélectionné' });
                                    } catch (err) {
                                        toast.error({ title: 'Sélection impossible', message: getErrorMessage(err) });
                                    }
                                }}
                                isSelectingCoachMotm={selectMotmByCoachMutation.isPending}
                            />
                        )
                    )}
                </div>
            </div>

            <FloatingChat 
                isChatOpen={isChatOpen}
                setIsChatOpen={setIsChatOpen}
                gameId={event?.game?.game_id}
                canManage={canManage}
            />
        </div>
    );
};

export default MatchCenter;
