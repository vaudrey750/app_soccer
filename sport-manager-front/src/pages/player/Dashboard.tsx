import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTeam } from '../../context/TeamContext';
import { eventService, EventDTO } from '../../services/eventService';
import { memberService } from '../../services/memberService';
import { Card } from '../../components/atoms/Card';
import { Button } from '../../components/atoms/Button';
import { MapPin, Calendar, Clock, CheckCircle, XCircle, HelpCircle, ArrowRight, Trophy, TrendingUp } from 'lucide-react';
import { cn } from '../../utils/cn';

const Dashboard: React.FC = () => {
    const { user: authUser } = useAuth();
    const { selectedTeam, teams } = useTeam();
    const navigate = useNavigate();
    const [nextMatch, setNextMatch] = useState<EventDTO | null>(null);
    const [lastMatches, setLastMatches] = useState<EventDTO[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userName, setUserName] = useState(authUser?.firstName || 'Joueur');

    useEffect(() => {
        const loadDashboard = async () => {
            if (authUser?.id) {
                try {
                    // Load Profile for name
                    const member = await memberService.getMember(authUser.id);
                    setUserName(member.first_name || authUser.firstName);

                    // Load Data
                    const allowedTeamIds = teams.map(t => t.team_id);
                    const match = await eventService.getNextMatch(selectedTeam?.team_id, allowedTeamIds);
                    setNextMatch(match);

                    const pastMatches = await eventService.getLastMatches(5, selectedTeam?.team_id, allowedTeamIds);
                    setLastMatches(pastMatches);
                } catch (error) {
                    console.error("Dashboard error", error);
                } finally {
                    setIsLoading(false);
                }
            }
        };
        loadDashboard();
    }, [authUser, selectedTeam]);

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

    return (
        <div className="p-4 md:p-8 animate-fade-in space-y-8">
            
            {/* --- HEADER --- */}
            <div className="flex flex-col gap-1">
                <span className="text-slate-500 font-medium uppercase tracking-wider text-sm">Bon retour sur le terrain,</span>
                <h1 className="text-4xl font-black text-slate-800">
                    {userName} <span className="text-indigo-600">!</span>
                </h1>
            </div>

            {/* --- NEXT MATCH HERO --- */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        PROCHAIN MATCH
                    </h2>
                    {nextMatch && (
                        <Button variant="ghost" size="sm" className="text-indigo-600">Voir tout <ArrowRight size={14} className="ml-1"/></Button>
                    )}
                </div>

                {isLoading ? (
                    <Card className="h-48 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </Card>
                ) : nextMatch ? (
                        <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 shadow-2xl text-white cursor-pointer hover:shadow-indigo-500/20 transition-all">
                        {/* Background Decor */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-600/20 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2"></div>
                        
                        <div className="relative z-10 p-6 md:p-8" onClick={() => navigate(`/events/${nextMatch.event_id}`)}>
                            {/* Match Info Header */}
                            <div className="flex justify-between items-start mb-8">
                                <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/10">
                                    <span className="block text-xs font-bold text-blue-200 uppercase tracking-widest mb-1">Compétition</span>
                                    <span className="text-sm font-semibold">{nextMatch.game?.competition_name || "Championnat"}</span>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center justify-end gap-2 text-blue-200 mb-1">
                                        <Calendar size={14} />
                                        <span className="text-xs font-bold uppercase tracking-widest">Date</span>
                                    </div>
                                    <span className="text-xl font-bold">
                                        {new Date(nextMatch.start_date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}
                                    </span>
                                    <div className="text-sm font-medium text-slate-400 mt-1 flex items-center justify-end gap-1">
                                         <Clock size={12} />
                                         {new Date(nextMatch.start_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>

                            {/* VS Display */}
                            <div className="flex items-center justify-between gap-4 mb-8">
                                <div className="flex-1 text-center">
                                    <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-white rounded-full flex items-center justify-center text-slate-900 font-black text-xl mb-3 shadow-lg border-4 border-indigo-500">
                                        {/* Placeholder for Home Logo */}
                                        {nextMatch.game?.home_team_name?.substring(0,2) || "H"}
                                    </div>
                                    <h3 className="font-bold text-lg leading-tight">{nextMatch.game?.home_team_name || "Domicile"}</h3>
                                </div>
                                <div className="flex-shrink-0 flex flex-col items-center">
                                    <span className="text-4xl font-black text-white/20 italic">VS</span>
                                    {nextMatch.game?.location && (
                                        <span className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400 bg-black/30 px-2 py-1 rounded-full">
                                            <MapPin size={10} /> {nextMatch.game.location}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 text-center">
                                    <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-slate-800 rounded-full flex items-center justify-center text-white font-black text-xl mb-3 shadow-lg border-4 border-slate-700">
                                        {/* Placeholder for Away Logo */}
                                        {nextMatch.game?.away_team_name?.substring(0,2) || "A"}
                                    </div>
                                    <h3 className="font-bold text-lg leading-tight">{nextMatch.game?.away_team_name || "Extérieur"}</h3>
                                </div>
                            </div>

                            {/* Attendance Actions - Only visible if convoked */}
                            {nextMatch.status_id && [1, 2, 3, 4, 6].includes(nextMatch.status_id) ? (
                                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-semibold text-slate-300">Votre présence</span>
                                        {nextMatch.status && nextMatch.status !== 'none' && (
                                            <span className={cn(
                                                "text-xs font-bold px-2 py-1 rounded border",
                                                nextMatch.status === 'present' ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : 
                                                nextMatch.status === 'absent' ? "bg-red-500/20 text-red-300 border-red-500/30" :
                                                nextMatch.status === 'maybe' ? "bg-orange-500/20 text-orange-300 border-orange-500/30" :
                                                "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                                            )}>
                                                {nextMatch.status === 'present' ? 'Confirmé' : 
                                                 nextMatch.status === 'absent' ? 'Absent' : 
                                                 nextMatch.status === 'maybe' ? 'Incertain' : 'Convoqué'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handlePresence('present'); }}
                                            className={cn(
                                                "flex flex-col items-center justify-center py-3 rounded-xl border transition-all",
                                                nextMatch.status === 'present' 
                                                    ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]" 
                                                    : "bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/30"
                                            )}
                                        >
                                            <CheckCircle size={20} className="mb-1" />
                                            <span className="text-xs font-bold">Présent</span>
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handlePresence('maybe'); }}
                                            className={cn(
                                                "flex flex-col items-center justify-center py-3 rounded-xl border transition-all",
                                                nextMatch.status === 'maybe' 
                                                    ? "bg-orange-500 text-white border-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.4)]" 
                                                    : "bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-orange-500/20 hover:text-orange-300 hover:border-orange-500/30"
                                            )}
                                        >
                                            <HelpCircle size={20} className="mb-1" />
                                            <span className="text-xs font-bold">Incertain</span>
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handlePresence('absent'); }}
                                            className={cn(
                                                "flex flex-col items-center justify-center py-3 rounded-xl border transition-all",
                                                nextMatch.status === 'absent' 
                                                    ? "bg-red-500 text-white border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]" 
                                                    : "bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30"
                                            )}
                                        >
                                            <XCircle size={20} className="mb-1" />
                                            <span className="text-xs font-bold">Absent</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/5 text-center">
                                    <p className="text-slate-400 text-sm font-medium italic">
                                        En attente de la convocation du coach...
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                   <Card className="text-center py-12">
                       <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                           <Calendar size={32} />
                       </div>
                       <h3 className="text-lg font-bold text-slate-700 mb-1">Aucun match prévu</h3>
                       <p className="text-slate-500 text-sm">Votre calendrier est vide pour le moment.</p>
                   </Card> 
                )}
            </section>

            {/* --- PERFORMANCE & FORM --- */}
            {lastMatches.length > 0 && (
                <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="text-slate-400" size={18} />
                        <h2 className="text-lg font-bold text-slate-700">Récemment</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Last Result Card */}
                        <Card className="p-4 flex items-center justify-between bg-white border border-slate-100 shadow-sm relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-blue-500"></div>
                            
                            <div className="flex flex-col items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Dernier Match</span>
                                <div className="flex items-center gap-3">
                                    <span className={cn(
                                        "text-xl font-black",
                                        getResult(lastMatches[0]) === 'W' ? "text-emerald-500" : 
                                        getResult(lastMatches[0]) === 'L' ? "text-red-500" : "text-slate-600"
                                    )}>
                                        {lastMatches[0].game?.is_home ? lastMatches[0].game?.score_home : lastMatches[0].game?.score_away}
                                    </span>
                                    <span className="text-slate-300 font-light">-</span>
                                    <span className="text-xl font-black text-slate-700">
                                        {lastMatches[0].game?.is_home ? lastMatches[0].game?.score_away : lastMatches[0].game?.score_home}
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-medium mt-1 truncate max-w-[120px]">
                                    vs {lastMatches[0].game?.is_home ? lastMatches[0].game?.away_team_name : lastMatches[0].game?.home_team_name}
                                </span>
                            </div>

                            {/* Form Sequence */}
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">État de forme</span>
                                <div className="flex gap-1.5">
                                    {lastMatches.map((match) => {
                                        const res = getResult(match);
                                        return (
                                            <div key={match.event_id} className={cn(
                                                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm border border-white/20",
                                                res === 'W' ? "bg-emerald-500" : 
                                                res === 'L' ? "bg-red-500" : 
                                                res === 'D' ? "bg-slate-400" : "bg-slate-200 text-slate-400"
                                            )}>
                                                {res === '-' ? '?' : res === 'W' ? 'V' : res === 'L' ? 'D' : 'N'}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </Card>
                    </div>
                </section>
            )}
            
            {/* --- QUICK ACTIONS GRID --- */}
            <section className="grid grid-cols-2 gap-4">
                 <Button variant="glass" className="h-auto py-6 flex flex-col items-center bg-white border border-slate-100 shadow-sm hover:shadow-md text-slate-700 hover:text-indigo-600">
                     <span className="p-3 bg-indigo-50 rounded-full text-indigo-600 mb-2">
                         <Calendar size={24} />
                     </span>
                     <span className="font-bold text-sm">Entraînements</span>
                 </Button>
                 <Button variant="glass" className="h-auto py-6 flex flex-col items-center bg-white border border-slate-100 shadow-sm hover:shadow-md text-slate-700 hover:text-indigo-600">
                     <span className="p-3 bg-indigo-50 rounded-full text-indigo-600 mb-2">
                         <Trophy size={24} /> // Note: I need to import Trophy if available
                     </span>
                     <span className="font-bold text-sm">Classement</span>
                 </Button>
            </section>

        </div>
    );
}

export default Dashboard;
