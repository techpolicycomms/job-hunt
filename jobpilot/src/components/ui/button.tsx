// ============================================================
// src/components/ui/button.tsx
// Reusable Button component built with shadcn/ui conventions.
// ============================================================

"use client"; // Required for interactive components in Next.js App Router

// `React` import gives us JSX support and React types
import * as React from "react";

// Slot allows the button to render as a different element (e.g., <a>)
import { Slot } from "@radix-ui/react-slot";

// cva = class variance authority: creates typed variant systems for components
// VariantProps extracts the prop types from a cva definition
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// `buttonVariants` is a function that returns a className string.
// TS concept: cva() returns a typed function — the generic is inferred automatically.
const buttonVariants = cva(
  // Base classes applied to every button
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      // Each variant key maps to a record of string → className string
      variant: {
        default: "bg-indigo-600 text-white shadow hover:bg-indigo-700",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    // Default values so you don't have to specify them every time
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// TS concept: Interface extending another type using `&` intersection.
// `VariantProps<typeof buttonVariants>` extracts { variant?, size? } from cva.
// `React.ButtonHTMLAttributes<HTMLButtonElement>` gives us all native button props.
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  // When true, the button renders its child element instead of a <button>
  // This is the "asChild" pattern from Radix UI
  asChild?: boolean;
}

// `React.forwardRef` lets parent components get a ref to the DOM button element.
// Generic: <HTMLButtonElement, ButtonProps> — the ref type, then the props type.
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // If asChild is true, render the Slot (passes all props to child element)
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props} // Spread remaining props (onClick, disabled, children, etc.)
      />
    );
  }
);

// displayName helps React DevTools show the component name
Button.displayName = "Button";

export { Button, buttonVariants };
