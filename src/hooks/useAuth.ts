import { useEffect, useState, useCallback } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "adm" | "gestor" | "operador" | "fretista";

export type AuthState = {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
};

async function fetchPrimaryRole(userId: string): Promise<AppRole | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error || !data || data.length === 0) return null;
  // Priority order
  const priority: AppRole[] = ["adm", "gestor", "operador", "fretista"];
  const roles = data.map((r) => r.role as AppRole);
  for (const p of priority) {
    if (roles.includes(p)) return p;
  }
  return roles[0] ?? null;
}

export function useAuth(): AuthState & {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
} {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRole = useCallback(async (uid: string | null) => {
    if (!uid) {
      setRole(null);
      return;
    }
    const r = await fetchPrimaryRole(uid);
    setRole(r);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      // defer role fetch to avoid deadlock
      if (sess?.user) {
        setTimeout(() => {
          void loadRole(sess.user.id);
        }, 0);
      } else {
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) void loadRole(s.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { full_name: fullName },
        },
      });
      return { error: error?.message ?? null };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshRole = useCallback(async () => {
    if (user) await loadRole(user.id);
  }, [user, loadRole]);

  return { user, session, role, loading, signIn, signUp, signOut, refreshRole };
}
