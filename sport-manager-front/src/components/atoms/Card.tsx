import React from 'react';
import { cn } from '../../utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'glass' | 'neo';
    noPadding?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant = 'default', noPadding = false, children, ...props }, ref) => {
        
        const variants = {
            default: "bg-white border border-slate-100 shadow-sm",
            glass: "bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl", // iOS style
            neo: "bg-slate-100 shadow-[20px_20px_60px_#d1d5db,-20px_-20px_60px_#ffffff] border-none" // Neumorphism subtle
        };

        return (
            <div 
                ref={ref}
                className={cn(
                    "rounded-3xl overflow-hidden transition-all",
                    variants[variant],
                    !noPadding && "p-6",
                    className
                )}
                {...props}
            >
                {children}
            </div>
        );
    }
);
Card.displayName = "Card";
