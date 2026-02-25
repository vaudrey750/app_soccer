import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, addMinutes, addYears, format, isAfter, isBefore, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
    AlertCircle,
    BarChart3,
    Calendar,
    Clock,
    RefreshCw,
    Shield,
    Trophy,
    Users,
} from 'lucide-react';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { useAuth } from '../../context/AuthContext';
import { useTeam } from '../../context/TeamContext';
import { eventService, type EventDTO } from '../../services/eventService';
import { memberService, type MemberDTO } from '../../services/memberService';
import { referenceService, type SeasonDTO } from '../../services/referenceService';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../utils/cn';

type Role = string;

const toRole = (role: Role | undefined) => String(role ?? '').toUpperCase();

const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const { selectedTeam, teams, isLoading: isTeamsLoading } = useTeam();
    const navigate = useNavigate();
    const toast = useToast();

    const [members, setMembers] = useState<MemberDTO[]>([]);
    const [events, setEvents] = useState<EventDTO[]>([]);
    const [activeSeason, setActiveSeason] = useState<SeasonDTO | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const [roleTargetMemberId, setRoleTargetMemberId] = useState<string>('');
    const [roleNextValue, setRoleNextValue] = useState<string>('COACH');
    const [isUpdatingRole, setIsUpdatingRole] = useState(false);

    const canManageSeason = useMemo(() => ['ADMIN', 'PRESIDENT'].includes(toRole(user?.role)), [user?.role]);
    const [isSeasonEditing, setIsSeasonEditing] = useState(false);
    const [seasonStartDraft, setSeasonStartDraft] = useState<string>('');
    const [seasonEndDraft, setSeasonEndDraft] = useState<string>('');
    const [isSavingSeason, setIsSavingSeason] = useState(false);

    const title = useMemo(() => (user?.role === 'PRESIDENT' ? 'Espace Président' : 'Espace Admin'), [user?.role]);

    const modeLabel = selectedTeam ? `Mode équipe : ${selectedTeam.name}` : 'Mode club : toutes équipes';

    const allowedTeamIds = useMemo(() => teams.map((t) => t.team_id), [teams]);

    const weekendRange = useMemo(() => {
        // Même définition que le dashboard coach: prochain week-end (samedi → dimanche).
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
        const load = async () => {
            if (isTeamsLoading) return;

            setIsLoading(true);
            setError(null);
            try {
                const [membersRes, eventsRes, seasonRes] = await Promise.all([
                    memberService.getMembers(),
                    eventService.getEvents(undefined, allowedTeamIds),
                    referenceService.getActiveSeason(),
                ]);
                setMembers(membersRes);
                setEvents(eventsRes);
                setActiveSeason(seasonRes);
                setSeasonStartDraft(seasonRes?.start_date ? String(seasonRes.start_date) : '');
                setSeasonEndDraft(seasonRes?.end_date ? String(seasonRes.end_date) : '');
            } catch (e) {
                console.error('Admin dashboard load error', e);
                setError('Impossible de charger le dashboard admin.');
                setMembers([]);
                setEvents([]);
                setActiveSeason(null);
                setSeasonStartDraft('');
                setSeasonEndDraft('');
            } finally {
                setIsLoading(false);
            }
        };

        load();
    }, [allowedTeamIds, isTeamsLoading, reloadKey]);

    const memberCount = members.length;
    const blockedCount = members.filter((m) => Boolean(m.is_access_blocked)).length;

    const cotisations = useMemo(() => {
        const paid = members.filter((m) => String(m.contribution_status ?? '').toUpperCase() === 'PAID').length;
        const unpaid = Math.max(0, members.length - paid);
        return { paid, unpaid };
    }, [members]);

    const growthByCategory = useMemo(() => {
        const teamById = new Map(teams.map((t) => [t.team_id, t] as const));
        const categoryToMembers = new Map<string, Set<string>>();

        for (const m of members) {
            const teamIds = Array.isArray(m.team_ids) ? m.team_ids : [];
            for (const teamId of teamIds) {
                const team = teamById.get(teamId);
                const category = (team?.category && String(team.category).trim()) || 'Autre';
                if (!categoryToMembers.has(category)) categoryToMembers.set(category, new Set());
                categoryToMembers.get(category)!.add(m.member_id);
            }
        }

        const rows = Array.from(categoryToMembers.entries()).map(([category, set]) => ({
            category,
            count: set.size,
        }));

        rows.sort((a, b) => b.count - a.count);
        return rows;
    }, [members, teams]);

    const weekendPerformance = useMemo(() => {
        const inWeekend = (iso: string) => {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return false;
            return d >= weekendRange.start && d <= weekendRange.end;
        };

        const matches = events.filter((e) => e.type === 'match' && inWeekend(e.start_date) && e.game);

        const played = matches.filter((m) =>
            typeof m.game?.score_home === 'number' && typeof m.game?.score_away === 'number'
        );

        const wins = played.filter((m) => {
            const g = m.game!;
            const home = g.score_home as number;
            const away = g.score_away as number;
            const myScore = g.is_home ? home : away;
            const oppScore = g.is_home ? away : home;
            return myScore > oppScore;
        }).length;

        const total = played.length;
        const pct = total ? Math.round((wins / total) * 100) : null;
        return { wins, total, pct };
    }, [events, weekendRange.end, weekendRange.start]);

    const alerts = useMemo(() => {
        const missingMedical = members.filter((m) => !m.medical_certificate_date).length;

        const now = new Date();
        const soonLimit = addDays(now, 30);
        const expiringSoonMedical = members.filter((m) => {
            if (!m.medical_certificate_date) return false;
            const cert = parseISO(String(m.medical_certificate_date));
            if (Number.isNaN(cert.getTime())) return false;
            const expiry = addYears(cert, 1);
            return isAfter(expiry, now) && isBefore(expiry, soonLimit);
        }).length;

        // Licences: elles expirent en fin de saison (annuelle).
        // Source: saison active configurée par l'admin (fallback 30/06 si indisponible).
        const seasonEndFromApi = activeSeason?.end_date ? parseISO(String(activeSeason.end_date)) : null;
        const seasonEndFromApiValid = seasonEndFromApi && !Number.isNaN(seasonEndFromApi.getTime()) ? seasonEndFromApi : null;

        const fallbackSeasonEndBase = new Date(now.getFullYear(), 5, 30, 23, 59, 59, 999); // June=5 (0-based)
        const fallbackSeasonEnd = isAfter(now, fallbackSeasonEndBase)
            ? new Date(now.getFullYear() + 1, 5, 30, 23, 59, 59, 999)
            : fallbackSeasonEndBase;

        const seasonEnd = seasonEndFromApiValid
            ? new Date(seasonEndFromApiValid.getFullYear(), seasonEndFromApiValid.getMonth(), seasonEndFromApiValid.getDate(), 23, 59, 59, 999)
            : fallbackSeasonEnd;
        const msLeft = seasonEnd.getTime() - now.getTime();
        const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

        // Proxy "licenciés" = membres rattachés à au moins une équipe.
        const licensedCount = members.filter((m) => (m.team_ids?.length ?? 0) > 0).length;

        return { missingMedical, expiringSoonMedical, seasonEnd, daysLeft, licensedCount };
    }, [activeSeason?.end_date, members]);

    const handleSeasonSave = async () => {
        if (!canManageSeason) return;
        if (!seasonStartDraft || !seasonEndDraft) return;

        setIsSavingSeason(true);
        try {
            const updated = await referenceService.updateActiveSeason({ start_date: seasonStartDraft, end_date: seasonEndDraft });
            setActiveSeason(updated);
            setIsSeasonEditing(false);
            toast.success({ title: 'Saison mise à jour' });
        } catch (e) {
            console.error('Failed to update season', e);
            toast.error({ title: 'Impossible de modifier la saison' });
        } finally {
            setIsSavingSeason(false);
        }
    };

    const staffDirectory = useMemo(() => {
        const staffRoles = new Set(['COACH', 'ASSISTANT', 'STAFF', 'ADMIN', 'PRESIDENT']);
        const staff = members.filter((m) => staffRoles.has(toRole(m.role)));
        staff.sort((a, b) => {
            const aName = `${a.last_name ?? ''} ${a.first_name ?? ''}`.trim().toLowerCase();
            const bName = `${b.last_name ?? ''} ${b.first_name ?? ''}`.trim().toLowerCase();
            return aName.localeCompare(bName);
        });
        return staff;
    }, [members]);

    const roleCandidates = useMemo(() => {
        const disallowed = new Set(['ADMIN', 'PRESIDENT']);
        return members
            .filter((m) => !disallowed.has(toRole(m.role)))
            .sort((a, b) => {
                const aName = `${a.last_name ?? ''} ${a.first_name ?? ''}`.trim().toLowerCase();
                const bName = `${b.last_name ?? ''} ${b.first_name ?? ''}`.trim().toLowerCase();
                return aName.localeCompare(bName);
            });
    }, [members]);

    const handleRoleUpdate = async () => {
        if (!roleTargetMemberId) return;
        if (!roleNextValue) return;

        setIsUpdatingRole(true);
        try {
            await memberService.updateMember(roleTargetMemberId, { role: roleNextValue });
            toast.success({ title: 'Rôle mis à jour' });
            setReloadKey((k) => k + 1);
        } catch (e) {
            console.error('Failed to update role', e);
            toast.error({ title: 'Impossible de modifier le rôle' });
        } finally {
            setIsUpdatingRole(false);
        }
    };

    const collisions = useMemo(() => {
        const now = new Date();
        const horizon = addDays(now, 14);

        const getStart = (e: EventDTO) => {
            const d = new Date(e.start_date);
            return Number.isNaN(d.getTime()) ? null : d;
        };

        const getEnd = (e: EventDTO, start: Date) => {
            if (e.end_date) {
                const d = new Date(e.end_date);
                if (!Number.isNaN(d.getTime())) return d;
            }
            const minutes = e.type === 'match' ? 120 : e.type === 'meeting' ? 60 : 90;
            return addMinutes(start, minutes);
        };

        const relevant = events
            .filter((e) => Boolean((e.location ?? '').trim()))
            .map((e) => {
                const start = getStart(e);
                if (!start) return null;
                const end = getEnd(e, start);
                return { e, start, end, locationKey: String(e.location).trim().toLowerCase() };
            })
            .filter((x): x is NonNullable<typeof x> => Boolean(x))
            .filter((x) => x.start >= now && x.start <= horizon);

        const byLocation = new Map<string, typeof relevant>();
        for (const row of relevant) {
            const list = byLocation.get(row.locationKey) ?? [];
            list.push(row);
            byLocation.set(row.locationKey, list);
        }

        const conflicts: Array<{ location: string; a: EventDTO; b: EventDTO; start: Date }> = [];
        for (const [locationKey, list] of byLocation.entries()) {
            list.sort((x, y) => x.start.getTime() - y.start.getTime());
            for (let i = 0; i < list.length - 1; i++) {
                const cur = list[i];
                const next = list[i + 1];
                if (next.start < cur.end) {
                    conflicts.push({
                        location: locationKey,
                        a: cur.e,
                        b: next.e,
                        start: next.start,
                    });
                }
            }
        }

        conflicts.sort((x, y) => x.start.getTime() - y.start.getTime());
        return conflicts;
    }, [events]);

    const clubEvents = useMemo(() => {
        const now = new Date();
        const limit = addDays(now, 30);
        return events
            .filter((e) => e.type !== 'match' && e.type !== 'training')
            .filter((e) => {
                const d = new Date(e.start_date);
                if (Number.isNaN(d.getTime())) return false;
                return d >= now && d <= limit;
            })
            .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
            .slice(0, 8);
    }, [events]);

    const maxGrowth = Math.max(1, ...growthByCategory.map((r) => r.count));
    const weekendLabel = `${format(weekendRange.start, 'EEE d MMM', { locale: fr })} → ${format(weekendRange.end, 'EEE d MMM', { locale: fr })}`;

    const showIamControls = user?.role === 'ADMIN';

    return (
        <div className="p-4 space-y-6 container mx-auto w-full pt-8 pb-24 px-4 sm:px-6 lg:px-8 animate-fade-in">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Shield className="text-slate-900" size={20} />
                        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
                    </div>
                    <p className="text-slate-600 mt-1">{modeLabel}</p>
                </div>

                <Button
                    variant="secondary"
                    onClick={() => setReloadKey((k) => k + 1)}
                    disabled={isLoading || isTeamsLoading}
                    className="shrink-0"
                >
                    <RefreshCw size={16} className={cn(isLoading ? 'animate-spin' : '')} />
                    <span className="ml-2">Rafraîchir</span>
                </Button>
            </div>

            {error && (
                <Card className="p-4 border border-red-200 bg-red-50">
                    <div className="flex items-start gap-3">
                        <AlertCircle size={18} className="text-red-600 mt-0.5" />
                        <div className="text-sm text-red-700">{error}</div>
                    </div>
                </Card>
            )}

            {/* 1) OVERVIEW */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">1. Vue d’Ensemble du Club</h2>
                    <div className="text-xs font-semibold text-slate-500">Week-end : {weekendLabel}</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-slate-600 text-sm">KPIs financiers</div>
                                <div className="text-slate-900 font-semibold mt-1">Cotisations (proxy)</div>
                                <div className="text-slate-600 text-sm mt-2">
                                    Payées : <span className="font-semibold text-slate-900">{isLoading ? '…' : cotisations.paid}</span>
                                    <span className="mx-2">•</span>
                                    Impayées : <span className="font-semibold text-slate-900">{isLoading ? '…' : cotisations.unpaid}</span>
                                </div>
                                <div className="text-xs text-slate-500 mt-2">Basé sur `contribution_status` (montants non fournis par l’API).</div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <Trophy size={20} className="text-slate-700" />
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-slate-600 text-sm">Performance globale</div>
                                <div className="text-slate-900 font-semibold mt-1">Victoires week-end</div>
                                <div className="text-slate-600 text-sm mt-2">
                                    {isLoading ? (
                                        '…'
                                    ) : weekendPerformance.pct === null ? (
                                        'Aucun match joué'
                                    ) : (
                                        <>
                                            <span className="font-semibold text-slate-900">{weekendPerformance.pct}%</span>
                                            <span className="ml-2 text-slate-500">({weekendPerformance.wins}/{weekendPerformance.total})</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <BarChart3 size={20} className="text-slate-700" />
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card className="p-4 lg:col-span-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-slate-600 text-sm">Croissance</div>
                                <div className="text-slate-900 font-semibold mt-1">Licenciés actifs par catégorie</div>
                                <div className="text-xs text-slate-500 mt-1">Proxy via l’appartenance aux équipes.</div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <Users size={20} className="text-slate-700" />
                            </div>
                        </div>

                        <div className="mt-4 space-y-2">
                            {isLoading ? (
                                <div className="text-sm text-slate-500">Chargement…</div>
                            ) : growthByCategory.length === 0 ? (
                                <div className="text-sm text-slate-500">Aucune donnée de catégorie (équipes/rosters).</div>
                            ) : (
                                growthByCategory.slice(0, 8).map((row) => (
                                    <div key={row.category} className="flex items-center gap-3">
                                        <div className="w-20 text-xs font-semibold text-slate-600 truncate">{row.category}</div>
                                        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                            <div
                                                className="h-full bg-slate-900/70"
                                                style={{ width: `${Math.round((row.count / maxGrowth) * 100)}%` }}
                                            />
                                        </div>
                                        <div className="w-10 text-right text-xs font-semibold text-slate-700">{row.count}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-slate-600 text-sm">Alertes</div>
                                <div className="text-slate-900 font-semibold mt-1">Conformité</div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <AlertCircle size={20} className="text-slate-700" />
                            </div>
                        </div>

                        <div className="mt-4 space-y-2 text-sm text-slate-700">
                            <div className="flex items-center justify-between">
                                <span>Certificats manquants</span>
                                <span className="font-semibold text-slate-900">{isLoading ? '…' : alerts.missingMedical}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Certificats expirant bientôt</span>
                                <span className="font-semibold text-slate-900">{isLoading ? '…' : alerts.expiringSoonMedical}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Licences (fin de saison)</span>
                                <span className="font-semibold text-slate-900">{isLoading ? '…' : `${alerts.daysLeft}j`}</span>
                            </div>
                        </div>

                        {!isLoading && (
                            <div className="mt-2 text-xs text-slate-500">
                                Saison {activeSeason?.name ? `: ${activeSeason.name}` : ''} • Fin : {format(alerts.seasonEnd, 'dd/MM/yyyy', { locale: fr })} • Licenciés concernés (proxy) : {alerts.licensedCount}
                            </div>
                        )}

                        {canManageSeason && !isLoading && (
                            <div className="mt-3">
                                {!isSeasonEditing ? (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setIsSeasonEditing(true)}
                                        className="w-full"
                                    >
                                        Modifier la période de saison
                                    </Button>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="date"
                                                value={seasonStartDraft}
                                                onChange={(e) => setSeasonStartDraft(e.target.value)}
                                                className={cn(
                                                    'w-full h-9 rounded-xl border-2 border-slate-100 bg-white px-3 text-xs text-slate-900',
                                                    'focus:outline-none focus:ring-2 focus:ring-indigo-500'
                                                )}
                                                aria-label="Début de saison"
                                            />
                                            <input
                                                type="date"
                                                value={seasonEndDraft}
                                                onChange={(e) => setSeasonEndDraft(e.target.value)}
                                                className={cn(
                                                    'w-full h-9 rounded-xl border-2 border-slate-100 bg-white px-3 text-xs text-slate-900',
                                                    'focus:outline-none focus:ring-2 focus:ring-indigo-500'
                                                )}
                                                aria-label="Fin de saison"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => {
                                                    setSeasonStartDraft(activeSeason?.start_date ? String(activeSeason.start_date) : '');
                                                    setSeasonEndDraft(activeSeason?.end_date ? String(activeSeason.end_date) : '');
                                                    setIsSeasonEditing(false);
                                                }}
                                            >
                                                Annuler
                                            </Button>
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={handleSeasonSave}
                                                isLoading={isSavingSeason}
                                                disabled={!seasonStartDraft || !seasonEndDraft}
                                            >
                                                Enregistrer
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-4">
                            <Button variant="secondary" onClick={() => navigate('/my-club')} className="w-full">
                                Traiter dans “Mon club”
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* 2) IAM */}
            <div className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">2. Gestion des utilisateurs et rôles (IAM)</h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card className="p-4 lg:col-span-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-slate-600 text-sm">Annuaire du staff</div>
                                <div className="text-slate-900 font-semibold mt-1">Coachs, assistants, bénévoles</div>
                                <div className="text-xs text-slate-500 mt-1">Total : {isLoading ? '…' : staffDirectory.length}</div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <Users size={20} className="text-slate-700" />
                            </div>
                        </div>

                        <div className="mt-4 divide-y divide-slate-100">
                            {(isLoading ? Array.from({ length: 5 }).map((_, i) => ({ member_id: String(i) })) : staffDirectory.slice(0, 8)).map((m: any) => (
                                <div key={m.member_id} className="py-2 flex items-center justify-between">
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-slate-900 truncate">
                                            {isLoading ? '…' : `${m.first_name} ${m.last_name}`}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate">{isLoading ? '' : m.email}</div>
                                    </div>
                                    <div className="text-xs font-semibold text-slate-600 ml-3">{isLoading ? '…' : toRole(m.role)}</div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4">
                            <Button variant="secondary" onClick={() => navigate('/my-club')} className="w-full">
                                Ouvrir l’annuaire complet
                            </Button>
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-slate-600 text-sm">Contrôle d’accès</div>
                                <div className="text-slate-900 font-semibold mt-1">Changer un rôle</div>
                                <div className="text-xs text-slate-500 mt-1">Ex: Membre → Coach</div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <Shield size={20} className="text-slate-700" />
                            </div>
                        </div>

                        {!showIamControls ? (
                            <div className="mt-4 text-sm text-slate-500">Disponible uniquement pour un rôle ADMIN.</div>
                        ) : (
                            <div className="mt-4 space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 ml-1">Membre</label>
                                    <select
                                        value={roleTargetMemberId}
                                        onChange={(e) => setRoleTargetMemberId(e.target.value)}
                                        className={cn(
                                            'mt-2 h-12 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 text-sm font-medium',
                                            'focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10'
                                        )}
                                    >
                                        <option value="">Sélectionner…</option>
                                        {roleCandidates.map((m) => (
                                            <option key={m.member_id} value={m.member_id}>
                                                {m.first_name} {m.last_name} — {toRole(m.role)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-700 ml-1">Nouveau rôle</label>
                                    <select
                                        value={roleNextValue}
                                        onChange={(e) => setRoleNextValue(e.target.value)}
                                        className={cn(
                                            'mt-2 h-12 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 text-sm font-medium',
                                            'focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10'
                                        )}
                                    >
                                        <option value="COACH">COACH</option>
                                        <option value="ASSISTANT">ASSISTANT</option>
                                        <option value="STAFF">STAFF</option>
                                        <option value="PLAYER">PLAYER</option>
                                        <option value="MEMBER">MEMBER</option>
                                    </select>
                                </div>

                                <Button onClick={handleRoleUpdate} disabled={!roleTargetMemberId || isUpdatingRole} className="w-full">
                                    {isUpdatingRole ? 'Mise à jour…' : 'Appliquer'}
                                </Button>
                            </div>
                        )}

                        <div className="mt-4 text-xs text-slate-500">
                            Audit trail: non disponible (pas encore implémenté côté API).
                        </div>
                    </Card>
                </div>
            </div>

            {/* 3) MASTER CALENDAR & LOGISTICS */}
            <div className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">3. Calendrier maître et logistique</h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-slate-600 text-sm">Occupation des terrains</div>
                                <div className="text-slate-900 font-semibold mt-1">Conflits (14 jours)</div>
                                <div className="text-xs text-slate-500 mt-1">Même lieu + horaires qui se chevauchent.</div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <Clock size={20} className="text-slate-700" />
                            </div>
                        </div>

                        <div className="mt-4">
                            <div className="text-2xl font-bold text-slate-900">{isLoading ? '…' : collisions.length}</div>
                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                                {isLoading ? (
                                    <div className="text-slate-500">Chargement…</div>
                                ) : collisions.length === 0 ? (
                                    <div className="text-slate-500">Aucun conflit détecté.</div>
                                ) : (
                                    collisions.slice(0, 3).map((c, idx) => (
                                        <div key={idx} className="text-xs text-slate-600">
                                            <span className="font-semibold text-slate-800">{c.location}</span> : {c.a.title} ↔ {c.b.title}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-slate-600 text-sm">Gestion des transports</div>
                                <div className="text-slate-900 font-semibold mt-1">Parc & déplacements</div>
                                <div className="text-xs text-slate-500 mt-1">Indisponible (pas de données/API).</div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <Trophy size={20} className="text-slate-700" />
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-slate-600 text-sm">Événements club</div>
                                <div className="text-slate-900 font-semibold mt-1">30 jours</div>
                                <div className="text-xs text-slate-500 mt-1">Réunions, tournois, social…</div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <Calendar size={20} className="text-slate-700" />
                            </div>
                        </div>

                        <div className="mt-4 space-y-2">
                            {isLoading ? (
                                <div className="text-sm text-slate-500">Chargement…</div>
                            ) : clubEvents.length === 0 ? (
                                <div className="text-sm text-slate-500">Aucun événement club à venir.</div>
                            ) : (
                                clubEvents.slice(0, 5).map((e) => (
                                    <div key={e.event_id} className="text-sm">
                                        <div className="font-semibold text-slate-900 truncate">{e.title}</div>
                                        <div className="text-xs text-slate-500">
                                            {format(new Date(e.start_date), 'EEE d MMM • HH:mm', { locale: fr })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            {/* 4) REPORTING */}
            <div className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">4. Analyse de données (Reporting)</h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-slate-600 text-sm">Répartition par âge</div>
                                <div className="text-slate-900 font-semibold mt-1">Pyramide des âges</div>
                                <div className="text-xs text-slate-500 mt-1">Indisponible (date de naissance non exposée).</div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <BarChart3 size={20} className="text-slate-700" />
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-slate-600 text-sm">Assiduité</div>
                                <div className="text-slate-900 font-semibold mt-1">Présence aux entraînements</div>
                                <div className="text-xs text-slate-500 mt-1">Indisponible (historique d’entraînements requis).</div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <Users size={20} className="text-slate-700" />
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-slate-600 text-sm">Comparaison saisons</div>
                                <div className="text-slate-900 font-semibold mt-1">Barres de performance</div>
                                <div className="text-xs text-slate-500 mt-1">Indisponible (API reporting à ajouter).</div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <Trophy size={20} className="text-slate-700" />
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Footer quick stats (kept minimal) */}
            <Card className="p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-slate-600 text-sm">Raccourci</div>
                        <div className="text-slate-900 font-semibold mt-1">Gestion des membres</div>
                        <div className="text-slate-500 text-sm mt-1">Membres : {isLoading ? '…' : memberCount} • Accès bloqués : {isLoading ? '…' : blockedCount}</div>
                    </div>
                    <Button onClick={() => navigate('/my-club')}>Ouvrir “Mon club”</Button>
                </div>
            </Card>
        </div>
    );
};

export default AdminDashboard;
