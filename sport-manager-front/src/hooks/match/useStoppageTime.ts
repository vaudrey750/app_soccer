import { useState, useEffect } from 'react';

export const useStoppageTime = (eventId: string | undefined) => {
    const [stoppageStart, setStoppageStart] = useState<number | null>(() => {
        if (!eventId) return null;
        const saved = localStorage.getItem(`match_stoppage_start_${eventId}`);
        return saved && saved !== 'null' ? parseInt(saved, 10) : null;
    });
    const [accumulatedStoppage, setAccumulatedStoppage] = useState<number>(() => {
        if (!eventId) return 0;
        const saved = localStorage.getItem(`match_stoppage_accum_${eventId}`);
        return saved ? parseInt(saved, 10) : 0;
    });
    const [additionalTime, setAdditionalTime] = useState<number>(() => {
        if (!eventId) return 0;
        const saved = localStorage.getItem(`match_stoppage_add_${eventId}`);
        return saved ? parseInt(saved, 10) : 0;
    });

    useEffect(() => {
        if (eventId) {
            if (stoppageStart !== null) {
                localStorage.setItem(`match_stoppage_start_${eventId}`, stoppageStart.toString());
            } else {
                localStorage.removeItem(`match_stoppage_start_${eventId}`);
            }
            localStorage.setItem(`match_stoppage_accum_${eventId}`, accumulatedStoppage.toString());
            localStorage.setItem(`match_stoppage_add_${eventId}`, additionalTime.toString());
        }
    }, [eventId, stoppageStart, accumulatedStoppage, additionalTime]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (stoppageStart) {
            interval = setInterval(() => {
                setAccumulatedStoppage(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [stoppageStart]);

    const toggleStoppage = () => {
        if (stoppageStart) {
            setStoppageStart(null);
            setAdditionalTime(Math.ceil((accumulatedStoppage + 1) / 60));
        } else {
            setStoppageStart(Date.now());
        }
    };

    const resetStoppage = () => {
        setStoppageStart(null);
        setAccumulatedStoppage(0);
        setAdditionalTime(0);
        if (eventId) {
            localStorage.removeItem(`match_stoppage_start_${eventId}`);
            localStorage.removeItem(`match_stoppage_accum_${eventId}`);
            localStorage.removeItem(`match_stoppage_add_${eventId}`);
        }
    };

    return {
        stoppageStart,
        accumulatedStoppage,
        additionalTime,
        setAdditionalTime,
        toggleStoppage,
        resetStoppage,
        stoppageTime: accumulatedStoppage,
        setStoppageTime: setAccumulatedStoppage
    };
};
