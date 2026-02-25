import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventService, EventDetailDTO } from '../../services/eventService';
import { carpoolingService, CarpoolDTO } from '../../services/carpoolingService';
import { taskService, TaskDTO } from '../../services/taskService';
import { memberService } from '../../services/memberService';
import { useAuth } from '../../context/AuthContext';
import { useTeam } from '../../context/TeamContext';
import { Button } from '../../components/atoms/Button';
import { sportService, FormationDTO } from '../../services/sportService';
import { TacticsBoard } from '../../components/organisms/TacticsBoard';
import { Card } from '../../components/atoms/Card';
import { ArrowLeft, Clock, MapPin, Share2, CheckCircle, XCircle, HelpCircle, AlertTriangle, ClipboardList, TrendingUp, Car, Star, Award, UserPlus, LayoutTemplate } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '../../utils/cn';

const EventDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { teams } = useTeam();
    const [event, setEvent] = useState<EventDetailDTO | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [userStatus, setUserStatus] = useState<'present' | 'absent' | 'maybe' | 'none'>('none');
    const [activeTab, setActiveTab] = useState<'overview' | 'lineup' | 'logistics' | 'debrief'>('overview');
    
    // Tactics State
    const [formations, setFormations] = useState<FormationDTO[]>([]);
    const [lineup, setLineup] = useState<{ [positionId: number]: string }>({}); 
    const [formationId, setFormationId] = useState<number | null>(null);

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

    // Carpool State
    const [carpools, setCarpools] = useState<CarpoolDTO[]>([]);
    const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
    const [isEditingCarpool, setIsEditingCarpool] = useState(false);
    const [myCarpool, setMyCarpool] = useState<CarpoolDTO | null>(null);
    // Temp form state
    const [carpoolForm, setCarpoolForm] = useState({ seats: 4, location: '', time: '', note: '' });

    // Task State
    const [tasks, setTasks] = useState<TaskDTO[]>([]);

    useEffect(() => {
        const fetchEvent = async () => {
            if (!id) return;
            try {
                const data = await eventService.getEvent(id);
                
                // Security Check: Ensure user belongs to the team of this event
                if (data.team_id && teams.length > 0) {
                     const hasAccess = teams.some(t => t.team_id === data.team_id);
                     if (!hasAccess) {
                         setAccessDenied(true);
                         setIsLoading(false);
                         return;
                     }
                }

                setEvent(data);
                if (data.status && ['present', 'absent', 'maybe', 'none'].includes(data.status)) {
                    setUserStatus(data.status as any);
                }

                // Fetch Carpools & Member Info
                const carpoolData = await carpoolingService.getEventCarpools(id);
                setCarpools(carpoolData);

                // Fetch Tasks
                const taskData = await taskService.getEventTasks(id);
                setTasks(taskData);

                if (user?.id) {
                    const member = await memberService.getMember(user.id);
                    setCurrentMemberId(member.member_id);
                    const mine = carpoolData.find(c => c.driver_id === member.member_id);
                    if (mine) {
                        setMyCarpool(mine);
                        setCarpoolForm({
                            seats: mine.available_seats,
                            location: mine.departure_location,
                            time: mine.departure_time,
                            note: mine.note
                        });
                    }
                }

            } catch (error) {
                console.error("Failed to load event details", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchEvent();
    }, [id, user, teams]);

    const refreshCarpools = async () => {
        if (!id) return;
        const data = await carpoolingService.getEventCarpools(id);
        setCarpools(data);
        if (currentMemberId) {
            const mine = data.find(c => c.driver_id === currentMemberId);
            setMyCarpool(mine || null);
        }
    };

    const handleCreateOrUpdateCarpool = async () => {
        if (!id || !event) return;
        try {
            if (myCarpool) {
                await carpoolingService.updateCarpool(myCarpool.id, {
                    available_seats: carpoolForm.seats,
                    departure_location: carpoolForm.location,
                    departure_time: carpoolForm.time,
                    note: carpoolForm.note
                });
            } else {
                await carpoolingService.createCarpool({
                    event_id: id,
                    available_seats: carpoolForm.seats,
                    departure_location: carpoolForm.location,
                    departure_time: carpoolForm.time,
                    note: carpoolForm.note
                });
            }
            setIsEditingCarpool(false);
            refreshCarpools();
        } catch (e) {
            console.error("Carpool save failed", e);
        }
    };

    const handleDeleteCarpool = async () => {
        if (!myCarpool) return;
        if (confirm("Supprimer votre covoiturage ?")) {
            await carpoolingService.deleteCarpool(myCarpool.id);
            setMyCarpool(null);
            setCarpoolForm({ seats: 4, location: '', time: '', note: '' });
            refreshCarpools();
        }
    };

    const handleJoinCarpool = async (carpoolId: string) => {
        try {
            await carpoolingService.joinCarpool(carpoolId);
            refreshCarpools();
        } catch (e) {
            alert("Impossible de rejoindre ce covoiturage (complet ou déjà inscrit)");
        }
    };

    const handleLeaveCarpool = async (carpoolId: string) => {
        try {
            await carpoolingService.leaveCarpool(carpoolId);
            refreshCarpools();
        } catch (e) {
            console.error(e);
        }
    };

    const handleToggleTask = async (task: TaskDTO) => {
        try {
            const updated = await taskService.updateTaskStatus(task.id, !task.is_completed);
            setTasks(tasks.map(t => t.id === task.id ? updated : t));
        } catch (e) {
            console.error("Failed to update task", e);
        }
    };

    useEffect(() => {
        if (activeTab === 'lineup' && id && formations.length === 0) {
            const loadTactics = async () => {
                try {
                    const forms = await sportService.getFormations();
                    setFormations(forms);
                    
                    const lineupDTO = await sportService.getMatchLineup(id);
                    if (lineupDTO && lineupDTO.formation) {
                        setFormationId(lineupDTO.formation.id);
                        const mapping: {[k:number]: string} = {};
                        lineupDTO.items.forEach(i => {
                            if(i.member_id) mapping[i.position_id] = i.member_id;
                        });
                        setLineup(mapping);
                    }
                } catch (e) {
                    console.error("Failed to load lineup", e);
                }
            };
            loadTactics();
        }
    }, [activeTab, id, formations.length]);

    if (isLoading) return <div className="p-4 flex justify-center"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>;

    if (accessDenied) {
        return (
            <div className="p-6 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Accès Refusé</h2>
                <p className="text-slate-600">Vous ne faites pas partie de l'équipe associée à cet événement.</p>
                {/* @ts-ignore */}
                <Button onClick={() => navigate(-1)} variant="secondary">Retour</Button>
            </div>
        );
    }

    if (!event) return <div className="p-4 text-center">Événement non trouvé</div>;

    const handlePresence = async (status: 'present' | 'absent' | 'maybe') => {
        if (!event || !user?.id) return;
        try {
            await eventService.setParticipation(event.event_id, user.id, status);
            setUserStatus(status);
            
            // Updating list is tricky without Member ID. 
            // We refresh the whole event to be safe and accurate.
            const updatedEvent = await eventService.getEvent(event.event_id);
            setEvent(updatedEvent);
            if (updatedEvent.status) setUserStatus(updatedEvent.status as any);

        } catch (error) {
            console.error("Failed to update status", error);
        }
    };

    if (isLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
    if (!event) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Event not found</div>;

    const startDate = parseISO(event.start_date);
    const isMatch = event.type === 'match';

    const participantsByStatus = {
        present: event.participants.filter(p => p.status === 'present'),
        maybe: event.participants.filter(p => p.status === 'maybe'),
        absent: event.participants.filter(p => p.status === 'absent')
    };

    const canSeeLineup = event && (
        ['COACH', 'ADMIN', 'ASSISTANT'].includes(user?.role || '') || 
        event.lineup_published 
    );

    return (
        <div className="min-h-screen bg-slate-50 pb-24 animate-fade-in relative">
            {/* Header Image / Pattern */}
            <div className={cn(
                "relative overflow-hidden flex flex-col justify-end p-6 text-white transition-all",
                isMatch ? "min-h-[280px] bg-indigo-900" : "h-64 bg-emerald-800"
            )}>
                {/* Back Button */}
                <button 
                    onClick={() => navigate(-1)} 
                    className="absolute top-6 left-6 p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition-colors z-20"
                >
                    <ArrowLeft size={20} />
                </button>

                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] translate-x-1/3 -translate-y-1/3"></div>

                <div className={cn("relative z-10", isMatch ? "mb-12" : "")}>
                    <span className={cn(
                        "inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2",
                        isMatch ? "bg-indigo-500/50 text-indigo-100 border border-indigo-400/30" : "bg-emerald-500/50 text-emerald-100 border border-emerald-400/30"
                    )}>
                        {isMatch ? "Championnat" : "Entraînement"}
                    </span>
                    <h1 className="text-3xl font-black mb-2 leading-tight">
                        {isMatch ? `vs ${event.game?.away_team_name || 'Adversaire'}` : event.title}
                    </h1>
                    <div className="flex flex-col gap-1 text-sm font-medium opacity-90">
                        <span className="flex items-center gap-2"><Clock size={16} /> {format(startDate, 'EEEE d MMMM à HH:mm', { locale: fr })}</span>
                        {event.location && <span className="flex items-center gap-2"><MapPin size={16} /> {event.location}</span>}
                    </div>
                </div>

                {/* --- MOCK TABS --- */}
                {isMatch && (
                    <div className="absolute bottom-0 left-0 w-full px-6 flex items-center justify-start gap-8 overflow-x-auto text-sm font-bold text-indigo-300/70 no-scrollbar border-t border-indigo-500/30 bg-indigo-900/50 backdrop-blur-sm z-20">
                        <button 
                            onClick={() => setActiveTab('overview')}
                            className={cn("py-4 border-b-[3px] transition-all whitespace-nowrap px-2", activeTab === 'overview' ? "text-white border-white" : "border-transparent hover:text-indigo-200")}
                        >
                            Aperçu
                        </button>
                        
                        {canSeeLineup && (
                            <button 
                                onClick={() => setActiveTab('lineup')}
                                className={cn("py-4 border-b-[3px] transition-all whitespace-nowrap px-2", activeTab === 'lineup' ? "text-white border-white" : "border-transparent hover:text-indigo-200")}
                            >
                                Compo
                            </button>
                        )}
                        
                        <button 
                            onClick={() => navigate(`/match-center/${id}`)}
                            className="py-4 border-b-[3px] border-transparent transition-all whitespace-nowrap px-2 text-red-400 hover:text-red-300 flex items-center gap-1.5 animate-pulse"
                        >
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            Live
                        </button>

                        <button 
                            onClick={() => setActiveTab('logistics')}
                            className={cn("py-4 border-b-[3px] transition-all whitespace-nowrap px-2", activeTab === 'logistics' ? "text-white border-white" : "border-transparent hover:text-indigo-200")}
                        >
                            Logistique
                        </button>
                        <button 
                            onClick={() => setActiveTab('debrief')}
                            className={cn("py-4 border-b-[3px] transition-all whitespace-nowrap px-2", activeTab === 'debrief' ? "text-white border-white" : "border-transparent hover:text-indigo-200")}
                        >
                            Débrief
                        </button>
                    </div>
                )}
            </div>

            <div className="p-4 relative z-20 space-y-6">
                {activeTab === 'overview' && (
                    <div className="space-y-6 -mt-6">
                        {/* Participation Toggle */}
                        <Card className="shadow-xl border-none">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800">Votre réponse</h3>
                        {/* @ts-ignore */}
                        <Button variant="ghost" className="text-indigo-600 h-8 w-8 p-0"><Share2 size={16} /></Button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                         <button 
                            onClick={() => handlePresence('present')}
                            className={cn(
                                "flex flex-col items-center justify-center py-4 rounded-xl border transition-all",
                                userStatus === 'present' 
                                    ? "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/30 scale-105" 
                                    : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-500"
                            )}
                        >
                            <CheckCircle size={24} className="mb-2" />
                            <span className="text-xs font-bold uppercase">Présent</span>
                        </button>
                        <button 
                            onClick={() => handlePresence('maybe')}
                            className={cn(
                                "flex flex-col items-center justify-center py-4 rounded-xl border transition-all",
                                userStatus === 'maybe' 
                                    ? "bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-500/30 scale-105" 
                                    : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-orange-50 hover:text-orange-500"
                            )}
                        >
                            <HelpCircle size={24} className="mb-2" />
                            <span className="text-xs font-bold uppercase">Incertain</span>
                        </button>
                        <button 
                            onClick={() => handlePresence('absent')}
                            className={cn(
                                "flex flex-col items-center justify-center py-4 rounded-xl border transition-all",
                                userStatus === 'absent' 
                                    ? "bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/30 scale-105" 
                                    : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500"
                            )}
                        >
                            <XCircle size={24} className="mb-2" />
                            <span className="text-xs font-bold uppercase">Absent</span>
                        </button>
                    </div>
                </Card>

                {/* Team Presence Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-emerald-100/50 p-4 rounded-2xl text-center border border-emerald-100">
                        <span className="block text-2xl font-black text-emerald-600">{participantsByStatus.present.length}</span>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase">Présents</span>
                    </div>
                    <div className="bg-orange-100/50 p-4 rounded-2xl text-center border border-orange-100">
                        <span className="block text-2xl font-black text-orange-600">{participantsByStatus.maybe.length}</span>
                        <span className="text-[10px] font-bold text-orange-400 uppercase">Incertains</span>
                    </div>
                    <div className="bg-red-100/50 p-4 rounded-2xl text-center border border-red-100">
                        <span className="block text-2xl font-black text-red-600">{participantsByStatus.absent.length}</span>
                        <span className="text-[10px] font-bold text-red-400 uppercase">Absents</span>
                    </div>
                </div>

                {/* Participants List */}
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-800 pl-1">Participants</h3>
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                        {participantsByStatus.present.length > 0 && (
                            <div className="p-4 border-b border-slate-50">
                                <h4 className="text-xs font-bold text-emerald-500 uppercase mb-3 flex items-center gap-2">
                                    <CheckCircle size={12} /> Confirmés
                                </h4>
                                <div className="space-y-3">
                                    {participantsByStatus.present.map(p => (
                                        <div key={p.member_id} className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                                                {p.photo_url ? <img src={p.photo_url} className="w-full h-full object-cover"/> : null}
                                            </div>
                                            <span className="text-sm font-semibold text-slate-700">{p.first_name} {p.last_name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* Show others if needed or keep it clean with just presents */}
                         {(participantsByStatus.maybe.length > 0 || participantsByStatus.absent.length > 0) && (
                            <div className="p-4 bg-slate-50/50">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Autres</h4>
                                <div className="space-y-2 opacity-60">
                                    {[...participantsByStatus.maybe, ...participantsByStatus.absent].map(p => (
                                        <div key={p.member_id} className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-slate-200"></div>
                                            <span className="text-xs font-semibold text-slate-600">{p.first_name} {p.last_name} ({p.status === 'maybe' ? '?' : 'Abs'})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                         )}

                         {event.participants.length === 0 && (
                             <div className="p-8 text-center text-slate-400 text-sm">
                                 Personne n'a encore répondu.
                             </div>
                         )}
                    </div>
                </div>
                </div>
                )}
                
                {/* --- TAB CONTENT: LINEUP --- */}
                {activeTab === 'lineup' && canSeeLineup && (
                    <div className="animate-fade-in pt-4">
                        <div className="flex justify-between items-end px-1 mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <LayoutTemplate className="text-indigo-600" />
                                    Composition d'équipe
                                </h3>
                                <p className="text-slate-500 text-xs font-medium mt-1">
                                    Dispositif tactique prévu pour le match
                                </p>
                            </div>
                        </div>

                        {formations.length > 0 ? (
                            <TacticsBoard 
                                players={event.participants.map(p => ({
                                    id: p.member_id,
                                    name: `${p.first_name} ${p.last_name}`,
                                    position: p.role || 'M',
                                    photo: p.photo_url
                                }))}
                                formations={formations}
                                initialFormationId={formationId || undefined}
                                initialLineup={lineup}
                                motmMemberId={(event as any)?.motm_id ?? null}
                                goalCountsByPlayerId={goalCountsByPlayerId}
                                onSave={() => {}} // Read only basically
                                readOnly={true}
                            />
                        ) : (
                            <div className="p-8 text-center text-slate-400">Chargement de la tactique...</div>
                        )}
                    </div>
                )}

                {/* --- TAB CONTENT: LOGISTICS --- */}
                {activeTab === 'logistics' && (
                    <div className="space-y-6 animate-fade-in pt-4">
                        
                        {/* Header & Actions */}
                        <div className="flex justify-between items-end px-1">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <Car className="text-indigo-600" />
                                    Covoiturages
                                </h3>
                                <p className="text-slate-500 text-xs font-medium mt-1">
                                    Organisez le déplacement pour le match
                                </p>
                            </div>
                            {!myCarpool && !isEditingCarpool && (
                                <Button 
                                    onClick={() => setIsEditingCarpool(true)}
                                    className="bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 h-9 px-3 text-xs"
                                >
                                    <Car size={16} className="mr-2" />
                                    J'ai une voiture
                                </Button>
                            )}
                        </div>

                        {/* Edit / Create Form */}
                        {isEditingCarpool && (
                            <Card className="p-5 bg-white border border-indigo-100 shadow-xl rounded-2xl">
                                <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wider">
                                    {myCarpool ? 'Modifier mon covoiturage' : 'Proposer un covoiturage'}
                                </h4>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 mb-1 block">Heure de départ</label>
                                            <input 
                                                type="time" 
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={carpoolForm.time}
                                                onChange={e => setCarpoolForm({...carpoolForm, time: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                             <label className="text-xs font-bold text-slate-500 mb-1 block">Places dispo.</label>
                                             <select 
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={carpoolForm.seats}
                                                onChange={e => setCarpoolForm({...carpoolForm, seats: parseInt(e.target.value)})}
                                             >
                                                 {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} places</option>)}
                                             </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Lieu de rendez-vous</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ex: Parking du stade, Gare..."
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={carpoolForm.location}
                                            onChange={e => setCarpoolForm({...carpoolForm, location: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Note / Infos supp.</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ex: Départ pile à l'heure !"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={carpoolForm.note}
                                            onChange={e => setCarpoolForm({...carpoolForm, note: e.target.value})}
                                        />
                                    </div>
                                    
                                    <div className="flex gap-3 pt-2">
                                        <Button 
                                            onClick={handleCreateOrUpdateCarpool} 
                                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                                        >
                                            Enregistrer
                                        </Button>
                                        {/* @ts-ignore */}
                                        <Button 
                                            onClick={() => {
                                                setIsEditingCarpool(false);
                                                if (!myCarpool) setCarpoolForm({ seats: 4, location: '', time: '', note: '' });
                                            }} 
                                            variant="secondary"
                                            className="flex-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                                        >
                                            Annuler
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Carpool List */}
                        <div className="space-y-4">
                            {carpools.length === 0 && !isEditingCarpool && (
                                <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                                    <Car className="mx-auto text-slate-300 mb-2" size={32} />
                                    <p className="text-slate-500 font-medium text-sm">Aucun covoiturage pour le moment.</p>
                                    <button onClick={() => setIsEditingCarpool(true)} className="text-indigo-600 font-bold text-sm mt-2 hover:underline">Soyez le premier !</button>
                                </div>
                            )}

                            {carpools.map(carpool => {
                                const isDriver = currentMemberId === carpool.driver_id;
                                const isPassenger = carpool.passengers.some(p => p.member_id === currentMemberId);
                                const isFull = carpool.passengers.length >= carpool.available_seats;
                                
                                return (
                                    <Card key={carpool.id} className={cn(
                                        "p-0 overflow-hidden transition-all hover:shadow-md border-slate-100",
                                        isDriver ? "border-indigo-200 ring-1 ring-indigo-100" : ""
                                    )}>
                                        {/* Header Part */}
                                        <div className="p-4 bg-white">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-md",
                                                        isDriver ? "bg-indigo-600" : "bg-slate-400"
                                                    )}>
                                                        {carpool.driver_first_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-sm leading-tight">
                                                            {isDriver ? 'Votre voiture' : `Voiture de ${carpool.driver_first_name} ${carpool.driver_last_name}`}
                                                        </h4>
                                                        <div className="flex flex-col text-xs text-slate-500 mt-1 space-y-0.5">
                                                            {carpool.departure_time && (
                                                                <span className="flex items-center gap-1"><Clock size={10}/> {carpool.departure_time}</span>
                                                            )}
                                                            {carpool.departure_location && (
                                                                <span className="flex items-center gap-1"><MapPin size={10}/> {carpool.departure_location}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Seats Badge */}
                                                <div className="flex flex-col items-end">
                                                    <span className={cn(
                                                        "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider mb-2",
                                                        isFull ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
                                                    )}>
                                                        {carpool.available_seats - carpool.passengers.length} places
                                                    </span>
                                                    
                                                    {isDriver && (
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={() => {
                                                                    setMyCarpool(carpool);
                                                                    setCarpoolForm({
                                                                        seats: carpool.available_seats,
                                                                        location: carpool.departure_location,
                                                                        time: carpool.departure_time,
                                                                        note: carpool.note
                                                                    });
                                                                    setIsEditingCarpool(true);
                                                                }}
                                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            >
                                                                <ClipboardList size={14} /> 
                                                            </button>
                                                            <button 
                                                                onClick={handleDeleteCarpool}
                                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            >
                                                                <XCircle size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {carpool.note && (
                                                <div className="mb-3 p-2 bg-yellow-50/50 border border-yellow-100 rounded-lg text-xs text-slate-600 italic flex gap-2">
                                                    <AlertTriangle size={12} className="text-yellow-500 shrink-0 mt-0.5" />
                                                    {carpool.note}
                                                </div>
                                            )}

                                            {/* Passengers List */}
                                            <div className="flex items-center gap-2 mt-2 pl-12 relative">
                                                
                                                <div className="flex -space-x-2">
                                                    {carpool.passengers.map(p => (
                                                        <div key={p.member_id} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 relative group cursor-help">
                                                            {p.first_name.charAt(0)}
                                                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                                                                {p.first_name} {p.last_name}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    
                                                    {[...Array(Math.max(0, carpool.available_seats - carpool.passengers.length))].map((_, i) => (
                                                        <div key={`empty-${i}`} className="w-8 h-8 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center border-dashed border-slate-300">
                                                            <span className="text-slate-300 text-[10px]">+</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Footer */}
                                        {!isDriver && (
                                            <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex justify-end">
                                                {isPassenger ? (
                                                    <button 
                                                        onClick={() => handleLeaveCarpool(carpool.id)}
                                                        className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline"
                                                    >
                                                        Quitter ce trajet
                                                    </button>
                                                ) : (
                                                    !isFull && !myCarpool && (
                                                        <button 
                                                            onClick={() => handleJoinCarpool(carpool.id)}
                                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                                                        >
                                                            Rejoindre <UserPlus size={12} />
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                        
                        {/* Tasks Section */}
                        <div className="pt-6 border-t border-slate-200">
                             <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
                                 <ClipboardList className="text-indigo-600" />
                                 Mes Tâches Assignées
                             </h3>
                             
                             {tasks.filter(t => t.assigned_member_id === currentMemberId).length === 0 ? (
                                 <div className="text-center p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                                     <CheckCircle className="mx-auto text-slate-300 mb-2" size={32} />
                                     <p className="text-slate-500 font-medium text-sm">Aucune tâche assignée pour cet événement.</p>
                                 </div>
                             ) : (
                                 <div className="space-y-3">
                                     {tasks.filter(t => t.assigned_member_id === currentMemberId).map(task => (
                                         <Card key={task.id} className="p-4 flex items-center justify-between transition-all hover:shadow-md border-slate-100">
                                             <div className="flex items-center gap-3">
                                                 <div onClick={() => handleToggleTask(task)} className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors", task.is_completed ? "bg-emerald-500 border-emerald-500" : "border-slate-300 hover:border-indigo-500")}>
                                                     {task.is_completed && <CheckCircle size={14} className="text-white" />}
                                                 </div>
                                                 <span className={cn("text-sm font-semibold", task.is_completed ? "text-slate-400 line-through" : "text-slate-700")}>
                                                     {task.description}
                                                 </span>
                                             </div>
                                         </Card>
                                     ))}
                                 </div>
                             )}
                        </div>
                    </div>
                )}

                {/* --- TAB CONTENT: DEBRIEF (Analysis + Vote) --- */}
                {activeTab === 'debrief' && (
                    <div className="space-y-6 animate-fade-in pt-4">
                         
                        {/* Vote MotM */}
                         <Card className="p-6 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl overflow-hidden relative">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/20 rounded-full blur-[50px] translate-x-1/2 -translate-y-1/2"></div>
                             
                             <div className="relative z-10 text-center">
                                 <Award size={32} className="mx-auto text-yellow-400 mb-3" />
                                 <h3 className="text-lg font-bold mb-1">Homme du match</h3>
                                 <p className="text-indigo-200 text-sm mb-6">Votez pour le meilleur joueur de la rencontre</p>
                                 
                                 <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x justify-start md:justify-center">
                                     {[1,2,3,4,5].map((i) => (
                                         <div key={i} className="flex-shrink-0 flex flex-col items-center gap-2 snap-center cursor-pointer group">
                                             <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-transparent group-hover:border-yellow-400 transition-all overflow-hidden relative">
                                                 <img src={`https://ui-avatars.com/api/?name=Joueur+${i}&background=random`} className="w-full h-full object-cover" />
                                                {i === 3 && <div className="absolute inset-0 bg-yellow-500/80 flex items-center justify-center font-bold text-xs text-yellow-900">VOTÉ</div>}
                                             </div>
                                             <span className="text-xs font-medium text-indigo-100">Joueur {i}</span>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         </Card>
                        
                        {/* Stats Analysis (Existing) */}
                        <Card className="p-6 text-center space-y-4">
                            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-500">
                                <TrendingUp size={32} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Statistiques du match</h3>
                                <p className="text-slate-500 text-sm mt-1">Les statistiques seront disponibles après la saisie de la feuille de match.</p>
                            </div>
                        </Card>

                        {/* Player Ratings */}
                        <Card className="p-4 bg-white rounded-2xl border border-slate-100">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Star size={20} className="text-yellow-500"/>
                                Notes des joueurs
                            </h4>
                            <div className="space-y-3">
                                {[1,2,3].map((i) => (
                                    <div key={i} className="flex items-center justify-between p-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                                                <img src={`https://ui-avatars.com/api/?name=Joueur+${i}&background=random`} className="w-full h-full object-cover" />
                                            </div>
                                            <span className="text-sm font-semibold text-slate-700">Joueur {i}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            {[1,2,3,4,5].map(star => (
                                                <Star key={star} size={16} className={cn("cursor-pointer", star <= 3 ? "text-yellow-400 fill-yellow-400" : "text-slate-200")} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                    </div>
                )}

            </div>
        </div>
    );
};

export default EventDetails;
