"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, ApiError, type AuthSession } from "@/lib/api";

type SessionContextValue = {
  session: AuthSession | null;
  status: "loading" | "authenticated" | "guest";
  refresh: () => Promise<AuthSession | null>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] =
    useState<SessionContextValue["status"]>("loading");

  const refresh = useCallback(async () => {
    try {
      const response = await api.get<AuthSession>("/auth/me");
      setSession(response.data);
      setStatus("authenticated");
      return response.data;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        console.error("Session check failed", error);
      }
      setSession(null);
      setStatus("guest");
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post<{ loggedOut: boolean }>("/auth/logout");
    } finally {
      setSession(null);
      setStatus("guest");
    }
  }, []);

  useEffect(() => {
    let active = true;
    api
      .get<AuthSession>("/auth/me")
      .then((response) => {
        if (!active) return;
        setSession(response.data);
        setStatus("authenticated");
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (!(error instanceof ApiError) || error.status !== 401) {
          console.error("Session check failed", error);
        }
        setSession(null);
        setStatus("guest");
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({ session, status, refresh, logout }),
    [logout, refresh, session, status],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return context;
}
