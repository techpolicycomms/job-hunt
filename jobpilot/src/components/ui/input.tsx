// ============================================================
// src/components/ui/input.tsx
// Styled Input component that wraps a native <input> element.
// ============================================================

import * as React from "react";
import { cn } from "@/lib/utils";

// TS concept: We extend React.InputHTMLAttributes<HTMLInputElement> to get
// all native input props (value, onChange, placeholder, type, etc.) for free.
// No need to redeclare them — inheritance handles it.
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-white shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
