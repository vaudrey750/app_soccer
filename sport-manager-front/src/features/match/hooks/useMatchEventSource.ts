import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
export const matchKeys = {
    detail: (id: string) => ['matchEvent', id],
};

// Use same base URL strategy as other requests (relative path assumes proxy or same origin)
// If backend is on port 8000 and frontend 5173, check vite proxy config.
const SSE_ENDPOINT_BASE = '/api/v1/core/games'; 

export const useMatchEventSource = (matchId: string | undefined) => {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!matchId) return;

        // Construct SSE URL
        const url = `${SSE_ENDPOINT_BASE}/${matchId}/sse`;
        console.log(`📡 Connecting to Match SSE: ${url}`);

        const eventSource = new EventSource(url);

        // Connection opened
        eventSource.onopen = () => {
             console.log("✅ Match SSE Connected");
        };

        // Message received
        eventSource.onmessage = (event) => {
            // Check for keep-alive
            if (event.data === ': keep-alive') return;
            
            console.log("⚡ Match SSE Update Received", event.data);
            
            // Invalidate match query to refetch fresh data
            // This covers ALL updates: Timer, Score, Timeline, Tactics
            queryClient.invalidateQueries({ queryKey: matchKeys.detail(matchId) });
        };

        // Error handling
        eventSource.onerror = (err) => {
            console.error("❌ Match SSE Error:", err);
            eventSource.close();
            // Optional: Implement retry logic here if native reconnection fails
        };

        return () => {
            console.log("🛑 Closing Match SSE Connection");
            eventSource.close();
        };
    }, [matchId, queryClient]);
};
