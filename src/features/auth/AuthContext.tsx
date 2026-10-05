import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  preferred_language: 'ckb' | 'ar' | 'en';
  city: string;
  wallet_balance_iqd: number;
  d_sh_points: number;
  is_active: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: string[];
  permissions: string[];
  loading: boolean;
  hasRole: (roles: string | string[]) => boolean;
  hasPermission: (permission: string) => boolean;
  refreshIdentity: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadIdentity(user: User | null) {
  if (!user) return { profile: null, roles: [] as string[], permissions: [] as string[] };

  const [profileResult, roleResult] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone, avatar_url, preferred_language, city, wallet_balance_iqd, d_sh_points, is_active').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role_code').eq('user_id', user.id),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (roleResult.error) throw roleResult.error;

  const roles = (roleResult.data ?? []).map((row) => row.role_code as string);
  if (!roles.length) {
    return { profile: (profileResult.data as Profile | null) ?? null, roles, permissions: [] as string[] };
  }

  const permissionResult = await supabase.from('role_permissions').select('permission_code').in('role_code', roles);
  if (permissionResult.error) throw permissionResult.error;

  return {
    profile: (profileResult.data as Profile | null) ?? null,
    roles,
    permissions: [...new Set((permissionResult.data ?? []).map((row) => row.permission_code as string))],
  };
}

function syncRecoveryRoute() {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  if (hashParams.get('type') !== 'recovery') return;

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('auth', 'password-recovery');
  nextUrl.hash = '';
  window.history.replaceState({}, '', nextUrl.toString());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshIdentity = async () => {
    const result = await loadIdentity(session?.user ?? null);
    setProfile(result.profile);
    setRoles(result.roles);
    setPermissions(result.permissions);
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      syncRecoveryRoute();
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!mounted) return;
      setSession(data.session);
      const identity = await loadIdentity(data.session?.user ?? null);
      if (!mounted) return;
      setProfile(identity.profile);
      setRoles(identity.roles);
      setPermissions(identity.permissions);
      setLoading(false);
    };

    bootstrap().catch(() => {
      if (mounted) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') {
        window.setTimeout(() => {
          if (!mounted) return;
          const nextUrl = new URL(window.location.href);
          nextUrl.searchParams.set('auth', 'password-recovery');
          nextUrl.hash = '';
          window.history.replaceState({}, '', nextUrl.toString());
        }, 0);
      }
      window.setTimeout(async () => {
        if (!mounted) return;
        try {
          const identity = await loadIdentity(nextSession?.user ?? null);
          if (!mounted) return;
          setProfile(identity.profile);
          setRoles(identity.roles);
          setPermissions(identity.permissions);
        } finally {
          if (mounted) setLoading(false);
        }
      }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    roles,
    permissions,
    loading,
    hasRole: (required) => {
      const values = Array.isArray(required) ? required : [required];
      return values.some((role) => roles.includes(role));
    },
    hasPermission: (permission) => permissions.includes(permission),
    refreshIdentity,
  }), [session, profile, roles, permissions, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
