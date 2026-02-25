import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventService, EventDTO, EventDetailDTO, ParticipantDTO } from '../../services/eventService';
import { memberService } from '../../services/memberService';
import { Card } from '../../components/atoms/Card';
import { ArrowLeft, Calendar, CheckCircle, XCircle, HelpCircle, Shield, Clock, Plus, Trash2, Edit2, Ban, Check, RefreshCcw, ChevronRight, ChevronLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '../../utils/cn';
import { useTeam } from '../../context/TeamContext';

const CoachConvocations: React.FC = () => {
    const navigate = useNavigate();
    const { selectedTeam, teams } = useTeam();
    const [matches, setMatches] = useState<EventDTO[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [eventDetails, setEventDetails] = useState<EventDetailDTO | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const eventsPerPage = 4;

    // Initial Load: List of Matches
    useEffect(() => {
        const loadMatches = async () => {
            try {
                // If selectedTeam is null (which means "All My Teams"), we should fetch events but filter them
                // by the teams the user actually belongs to (provided by `teams` context).
                // Or pass them to `getEvents` if it supports filtering.
                // Currently `getEvents` supports a second argument `allowedTeamIds`.
                
                const allowedTeamIds = teams.map(t => t.team_id);
                
                // Only load if we have teams (unless user has no teams at all, then empty is fine)
                // Avoid loading if teams are still loading? Assuming context handles that.
                
                const allEvents = await eventService.getEvents(selectedTeam?.team_id, allowedTeamIds);
                console.log("All Events fetched:", allEvents);
                
                // Filter Future Events (Matches, Trainings, Tournaments)
                const futureEvents = allEvents
                    .filter(e => ['match', 'training', 'tournament'].includes(e.type) && new Date(e.end_date || e.start_date) >= new Date())
                    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
                
                console.log("Filtered Events:", futureEvents);
                setMatches(futureEvents);
            } catch (error) {
                console.error("Failed to load events", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadMatches();
    }, [selectedTeam]);

    // Load Details when event selected
    useEffect(() => {
        if (!selectedEventId) {
            setEventDetails(null);
            return;
        }

        const loadDetails = async () => {
            setIsLoading(true);
            try {
                // Pass selectedTeam.team_id so we get all team members as (non-selected) participants for training
                const details = await eventService.getEvent(selectedEventId, selectedTeam?.team_id);

                // If we have a team selected, fetch ALL members to ensure everyone is listed
                // This fixes the issue where only already-convoked players were shown
                if (selectedTeam?.team_id) {
                     try {
                         const allMembers = await memberService.getMembers();
                         const teamMembers = allMembers.filter(m => m.team_ids?.includes(selectedTeam.team_id));
                         
                         // Merge: Add missing members to participants list with status 'none'
                         const existingMemberIds = details.participants?.map(p => p.member_id) || [];
                         
                         const missingMembers = teamMembers.filter(m => !existingMemberIds.includes(m.member_id));
                         
                         const toAdd: ParticipantDTO[] = missingMembers.map(m => ({
                             member_id: m.member_id,
                             first_name: m.first_name,
                             last_name: m.last_name,
                             role: m.role,
                             photo_url: m.photo_url,
                             status: 'none',
                             status_id: 0
                         }));
                         
                         details.participants = [...(details.participants || []), ...toAdd];
                     } catch (memSdkErr) {
                         console.warn("Failed to fetch team members for list completion", memSdkErr);
                     }
                }

                setEventDetails(details);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        loadDetails();
    }, [selectedEventId]);

    const updateStatus = async (memberId: string, statusId: number) => {
        if (!eventDetails) return;
        
        // Optimistic Update
        setEventDetails(prev => {
            if (!prev) return null;
            return {
                ...prev,
                participants: prev.participants.map(p => 
                    p.member_id === memberId ? { ...p, status_id: statusId } : p
                )
            };
        });

        try {
            await eventService.updateParticipationStatus(selectedEventId!, [memberId], statusId);
        } catch (e) {
            console.error("Failed to update status", e);
        }
    };

    const convokeAll = async () => {
        if (!eventDetails || !selectedEventId) return;

        // Filter out non-players
        const availablePlayers = (eventDetails.participants || []).filter(p => p.role === 'MEMBER' || p.role === 'PLAYER');
        
        const toSelectIds = availablePlayers
            .filter(p => !p.status_id || p.status_id === 0 || p.status_id === 5)
            .map(p => p.member_id);
            
        if (toSelectIds.length === 0) return;

        // Optimistic Update
        setEventDetails(prev => {
            if (!prev) return null;
            return {
                ...prev,
                participants: prev.participants.map(p => 
                    toSelectIds.includes(p.member_id) ? { ...p, status_id: 6 } : p
                )
            };
        });

        try {
            await eventService.updateParticipationStatus(selectedEventId, toSelectIds, 6);
        } catch (e) {
            console.error("Failed to batch update status", e);
        }
    };
    
    // Status Logic:
    // 6 = Selected (Pending response from player) -> Convoqué
    // 2 = Confirmed (Player Validated Presence) -> Présent
    // 3 = Declined (Player Declined) -> Absent
    // 5 = No Response -> En attente
    
    // Actions for Coach:
    // If Not Selected (Null/5/0) -> Can SELECT (6)
    // If Selected (6) -> Can CONFIRM (2) or DECLINE/REMOVE (3 or 5)
    // If Confirmed (2) -> Can DECLINE (3)
    const handleDeleteEvent = async (e: React.MouseEvent, eventId: string) => {
        e.stopPropagation();
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cet événement ?")) {
            try {
                await eventService.deleteEvent(eventId);
                setMatches(matches.filter(m => m.event_id !== eventId));
            } catch (error) {
                console.error("Failed to delete event", error);
                alert("Impossible de supprimer cet événement. Il peut être lié à un match officiel.");
            }
        }
    };

    const handleCancelEvent = async (e: React.MouseEvent, eventId: string) => {
        e.stopPropagation();
        if (window.confirm("Voulez-vous annuler cet événement ? Une notification sera envoyée aux joueurs.")) {
            try {
                // Determine if we need to call specific endpoint
                await eventService.cancelEvent(eventId);
                
                // Update local state
                setMatches(prev => prev.map(m => 
                    m.event_id === eventId 
                        ? { ...m, status_id: 4, status: 'CANCELLED' } 
                        : m
                ));
            } catch (error) {
                console.error("Failed to cancel event", error);
                alert("Erreur lors de l'annulation.");
            }
        }
    };

    const handleReactivateEvent = async (e: React.MouseEvent, eventId: string) => {
        e.stopPropagation();
        if (window.confirm("Voulez-vous réactiver cet événement ?")) {
            try {
                await eventService.reactivateEvent(eventId);
                
                // Update local state
                setMatches(prev => prev.map(m => 
                    m.event_id === eventId 
                        ? { ...m, status_id: 1, status: 'SCHEDULED' } 
                        : m
                ));
            } catch (error) {
                console.error("Failed to reactivate event", error);
                alert("Erreur lors de la réactivation.");
            }
        }
    };

    // If Absent (3) -> Can CONFIRM (2)

    if (selectedEventId && eventDetails) {
        // SQUAD MANAGER VIEW
        // Filter out non-players (COACH, ADMIN, etc.)
        const parts = (eventDetails.participants || []).filter(p => p.role === 'MEMBER' || p.role === 'PLAYER');
        
        // Sort: Selected/Present first
        const sortedParts = [...parts].sort((a, b) => {
             const priority = (id: number) => {
                 if (id === 2) return 5; // Present
                 if (id === 6) return 4; // Selected
                 if (id === 3) return 1; // Absent
                 return 2; // Others
             };
             return priority(b.status_id || 0) - priority(a.status_id || 0);
        });

        const selectionCount = parts.filter(p => p.status_id === 6 || p.status_id === 2).length;

        return (
            <div className="min-h-screen bg-slate-50 pb-20">
                {/* Header */}
                <div className="bg-white sticky top-0 z-30 shadow-sm border-b border-slate-200">
                    <div className="container mx-auto px-4 py-4">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setSelectedEventId(null)} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition">
                                <ArrowLeft size={20} className="text-slate-600" />
                            </button>
                            <div>
                                <h1 className="text-lg font-bold text-slate-800 leading-tight">Convocations</h1>
                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                    {eventDetails.type === 'match' 
                                        ? `${eventDetails.game?.home_team_name} vs ${eventDetails.game?.away_team_name}`
                                        : eventDetails.title || (eventDetails.type === 'training' ? "Entraînement" : "Événement")
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="container mx-auto px-4 py-6 max-w-2xl">
                    {/* Stats */}
                    <Card className="p-4 mb-6 bg-indigo-600 text-white border-none shadow-indigo-200 shadow-xl">
                        <div className="flex justify-between items-center">
                            <div>
                                <div className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">Joueurs Convoqués</div>
                                <div className="text-3xl font-black">{selectionCount}</div>
                            </div>
                            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
                                <Shield size={32} className="text-indigo-100" />
                            </div>
                        </div>
                    </Card>

                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Effectif Disponible</h3>
                        <button 
                            onClick={convokeAll} 
                            className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1 active:scale-95"
                        >
                            <Plus size={14} />
                            Tout convoquer
                        </button>
                    </div>
                    
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
                        {sortedParts.map((player) => {
                            const status = player.status_id || 0;
                            const isSelected = status === 6; // Convoqué
                            const isConfirmed = status === 2; // Présent
                            const isAbsent = status === 3; // Absent
                            const isMaybe = status === 1; // Incertain
                            // Null/0/5 = Not Selected

                            return (
                                <div 
                                    key={player.member_id} 
                                    className={cn(
                                        "p-3 flex items-center justify-between transition-colors",
                                        (isSelected || isConfirmed || isMaybe) ? "bg-indigo-50/30" : "bg-white"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 shrink-0",
                                            isConfirmed ? "bg-emerald-100 border-emerald-200 text-emerald-700" :
                                            isSelected ? "bg-indigo-100 border-indigo-200 text-indigo-700" : 
                                            isMaybe ? "bg-orange-100 border-orange-200 text-orange-700" :
                                            isAbsent ? "bg-red-50 border-red-100 text-red-400 opacity-50" :
                                            "bg-slate-100 border-slate-200 text-slate-500"
                                        )}>
                                            {player.first_name.charAt(0)}{player.last_name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className={cn("font-bold text-sm", isAbsent ? "text-slate-400 line-through" : "text-slate-800")}>
                                                {player.first_name} {player.last_name}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                               {isConfirmed && <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><CheckCircle size={10} /> PRÉSENT</span>}
                                               {isSelected && <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-1"><Clock size={10} /> CONVOQUÉ</span>}
                                               {isAbsent && <span className="text-[10px] font-bold text-red-400">ABSENT</span>}
                                               {isMaybe && <span className="text-[10px] font-bold text-orange-500 flex items-center gap-1"><HelpCircle size={10} /> INCERTAIN</span>}
                                               {(!isConfirmed && !isSelected && !isAbsent && !isMaybe) && <span className="text-[10px] text-slate-400">Non sélectionné</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {/* Actions based on state */}
                                        
                                        {/* NOT SELECTED: Show ADD Button */}
                                        {(!isConfirmed && !isSelected && !isAbsent && !isMaybe) && (
                                            <button 
                                                onClick={() => updateStatus(player.member_id, 6)}
                                                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                                                title="Convoquer"
                                            >
                                                <Plus size={18} />
                                            </button>
                                        )}

                                        {/* SELECTED OR CONFIRMED OR MAYBE: Show Actions */}
                                        {(isSelected || isConfirmed || isMaybe) && (
                                            <>
                                                {/* Force Present - DISABLED per rules: Coach waits for player response */}
                                                {/* UPDATE: Coach CAN confirm on behalf of player */}
                                                {!isConfirmed && (
                                                    <button 
                                                        onClick={() => updateStatus(player.member_id, 2)}
                                                        className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all active:scale-95"
                                                        title="Valider la présence"
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                )}
                                                
                                                {/* Force Absent (Only if confirmed/selected) */}
                                                <button 
                                                    onClick={() => updateStatus(player.member_id, 3)}
                                                    className="w-8 h-8 rounded-full bg-red-50 text-red-500 border border-red-100 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all active:scale-95"
                                                    title="Marquer absent"
                                                >
                                                    <XCircle size={16} />
                                                </button>

                                                {/* Unselect (Cancel Convocation) */}
                                                <button 
                                                    onClick={() => updateStatus(player.member_id, 5)} // 5 = NO_RESPONSE (Reset)
                                                    className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 border border-slate-100 flex items-center justify-center hover:bg-slate-200 hover:text-slate-600 transition-all active:scale-95"
                                                    title="Annuler convocation"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}

                                        {/* ABSENT: Show Restore Actions */}
                                        {isAbsent && (
                                            <>
                                                <button 
                                                    onClick={() => updateStatus(player.member_id, 6)}
                                                    className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                                                    title="Re-convoquer"
                                                >
                                                    <Shield size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => updateStatus(player.member_id, 5)}
                                                    className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 border border-slate-100 flex items-center justify-center hover:bg-slate-200 transition-all active:scale-95"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // MATCH LIST VIEW
    return (
        <div className="p-4 space-y-6 max-w-4xl mx-auto w-full pt-8 pb-24">
             <header className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition lg:hidden">
                    <ArrowLeft size={24} className="text-slate-700" />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-slate-800">Convocations</h1>
                    <p className="text-sm font-medium text-slate-500">
                        Sélectionnez les joueurs pour les matchs à venir
                    </p>
                </div>
            </header>

            {isLoading ? (
                <div className="text-center py-10 text-slate-400">Chargement...</div>
            ) : matches.length === 0 ? (
                <div className="text-center py-12 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200">
                    <Calendar size={48} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">Aucun match à venir</p>
                </div>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2">
                        {matches.slice((currentPage - 1) * eventsPerPage, currentPage * eventsPerPage).map(match => (
                            <Card 
                                key={match.event_id} 
                                onClick={() => setSelectedEventId(match.event_id)}
                                className={cn(
                                    "p-0 overflow-hidden cursor-pointer hover:shadow-lg transition-all group border-slate-200",
                                    match.status_id === 4 && "opacity-75 grayscale-[0.8] bg-slate-50"
                                )}
                            >
                                <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center group-hover:bg-indigo-50/50 transition">
                                    <span className={cn(
                                        "text-xs font-bold px-2 py-1 rounded border uppercase tracking-wide",
                                        match.status_id === 4 ? "text-slate-500 bg-slate-200 border-slate-300" :
                                        match.type === 'match' ? "text-indigo-600 bg-indigo-50 border-indigo-100" :
                                        match.type === 'training' ? "text-emerald-600 bg-emerald-50 border-emerald-100" :
                                        "text-orange-600 bg-orange-50 border-orange-100"
                                    )}>
                                        {match.status_id === 4 ? 'ANNULÉ' : match.type === 'match' ? 'Match' : match.type === 'training' ? 'Entraînement' : 'Tournoi'}
                                    </span>
                                    
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs font-bold text-slate-400 mr-2">
                                            {format(parseISO(match.start_date), 'dd MMM yyyy', { locale: fr })}
                                        </span>
                                        {!match.game && match.status_id !== 4 && (
                                            <>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/events/edit/${match.event_id}`); }}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                                                    title="Modifier"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button 
                                                    onClick={(e) => handleCancelEvent(e, match.event_id)}
                                                    className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-full transition-colors"
                                                    title="Annuler"
                                                >
                                                    <Ban size={16} />
                                                </button>
                                                <button 
                                                    onClick={(e) => handleDeleteEvent(e, match.event_id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                        {(!match.game && match.status_id === 4) && (
                                            <>
                                                <button 
                                                    onClick={(e) => handleReactivateEvent(e, match.event_id)}
                                                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                                                    title="Réactiver"
                                                >
                                                    <RefreshCcw size={16} />
                                                </button>
                                                <button 
                                                    onClick={(e) => handleDeleteEvent(e, match.event_id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                                    title="Supprimer définitivement"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="p-5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock size={14} className="text-slate-400" />
                                        <span className="text-sm font-mono text-slate-500">{format(parseISO(match.start_date), 'HH:mm')}</span>
                                    </div>
                                    <h3 className="text-lg font-black text-slate-800 mb-4 line-clamp-1">
                                        {match.type === 'match' 
                                            ? <span>{match.game?.home_team_name || '?'} <span className="text-slate-300 mx-1">vs</span> {match.game?.away_team_name || '?'}</span>
                                            : match.title || (match.type === 'training' ? "Entraînement" : "Tournoi")
                                        }
                                    </h3>

                                    <div className="flex items-center justify-between mt-4">
                                        <div className="flex -space-x-2 overflow-hidden py-1 pl-1">
                                            {match.participants && match.participants.length > 0 ? (
                                                <>
                                                    {match.participants.slice(0, 5).map((p, i) => (
                                                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center overflow-hidden bg-slate-100 shadow-sm" title={`${p.first_name} ${p.last_name}`}>
                                                            {p.photo_url ? (
                                                                <img src={p.photo_url} alt={p.first_name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-slate-500">{p.first_name.charAt(0)}{p.last_name.charAt(0)}</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {match.participants.length > 5 && (
                                                        <div className="w-8 h-8 rounded-full bg-slate-50 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm">
                                                            +{match.participants.length - 5}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Aucune sélection</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 text-indigo-600 text-sm font-bold group-hover:translate-x-1 transition-transform pl-4 whitespace-nowrap">
                                            Gérer
                                            <ChevronRight size={16} />
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>

                    {matches.length > eventsPerPage && (
                        <div className="flex justify-center items-center gap-4 mt-8">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                                <ChevronLeft size={20} className="text-slate-600" />
                            </button>
                            <span className="text-sm font-medium text-slate-500">
                                Page {currentPage} sur {Math.ceil(matches.length / eventsPerPage)}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(Math.ceil(matches.length / eventsPerPage), p + 1))}
                                disabled={currentPage === Math.ceil(matches.length / eventsPerPage)}
                                className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                                <ChevronRight size={20} className="text-slate-600" />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default CoachConvocations;
