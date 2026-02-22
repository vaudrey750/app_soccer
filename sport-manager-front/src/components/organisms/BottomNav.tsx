import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Calendar, User, Trophy, BarChart2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const BottomNav: React.FC = () => {
    const navItems = [
        { path: '/', label: 'Accueil', icon: Home },
        { path: '/calendar', label: 'Calendrier', icon: Calendar },
        { path: '/my-club', label: 'Club', icon: Trophy },
        { path: '/statistics', label: 'Stats', icon: BarChart2 },
        { path: '/profile', label: 'Profil', icon: User },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-50 flex justify-center pointer-events-none">
            <nav className="pointer-events-auto bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 shadow-2xl flex items-center gap-2 max-w-md w-full justify-between">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => cn(
                            "flex flex-col items-center justify-center p-2 rounded-full transition-all duration-300 relative",
                            isActive 
                                ? "text-white scale-110" 
                                : "text-slate-400 hover:text-slate-200"
                        )}
                    >
                        {({ isActive }) => (
                            <>
                                <div className={cn(
                                    "absolute inset-0 bg-blue-500/20 rounded-full blur-lg transition-opacity",
                                    isActive ? "opacity-100" : "opacity-0"
                                )}></div>
                                <item.icon size={24} className="relative z-10" />
                                {/* <span className="text-[10px] font-medium mt-1 relative z-10">{item.label}</span> */}
                                {isActive && (
                                    <span className="absolute -bottom-1 w-1 h-1 bg-blue-400 rounded-full"></span>
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>
        </div>
    );
};

export default BottomNav;
