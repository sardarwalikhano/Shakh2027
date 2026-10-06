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
  identityError: string | null;
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

  const roles = [...new Set((roleResult.data ?? []).map((row) => row.role_code as string))];
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

function formatIdentityError(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : '';
  return message || 'بارکردنی زانیاری هەژمار و دەسەڵاتەکان سەرکەوتوو نەبوو.';
}

function syncAuthFlowRoute(flow: 'email-confirmation' | 'password-recovery') {
  const nextUrl = new URL(window.location.href);
  for (const key of ['code', 'error', 'error_code', 'error_description']) {
    nextUrl.searchParams.delete(key);
  }
  nextUrl.searchParams.set('auth', flow);
  nextUrl.hash = flow === 'password-recovery' ? '#auth/reset-password' : '#auth/email-confirmation';
  window.history.replaceState({}, '', nextUrl.toString());
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function hasRecoveryCallbackInUrl() {
  const queryParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  return queryParams.get('auth') === 'password-recovery' || hashParams.get('type') === 'recovery';
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [identityError, setIdentityError] = useState<string | null>(null);

  const refreshIdentity = async () => {
    setIdentityError(null);
    try {
      const result = await loadIdentity(session?.user ?? null);
      setProfile(result.profile);
      setRoles(result.roles);
      setPermissions(result.permissions);
    } catch (error) {
      const message = formatIdentityError(error);
      setIdentityError(message);
      throw error;
    }
  };

  useEffect(() => {
    let mounted = true;

    const handleAuthEvent = (event: string, nextSession: Session | null) => {
      if (!mounted) return;

      setSession(nextSession);

      if (!nextSession) {
        setProfile(null);
        setRoles([]);
        setPermissions([]);
        setIdentityError(null);
        setLoading(false);
        return;
      }

      setIdentityError(null);

      if (event === 'PASSWORD_RECOVERY') {
        window.setTimeout(() => {
          if (!mounted) return;
          syncAuthFlowRoute('password-recovery');
        }, 0);
      }

      window.setTimeout(async () => {
        if (!mounted) return;
        try {
          const identity = await loadIdentity(nextSession.user);
          if (!mounted) return;
          setProfile(identity.profile);
          setRoles(identity.roles);
          setPermissions(identity.permissions);
        } catch (error) {
          if (!mounted) return;
          setIdentityError(formatIdentityError(error));
        } finally {
          if (mounted) setLoading(false);
        }
      }, 0);
    };

    const { data: listener } = supabase.auth.onAuthStateChange(handleAuthEvent);

    const bootstrap = async () => {
      const recoveryCallback = hasRecoveryCallbackInUrl();
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!mounted) return;

      setSession(data.session);
      setIdentityError(null);

      if (recoveryCallback && data.session) {
        syncAuthFlowRoute('password-recovery');
      }

      try {
        const identity = await loadIdentity(data.session?.user ?? null);
        if (!mounted) return;
        setProfile(identity.profile);
        setRoles(identity.roles);
        setPermissions(identity.permissions);
      } catch (error) {
        if (!mounted) return;
        setProfile(null);
        setRoles([]);
        setPermissions([]);
        setIdentityError(formatIdentityError(error));
      }

      if (mounted) setLoading(false);
    };

    bootstrap().catch((error) => {
      if (!mounted) return;
      setIdentityError(formatIdentityError(error));
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;

    let cancelled = false;
    let timer: number | undefined;

    const refresh = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void loadIdentity(session?.user ?? null)
          .then((identity) => {
            if (cancelled) return;
            setProfile(identity.profile);
            setRoles(identity.roles);
            setPermissions(identity.permissions);
            setIdentityError(null);
          })
          .catch((error) => {
            if (!cancelled) setIdentityError(formatIdentityError(error));
          });
      }, 200);
    };

    const channel = supabase
      .channel(`auth-identity:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${userId}` }, refresh)
      .subscribe((status, subscriptionError) => {
        if (status === 'SUBSCRIBED') return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const message = subscriptionError instanceof Error ? subscriptionError.message : 'Auth realtime sync بەردەست نییە؛ identity لە refreshی دواتر نوێ دەکرێتەوە.';
          if (!cancelled) setIdentityError(message);
        }
      });

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [session?.user.id]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    roles,
    permissions,
    loading,
    identityError,
    hasRole: (required) => {
      const values = Array.isArray(required) ? required : [required];
      return values.some((role) => roles.includes(role));
    },
    hasPermission: (permission) => permissions.includes(permission),
    refreshIdentity,
  }), [session, profile, roles, permissions, loading, identityError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
