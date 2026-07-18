"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { AiConsultResponse } from "../lib/api/schemas";

type Deltas = AiConsultResponse["deltas"];

interface AIConsultantState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  lastDeltas: Deltas | null;
  applyDeltas: (deltas: Deltas) => void;
}

const AIConsultantContext = createContext<AIConsultantState>({
  isOpen: false,
  open: () => {},
  close: () => {},
  lastDeltas: null,
  applyDeltas: () => {},
});

export function AIConsultantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [lastDeltas, setLastDeltas] = useState<Deltas | null>(null);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const applyDeltas = useCallback((deltas: Deltas) => {
    setLastDeltas(deltas);
  }, []);
  return (
    <AIConsultantContext.Provider
      value={{ isOpen, open, close, lastDeltas, applyDeltas }}
    >
      {children}
    </AIConsultantContext.Provider>
  );
}

export function useAIConsultant() {
  return useContext(AIConsultantContext);
}
