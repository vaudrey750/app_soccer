import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTeam } from '../../context/TeamContext';
import { PlayerStatsDTO, TeamStatsDTO, LeaderboardsDTO, SquadMemberStatsDTO, statsService } from '../../services/statsService';
import { Card } from '../../components/atoms/Card';
import { cn } from '../../utils/cn';
import { Trophy, Activity, Users, Target, Footprints, Clock, Star} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip} from 'recharts';

type TabType = 'personal' | 'team' | 'squad' | 'leaders';

const COLORS = ['#10B981', '#94A3B8', '#EF4444']; // Win (Green), Draw (Slate), Loss (Red)

const Statistics: React.FC = () => {
    const { user } = useAuth();
    const { selectedTeam, teams } = useTeam();
    const [activeTab, setActiveTab] = useState<TabType>('personal');
    const [isLoading, setIsLoading] = useState(true);
    
    // Data States
    const [myStats, setMyStats] = useState<PlayerStatsDTO | null>(null);
    const [teamStats, setTeamStats] = useState<TeamStatsDTO[]>([]);
    const [leaderboards, setLeaderboards] = useState<LeaderboardsDTO | null>(null);
    const [squadStats, setSquadStats] = useState<SquadMemberStatsDTO[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: keyof SquadMemberStatsDTO, direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        const loadStats = async () => {
            if (!user) return;
            setIsLoading(true);
            try {

                // 1. My Stats
                const myStatsData = await statsService.getMyStats(user.id);
                setMyStats(myStatsData);

                // 2. Team Stats
                // If 'all', we fetch all stats for user's teams
                const teamsToFetch = selectedTeam ? [selectedTeam] : teams;
                const tStatsPromises = teamsToFetch.map(t => statsService.getTeamStats(t.team_id));
                const tStats = await Promise.all(tStatsPromises);
                setTeamStats(tStats);

                // 3. Squad Stats (Only specific team for now, or aggregate if possible)
                if (selectedTeam) {
                    const squad = await statsService.getSquadStats(selectedTeam.team_id);
                    setSquadStats(squad);
                } else {
                    // Aggregate or fetch first team
                    if (teams.length > 0) {
                        // For demo, just fetching first team
                         const squad = await statsService.getSquadStats(teams[0].team_id);
                         setSquadStats(squad);
                    }
                }

                // 4. Leaderboards
                // If 'all', mock might aggregate or just show first. 
                // In real app, 'all' leaderboard is tricky. Let's just fetch for the context.
                const leaders = await statsService.getLeaderboards();
                setLeaderboards(leaders);

            } catch (error) {
                console.error("Failed to load stats", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadStats();
    }, [user, selectedTeam, teams]);

    const handleSort = (key: keyof SquadMemberStatsDTO) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });

        const sorted = [...squadStats].sort((a, b) => {
            if (a[key]! < b[key]!) return direction === 'asc' ? -1 : 1;
            if (a[key]! > b[key]!) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        setSquadStats(sorted);
    };

    if (isLoading) return <div className="flex justify-center p-12"><div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="p-4 md:p-8 space-y-6 pb-24">
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <Activity className="text-indigo-600" />
                Statistiques
            </h1>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-lg w-full max-w-md mx-auto md:mx-0">
                <button 
                    onClick={() => setActiveTab('personal')}
                    className={cn(
                        "flex-1 py-2 text-sm font-semibold rounded-md transition-all",
                        activeTab === 'personal' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    Personnel
                </button>
                <button 
                    onClick={() => setActiveTab('team')}
                    className={cn(
                        "flex-1 py-2 text-sm font-semibold rounded-md transition-all",
                        activeTab === 'team' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    Collectif
                </button>
                <button 
                    onClick={() => setActiveTab('squad')}
                    className={cn(
                        "flex-1 py-2 text-sm font-semibold rounded-md transition-all",
                        activeTab === 'squad' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    Effectif
                </button>
                <button 
                    onClick={() => setActiveTab('leaders')}
                    className={cn(
                        "flex-1 py-2 text-sm font-semibold rounded-md transition-all",
                        activeTab === 'leaders' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    Leaders
                </button>
            </div>

            {/* Content */}
            <div className="animate-fade-in">
                {activeTab === 'personal' && myStats && (
                    <div className="space-y-6">
                        {/* Key Metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard label="Matchs Joués" value={myStats.matches_played} icon={Footprints} color="blue" />
                            <StatCard label="Buts" value={myStats.goals} icon={Target} color="emerald" />
                            <StatCard label="Passes D." value={myStats.assists} icon={Users} color="indigo" />
                            <StatCard label="Note Moy." value={myStats.average_rating || '-'} icon={Star} color="amber" isFloat />
                        </div>

                        {/* Attendance Section */}
                        <Card className="p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Clock size={20} className="text-slate-400" /> Assiduité
                            </h3>
                            <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
                                <div className="w-32 h-32 relative flex items-center justify-center">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                                        <circle 
                                            cx="64" cy="64" r="56" 
                                            stroke="currentColor" strokeWidth="12" 
                                            fill="transparent" 
                                            strokeDasharray={351}
                                            strokeDashoffset={351 - (351 * (myStats.trainings_attended / myStats.trainings_total))}
                                            className="text-indigo-600 transition-all duration-1000 ease-out" 
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-2xl font-bold text-indigo-900">{Math.round((myStats.trainings_attended / myStats.trainings_total) * 100)}%</span>
                                    </div>
                                </div>
                                <div className="space-y-2 text-center md:text-left">
                                    <div className="text-sm text-slate-500">Vous avez participé à <span className="font-bold text-slate-800">{myStats.trainings_attended}</span> entraînements sur <span className="font-bold text-slate-800">{myStats.trainings_total}</span>.</div>
                                    <div className="text-xs text-slate-400">Une présence régulière est clé pour la progression.</div>
                                </div>
                            </div>
                        </Card>

                        {/* Competition Breakdown */}
                        {myStats.by_competition && myStats.by_competition.length > 0 && (
                            <Card className="p-6">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <Trophy size={20} className="text-slate-400" /> Par Compétition
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-slate-100 text-slate-500 uppercase text-xs">
                                            <tr>
                                                <th className="py-2 text-left font-bold pl-2">Compétition</th>
                                                <th className="py-2 text-center font-bold">M</th>
                                                <th className="py-2 text-center font-bold text-emerald-600">B</th>
                                                <th className="py-2 text-center font-bold text-indigo-600">P</th>
                                                <th className="py-2 text-center font-bold text-amber-500">Note</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {myStats.by_competition.map((comp, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="py-3 font-semibold text-slate-800 pl-2">{comp.competition_name}</td>
                                                    <td className="py-3 text-center text-slate-600 font-bold">{comp.matches_played}</td>
                                                    <td className="py-3 text-center text-emerald-600 font-black">{comp.goals}</td>
                                                    <td className="py-3 text-center text-indigo-600 font-bold">{comp.assists}</td>
                                                    <td className="py-3 text-center text-amber-600 font-bold">{comp.average_rating || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        )}
                    </div>
                )}

                {activeTab === 'team' && (
                    <div className="space-y-8">
                        {teamStats.map(stat => (
                            <div key={stat.team_id} className="space-y-4">
                                <h3 className="text-xl font-bold text-slate-800 border-l-4 border-indigo-600 pl-3">
                                    {stat.team_name}
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Win/Draw/Loss & Form */}
                                    <Card className="p-6 flex flex-col items-center">
                                        <h4 className="font-semibold text-slate-600 mb-4 w-full">Résultats</h4>
                                        <div className="w-48 h-48">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={[
                                                            { name: 'Victoires', value: stat.wins },
                                                            { name: 'Nuls', value: stat.draws },
                                                            { name: 'Défaites', value: stat.losses }
                                                        ]}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {COLORS.map((_, index) => (
                                                            <Cell key={`cell-\${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="flex gap-4 mt-4 text-xs font-medium">
                                            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> {stat.wins} V</div>
                                            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-slate-400"></div> {stat.draws} N</div>
                                            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> {stat.losses} D</div>
                                        </div>

                                        <div className="mt-6 w-full">
                                            <div className="text-xs text-slate-400 mb-2 uppercase font-bold tracking-wider">Forme (5 derniers)</div>
                                            <div className="flex gap-2">
                                                {stat.form.map((f, i) => (
                                                    <div 
                                                        key={i} 
                                                        className={cn(
                                                            "w-8 h-8 rounded flex items-center justify-center font-bold text-white text-xs",
                                                            f === 'W' ? "bg-emerald-500" : f === 'D' ? "bg-slate-400" : "bg-red-500"
                                                        )}
                                                    >
                                                        {f === 'W' ? 'V' : f === 'D' ? 'N' : 'D'}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </Card>

                                    {/* Goals Stats */}
                                    <Card className="p-6">
                                        <h4 className="font-semibold text-slate-600 mb-4">Buts</h4>
                                        <div className="grid grid-cols-2 gap-4 h-full content-center">
                                            <div className="bg-emerald-50 p-4 rounded-xl text-center">
                                                <div className="text-3xl font-black text-emerald-600">{stat.goals_for}</div>
                                                <div className="text-xs font-bold text-emerald-800 uppercase mt-1">Marqués</div>
                                            </div>
                                            <div className="bg-red-50 p-4 rounded-xl text-center">
                                                <div className="text-3xl font-black text-red-600">{stat.goals_against}</div>
                                                <div className="text-xs font-bold text-red-800 uppercase mt-1">Encaissés</div>
                                            </div>
                                            <div className="bg-indigo-50 p-4 rounded-xl text-center col-span-2 flex items-center justify-between px-8">
                                                <div className="text-left">
                                                    <div className="text-2xl font-black text-indigo-600">{stat.goals_for - stat.goals_against > 0 ? '+' : ''}{stat.goals_for - stat.goals_against}</div>
                                                    <div className="text-xs font-bold text-indigo-800 uppercase">Différence</div>
                                                </div>
                                                <div className="h-8 w-[1px] bg-indigo-200"></div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-black text-slate-700">{stat.clean_sheets}</div>
                                                    <div className="text-xs font-bold text-slate-500 uppercase">Clean Sheets</div>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                                
                                {stat.by_competition && stat.by_competition.length > 0 && (
                                    <Card className="p-6">
                                        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                            <Trophy size={18} className="text-slate-400" /> Détails par Compétition
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="border-b border-slate-100 text-slate-500 uppercase text-xs bg-slate-50/50">
                                                    <tr>
                                                        <th className="py-2 px-3 text-left font-bold rounded-l-lg">Compétition</th>
                                                        <th className="py-2 px-2 text-center font-bold">J</th>
                                                        <th className="py-2 px-2 text-center font-bold text-emerald-600">V</th>
                                                        <th className="py-2 px-2 text-center font-bold text-slate-500">N</th>
                                                        <th className="py-2 px-2 text-center font-bold text-red-600">D</th>
                                                        <th className="py-2 px-2 text-center font-bold">BP</th>
                                                        <th className="py-2 px-2 text-center font-bold">BC</th>
                                                        <th className="py-2 px-3 text-center font-bold rounded-r-lg">Diff</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {stat.by_competition.map((comp, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                            <td className="py-3 px-3 font-semibold text-slate-800">{comp.competition_name}</td>
                                                            <td className="py-3 px-2 text-center font-bold text-slate-700">{comp.matches_played}</td>
                                                            <td className="py-3 px-2 text-center font-bold text-emerald-600 bg-emerald-50/30 rounded">{comp.wins}</td>
                                                            <td className="py-3 px-2 text-center font-bold text-slate-500">{comp.draws}</td>
                                                            <td className="py-3 px-2 text-center font-bold text-red-500 bg-red-50/30 rounded">{comp.losses}</td>
                                                            <td className="py-3 px-2 text-center text-slate-600">{comp.goals_for}</td>
                                                            <td className="py-3 px-2 text-center text-slate-400">{comp.goals_against}</td>
                                                            <td className="py-3 px-3 text-center font-bold text-slate-800">
                                                                {comp.goals_for - comp.goals_against > 0 ? '+' : ''}{comp.goals_for - comp.goals_against}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </Card>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {activeTab === 'squad' && squadStats.length > 0 && (
                     <Card className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('last_name')}>
                                            Joueur
                                        </th>
                                        <th className="px-4 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('matches_played')}>
                                            Matchs
                                        </th>
                                        <th className="px-4 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors text-emerald-600" onClick={() => handleSort('goals')}>
                                            Buts
                                        </th>
                                        <th className="px-4 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors text-indigo-600" onClick={() => handleSort('assists')}>
                                            Passes
                                        </th>
                                        <th className="px-4 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('trainings_attended')}>
                                            Présence
                                        </th>
                                        <th className="px-4 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors text-amber-600" onClick={() => handleSort('average_rating')}>
                                            Note
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {squadStats.map((player) => (
                                        <tr key={player.member_id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {player.photo_url ? (
                                                        <img src={player.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                                                            {player.first_name[0]}{player.last_name[0]}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="font-bold text-slate-800">{player.first_name} {player.last_name}</div>
                                                        <div className="text-[10px] text-slate-400 uppercase font-medium">{player.position}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-slate-600">{player.matches_played}</td>
                                            <td className="px-4 py-3 text-center font-black text-emerald-600">{player.goals}</td>
                                            <td className="px-4 py-3 text-center font-bold text-indigo-600">{player.assists}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="font-bold text-slate-700">{Math.round((player.trainings_attended / player.trainings_total) * 100)}%</span>
                                                    <span className="text-[10px] text-slate-400">{player.trainings_attended}/{player.trainings_total}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-amber-600 bg-amber-50/50">
                                                {player.average_rating}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                     </Card>
                )}
                {activeTab === 'leaders' && leaderboards && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <LeaderboardCard 
                            title="Meilleurs Buteurs" 
                            icon={Target} 
                            data={leaderboards.top_scorers} 
                            color="bg-emerald-100 text-emerald-700"
                            unit="buts"
                        />
                        <LeaderboardCard 
                            title="Meilleurs Passeurs" 
                            icon={Users} 
                            data={leaderboards.top_assists} 
                            color="bg-blue-100 text-blue-700"
                            unit="passes"
                        />
                         <LeaderboardCard 
                            title="Les plus assidus" 
                            icon={Clock} 
                            data={leaderboards.most_active} 
                            color="bg-amber-100 text-amber-700"
                            unit="%"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

const StatCard = ({ label, value, icon: Icon, color }: any) => {
    // Determine gradient/text colors based on prop
    const colorClasses = {
        blue: "text-blue-600 bg-blue-50",
        emerald: "text-emerald-600 bg-emerald-50",
        indigo: "text-indigo-600 bg-indigo-50",
        amber: "text-amber-600 bg-amber-50"
    }[color as string] || "text-slate-600 bg-slate-50";

    return (
        <Card className="p-4 flex flex-col items-center justify-center text-center hover:shadow-md transition-all">
            <div className={cn("p-2 rounded-full mb-2", colorClasses)}>
                <Icon size={20} />
            </div>
            <div className="text-2xl font-black text-slate-800">
                {value}
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</div>
        </Card>
    );
};

const LeaderboardCard = ({ title, icon: Icon, data, color, unit }: any) => (
    <Card className="flex flex-col overflow-hidden">
        <div className={cn("p-4 flex items-center gap-2 font-bold", color)}>
            <Icon size={18} />
            {title}
        </div>
        <div className="divide-y divide-slate-100">
            {data.map((item: any, idx: number) => (
                <div key={item.member_id} className="p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                    <div className={cn(
                        "w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold",
                        idx === 0 ? "bg-amber-400 text-white" : 
                        idx === 1 ? "bg-slate-300 text-white" : 
                        idx === 2 ? "bg-orange-300 text-white" : "bg-slate-100 text-slate-500"
                    )}>
                        {idx + 1}
                    </div>
                    {item.photo_url ? (
                        <img src={item.photo_url} className="w-8 h-8 rounded-full object-cover bg-slate-200" alt="" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                            {item.name.charAt(0)}
                        </div>
                    )}
                    <div className="flex-1 font-medium text-sm text-slate-700 truncate">{item.name}</div>
                    <div className="font-bold text-slate-900 text-sm whitespace-nowrap">
                        {item.value} <span className="text-[10px] text-slate-400 font-normal uppercase">{unit}</span>
                    </div>
                </div>
            ))}
        </div>
    </Card>
);

export default Statistics;
