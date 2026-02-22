import React from 'react';
import { useTeam } from '../../context/TeamContext';
import { cn } from '../../utils/cn';
import { Shield } from 'lucide-react';

export const TeamSelector: React.FC = () => {
    const { teams, selectedTeam, selectTeam } = useTeam();

    if (teams.length === 0) return null;

    return (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-4 pt-2 -mx-4 md:mx-0">
            <button
                onClick={() => selectTeam('all')}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                    !selectedTeam 
                        ? "bg-slate-800 text-white border-slate-800 shadow-sm" 
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                )}
            >
                <Shield size={12} />
                Tout
            </button>
            {teams.map(team => (
                <button
                    key={team.team_id}
                    onClick={() => selectTeam(team.team_id)}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                        selectedTeam?.team_id === team.team_id 
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    )}
                >
                    {/* If we had a team logo/icon we could show it here */}
                    {team.name}
                    {team.category && <span className="opacity-70 text-[10px] uppercase font-normal ml-1">({team.category})</span>}
                </button>
            ))}
        </div>
    );
};
