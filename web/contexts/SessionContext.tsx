"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getSessionId } from "../lib/session";

const SessionContext = createContext<{
  sessionId: string;
  isAuthenticated: boolean;
}>({
  sessionId: "ssr",
  isAuthenticated: false,
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
  // A real Auth0 subject is only passed in when the user is logged in;
  // anonymous visitors get a client-generated localStorage id instead.
  const isAuthenticated = Boolean(initialSessionId);
  return (
    <SessionContext.Provider value={{ sessionId, isAuthenticated }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
