"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getSessionId } from "../lib/session";

const SessionContext = createContext<{ sessionId: string }>({
  sessionId: "ssr",
});

export function SessionProvider({
  children,
  initialSessionId,
}: {
  children: ReactNode;
  initialSessionId?: string;
}) {
  const [sessionId, setSessionId] = useState(initialSessionId ?? "ssr");
  useEffect(() => {
    if (!initialSessionId) setSessionId(getSessionId());
  }, [initialSessionId]);
  return (
    <SessionContext.Provider value={{ sessionId }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
