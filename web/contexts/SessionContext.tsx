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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState("ssr");
  useEffect(() => {
    setSessionId(getSessionId());
  }, []);
  return (
    <SessionContext.Provider value={{ sessionId }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
