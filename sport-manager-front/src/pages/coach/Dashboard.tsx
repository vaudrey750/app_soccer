import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/atoms/Card';
import { useAuth } from '../../context/AuthContext';
import { useTeam } from '../../context/TeamContext';
import { eventService, EventDTO } from '../../services/eventService';
import { Calendar, ClipboardList, Activity, ChevronRight, MapPin, Clock, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const CoachDashboard: React.FC = () => {
    const { user } = useAuth();
    const { selectedTeam, teams } = useTeam();
    const navigate = useNavigate();
    const [nextMatch, setNextMatch] = useState<EventDTO | null>(null);
    const [events, setEvents] = useState<EventDTO[]>([]);
    const [_, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
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
                
                // Filter future events and sort
                const futureEvents = allEvents
                    .filter(e => new Date(e.start_date) >= new Date())
                    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                    .slice(0, 5);
                setEvents(futureEvents);
            } catch (e) {
                console.error("Failed to load coach dashboard data", e);
            } finally {
                setIsLoading(false);
            }
        };
        
        // Only trigger load if teams are loaded (or if we know user has no teams)
        // If 'teams' is empty but isLoading is true, wait.
        // Assuming context sets 'isLoading' properly or 'teams' is populated.
        loadData();
    }, [selectedTeam, teams]); // Re-run when team selection or available teams change

    const handleMatchCenterClick = () => {
        if (nextMatch) {
            navigate(`/match-center/${nextMatch.event_id}`);
        } else {
            // Maybe navigate to calendar if no immediate match
            navigate('/calendar');
        }
    };

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
                                onClick={() => navigate('/events/new')}
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
                    
                    {/* NEXT MATCH HERO (If any) */}
                    {nextMatch && (
                        <section>
                            <h2 className="text-lg font-bold text-slate-800 mb-3">Prochain Match</h2>
                            <Card onClick={handleMatchCenterClick} className="p-0 overflow-hidden cursor-pointer active:scale-[0.99] hover:shadow-xl transition-all shadow-lg shadow-indigo-500/10 border-indigo-100">
                                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 sm:p-8 text-white relative">
                                    <div className="flex justify-between items-start mb-6">
                                        <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold backdrop-blur-sm uppercase tracking-wider shadow-sm">
                                            {nextMatch.game?.competition_name || "Championnat"}
                                        </span>
                                        <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full backdrop-blur-md">
                                            <Clock size={14} className="opacity-80"/>
                                            <span className="font-mono font-bold">
                                                {format(parseISO(nextMatch.start_date), 'HH:mm')}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between gap-4 sm:gap-8">
                                        <div className="text-center flex-1">
                                            <div className="font-black text-xl sm:text-3xl leading-tight mb-2 truncate">
                                                {nextMatch.game?.home_team_name}
                                            </div>
                                            <div className="text-xs font-medium opacity-60 uppercase tracking-widest">Domicile</div>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <div className="text-center font-black text-2xl sm:text-4xl opacity-40 italic">VS</div>
                                        </div>
                                        <div className="text-center flex-1">
                                            <div className="font-black text-xl sm:text-3xl leading-tight mb-2 truncate">
                                                {nextMatch.game?.away_team_name}
                                            </div>
                                            <div className="text-xs font-medium opacity-60 uppercase tracking-widest">Extérieur</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white p-4 flex justify-between items-center border-t border-slate-100">
                                    <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                                        <Calendar size={16} className="text-indigo-400" />
                                        {format(parseISO(nextMatch.start_date), 'EEEE d MMMM yyyy', { locale: fr })}
                                        <span className="text-slate-300 mx-2">|</span>
                                        <MapPin size={16} className="text-indigo-400" />
                                        {nextMatch.location || 'Stade Municipal'}
                                    </div>
                                    <div className="flex items-center gap-1 text-indigo-600 text-sm font-bold group bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">
                                        Ouvrir Match Center
                                        <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </Card>
                        </section>
                    )}
                </div>

                {/* Right Column (Agenda) */}
                <div className="lg:col-span-1">
                    <section className="h-full">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-bold text-slate-800">Agenda</h2>
                            <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline">Tout voir</button>
                        </div>
                        <div className="space-y-3">
                            {events.length === 0 ? (
                                <div className="text-sm text-slate-500 italic text-center py-12 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200">
                                    Aucun événement futur
                                </div>
                            ) : (
                                events.map(evt => (
                                    <Card key={evt.event_id} className="p-3 flex items-center gap-4 hover:bg-slate-50 transition border-l-4 border-l-transparent hover:border-l-blue-500 cursor-pointer group">
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
        </div>
    );
};

export default CoachDashboard;
