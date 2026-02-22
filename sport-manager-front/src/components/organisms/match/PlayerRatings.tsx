import React from 'react';

interface PlayerRatingsProps {
    players: any[];
    onUpdateRatings: (ratings: Record<string, number>) => void;
    readOnly?: boolean;
}

export const PlayerRatings: React.FC<PlayerRatingsProps> = ({
    players, onUpdateRatings, readOnly
}) => {
    const handleRatePlayer = (playerId: string, rating: number) => {
        if (readOnly) return;
        const currentRatings = players.reduce((acc, p) => {
            if (typeof p.rating === 'number') acc[p.id] = p.rating;
            return acc;
        }, {} as Record<string, number>);
        
        onUpdateRatings({ ...currentRatings, [playerId]: rating });
    };

    return (
        <div className="divide-y divide-slate-700/50">
            {players.map(p => (
                <div key={p.id} className="flex items-center justify-between py-4 group">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                            {p.photo_url ? (
                                <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-sm font-bold text-slate-500">{p.name.charAt(0)}</span>
                            )}
                        </div>
                        <div>
                            <div className="font-medium text-white group-hover:text-emerald-400 transition-colors">
                                {p.name}
                            </div>
                            <div className="text-xs text-slate-400">
                                {[p.position, p.number ? `N° ${p.number}` : null].filter(Boolean).join(' • ')}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Note</span>
                        <input 
                            type="number" 
                            min="0" max="10" step="0.5"
                            aria-label={`Note ${p.name}`}
                            data-testid={`player-rating-${p.id}`}
                            value={typeof p.rating === 'number' ? p.rating : ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                    handleRatePlayer(p.id, 5);
                                    return;
                                }
                                const parsed = parseFloat(val);
                                if (!Number.isNaN(parsed)) handleRatePlayer(p.id, parsed);
                            }}
                            disabled={readOnly}
                            className="w-16 p-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="-"
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};
export default PlayerRatings;
