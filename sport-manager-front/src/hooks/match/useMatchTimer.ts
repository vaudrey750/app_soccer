import { useState, useEffect } from 'react';
import { EventDetailDTO } from '../../services/eventService';

export const useMatchTimer = (event: EventDetailDTO | null | undefined) => {
    const [elapsedTime, setElapsedTime] = useState(0);
    const [minute, setMinute] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);

    useEffect(() => {
        if (event?.game) {
            const isLive = event.game.status_id === 5;
            setIsTimerRunning(isLive);
            
            if (isLive && event.game.timer_start_at) {
                const start = new Date(event.game.timer_start_at + (event.game.timer_start_at.endsWith("Z") ? "" : "Z")).getTime();
                const now = new Date().getTime();
                const currentSegment = Math.max(0, Math.floor((now - start) / 1000));
                setElapsedTime((event.game.elapsed_time_at_start || 0) + currentSegment);
            } else {
                setElapsedTime(event.game.elapsed_time_at_start || 0);
            }
        }
    }, [event?.game?.status_id, event?.game?.timer_start_at, event?.game?.elapsed_time_at_start]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTimerRunning && event?.game?.timer_start_at) {
            const tStr = event.game.timer_start_at;
            const start = new Date(tStr + (tStr.endsWith("Z") ? "" : "Z")).getTime();
            const base = event.game.elapsed_time_at_start || 0;
            
            interval = setInterval(() => {
                const now = new Date().getTime();
                const diff = Math.floor((now - start) / 1000);
                setElapsedTime(base + Math.max(0, diff));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, event?.game?.timer_start_at, event?.game?.elapsed_time_at_start]);

    useEffect(() => {
        setMinute(Math.floor(elapsedTime / 60));
    }, [elapsedTime]);

    return { elapsedTime, minute, isTimerRunning, toggleTimer: () => setIsTimerRunning(!isTimerRunning), setElapsedTime };
};
