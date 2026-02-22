import React, { useEffect, useState } from 'react';
import { memberService, MemberDTO } from '../../services/memberService';
import { statsService, PlayerStatsDTO } from '../../services/statsService';
import { Card } from '../../components/atoms/Card';
import { Modal } from '../../components/molecules/Modal';
import { User, Phone, Mail, Award, Trophy, Users, Star, Footprints, Target } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useTeam } from '../../context/TeamContext';

const MyClub: React.FC = () => {
    const { selectedTeam, teams } = useTeam();
    const [members, setMembers] = useState<MemberDTO[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'roster' | 'standings'>('roster');
    
    // Stats Modal State
    const [selectedMember, setSelectedMember] = useState<MemberDTO | null>(null);
    const [memberStats, setMemberStats] = useState<PlayerStatsDTO | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);

    useEffect(() => {
        const fetchClubData = async () => {
            setIsLoading(true);
            try {
                const data = await memberService.getMembers();
                
                // Filter members based on selected team or user's teams
                const myTeamIds = teams.map(t => t.team_id);
                
                const filtered = data.filter(member => {
                    // If member has no team usage defined, assume they might clear (or block? safe to block)
                    if (!member.team_ids || member.team_ids.length === 0) return false;

                    if (selectedTeam) {
                        // Specific team selected: Member must be in that team
                        return member.team_ids.includes(selectedTeam.team_id);
                    } else {
                        // 'All' selected: Member must be in AT LEAST ONE of my teams
                        return member.team_ids.some(tid => myTeamIds.includes(tid));
                    }
                });

                setMembers(filtered);
            } catch (error) {
                console.error("Failed to load club members", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchClubData();
    }, [selectedTeam, teams]);

    // Grouping
    const staff = members.filter(m => ['coach', 'admin', 'staff'].includes(m.role?.toLowerCase()));
    // If roles aren't strictly defined yet, fallback or include everyone else in players
    const players = members.filter(m => !['coach', 'admin', 'staff'].includes(m.role?.toLowerCase()));
    
    // Mock Standings Data
    const standings = [
        { rank: 1, team: "FC Lyon Field", points: 42, played: 18, won: 13, draw: 3, lost: 2, diff: 28 },
        { rank: 2, team: "Bron Terraillon", points: 39, played: 18, won: 12, draw: 3, lost: 3, diff: 15 },
        { rank: 3, team: "AS Villeurbanne", points: 35, played: 18, won: 10, draw: 5, lost: 3, diff: 12 },
        { rank: 4, team: "Caluire SC", points: 30, played: 18, won: 9, draw: 3, lost: 6, diff: 5 },
        { rank: 5, team: "Vaulx-en-Velin", points: 28, played: 18, won: 8, draw: 4, lost: 6, diff: 2 },
        { rank: 6, team: "FC Mon Club", points: 25, played: 17, won: 7, draw: 4, lost: 6, diff: -1, isMyTeam: true },
        { rank: 7, team: "Rillieux", points: 22, played: 18, won: 6, draw: 4, lost: 8, diff: -5 },
        { rank: 8, team: "Meyzieu", points: 18, played: 18, won: 5, draw: 3, lost: 10, diff: -12 },
        { rank: 9, team: "Décines", points: 15, played: 18, won: 4, draw: 3, lost: 11, diff: -18 },
        { rank: 10, team: "Chassieu", points: 8, played: 18, won: 2, draw: 2, lost: 14, diff: -26 },
    ];

    const handleMemberClick = async (member: MemberDTO) => {
        setSelectedMember(member);
        setStatsLoading(true);
        try {
            // Fetch global stats for this member 
            // (could filter by current team context if needed, but "Details" usually implies global view or context view)
            
            const stats = await statsService.getMyStats(member.member_id);
            setMemberStats(stats);
        } catch (error) {
            console.error("Failed to load member stats", error);
        } finally {
            setStatsLoading(false);
        }
    };

    const MemberCard = ({ member }: { member: MemberDTO }) => (
        <Card 
            variant="default" 
            className="flex items-center gap-4 p-4 border-slate-100 hover:shadow-md transition-all cursor-pointer active:scale-95"
            onClick={() => handleMemberClick(member)}
        >
            <div className="relative">
                <div className="w-14 h-14 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
                    {member.photo_url ? (
                        <img src={member.photo_url} alt={`${member.first_name}`} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold text-lg">
                            {member.first_name[0]}{member.last_name[0]}
                        </div>
                    )}
                </div>
                {member.role === 'coach' && (
                    <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white p-1 rounded-full border-2 border-white" title="Coach">
                        <Award size={10} />
                    </div>
                )}
            </div>
            
            <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-800 truncate">
                    {member.first_name} {member.last_name}
                </h3>
                <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider mb-1">
                    {member.position || member.role || 'Membre'}
                </p>
                
                <div className="flex items-center gap-3">
                    {member.phone && (
                        <a href={`tel:${member.phone}`} className="text-slate-400 hover:text-green-500 transition-colors">
                            <Phone size={14} />
                        </a>
                    )}
                    {member.email && (
                        <a href={`mailto:${member.email}`} className="text-slate-400 hover:text-blue-500 transition-colors">
                            <Mail size={14} />
                        </a>
                    )}
                </div>
            </div>
        </Card>
    );

    return (
        <div className="min-h-screen bg-slate-50 p-4 pb-24 animate-fade-in">
             {/* Header */}
             <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 p-6 md:p-8 text-white shadow-xl mb-6">
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/30 rounded-full blur-[60px] translate-x-1/2 -translate-y-1/2"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg text-slate-900">
                             {activeTab === 'roster' ? <Users size={32} /> : <Trophy size={32} />}
                        </div>
                        <div>
                            <h1 className="text-2xl font-black">{selectedTeam ? selectedTeam.name : "Tout mon Club"}</h1>
                            <p className="text-indigo-200 text-sm font-medium">Saison 2025-2026</p>
                        </div>
                    </div>
                    
                    {/* Tab Switcher */}
                    <div className="flex p-1 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 self-start md:self-auto">
                        <button 
                            onClick={() => setActiveTab('roster')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                                activeTab === 'roster' ? "bg-white text-slate-900 shadow-lg" : "text-white/60 hover:text-white"
                            )}
                        >
                            <Users size={16} /> Effectif
                        </button>
                        <button 
                            onClick={() => setActiveTab('standings')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                                activeTab === 'standings' ? "bg-white text-slate-900 shadow-lg" : "text-white/60 hover:text-white"
                            )}
                        >
                            <Trophy size={16} /> Classement
                        </button>
                    </div>
                </div>
            </div>

             {/* Modal Details */}
             <Modal 
                isOpen={!!selectedMember} 
                onClose={() => { setSelectedMember(null); setMemberStats(null); }}
                title="Détails du joueur"
            >
                {selectedMember && (
                    <div className="space-y-6">
                        {/* Header Profile */}
                        <div className="flex flex-col items-center justify-center text-center">
                            <div className="w-24 h-24 rounded-full bg-slate-200 overflow-hidden border-4 border-white shadow-md mb-3">
                                {selectedMember.photo_url ? (
                                    <img src={selectedMember.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold text-3xl">
                                        {selectedMember.first_name[0]}{selectedMember.last_name[0]}
                                    </div>
                                )}
                            </div>
                            <h3 className="text-xl font-black text-slate-800">{selectedMember.first_name} {selectedMember.last_name}</h3>
                            <div className="flex gap-2 mt-1">
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-bold uppercase uppercase tracking-wider">
                                    {selectedMember.role}
                                </span>
                                {selectedMember.position && (
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-bold uppercase tracking-wider">
                                        {selectedMember.position}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Quick Actions (Contact) */}
                        <div className="flex justify-center gap-4">
                            {selectedMember.phone && (
                                <a href={`tel:${selectedMember.phone}`} className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-600 text-sm font-bold hover:bg-emerald-100 transition-colors">
                                    <Phone size={16} /> Appeler
                                </a>
                            )}
                            {selectedMember.email && (
                                <a href={`mailto:${selectedMember.email}`} className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-600 text-sm font-bold hover:bg-blue-100 transition-colors">
                                    <Mail size={16} /> Email
                                </a>
                            )}
                        </div>

                        {/* Stats Section */}
                        {statsLoading ? (
                            <div className="flex justify-center py-8">
                                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : memberStats ? (
                            <div className="bg-slate-50 p-4 rounded-xl space-y-4">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Statistiques Saison</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white p-3 rounded-lg shadow-sm flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-full"><Footprints size={16} /></div>
                                        <div>
                                            <div className="text-lg font-black text-slate-800">{memberStats.matches_played}</div>
                                            <div className="text-[10px] uppercase font-bold text-slate-400">Matchs</div>
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg shadow-sm flex items-center gap-3">
                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-full"><Target size={16} /></div>
                                        <div>
                                            <div className="text-lg font-black text-slate-800">{memberStats.goals}</div>
                                            <div className="text-[10px] uppercase font-bold text-slate-400">Buts</div>
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg shadow-sm flex items-center gap-3">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-full"><Users size={16} /></div>
                                        <div>
                                            <div className="text-lg font-black text-slate-800">{memberStats.assists}</div>
                                            <div className="text-[10px] uppercase font-bold text-slate-400">Passes D.</div>
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg shadow-sm flex items-center gap-3">
                                        <div className="p-2 bg-amber-50 text-amber-600 rounded-full"><Star size={16} /></div>
                                        <div>
                                            <div className="text-lg font-black text-slate-800">{memberStats.average_rating || '-'}</div>
                                            <div className="text-[10px] uppercase font-bold text-slate-400">Note</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-xs text-slate-400 italic">
                                        {memberStats.trainings_attended} entraînements sur {memberStats.trainings_total} ({Math.round((memberStats.trainings_attended / memberStats.trainings_total) * 100)}%)
                                    </p>
                                </div>

                                {memberStats.by_competition && memberStats.by_competition.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-200">
                                         <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Par Compétition</h4>
                                         <div className="space-y-2">
                                            {memberStats.by_competition.map((comp, i) => (
                                                <div key={i} className="flex justify-between items-center text-xs bg-white p-2 rounded shadow-sm">
                                                    <span className="font-semibold text-slate-700">{comp.competition_name}</span>
                                                    <div className="flex gap-3">
                                                        <span className="font-bold text-slate-500">{comp.matches_played}M</span>
                                                        <span className="font-bold text-emerald-600">{comp.goals}B</span>
                                                        <span className="font-bold text-indigo-600">{comp.assists}P</span>
                                                    </div>
                                                </div>
                                            ))}
                                         </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-slate-400 text-sm">Aucune statistique disponible</div>
                        )}
                    </div>
                )}
             </Modal>

            {isLoading ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="h-20 bg-white rounded-2xl animate-pulse"></div>
                    ))}
                 </div>
            ) : activeTab === 'roster' ? (
                <div className="space-y-8 animate-fade-in">
                    {/* Staff Section */}
                    {staff.length > 0 && (
                        <section>
                            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Award size={18} className="text-indigo-600" />
                                STAFF TECHNIQUE
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {staff.map(m => <MemberCard key={m.member_id} member={m} />)}
                            </div>
                        </section>
                    )}

                    {/* Players Section */}
                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <User size={18} className="text-indigo-600" />
                            EFFECTIF
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {players.map(m => <MemberCard key={m.member_id} member={m} />)}
                        </div>
                    </section>
                </div>
            ) : (
                <div className="space-y-6 animate-fade-in">
                    <Card className="overflow-hidden border-none shadow-lg">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3 font-bold text-center">#</th>
                                        <th className="px-4 py-3 font-bold">Équipe</th>
                                        <th className="px-4 py-3 font-bold text-center">Pts</th>
                                        <th className="px-4 py-3 font-bold text-center text-slate-400 hidden sm:table-cell">J</th>
                                        <th className="px-4 py-3 font-bold text-center text-slate-400 hidden sm:table-cell">G</th>
                                        <th className="px-4 py-3 font-bold text-center text-slate-400 hidden sm:table-cell">N</th>
                                        <th className="px-4 py-3 font-bold text-center text-slate-400 hidden sm:table-cell">P</th>
                                        <th className="px-4 py-3 font-bold text-center">Diff</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {standings.map((row, index) => (
                                        <tr 
                                            key={index} 
                                            className={cn(
                                                "border-b border-slate-50 last:border-none hover:bg-slate-50 transition-colors",
                                                row.isMyTeam && "bg-indigo-50/50 hover:bg-indigo-50"
                                            )}
                                        >
                                            <td className="px-4 py-3 text-center font-bold text-slate-400">
                                                <div className={cn(
                                                    "w-6 h-6 rounded-full flex items-center justify-center mx-auto",
                                                    index < 3 ? "bg-amber-100 text-amber-700" : "bg-slate-100"
                                                )}>
                                                    {row.rank}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-700 flex items-center gap-3">
                                                {/* Placeholder Logo */}
                                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0">
                                                    {row.team.substring(0, 2).toUpperCase()}
                                                </div>
                                                {row.team}
                                                {row.isMyTeam && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider ml-2">Moi</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center font-black text-slate-900">{row.points}</td>
                                            <td className="px-4 py-3 text-center text-slate-500 hidden sm:table-cell">{row.played}</td>
                                            <td className="px-4 py-3 text-center text-emerald-600 font-bold hidden sm:table-cell">{row.won}</td>
                                            <td className="px-4 py-3 text-center text-slate-400 hidden sm:table-cell">{row.draw}</td>
                                            <td className="px-4 py-3 text-center text-red-500 hidden sm:table-cell">{row.lost}</td>
                                            <td className="px-4 py-3 text-center font-bold text-slate-600">
                                                {row.diff > 0 ? `+${row.diff}` : row.diff}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                    
                    <div className="grid grid-cols-2 gap-4">
                         <Card className="p-4 flex flex-col items-center justify-center gap-2 text-center">
                             <span className="text-3xl font-black text-emerald-500">72%</span>
                             <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Victoires</span>
                         </Card>
                         <Card className="p-4 flex flex-col items-center justify-center gap-2 text-center">
                             <span className="text-3xl font-black text-indigo-500">2.4</span>
                             <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Buts / Match</span>
                         </Card>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyClub;
