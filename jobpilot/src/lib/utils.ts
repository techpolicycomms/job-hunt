// ============================================================
// src/lib/utils.ts
// Utility functions used throughout the app.
// ============================================================

// `type` import: TypeScript-only import, erased at runtime.
// ClassValue is a union type accepting string | string[] | object | etc.
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// TS concept: Function with typed parameters and return type.
// This is a common pattern in shadcn/ui projects.
// `...inputs: ClassValue[]` — rest parameters with an array type.
export function cn(...inputs: ClassValue[]): string {
  // clsx merges class names conditionally; twMerge resolves Tailwind conflicts.
  return twMerge(clsx(inputs));
}
