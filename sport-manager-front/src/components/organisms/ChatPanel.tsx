import React, { useEffect, useState, useRef } from 'react';
import { Send, User, Lock, Unlock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { sportService, ChatMessage } from '../../services/sportService';
import { cn } from '../../utils/cn';

interface ChatPanelProps {
    gameId: string;
    canManage?: boolean;
    className?: string; // Add className prop here as well
}

const ChatPanel: React.FC<ChatPanelProps> = ({ gameId, className, canManage = false }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isClosed, setIsClosed] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        const fetchMessages = async () => {
            if (!gameId) return;
            try {
                const data = await sportService.getMatchChat(gameId);
                setMessages(prev => {
                    const fetchedIds = new Set(data.map(m => m.id));
                    const uniquePrev = prev.filter(m => !fetchedIds.has(m.id));
                    const merged = [...data, ...uniquePrev].sort((a, b) => 
                        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    );
                    return merged;
                });
                
                // Fetch status
                const status = await sportService.getChatStatus(gameId);
                setIsClosed(status.is_closed);
            } catch (error) {
                console.error("Failed to load chat", error);
            }
        };
        fetchMessages();
    }, [gameId]);

    useEffect(() => {
         if (!gameId) return;

        // URL building logic... (keeping existing)
        const apiUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000/api/v1';
        let wsUrl = '';
        if (apiUrl.startsWith('http')) {
             wsUrl = apiUrl.replace(/^http/, 'ws');
        } else if (apiUrl.startsWith('/')) {
             const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
             wsUrl = `${protocol}//${window.location.host}${apiUrl}`;
        } else {
             wsUrl = 'ws://localhost:8000/api/v1';
        }
        
        wsUrl = `${wsUrl}/sport/games/${gameId}/ws`;
        
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => console.log("WebSocket Connected");

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // Handle System Messages
                if (data.type === 'system') {
                    if (data.action === 'chat_status_changed') {
                        setIsClosed(data.is_closed);
                    }
                    // Could add system message to chat list too if desired
                    return;
                }

                setMessages(prev => {
                    if (prev.some(m => m.id === data.id)) return prev;
                    if (data.user_id && user && user.id === data.user_id) {
                         // update local simplified message with real one? or just ignore if deduped
                         return [...prev, { ...data, is_me: true }];
                    }
                    return [...prev, { ...data, is_me: false }];
                });
            } catch (err) {
                console.error("WS Error", err);
            }
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
        };
    }, [gameId, user?.id]); 

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !gameId || isClosed) return;
        
        setIsLoading(true);
        try {
            await sportService.postMatchChat(gameId, newMessage);
            setNewMessage('');
        } catch (error: any) {
            console.error("Failed to send", error);
            if (error.response?.status === 403) {
                alert("Le chat est fermé.");
                setIsClosed(true);
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    const toggleChat = async () => {
        if (!gameId || !canManage) return;
        try {
            await sportService.toggleChatStatus(gameId, !isClosed);
            setIsClosed(!isClosed);
        } catch(e) { console.error(e); }
    };

    return (
        <div className={cn("flex flex-col h-[600px] w-full bg-slate-900/50 rounded-xl border border-slate-700/50 backdrop-blur-sm overflow-hidden", className)}>
            {/* Header */}
            <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200">Chat En Direct</span>
                    {isClosed ? (
                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-500 text-[10px] font-bold uppercase border border-red-500/30">Fermé</span>
                    ) : (
                         <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                </div>
                
                <div className="flex items-center gap-2">
                    {canManage && (
                        <button 
                            onClick={toggleChat}
                            title={isClosed ? "Ouvrir le chat" : "Fermer le chat"}
                            className="p-1.5 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        >
                            {isClosed ? <Unlock size={14} /> : <Lock size={14} />}
                        </button>
                    )}
                    <span className="text-xs text-slate-500 uppercase font-black tracking-wider">Public</span>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-slate-500 italic text-sm mt-10">
                        {isClosed ? "Le chat est fermé." : "Aucun message. Soyez le premier à commenter !"}
                    </div>
                )}
                {messages.map((msg, idx) => (
                    <div key={msg.id || idx} className={cn("flex flex-col max-w-[80%]", msg.is_me ? "self-end items-end" : "self-start items-start")}>
                        <div className="flex items-center gap-2 mb-1">
                            {!msg.is_me && <User size={12} className="text-slate-400" />}
                            <span className="text-[10px] text-slate-400 font-bold">{msg.sender_name}</span>
                            <span className="text-[10px] text-slate-600">
                                {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                        </div>
                        <div className={cn(
                            "px-3 py-2 rounded-2xl text-sm shadow-sm break-words",
                            msg.is_me 
                                ? "bg-emerald-600/90 text-white rounded-tr-none" 
                                : "bg-slate-700/80 text-slate-200 rounded-tl-none border border-slate-600"
                        )}>
                            {msg.message}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-slate-800/50 border-t border-slate-700/50">
                {isClosed ? (
                    <div className="text-center py-2 text-sm text-slate-500 italic flex items-center justify-center gap-2">
                        <Lock size={14} />
                        Le chat est fermé.
                    </div>
                ) : (
                <form onSubmit={handleSend} className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Votre message..."
                        disabled={isLoading}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 placeholder:text-slate-600 disabled:opacity-50"
                    />
                    <button 
                        type="submit" 
                        disabled={isLoading || !newMessage.trim()}
                        className="bg-emerald-500 text-white p-2 rounded-full hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                    >
                        <Send size={18} />
                    </button>
                </form>
                )}
            </div>
        </div>
    );
};

export default ChatPanel;

