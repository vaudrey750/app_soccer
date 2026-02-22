import React from 'react';
import { MessageSquare, X } from 'lucide-react';
import { cn } from '../../../utils/cn';
import ChatPanel from '../ChatPanel';

interface FloatingChatProps {
    isChatOpen: boolean;
    setIsChatOpen: (isOpen: boolean) => void;
    gameId: string | undefined;
    canManage: boolean | null;
}

export const FloatingChat: React.FC<FloatingChatProps> = ({
    isChatOpen, setIsChatOpen, gameId, canManage
}) => {
    return (
        <div className="fixed bottom-6 right-6 z-[110] flex flex-col items-end gap-2 pointer-events-none">
            {isChatOpen && gameId && (
                <div className={cn(
                    "pointer-events-auto transition-all duration-300 origin-bottom-right mb-2",
                    "animate-in slide-in-from-bottom-4 fade-in duration-200",
                    "fixed bottom-24 right-4 left-4 sm:static sm:w-[380px] sm:h-[500px] h-[60vh] sm:left-auto"
                )}>
                    <div className="w-full h-full shadow-2xl rounded-2xl overflow-hidden border border-slate-700/50 bg-slate-900/95 backdrop-blur-md flex flex-col">
                        <ChatPanel 
                            gameId={gameId} 
                            canManage={canManage || false}
                            className="h-full w-full border-none rounded-none bg-transparent"
                        />
                    </div>
                </div>
            )}
            
            <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={cn(
                    "pointer-events-auto h-14 w-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-200 hover:scale-105 active:scale-95 z-50",
                    isChatOpen ? "bg-slate-700 rotate-90" : "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20"
                )}
            >
                {isChatOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </button>
        </div>
    );
};
