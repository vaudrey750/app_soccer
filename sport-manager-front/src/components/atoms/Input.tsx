import React from 'react';
import { cn } from '../../utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  labelClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, labelClassName, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? (label ? generatedId : undefined);

    return (
      <div className="w-full space-y-2">
        {label && (
          <label htmlFor={inputId} className={cn("text-sm font-bold text-slate-700 ml-1", labelClassName)}>
            {label}
          </label>
        )}
        <div className="relative group">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "flex h-12 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-2 text-sm font-medium transition-all",
              "placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-indigo-500 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-indigo-500/10",
              "disabled:cursor-not-allowed disabled:opacity-50",
              leftIcon && "pl-10",
              error && "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/10",
              className
            )}
            {...props}
          />
        </div>
        {error && (
            <p className="text-xs font-bold text-red-500 ml-1 animate-fade-in">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
