import React, { ReactNode } from 'react';
import BottomNav from '../organisms/BottomNav';
import { TeamSelector } from '../molecules/TeamSelector';
import { useLocation } from 'react-router-dom';
import { ToastHost } from '../molecules/ToastHost';

interface PlayerLayoutProps {
    children: ReactNode;
}

const PlayerLayout: React.FC<PlayerLayoutProps> = ({ children }) => {
    const location = useLocation();
    // Don't show selector on Profile or Event Details? Maybe keep it global.
    // Let's hide it on Event Details since it's a specific event context.
    const showSelector = !location.pathname.startsWith('/events/');

    return (
        <div className="min-h-screen bg-slate-50 relative flex flex-col">
            <ToastHost />
            {showSelector && (
                <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur pt-2 pb-1 safe-top w-full">
                    <div className="max-w-md mx-auto w-full">
                        <TeamSelector />
                    </div>
                </div>
            )}
            <div className="pb-24 flex-1">
                {children}
            </div>
            <BottomNav />
        </div>
    );
};

export default PlayerLayout;
