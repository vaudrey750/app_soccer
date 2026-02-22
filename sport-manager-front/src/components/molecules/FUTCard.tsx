import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import { Download, Shield } from 'lucide-react';

interface FUTCardProps {
    player: {
        name: string;
        position: string;
        photo_url?: string;
        club_badge?: string;
        nationality_flag?: string;
    };
    rating: number;
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

export const FUTCard: React.FC<FUTCardProps> = ({ player, rating, stats, onClose }) => {
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

    // Default stats based on rating if not provided (Mocking for now)
    const displayStats = stats || {
        pac: Math.min(99, Math.round(rating * 0.9 + Math.random() * 10)),
        sho: Math.min(99, Math.round(rating * 0.85 + Math.random() * 10)),
        pas: Math.min(99, Math.round(rating * 0.88 + Math.random() * 10)),
        dri: Math.min(99, Math.round(rating * 0.92 + Math.random() * 10)),
        def: Math.min(99, Math.round(rating * 0.7 + Math.random() * 10)),
        phy: Math.min(99, Math.round(rating * 0.8 + Math.random() * 10)),
    };

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
                            <span className="text-4xl font-black">{Math.round(rating * 10) > 99 ? 99 : Math.round(rating * 10)}</span>
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
            
            <p className="text-xs text-slate-400 text-center max-w-xs">
                Note basée sur l'évaluation du coach ({rating}/10).
            </p>
        </div>
    );
};
