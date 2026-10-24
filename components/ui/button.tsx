import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

    const variants = {
      primary: "bg-slate-900 text-white font-medium hover:bg-slate-800 active:bg-slate-950 shadow-xs focus-visible:ring-slate-900",
      secondary: "bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 border border-slate-200 shadow-2xs focus-visible:ring-slate-400",
      destructive: "bg-rose-600 text-white font-medium hover:bg-rose-700 active:bg-rose-800 shadow-xs focus-visible:ring-rose-500",
      outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-slate-400 shadow-2xs",
      ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-9 px-4 text-sm gap-2",
      lg: "h-11 px-6 text-base gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
