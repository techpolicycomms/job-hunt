// ============================================================
// src/hooks/use-toast.ts
// Custom hook for managing toast notifications.
// ============================================================

"use client";

// TS concept: `import type` only imports the type, not the runtime value.
// It's erased at compile time — useful for keeping bundle size small.
import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 1000000;

// TS concept: `type` alias with intersection — extends ToastProps with extra fields.
type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

// TS concept: `const` enum — these values exist only at compile time.
// Using `const` here for regular object pattern (more compatible).
const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const; // `as const` makes all values readonly literal types

// TS concept: Increment counter with a module-level variable.
let count = 0;

function genId(): string {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

// TS concept: Union type using `typeof` and indexed access types.
// `typeof actionTypes` gets the type of the object; [keyof typeof actionTypes]
// gets a union of all its value types.
type ActionType = typeof actionTypes;

// TS concept: Discriminated union — each action variant has a different `type` field.
// TypeScript narrows the type based on `type` in switch/if statements.
type Action =
  | { type: ActionType["ADD_TOAST"]; toast: ToasterToast }
  | { type: ActionType["UPDATE_TOAST"]; toast: Partial<ToasterToast> }
  | { type: ActionType["DISMISS_TOAST"]; toastId?: ToasterToast["id"] }
  | { type: ActionType["REMOVE_TOAST"]; toastId?: ToasterToast["id"] };

// TS concept: Interface — like `type` but specifically for object shapes.
// Prefer `interface` for public API surfaces (extendable), `type` for unions/intersections.
interface State {
  toasts: ToasterToast[];
}

// Map of toast IDs to their removal timeout IDs
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

// `ReturnType<typeof setTimeout>` — utility type that gets the return type of a function.
function addToRemoveQueue(toastId: string): void {
  if (toastTimeouts.has(toastId)) return;

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: "REMOVE_TOAST", toastId });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
}

// Reducer: pure function that takes current state + action, returns new state.
// TS concept: The return type `State` is inferred but explicit here for clarity.
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };
    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };
    case "DISMISS_TOAST": {
      const { toastId } = action;
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => addToRemoveQueue(toast.id));
      }
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined ? { ...t, open: false } : t
        ),
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) return { ...state, toasts: [] };
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

// Module-level listeners list — shared across all hook instances
type Listener = (state: State) => void;
const listeners: Listener[] = [];
let memoryState: State = { toasts: [] };

function dispatch(action: Action): void {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

// TS concept: `Omit<T, K>` utility type — removes keys K from type T.
type Toast = Omit<ToasterToast, "id">;

function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({ type: "UPDATE_TOAST", toast: { ...props, id } });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return { id, dismiss, update };
}

// TS concept: Custom hook — a function that uses React hooks internally.
// Convention: must start with "use".
function useToast() {
  // `useState<State>` — generic state hook with explicit type parameter
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    // Add this component's setState to the listeners array
    listeners.push(setState);
    return () => {
      // Cleanup: remove listener when component unmounts
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

export { useToast, toast };
