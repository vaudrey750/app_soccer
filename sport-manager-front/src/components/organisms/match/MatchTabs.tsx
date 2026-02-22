import React from 'react';
import { LayoutTemplate, Radio, BarChart3, Star } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface MatchTabsProps {
    activeTab: 'tactics' | 'live' | 'stats' | 'motm';
    setActiveTab: (tab: 'tactics' | 'live' | 'stats' | 'motm') => void;
    isMotmOpen: boolean;
    canManage: boolean | null;
    hasVotedMotm: boolean;
    isMatchFinished: boolean;
    showMotmTabForCoach?: boolean;
    showLiveTab?: boolean;
}

export const MatchTabs: React.FC<MatchTabsProps> = ({
    activeTab,
    setActiveTab,
    isMotmOpen,
    canManage,
    hasVotedMotm,
    isMatchFinished,
    showMotmTabForCoach = false,
    showLiveTab = true,
}) => {
    const liveLabel = isMatchFinished ? 'Terminé' : 'Direct';

    return (
        <div className="mt-8 bg-white rounded-2xl shadow-xl p-1.5 mb-6 flex items-center justify-between border border-slate-100/50 backdrop-blur-xl">
            <button 
                onClick={() => setActiveTab('tactics')}
                className={cn(
                    "flex-1 py-3 px-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200 flex flex-col items-center gap-1.5 relative overflow-hidden",
                    activeTab === 'tactics' 
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                        : "text-slate-500 hover:bg-slate-50"
                )}
            >
                <LayoutTemplate size={18} />
                <span>Compo</span>
            </button>

            {showLiveTab && (
                <button 
                    onClick={() => setActiveTab('live')}
                    className={cn(
                        "flex-1 py-3 px-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200 flex flex-col items-center gap-1.5",
                        activeTab === 'live' 
                            ? (isMatchFinished
                                ? "bg-slate-800 text-white shadow-lg shadow-slate-200"
                                : "bg-red-500 text-white shadow-lg shadow-red-200")
                            : "text-slate-500 hover:bg-slate-50"
                    )}
                >
                    <Radio size={18} className={cn(activeTab === 'live' && !isMatchFinished && "animate-pulse")} />
                    <span>{liveLabel}</span>
                </button>
            )}
            
            <button 
                 onClick={() => setActiveTab('stats')}
                 className={cn(
                    "flex-1 py-3 px-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200 flex flex-col items-center gap-1.5",
                    activeTab === 'stats' 
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" 
                        : "text-slate-500 hover:bg-slate-50"
                )}
            >
                <BarChart3 size={18} />
                <span>Stats</span>
            </button>

            {isMatchFinished && (!canManage || showMotmTabForCoach) && (
                <button 
                     onClick={() => setActiveTab('motm')}
                     className={cn(
                        "flex-1 py-3 px-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200 flex flex-col items-center gap-1.5",
                        activeTab === 'motm'
                            ? "bg-amber-500 text-white shadow-lg shadow-amber-200"
                            : !canManage && isMotmOpen && !hasVotedMotm
                                ? "text-amber-500 hover:bg-amber-50 border border-amber-200 animate-pulse"
                                : "text-slate-500 hover:bg-slate-50"
                    )}
                >
                    <Star size={18} className="fill-current" />
                    <span>MotM</span>
                </button>
            )}
        </div>
    );
};
