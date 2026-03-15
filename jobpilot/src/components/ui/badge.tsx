// ============================================================
// src/components/ui/badge.tsx
// Small inline label/tag component with variants.
// ============================================================

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-indigo-600 text-white shadow hover:bg-indigo-700",
        secondary: "border-transparent bg-slate-700 text-slate-100 hover:bg-slate-600",
        destructive: "border-transparent bg-red-600 text-white shadow hover:bg-red-700",
        outline: "text-slate-300 border-slate-600",
        success: "border-transparent bg-green-700 text-white",
        warning: "border-transparent bg-yellow-600 text-white",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

// TS concept: Intersection type `&` merges two types.
// HTMLAttributes gives us className/children; VariantProps gives us `variant`.
export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
