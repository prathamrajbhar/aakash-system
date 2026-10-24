import React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          className={cn(
            "flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 transition-colors placeholder:text-slate-400 shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:border-slate-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50",
            error && "border-rose-500 focus-visible:ring-rose-500 text-rose-900",
            className
          )}
          ref={ref}
          {...props}
        />
        {error ? <p className="text-xs text-rose-600 mt-1">{error}</p> : null}
      </div>
    );
  }
);

Input.displayName = "Input";
