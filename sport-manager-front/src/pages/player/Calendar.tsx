import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventService, EventDTO } from '../../services/eventService';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/atoms/Card';
import { Button } from '../../components/atoms/Button';
import { Calendar as CalendarIcon, MapPin, Clock, ChevronRight, ChevronLeft } from 'lucide-react';
import { 
    format, parseISO, isPast, startOfWeek, endOfWeek, startOfMonth, 
    endOfMonth, isWithinInterval, addDays, 
    addWeeks, addMonths, subDays, subWeeks, subMonths, isSameDay,
    eachDayOfInterval, isSameMonth, isToday
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '../../utils/cn';
import { useTeam } from '../../context/TeamContext';

type ViewType = 'day' | 'week' | 'month';

const CalendarPage: React.FC = () => {
    const { user } = useAuth();
    const { selectedTeam, teams } = useTeam();
    const navigate = useNavigate();
    const [events, setEvents] = useState<EventDTO[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'match' | 'training'>('all');
    const [view, setView] = useState<ViewType>('month');
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                // Fetch all events for the user's team(s)
                const allowedTeamIds = teams.map(t => t.team_id);
                const data = await eventService.getEvents(selectedTeam?.team_id, allowedTeamIds); 
                // Sort by date ascending
                const sorted = data.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
                setEvents(sorted);
            } catch (error) {
                console.error("Failed to load events", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchEvents();
    }, [user, selectedTeam, teams]);

    // --- Navigation Logic ---
    const handlePrev = () => {
        if (view === 'day') setCurrentDate(prev => subDays(prev, 1));
        if (view === 'week') setCurrentDate(prev => subWeeks(prev, 1));
        if (view === 'month') setCurrentDate(prev => subMonths(prev, 1));
    };

    const handleNext = () => {
        if (view === 'day') setCurrentDate(prev => addDays(prev, 1));
        if (view === 'week') setCurrentDate(prev => addWeeks(prev, 1));
        if (view === 'month') setCurrentDate(prev => addMonths(prev, 1));
    };

    const getHeaderLabel = () => {
        if (view === 'day') return format(currentDate, 'd MMMM yyyy', { locale: fr });
        if (view === 'week') {
            const start = startOfWeek(currentDate, { locale: fr });
            const end = endOfWeek(currentDate, { locale: fr });
            // If same month
            if (format(start, 'MMM') === format(end, 'MMM')) {
                return `${format(start, 'd', { locale: fr })} - ${format(end, 'd MMMM yyyy', { locale: fr })}`;
            }
            return `${format(start, 'd MMM', { locale: fr })} - ${format(end, 'd MMM yyyy', { locale: fr })}`;
        }
        return format(currentDate, 'MMMM yyyy', { locale: fr });
    };

    // --- Filter Logic ---
    const getFilteredEvents = () => {
        // 1. Filter by Type
        let filtered = events.filter(e => {
            if (filter === 'all') return true;
            return e.type === filter;
        });

        // 2. Filter by Date Range (View)
        filtered = filtered.filter(e => {
            const date = parseISO(e.start_date);
            
            if (view === 'day') {
                return isSameDay(date, currentDate);
            }
            if (view === 'week') {
                const start = startOfWeek(currentDate, { locale: fr });
                const end = endOfWeek(currentDate, { locale: fr });
                return isWithinInterval(date, { start, end });
            }
            if (view === 'month') {
                const start = startOfMonth(currentDate);
                const end = endOfMonth(currentDate);
                // isWithinInterval is inclusive
                return isWithinInterval(date, { start, end });
            }
            return true;
        });

        return filtered;
    };

    const displayEvents = getFilteredEvents();

    // --- Grid Data Preparation ---
    let calendarDays: Date[] = [];
    
    if (view === 'month') {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const calendarStart = startOfWeek(monthStart, { locale: fr });
        const calendarEnd = endOfWeek(monthEnd, { locale: fr });
        calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    } else if (view === 'week') {
        const weekStart = startOfWeek(currentDate, { locale: fr });
        const weekEnd = endOfWeek(currentDate, { locale: fr });
        calendarDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
    
    // Map events to YYYY-MM-DD for O(1) grid lookup
    const eventsByDate = events.reduce((acc, event) => {
        const dateKey = format(parseISO(event.start_date), 'yyyy-MM-dd');
         if (filter !== 'all' && event.type !== filter) return acc; // Apply type filter
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(event);
        return acc;
    }, {} as Record<string, EventDTO[]>);

    // Group by Day for Day view list
    const groupedByDay = displayEvents.reduce((acc, event) => {
        const date = parseISO(event.start_date);
        const key = format(date, 'EEEE d MMMM', { locale: fr }); // Lundi 12 Janvier
        if (!acc[key]) acc[key] = [];
        acc[key].push(event);
        return acc;
    }, {} as Record<string, EventDTO[]>);

    const renderWeekView = () => (
        <div className="space-y-4 pt-2">
            {calendarDays.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsByDate[dateKey] || [];
                const isTodayDate = isToday(day);

                return (
                     <div key={day.toISOString()} className={cn("rounded-2xl border bg-white overflow-hidden transition-all", isTodayDate ? "border-indigo-200 shadow-md scale-[1.01]" : "border-slate-100")}>
                        <div className={cn("px-4 py-2 border-b flex justify-between items-center", isTodayDate ? "bg-indigo-50/50" : "bg-slate-50/50")}>
                           <span className={cn("font-bold capitalize", isTodayDate ? "text-indigo-900" : "text-slate-700")}>
                               {format(day, 'EEEE d MMMM', {locale: fr})}
                           </span>
                           {isTodayDate && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">Aujourd'hui</span>}
                        </div>
                        
                        <div className="p-2 min-h-[80px]">
                           {dayEvents.length > 0 ? (
                               <div className="space-y-2">
                                   {dayEvents.sort((a,b) => a.start_date.localeCompare(b.start_date)).map(event => {
                                       const isMatch = event.type === 'match';
                                       const date = parseISO(event.start_date);
                                       const isFinished = isPast(date);
                                       
                                       return (
                                           <div 
                                               key={event.event_id}
                                               onClick={() => navigate(`/events/${event.event_id}`)}
                                               className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-all"
                                           >
                                                {/* Time & Type Indicator */}
                                                <div className={cn(
                                                    "flex flex-col items-center justify-center w-12 h-12 rounded-xl shrink-0 font-bold text-xs",
                                                    isMatch ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
                                                )}>
                                                    <span>{format(date, 'HH:mm')}</span>
                                                    <div className={cn("w-1.5 h-1.5 rounded-full mt-1", isMatch ? "bg-indigo-500" : "bg-emerald-500")} />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="font-bold text-slate-800 text-sm truncate">
                                                            {isMatch ? `Match vs ${event.game?.away_team_name || 'Adversaire'}` : event.title}
                                                        </h4>
                                                         {isFinished && isMatch && event.game?.score_home !== undefined && (
                                                             <span className="text-xs font-black text-slate-600 bg-slate-100 px-1.5 rounded ml-2">
                                                                 {event.game.score_home}-{event.game.score_away}
                                                             </span>
                                                         )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                                        {event.location && (
                                                             <span className="flex items-center gap-1 truncate">
                                                                 <MapPin size={10} /> {event.location}
                                                             </span>
                                                        )}
                                                        <span className={cn(
                                                            "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                                            isMatch ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                                                        )}>
                                                            {isMatch ? "Champ." : "Entr."}
                                                        </span>
                                                    </div>
                                                </div>
                                                <ChevronRight size={16} className="text-slate-300" />
                                           </div>
                                       );
                                   })}
                               </div>
                           ) : (
                               <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-1 py-2">
                                   <div className="w-1 h-1 bg-slate-200 rounded-full" />
                                   <span className="text-xs font-medium italic">Rien de prévu</span>
                               </div>
                           )}
                        </div>
                     </div>
                );
            })}
        </div>
    );

    const renderMonthGrid = () => (
        <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
             {/* Headers */}
             <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                 {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                     <div key={day} className="py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                         {day}
                     </div>
                 ))}
             </div>
             {/* Days Grid */}
             <div className="grid grid-cols-7 flex-1 auto-rows-[1fr]">
                 {calendarDays.map((day, _) => {
                     const dateKey = format(day, 'yyyy-MM-dd');
                     const dayEvents = eventsByDate[dateKey] || [];
                     const isCurrentMonth = isSameMonth(day, currentDate);
                     const isTodayDate = isToday(day);

                     return (
                        <div 
                            key={day.toISOString()} 
                            onClick={() => {
                                setCurrentDate(day);
                                setView('day');
                            }}
                            className={cn(
                                "min-h-[80px] border-b border-r border-slate-50 p-2 relative transition-all group cursor-pointer hover:bg-slate-50",
                                !isCurrentMonth && "bg-slate-50/50 text-slate-300",
                                isTodayDate && "bg-indigo-50/30"
                            )}
                        >
                            <span className={cn(
                                "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mb-1",
                                isTodayDate 
                                    ? "bg-indigo-600 text-white shadow-sm" 
                                    : isCurrentMonth ? "text-slate-700" : "text-slate-300"
                            )}>
                                {format(day, 'd')}
                            </span>
                            
                            {/* Dot Indicators */}
                            <div className="flex flex-wrap gap-1 content-start">
                                {dayEvents.slice(0, 4).map((evt, i) => (
                                    <div 
                                        key={i} 
                                        className={cn(
                                            "h-1.5 w-1.5 rounded-full",
                                            evt.type === 'match' ? "bg-indigo-500" : "bg-emerald-500"
                                        )}
                                    />
                                ))}
                                {dayEvents.length > 4 && (
                                    <span className="text-[9px] text-slate-400 leading-none">+</span>
                                )}
                            </div>
                        </div>
                     );
                 })}
             </div>
        </div>
    );


    return (
        <div className="min-h-screen bg-slate-50 p-4 pb-24 animate-fade-in flex flex-col h-screen">
            
            {/* --- Fixed Header Area --- */}
            <div className="shrink-0 space-y-4 mb-4">
                {/* Top Bar */}
                <div className="flex items-center justify-between pt-2">
                    <h1 className="text-3xl font-black text-slate-900">Calendrier</h1>
                    {/* View Switcher */}
                    <div className="flex bg-slate-200 p-1 rounded-xl">
                        {(['day', 'week', 'month'] as ViewType[]).map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all",
                                    view === v ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                {v === 'day' ? 'Jour' : v === 'week' ? 'Sem' : 'Mois'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Date Navigation */}
                <div className="flex items-center justify-between bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                    <button onClick={handlePrev} className="p-2 hover:bg-slate-50 rounded-full text-slate-500 hover:text-indigo-600 transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-bold text-slate-800 capitalize">
                        {getHeaderLabel()}
                    </span>
                    <button onClick={handleNext} className="p-2 hover:bg-slate-50 rounded-full text-slate-500 hover:text-indigo-600 transition-colors">
                        <ChevronRight size={20} />
                    </button>
                </div>

                 {/* Filters */}
                 <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <button 
                        onClick={() => setFilter('all')}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                            filter === 'all' 
                                ? "bg-slate-800 text-white border-slate-800" 
                                : "bg-white text-slate-500 border-slate-200"
                        )}
                    >
                        Tout
                    </button>
                    <button 
                        onClick={() => setFilter('match')}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                            filter === 'match' 
                                ? "bg-indigo-600 text-white border-indigo-600" 
                                : "bg-white text-slate-500 border-slate-200"
                        )}
                    >
                        Matchs
                    </button>
                    <button 
                        onClick={() => setFilter('training')}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                            filter === 'training' 
                                ? "bg-emerald-600 text-white border-emerald-600" 
                                : "bg-white text-slate-500 border-slate-200"
                        )}
                    >
                        Entraînements
                    </button>
                </div>
            </div>

            {/* --- Scrollable Content --- */}
            <div className={cn("flex-1 -mx-4 px-4 pb-20", (view === 'month' || view === 'week') ? "overflow-y-auto pt-2" : "overflow-y-auto")}>
                {isLoading ? (
                    <div className="flex flex-col gap-4 mt-4">
                        {[1,2,3].map(i => (
                            <div key={i} className="h-24 bg-white rounded-3xl animate-pulse"></div>
                        ))}
                    </div>
                ) : view === 'month' ? (
                    renderMonthGrid()
                ) : view === 'week' ? (
                    renderWeekView()
                ) : displayEvents.length > 0 ? (
                    // --- LIST VIEW (DAY) ---
                    <div className="space-y-6 pt-4">
                        {Object.entries(groupedByDay).map(([dayLabel, dayEvents]) => (
                            <div key={dayLabel} className="space-y-3">
                                {/* Date Separator (Only if not in Day view, Day view header is enough context usually, but keeping it is fine) */}
                                {view !== 'day' && (
                                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2 sticky top-0 bg-slate-50/95 backdrop-blur py-2 z-10">
                                        {dayLabel}
                                    </h2>
                                )}
                                
                                {dayEvents.map(event => {
                                    const isMatch = event.type === 'match';
                                    const date = parseISO(event.start_date);
                                    const isFinished = isPast(date);

                                    return (
                                        <div 
                                            key={event.event_id}
                                            className="group relative"
                                        >
                                            {/* Timeline connector (optional visual) */}
                                            {view !== 'day' && <div className="absolute left-8 top-0 bottom-0 w-px bg-slate-200 -z-10 group-last:hidden"></div>}

                                            <Card 
                                                variant="default" 
                                                className="flex items-center gap-4 p-4 hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden border-slate-100"
                                                onClick={() => navigate(`/events/${event.event_id}`)}
                                            >
                                                {/* Left: Date Date Badge (Simplify if Day View?) */}
                                                <div className={cn(
                                                    "flex flex-col items-center justify-center w-14 h-14 rounded-2xl shrink-0 font-bold",
                                                    isMatch ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
                                                )}>
                                                    {view === 'day' ? (
                                                        <Clock size={20} />
                                                    ) : (
                                                        <>
                                                            <span className="text-xs uppercase">{format(date, 'MMM', { locale: fr })}</span>
                                                            <span className="text-xl">{format(date, 'dd')}</span>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Center: Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                         <span className={cn(
                                                             "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded mb-1 inline-block",
                                                             isMatch ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                                                         )}>
                                                             {isMatch ? "Championnat" : "Entraînement"}
                                                         </span>
                                                         {isFinished && isMatch && event.game?.score_home !== undefined && (
                                                             <span className="font-black text-slate-800 bg-slate-100 px-2 rounded">
                                                                 {event.game.score_home} - {event.game.score_away}
                                                             </span>
                                                         )}
                                                    </div>
                                                    
                                                    <h3 className="font-bold text-slate-800 truncate">
                                                        {isMatch 
                                                            ? `vs ${event.game?.away_team_name || 'Adversaire'}` 
                                                            : event.title
                                                        }
                                                    </h3>
                                                    
                                                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-1">
                                                        <span className="flex items-center gap-1">
                                                            <Clock size={12} />
                                                            {format(date, 'HH:mm')}
                                                        </span>
                                                        {event.location && (
                                                            <span className="flex items-center gap-1 truncate max-w-[100px]">
                                                                <MapPin size={12} />
                                                                {event.location}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right: Action or Status */}
                                                <div className="shrink-0 text-slate-300 group-hover:text-indigo-500 transition-colors">
                                                    <ChevronRight size={20} />
                                                </div>
                                            </Card>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 pb-20">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
                             <CalendarIcon size={32} />
                        </div>
                        <p className="font-medium">Aucun événement</p>
                        <p className="text-sm opacity-60">pour cette période</p>
                        {view === 'day' || view === 'week' ? (
                             <Button variant="ghost" className="mt-4 text-indigo-600" onClick={() => setView('month')}>
                                 Voir le mois
                             </Button>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CalendarPage;
