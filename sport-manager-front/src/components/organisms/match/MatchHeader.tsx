import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Play, Pause, Timer, Activity } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { EventDetailDTO } from '../../../services/eventService';
import { useToast } from '../../../hooks/useToast';
import { ConfirmModal } from '../../molecules/ConfirmModal';

interface MatchHeaderProps {
    event: EventDetailDTO;
    canManage: boolean | null;
    isTimerRunning: boolean;
    elapsedTime: number;
    additionalTime: number;
    accumulatedStoppage: number;
    stoppageStart: number | null;
    onToggleStoppage: () => void;
    onSetAdditionalTime: (time: number) => void;
    onUpdateStatus: (statusId: number) => void;
    onResetMatch: () => void;
    hasTimeline: boolean;
}

export const MatchHeader: React.FC<MatchHeaderProps> = ({
    event, canManage, isTimerRunning, elapsedTime, additionalTime,
    accumulatedStoppage, stoppageStart, onToggleStoppage, onSetAdditionalTime,
    onUpdateStatus, onResetMatch, hasTimeline
}) => {
    const navigate = useNavigate();
    const toast = useToast();

    const [confirmEndOpen, setConfirmEndOpen] = useState(false);
    const [confirmResetOpen, setConfirmResetOpen] = useState(false);

    return (
        <div className="bg-slate-900 text-white p-4 pt-6 pb-20 rounded-b-[2.5rem] shadow-2xl relative overflow-hidden">
            {/* Decorative Background */}
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                <Activity size={200} />
            </div>
            
            {/* Navbar */}
            <div className="flex items-center justify-between mb-8 relative z-10">
                <button onClick={() => navigate(-1)} className="p-3 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition active:scale-95">
                    <ArrowLeft size={20} />
                </button>
                {!canManage && <div className="text-[10px] font-bold tracking-widest px-2 py-1 bg-white/10 rounded uppercase text-emerald-400">Live Public</div>}
                
                {canManage ? (
                    <button 
                        onClick={() => {
                            const url = window.location.href;
                            navigator.clipboard
                                .writeText(url)
                                .then(() => {
                                    toast.success({
                                        title: 'Lien copié',
                                        message: 'Lien public copié. Vous pouvez le partager.',
                                    });
                                })
                                .catch(() => {
                                    toast.error({
                                        title: 'Copie impossible',
                                        message: "Impossible de copier le lien. Essayez un clic droit → Copier l'adresse.",
                                    });
                                });
                        }} 
                        className="p-3 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition active:scale-95 text-indigo-300 hover:text-white"
                    >
                        <Share2 size={20} />
                    </button>
                ) : <div className="w-10"></div> }
            </div>

            {/* Scoreboard */}
            <div className="flex items-start justify-between gap-2 px-2 relative z-10">
                {/* Home Team */}
                <div className="flex flex-col items-center flex-1 gap-2">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold ring-2 ring-white/10 mb-1 backdrop-blur-sm">
                        {event.game?.home_team_name?.substring(0, 3).toUpperCase()}
                    </div>
                    <span className="text-5xl font-black leading-none tracking-tighter shadow-black drop-shadow-lg">{event.game?.score_home ?? 0}</span>
                    <span className="text-xs font-bold text-center leading-tight opacity-80 uppercase tracking-wide px-2">{event.game?.home_team_name}</span>
                </div>
                
                {/* Time & Status */}
                <div className="flex flex-col items-center pt-2">
                    <div className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-2 transition-all",
                            isTimerRunning ? "bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse" : "bg-slate-800 text-slate-400 border border-slate-700"
                    )}>
                        {(() => {
                            if (isTimerRunning && event.game?.status === 'LIVE') return 'EN DIRECT';
                            switch(event.game?.status) {
                                case 'SCHEDULED': return 'À VENIR';
                                case 'PLAYED': return 'TERMINÉ';
                                case 'CANCELLED': return 'ANNULÉ';
                                case 'HALFTIME': return 'MI-TEMPS';
                                case 'FORFEITED': return 'FORFAIT';
                                default: return 'PAUSE'; 
                            }
                        })()}
                    </div>
                    
                    <div className="flex flex-col items-center">
                        <div className="text-4xl font-mono font-bold tracking-widest text-emerald-400 tabular-nums drop-shadow-md flex items-baseline justify-center">
                            {Math.floor(elapsedTime / 60)}
                            <span className="text-emerald-500/50 text-2xl mx-1 animate-pulse">:</span>
                            {(elapsedTime % 60).toString().padStart(2, '0')}
                        </div>
                        {additionalTime > 0 && (
                            <div className="text-sm font-bold text-amber-500 mt-[-5px] animate-pulse font-mono tracking-widest">
                                +{additionalTime} min app.
                            </div>
                        )}
                    </div>
                    
                    {canManage && (
                        <div className="flex flex-col items-center gap-2 mt-4 scale-90">
                            {event.game?.status_id === 5 ? (
                                <div className="flex flex-col gap-3 w-full items-center">
                                    {/* STOPPAGE TIME CONTROLS */}
                                    <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-lg border border-slate-700 w-full justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Arrêts de jeu</span>
                                            <div className={cn("font-mono font-bold text-lg tabular-nums flex items-center gap-2", stoppageStart ? "text-amber-400 animate-pulse" : "text-slate-300")}>
                                                {Math.floor(accumulatedStoppage / 60)}:{(accumulatedStoppage % 60).toString().padStart(2, '0')}
                                                {stoppageStart && <Activity size={14} className="animate-spin" />}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={onToggleStoppage}
                                                className={cn(
                                                    "p-2 rounded-full transition-all active:scale-95 shadow-lg flex items-center justify-center",
                                                    stoppageStart 
                                                        ? "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border border-amber-500/50" 
                                                        : "bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600"
                                                )}
                                                title={stoppageStart ? "Reprendre le jeu" : "Compter un arrêt de jeu"}
                                            >
                                                {stoppageStart ? <Play size={16} fill="currentColor" /> : <Timer size={16} />}
                                            </button>
                                        </div>

                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Temps Add.</span>
                                            <div className="flex items-center gap-1">
                                                <button 
                                                    onClick={() => onSetAdditionalTime(Math.max(0, additionalTime - 1))}
                                                    className="text-slate-500 hover:text-white transition-colors"
                                                >-</button>
                                                <span className="font-mono font-bold text-emerald-400 text-lg">+{additionalTime}</span>
                                                <button 
                                                    onClick={() => onSetAdditionalTime(additionalTime + 1)}
                                                    className="text-slate-500 hover:text-white transition-colors"
                                                >+</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 w-full justify-center">
                                        <button 
                                            onClick={() => onUpdateStatus(6)}
                                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-6 rounded-full shadow-lg shadow-amber-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                                        >
                                            <Pause size={16} fill="currentColor" />
                                            <span>Mi-temps / Pause</span>
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setConfirmEndOpen(true);
                                            }}
                                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2 px-4 rounded-full shadow-lg text-xs transition-all active:scale-95 border border-slate-600"
                                        >
                                            Fin
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                <button 
                                    onClick={() => onUpdateStatus(5)}
                                    className={cn(
                                        "bg-emerald-500 hover:bg-emerald-400 text-white font-black py-2 px-8 rounded-full shadow-lg shadow-emerald-500/50 transition-all flex items-center gap-2 active:scale-95 text-sm uppercase tracking-wider",
                                        event.game?.status_id === 5 && "animate-pulse"
                                    )}
                                >
                                    <Play size={18} fill="currentColor" />
                                    <span>{elapsedTime > 0 ? "Reprendre" : "Coup d'envoi"}</span>
                                </button>

                                {/* Reset Match Button */}
                                {!hasTimeline && event.game?.status_id !== 1 && canManage && (
                                    <button 
                                        onClick={() => {
                                            setConfirmResetOpen(true);
                                        }}
                                        className="mt-3 text-[10px] text-slate-500 hover:text-red-400 font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
                                    >
                                        <Activity size={12} />
                                        Réinitialiser 0-0
                                    </button>
                                )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Away Team */}
                <div className="flex flex-col items-center flex-1 gap-2">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold ring-2 ring-white/10 mb-1 backdrop-blur-sm">
                        {event.game?.away_team_name?.substring(0, 3).toUpperCase()}
                    </div>
                    <span className="text-5xl font-black leading-none tracking-tighter shadow-black drop-shadow-lg">{event.game?.score_away ?? 0}</span>
                    <span className="text-xs font-bold text-center leading-tight opacity-80 uppercase tracking-wide px-2">{event.game?.away_team_name}</span>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmEndOpen}
                title="Fin du match"
                message="Confirmer la fin du match ?"
                confirmLabel="Terminer"
                isDanger
                onClose={() => setConfirmEndOpen(false)}
                onConfirm={async () => {
                    setConfirmEndOpen(false);
                    onUpdateStatus(2);
                }}
            />

            <ConfirmModal
                isOpen={confirmResetOpen}
                title="Réinitialiser le match"
                message="Le chrono reviendra à 0, le score repassera à 0-0, la possession, les notes et les votes Homme du Match seront vidés, et le statut repassera à 'À venir'."
                confirmLabel="Réinitialiser"
                isDanger
                onClose={() => setConfirmResetOpen(false)}
                onConfirm={async () => {
                    setConfirmResetOpen(false);
                    onResetMatch();
                }}
            />
        </div>
    );
};
