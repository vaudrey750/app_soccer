import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import { Download, Shield } from 'lucide-react';
import { cn } from '../../utils/cn';

interface FUTCardProps {
    player: {
        name: string;
        position: string;
        photo_url?: string;
        club_badge?: string;
        nationality_flag?: string;
    };
    rating: number;
    variant?: 'full' | 'compact';
    showActions?: boolean;
    skin?: 'gold' | 'special';
    form?: Array<'W' | 'D' | 'L' | '-'>;
    level?: number;
    xp?: { current: number; next: number };
    stats?: {
        pac: number;
        sho: number;
        pas: number;
        dri: number;
        def: number;
        phy: number;
    };
    onClose?: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const FUTCard: React.FC<FUTCardProps> = ({
    player,
    rating,
    variant = 'full',
    showActions = true,
    skin = 'gold',
    form,
    level,
    xp,
    stats,
    onClose,
}) => {
    const cardRef = useRef<HTMLDivElement>(null);

    const handleDownload = async () => {
        if (!cardRef.current) return;
        
        try {
            const canvas = await html2canvas(cardRef.current, {
                useCORS: true, // Important for external images
                scale: 2, // Better resolution
                backgroundColor: null,
            });
            
            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            link.download = `FUT_Card_${player.name.replace(/\s+/g, '_')}.png`;
            link.click();
        } catch (err) {
            console.error("Failed to generate card image", err);
            alert("Erreur lors de la génération de l'image. Vérifiez les permissions CORS des images.");
        }
    };

    const futRating = clamp(Math.round(rating * 10), 0, 99);

    const deriveStat = (mult: number, add: number) => clamp(Math.round(futRating * mult + add), 0, 99);

    const displayStats = stats || {
        pac: deriveStat(0.9, 6),
        sho: deriveStat(0.85, 5),
        pas: deriveStat(0.88, 4),
        dri: deriveStat(0.92, 3),
        def: deriveStat(0.7, 8),
        phy: deriveStat(0.8, 7),
    };

    const formSequence = (form ?? []).slice(0, 5);
    const xpCurrent = xp ? clamp(xp.current, 0, xp.next) : undefined;
    const xpNext = xp?.next;

    if (variant === 'compact') {
        const isGold = skin === 'gold';
        const shellClassName = isGold
            ? 'relative w-full max-w-[280px] mx-auto rounded-[2rem] overflow-hidden border-4 border-amber-400/40 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 shadow-2xl'
            : 'relative w-full max-w-[280px] mx-auto rounded-[2rem] overflow-hidden border-4 border-indigo-500/30 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 shadow-2xl';

        const topTextClassName = isGold ? 'text-slate-900' : 'text-white';
        const subtleTextClassName = isGold ? 'text-slate-700/80' : 'text-slate-200/80';

        return (
            <div className="w-full">
                <div ref={cardRef} className={shellClassName}>
                    <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-white/30 via-transparent to-black/30" />
                    <div className="relative z-10 p-4">
                        {/* Top row */}
                        <div className="flex items-start justify-between">
                            <div className={cn('flex flex-col items-start', topTextClassName)}>
                                <div className="text-4xl font-black leading-none">{futRating}</div>
                                <div className="text-sm font-black uppercase tracking-tight">{player.position}</div>
                                <div className="mt-2 flex items-center gap-2">
                                    {player.nationality_flag ? (
                                        <img src={player.nationality_flag} alt="Nation" className="w-8 h-5 rounded-sm object-cover border border-white/20" />
                                    ) : (
                                        <div className={cn('w-8 h-5 rounded-sm border', isGold ? 'bg-blue-600/80 border-white/20' : 'bg-slate-800 border-white/10')} />
                                    )}
                                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center border', isGold ? 'bg-white/70 border-white/30' : 'bg-white/10 border-white/10')}>
                                        {player.club_badge ? (
                                            <img src={player.club_badge} className="w-6 h-6 object-contain" alt="Club" />
                                        ) : (
                                            <Shield size={16} className={cn(isGold ? 'text-slate-500' : 'text-slate-200/70')} />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {typeof level === 'number' && (
                                <div className={cn('text-xs font-black px-3 py-1 rounded-full border', isGold ? 'text-slate-900 bg-white/40 border-white/30' : 'text-white bg-white/10 border-white/10')}>
                                    NIV {level}
                                </div>
                            )}
                        </div>

                        {/* Player image */}
                        <div className="mt-4 flex items-center justify-center">
                            <div className={cn('w-44 h-44 rounded-full border-4 shadow-lg overflow-hidden', isGold ? 'border-white/20 bg-white/10' : 'border-white/10 bg-black/20')}>
                                {player.photo_url ? (
                                    <img
                                        src={player.photo_url}
                                        className="w-full h-full object-cover"
                                        alt={player.name}
                                        style={{ objectPosition: 'top' }}
                                        crossOrigin="anonymous"
                                    />
                                ) : (
                                    <div className={cn('w-full h-full flex items-center justify-center', isGold ? 'text-slate-900/40' : 'text-white/30')}>
                                        <span className="text-5xl font-black">?</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Name */}
                        <div className={cn('mt-4 text-center border-b-2 pb-2', isGold ? 'border-slate-900/10' : 'border-white/10')}>
                            <div className={cn('text-xl font-black uppercase tracking-tight truncate', topTextClassName)}>{player.name}</div>
                        </div>

                        {/* Stats */}
                        <div className={cn('mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm font-black', topTextClassName)}>
                            <div className="flex justify-between">
                                <span>{displayStats.pac} PAC</span>
                                <span>{displayStats.dri} DRI</span>
                            </div>
                            <div className="flex justify-between">
                                <span>{displayStats.sho} TIR</span>
                                <span>{displayStats.def} DEF</span>
                            </div>
                            <div className="flex justify-between">
                                <span>{displayStats.pas} PAS</span>
                                <span>{displayStats.phy} PHY</span>
                            </div>
                        </div>

                        {/* Form + XP */}
                        {(formSequence.length > 0 || (typeof xpCurrent === 'number' && typeof xpNext === 'number' && xpNext > 0)) && (
                            <div className="mt-4">
                                {formSequence.length > 0 && (
                                    <div className="flex items-center justify-center gap-1.5">
                                        {formSequence.map((res, idx) => (
                                            <div
                                                key={idx}
                                                className={
                                                    res === 'W'
                                                        ? 'w-6 h-6 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center border border-white/20'
                                                        : res === 'L'
                                                            ? 'w-6 h-6 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border border-white/20'
                                                            : res === 'D'
                                                                ? 'w-6 h-6 rounded-full bg-slate-400 text-white text-[10px] font-black flex items-center justify-center border border-white/20'
                                                                : 'w-6 h-6 rounded-full bg-black/10 text-slate-700 text-[10px] font-black flex items-center justify-center border border-white/10'
                                                }
                                                title={res === 'W' ? 'Victoire' : res === 'L' ? 'Défaite' : res === 'D' ? 'Nul' : '—'}
                                            >
                                                {res === 'W' ? 'V' : res === 'L' ? 'D' : res === 'D' ? 'N' : '?'}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {typeof xpCurrent === 'number' && typeof xpNext === 'number' && xpNext > 0 && (
                                    <div className="mt-3">
                                        <div className={cn('flex items-center justify-between text-[10px] font-black', subtleTextClassName)}>
                                            <span>XP</span>
                                            <span>
                                                {xpCurrent}/{xpNext}
                                            </span>
                                        </div>
                                        <div className={cn('mt-1 h-2 w-full rounded-full overflow-hidden', isGold ? 'bg-white/30' : 'bg-white/10')}>
                                            <div
                                                className={cn('h-2 rounded-full', isGold ? 'bg-slate-900/70' : 'bg-indigo-500')}
                                                style={{ width: `${(xpCurrent / xpNext) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={cn('absolute bottom-0 left-0 right-0 h-2', isGold ? 'bg-gradient-to-r from-amber-700 via-amber-400 to-amber-700' : 'bg-gradient-to-r from-indigo-900 via-indigo-500 to-indigo-900')} />
                </div>

                {!showActions ? null : (
                    <div className="flex justify-center mt-3">
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl shadow-lg hover:bg-slate-800 transition active:scale-95"
                        >
                            <Download size={18} />
                            Télécharger
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="ml-2 px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 transition"
                            >
                                Fermer
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
            {/* The Card */}
            <div 
                ref={cardRef}
                className="relative w-64 h-[400px] bg-gradient-to-b from-yellow-200 via-yellow-400 to-yellow-600 rounded-[2rem] shadow-2xl overflow-hidden border-4 border-yellow-500/50"
                style={{
                    boxShadow: '0 0 20px rgba(234, 179, 8, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.4)'
                }}
            >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                
                {/* Top Section */}
                <div className="relative z-10 p-4 flex flex-col h-full text-slate-900">
                    
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col items-center pt-6">
                            <span className="text-4xl font-black">{futRating}</span>
                            <span className="text-lg font-bold uppercase">{player.position}</span>
                            
                            {/* Nationality / Club placeholders */}
                            <div className="mt-2 w-8 h-5 bg-blue-600 rounded shadow-sm border border-white/20"></div> {/* Nation Flag */}
                            <div className="mt-1 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                                {player.club_badge ? (
                                    <img src={player.club_badge} className="w-6 h-6 object-contain" alt="Club" />
                                ) : (
                                    <Shield size={16} className="text-slate-400" />
                                )}
                            </div>
                        </div>
                        
                        <div className="relative w-32 h-32 mr-2">
                             {player.photo_url ? (
                                 <img 
                                    src={player.photo_url} 
                                    className="w-full h-full object-cover rounded-full border-2 border-white/30 shadow-lg"
                                    alt={player.name}
                                    style={{ objectPosition: 'top' }}
                                    crossOrigin="anonymous" 
                                 />
                             ) : (
                                 <div className="w-full h-full bg-slate-800/20 rounded-full flex items-center justify-center border-2 border-white/30">
                                     <span className="text-4xl">👤</span>
                                 </div>
                             )}
                        </div>
                    </div>

                    <div className="mt-auto items-center flex flex-col mb-4">
                        <h2 className="text-xl font-black uppercase tracking-tighter truncate w-full text-center border-b-2 border-slate-900/10 pb-1 mb-2">
                            {player.name}
                        </h2>
                        
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 w-full px-2 text-sm font-bold opacity-90">
                            <div className="flex justify-between">
                                <span>{displayStats.pac} PAC</span>
                                <span>{displayStats.dri} DRI</span>
                            </div>
                            <div className="flex justify-between">
                                <span>{displayStats.sho} TIR</span>
                                <span>{displayStats.def} DEF</span>
                            </div>
                            <div className="flex justify-between">
                                <span>{displayStats.pas} PAS</span>
                                <span>{displayStats.phy} PHY</span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Decoration */}
                    <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600"></div>
                </div>
            </div>

            {/* Actions */}
            {showActions && (
                <div className="flex gap-2">
                    <button 
                        onClick={handleDownload}
                        className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl shadow-lg hover:bg-slate-800 transition active:scale-95"
                    >
                        <Download size={18} />
                        Télécharger
                    </button>
                    {onClose && (
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 transition"
                        >
                            Fermer
                        </button>
                    )}
                </div>
            )}
            
            <p className="text-xs text-slate-400 text-center max-w-xs">
                Note basée sur l'évaluation du coach ({rating}/10).
            </p>
        </div>
    );
};
