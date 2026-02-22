import React, { useState, useEffect } from 'react';
import { Crown, Square, User, UserMinus } from 'lucide-react';
import { cn } from '../../utils/cn';
import { FormationDTO, FormationPositionDTO } from '../../services/sportService';

interface Player {
    id: string;
    name: string;
    position?: string; // 'GK', 'DEF', etc.
    photo?: string;
}

interface TacticsBoardProps {
    players: Player[]; // All available players
    formations: FormationDTO[];
    initialFormationId?: number;
    initialLineup?: { [positionId: number]: string }; // Map positionId -> playerId
    motmMemberId?: string | null;
    goalCountsByPlayerId?: Record<string, number>;
    excludedPlayerIds?: Set<string>;
    onSave: (formationId: number, lineup: { [positionId: number]: string }) => void;
    readOnly?: boolean;
}

const Pitch: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="relative w-full max-w-sm mx-auto aspect-[3/4] bg-emerald-600 rounded-xl overflow-hidden shadow-inner border-4 border-emerald-700">
        
        {/* Grass Pattern */}
        <div className="absolute inset-0 opacity-20" 
            style={{ 
                background: 'repeating-linear-gradient(0deg, #10b981, #10b981 10%, #059669 10%, #059669 20%)',
            }}>
        </div>
        
        {/* Pitch Lines - Half Pitch View (Own Half) */}
        <div className="absolute inset-0 border-2 border-white/50 m-4">
            
            {/* Halfway Line (Top) */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/50"></div>
            
            {/* Center Circle (Half - Top) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/4 h-[18%] border-b-2 border-x-2 border-white/50 rounded-b-full"></div>
            <div className="absolute top-[2%] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full"></div>

            {/* Penalty Area (Bottom) */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/5 h-[35%] border-t-2 border-x-2 border-white/50 bg-white/5"></div>
            
             {/* Goal Area (Bottom) */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-[12%] border-t-2 border-x-2 border-white/50"></div>
            
            {/* Penalty Arc (Bottom) */}
            <div className="absolute bottom-[35%] left-1/2 -translate-x-1/2 w-1/4 h-[10%] border-t-2 border-white/50 rounded-t-full"></div>

            {/* Penalty Spot (Bottom) */}
            <div className="absolute bottom-[22%] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full"></div>

            {/* Corner Arcs */}
            <div className="absolute top-0 left-0 w-8 h-8 border-r-2 border-b-2 border-white/50 rounded-br-full"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-l-2 border-b-2 border-white/50 rounded-bl-full"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-r-2 border-t-2 border-white/50 rounded-tr-full"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-l-2 border-t-2 border-white/50 rounded-tl-full"></div>
        </div>

        <div className="absolute inset-0 p-4">
             {children}
        </div>
    </div>
);

// Helper component for a player slot (used on Pitch and Bench)
const PlayerSlot: React.FC<{
    position: FormationPositionDTO;
    player?: Player;
    goalCount?: number;
    isSelected: boolean;
    isMotm?: boolean;
    isExcluded?: boolean;
    onClick: () => void;
    onRemove: (e: React.MouseEvent) => void;
    readOnly: boolean;
    style?: React.CSSProperties; // For absolute positioning on pitch
    className?: string;
}> = ({ position, player, goalCount, isSelected, isMotm, isExcluded, onClick, onRemove, readOnly, style, className }) => {
    // If GK and on Pitch (coord provided), reverse layout (Name on TOP) to avoid hidden name
    // Also apply to any player very close to the bottom (< 15%)
    const isGK = position.position_label === 'GK' || position.role === 'G';
    const reverseLayout = (isGK && position.coord_y !== undefined) || (position.coord_y !== undefined && position.coord_y < 15);

    return (
        <div 
            className={cn(
                "flex items-center gap-1 cursor-pointer transition-all duration-200",
                reverseLayout ? "flex-col-reverse" : "flex-col",
                isSelected ? "scale-110 z-20" : "z-10 hover:scale-105",
                className
            )}
            style={style}
            onClick={onClick}
        >
            {/* Player Dot/Card */}
            <div className={cn(
                "w-14 h-14 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center shadow-lg relative bg-white transition-all",
                player ? "border-white bg-slate-800 text-white" : "border-white/50 bg-white/20 text-white/50 dashed-border",
                isSelected && "ring-4 ring-yellow-400 ring-offset-2 ring-offset-emerald-600 scale-110"
            )}>
                {player ? (
                    <span className="text-sm sm:text-xs font-bold leading-none">{player.name.substring(0, 2).toUpperCase()}</span>
                ) : (
                    <span className="text-xs sm:text-[10px] font-bold">{position.position_label}</span>
                )}

                {player && isMotm && (
                    <div
                        className="pointer-events-none absolute -top-2 -left-2 w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center border-2 border-white shadow-md"
                        aria-label="Homme du match"
                        title="Homme du match"
                    >
                        <Crown size={14} className="text-white" />
                    </div>
                )}

                {player && typeof goalCount === 'number' && goalCount > 0 && (
                    <div
                        className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/5 px-1.5 py-1 rounded-full bg-yellow-500 text-white flex items-center justify-center border-2 border-white shadow-md"
                        aria-label={`${goalCount} but${goalCount > 1 ? 's' : ''}`}
                        title={`${goalCount} but${goalCount > 1 ? 's' : ''}`}
                    >
                        {Array.from({ length: goalCount }).map((_, index) => (
                            <span key={index} className="text-[11px] leading-none">⚽</span>
                        ))}
                    </div>
                )}

                {player && isExcluded && (
                    <div
                        className="pointer-events-none absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center border-2 border-white shadow-md"
                        aria-label="Carton rouge"
                        title="Carton rouge"
                    >
                        <Square size={14} className="text-white" fill="currentColor" />
                    </div>
                )}
                
                {/* Action buttons (mini) - Larger touch target */}
                {player && isSelected && !readOnly && !isExcluded && (
                    <div 
                        onClick={onRemove}
                        className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 rounded-full text-white flex items-center justify-center border-2 border-white hover:bg-red-600 shadow-md transform hover:scale-110 z-30"
                    >
                        <UserMinus size={14} />
                    </div>
                )}
            </div>
            
            {/* Name Label */}
            {player && (
                <div className="bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shadow-sm opacity-90 max-w-[80px] truncate text-center">
                    {player.name.split(' ')[0]}
                </div>
            )}
        </div>
    );
};

export const TacticsBoard: React.FC<TacticsBoardProps> = ({ 
    players, 
    formations, 
    initialFormationId, 
    initialLineup = {}, 
    motmMemberId,
    goalCountsByPlayerId,
    excludedPlayerIds,
    onSave,
    readOnly = false
}) => {
    const [selectedFormationId, setSelectedFormationId] = useState<number>(initialFormationId || (formations[0]?.id));
    const [lineup, setLineup] = useState<{ [positionId: number]: string }>(initialLineup);
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null); // PositionID currently being filled

    useEffect(() => {
        if (initialFormationId) setSelectedFormationId(initialFormationId);
    }, [initialFormationId]);

    // Auto-select first formation if none selected and formations available
    useEffect(() => {
        if (!selectedFormationId && formations.length > 0) {
             setSelectedFormationId(formations[0].id);
        }
    }, [formations, selectedFormationId]);

    useEffect(() => {
        setLineup(initialLineup);
    }, [initialLineup]);

    const currentFormation = formations.find(f => f.id === selectedFormationId);

    // Split positions
    const isBenchRole = (role: string | undefined) => {
        if (!role) return false;
        return role === 'B' || role.startsWith('B') || role === 'RES';
    };

    const pitchPositions = currentFormation?.positions?.filter(p => !isBenchRole(p.role)) || [];
    const benchPositions = (currentFormation?.positions?.filter(p => isBenchRole(p.role)) || [])
        .sort((a, b) => a.coord_x - b.coord_x);

    const isExcludedPlayerId = (playerId: string | undefined) => {
        if (!playerId) return false;
        return Boolean(excludedPlayerIds?.has(playerId));
    };

    const handleSlotClick = (positionId: number) => {
        if (readOnly) return;

        // Un joueur exclu ne peut pas être retiré / déplacé / remplacé dans la compo.
        const clickedPlayerId = lineup[positionId];
        if (isExcludedPlayerId(clickedPlayerId)) return;
        
        // S'il n'y a pas de slot sélectionné, on sélectionne celui-ci
        if (selectedSlot === null) {
            setSelectedSlot(positionId);
            return;
        }

        // Si on clique sur le MÊME slot, on désélectionne
        if (selectedSlot === positionId) {
            setSelectedSlot(null);
            return;
        }

        // Si on clique sur un AUTRE slot, on tente un ÉCHANGE (SWAP) ou un DÉPLACEMENT
        // Cas : Un slot A est sélectionné (selectedSlot). On clique sur le slot B (positionId).
        // On veut échanger les joueurs de A et B.
        
        const playerA = lineup[selectedSlot];
        const playerB = lineup[positionId];

        // Bloque aussi les échanges si un des joueurs est exclu
        if (isExcludedPlayerId(playerA) || isExcludedPlayerId(playerB)) return;

        const newLineup = { ...lineup };

        if (!playerA && !playerB) {
            // Deux slots vides = rien à faire, juste changer la sélection
            setSelectedSlot(positionId);
            return;
        }

        // Echange
        if (playerA) newLineup[positionId] = playerA;
        else delete newLineup[positionId];

        if (playerB) newLineup[selectedSlot] = playerB;
        else delete newLineup[selectedSlot];

        setLineup(newLineup);
        setSelectedSlot(null); // Reset après échange
    };

    const handlePlayerSelect = (playerId: string) => {
        if (selectedSlot === null) return;

        // Check if player is already assigned elsewhere -> remove from old pos
        const oldPos = Object.keys(lineup).find(key => lineup[parseInt(key)] === playerId);
        
        const newLineup = { ...lineup };
        
        if (oldPos) {
            delete newLineup[parseInt(oldPos)];
        }
        
        newLineup[selectedSlot] = playerId;
        setLineup(newLineup);
        setSelectedSlot(null);
    };

    const handleRemovePlayer = (positionId: number, e: React.MouseEvent) => {
        e.stopPropagation();

        const playerId = lineup[positionId];
        if (isExcludedPlayerId(playerId)) return;

        const newLineup = { ...lineup };
        delete newLineup[positionId];
        setLineup(newLineup);
    };
    
    // Derived: List of unassigned players
    const assignedPlayerIds = Object.values(lineup);
    const availablePlayers = players.filter(p => !assignedPlayerIds.includes(p.id));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* --- Pitch & Formation --- */}
            <div className="lg:col-span-2 space-y-4">
                {/* Controls */}
                {!readOnly && (
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <span className="text-sm font-bold text-slate-500 uppercase">Système :</span>
                            <select 
                                className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg p-2.5 font-bold focus:ring-indigo-500 focus:border-indigo-500"
                                value={selectedFormationId}
                                onChange={(e) => {
                                    const newFormationId = parseInt(e.target.value);
                                    
                                    // Intelligent Remapping
                                    // 1. Get current players mapped to their roles/indices
                                    const oldFormation = formations.find(f => f.id === selectedFormationId);
                                    const newFormation = formations.find(f => f.id === newFormationId);

                                    if (oldFormation && newFormation) {
                                        const newLineup: { [positionId: number]: string } = {};
                                        
                                        // Strategy: Remap by ROLE first, then by approximate order
                                        // Current players on pitch
                                        const currentAssignments = Object.entries(lineup).map(([posId, playerId]) => {
                                            const pos = oldFormation.positions.find(p => p.id === parseInt(posId));
                                            return { pos, playerId };
                                        }).filter(a => a.pos); // Only valid assignments

                                        const newPositions = [...newFormation.positions];

                                        // 1. GK First (Priority)
                                        const oldGK = currentAssignments.find(a => a.pos?.role === 'GK' || a.pos?.role === 'G');
                                        const newGK = newPositions.find(p => p.role === 'GK' || p.role === 'G');
                                        
                                        if (oldGK && newGK && oldGK.playerId) {
                                            newLineup[newGK.id] = oldGK.playerId;
                                            // Remove from pool
                                            currentAssignments.splice(currentAssignments.indexOf(oldGK), 1);
                                            newPositions.splice(newPositions.indexOf(newGK), 1);
                                        }

                                        // 2. Remap remaining players to remaining slots
                                        // Simple greedy approach: Just fill slots. 
                                        // Ideally could match Roles (DEF -> DEF), but for now just keeping them on pitch is goal.
                                        currentAssignments.forEach((assignment, index) => {
                                            if (index < newPositions.length && assignment.playerId) {
                                                newLineup[newPositions[index].id] = assignment.playerId;
                                            }
                                        });
                                        
                                        setLineup(newLineup);
                                    } else {
                                        setLineup({}); 
                                    }

                                    setSelectedFormationId(newFormationId);
                                }}
                            >
                                {formations.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                         </div>
                         
                         <button 
                            onClick={() => onSave(selectedFormationId, lineup)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-all active:scale-95 text-sm"
                        >
                            Sauvegarder
                        </button>
                    </div>
                )}

                {/* The Pitch */}
                <Pitch>
                        {pitchPositions.map((pos) => {
                             const assignedPlayerId = lineup[pos.id];
                         const player = assignedPlayerId ? players.find(p => p.id === assignedPlayerId) : undefined;
                             const isMotm = Boolean(motmMemberId && player && player.id === motmMemberId);
                             const goalCount = player ? (goalCountsByPlayerId?.[player.id] ?? 0) : 0;
                             
                             // Coordinate conversion for HALF PITCH View
                             // Full pitch: Y=0 (GK) to Y=100 (ATT)
                             // Half pitch view: Focus on one half? 
                             // Wait, if we use a Full Pitch view (original), we just map 0-100.
                             // But if user wants a "Half Pitch" visual style (like 5-a-side) but with 11 players, 
                             // that implies the spacing is tighter or it's a specific formation view.
                             // However, if the user requested "Half field like the picture", AND the picture has 11 players...
                             // It usually means a perspective view where the "top" goal is far and "bottom" is near, 
                             // showing the FULL pitch but styled.
                             
                             // BUT my previous edit changed the BACKGROUND to be a half-pitch (one goal, one center line).
                             // If I place 11 players on a "Half Pitch graphic", it will look like they are all attacking one goal.
                             // Let's assume the user wants a "Starting XI" view which is typically formatted on a Half Pitch diagram (Formation Sheet).
                             // In formation sheets, the GK is at the bottom, ATT at top. This represents the FULL team deployment.
                             // So the "Half Pitch" graphic is actually representing the WHOLE area the team occupies (which is usually their own half + attacking).
                             // Visually, formation sheets often look like a half-pitch because they show just "The Team's Shape".
                             
                             // So: Keep Y coordinates 0-100, but map them to the 0-100 of the container. 
                             // The container graphic is now a "Half Pitch" (Goal at top).
                             // Standard formations: GK is Y=5-10, DEF Y=30, MID Y=50-60, ATT Y=80-90.
                             // My Seed data: GK=10, DEF=30, MID=50, ATT=80 (approx).
                             // So they should land fine on the "Half Pitch" graphic (Bottom to Top).
                             
                             const left = `${pos.coord_x}%`;
                             const bottom = `${pos.coord_y}%`;
                             
                             const isBottomPlayer = pos.coord_y < 15;
                             
                             return (
                                <PlayerSlot
                                    key={pos.id}
                                    position={pos}
                                    player={player}
                                    goalCount={goalCount}
                                    isSelected={selectedSlot === pos.id}
                                    isMotm={isMotm}
                                    isExcluded={Boolean(player && excludedPlayerIds?.has(player.id))}
                                    onClick={() => handleSlotClick(pos.id)}
                                    onRemove={(e) => handleRemovePlayer(pos.id, e)}
                                    readOnly={readOnly}
                                    style={{ left, bottom }}
                                    className={cn(
                                        "absolute transform -translate-x-1/2",
                                        isBottomPlayer ? "translate-y-0" : "translate-y-1/2"
                                    )}
                                />
                             );
                    })}
                </Pitch>

                {/* The Bench */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Remplaçants</h3>
                    <div className="flex gap-4 overflow-x-auto pb-2">
                        {benchPositions.map((pos) => {
                             const assignedPlayerId = lineup[pos.id];
                             const player = assignedPlayerId ? players.find(p => p.id === assignedPlayerId) : undefined;
                             const isMotm = Boolean(motmMemberId && player && player.id === motmMemberId);
                             const goalCount = player ? (goalCountsByPlayerId?.[player.id] ?? 0) : 0;
                             
                             return (
                                <PlayerSlot
                                    key={pos.id}
                                    position={pos}
                                    player={player}
                                    goalCount={goalCount}
                                    isSelected={selectedSlot === pos.id}
                                    isMotm={isMotm}
                                    isExcluded={Boolean(player && excludedPlayerIds?.has(player.id))}
                                    onClick={() => handleSlotClick(pos.id)}
                                    onRemove={(e) => handleRemovePlayer(pos.id, e)}
                                    readOnly={readOnly}
                                />
                             );
                        })}
                        {benchPositions.length === 0 && (
                            <div className="text-sm text-slate-400 italic">Aucune place sur le banc définie.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- Sidebar: Players List --- */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden flex flex-col h-full max-h-[800px]">
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2">
                        <User size={16} /> Effectif ({availablePlayers.length})
                    </h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {selectedSlot && <div className="text-xs text-indigo-600 font-bold px-2 py-1 bg-indigo-50 rounded mb-2">Sélectionnez un joueur pour le poste...</div>}
                    
                    {availablePlayers.map(player => (
                        <div 
                            key={player.id}
                            onClick={() => selectedSlot && handlePlayerSelect(player.id)}
                            className={cn(
                                "p-3 rounded-lg flex items-center gap-3 transition-all duration-200 border border-transparent",
                                selectedSlot 
                                    ? "cursor-pointer hover:bg-indigo-50 hover:border-indigo-100 active:scale-[0.98]" 
                                    : "opacity-75 grayscale-[0.5] cursor-default"
                            )}
                        >
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs ring-2 ring-white">
                                {player.name ? player.name.substring(0, 1) : '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-slate-800 truncate">{player.name}</div>
                                <div className="text-xs text-slate-400">{player.position || 'N/A'}</div>
                            </div>
                        </div>
                    ))}
                    
                    {availablePlayers.length === 0 && (
                        <div className="p-8 text-center text-slate-400 text-sm">
                            {players.length === 0 
                                ? "Aucun joueur dans l'effectif." 
                                : "Tous les joueurs sont sur le terrain ou sur le banc !"
                            }
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

