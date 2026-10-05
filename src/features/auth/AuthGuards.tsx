import { useEffect, type ReactNode } from 'react';
import AppShell from '../../components/shell/AppShell';
import { LoadingState } from '../../components/ux/UiStates';
import { useAuth } from './AuthContext';

function IdentityFailure({ message }: { message: string }) {
  return (
    <AppShell>
      <main dir="rtl" className="rounded-[30px] border border-rose-200 bg-white p-8 text-center shadow-[var(--shakh-shadow-sm)]">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-600">AUTH / RBAC ERROR</p>
        <h1 className="mt-3 text-2xl font-black text-slate-950">زانیاری هەژمار و دەسەڵاتەکان بار نەکران</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-slate-500">{message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex min-h-11 items-center rounded-2xl bg-orange-500 px-5 text-xs font-black text-white transition hover:bg-orange-600"
        >
          دووبارە هەوڵ بدەرەوە
        </button>
      </main>
    </AppShell>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, user, identityError } = useAuth();

  useEffect(() => {
    if (!loading && !user && !identityError && window.location.hash !== '#auth/sign-in') {
      window.location.hash = '#auth/sign-in';
    }
  }, [loading, user, identityError]);

  if (loading) return <LoadingState label="خەریکی پشکنینی هەژمارەکەتین..." />;
  if (identityError) return <IdentityFailure message={identityError} />;
  if (!user) return <LoadingState label="گواستنەوە بۆ چوونەژوورەوە..." />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { loading, user, hasRole, identityError } = useAuth();

  useEffect(() => {
    if (!loading && !user && !identityError && window.location.hash !== '#auth/sign-in') {
      window.location.hash = '#auth/sign-in';
    }
  }, [loading, user, identityError]);

  if (loading) return <LoadingState label="دڵنیابوون لە دەسەڵاتەکان..." />;
  if (identityError) return <IdentityFailure message={identityError} />;
  if (!user) return <LoadingState label="گواستنەوە..." />;

  if (!hasRole(roles)) {
    return (
      <AppShell>
        <main dir="rtl" className="rounded-[30px] border border-slate-200 bg-white p-8 text-center shadow-[var(--shakh-shadow-sm)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">ACCESS DENIED</p>
          <h1 className="mt-3 text-2xl font-black text-slate-950">ئەم بەشە بۆ هەژمارەکەت بەردەست نییە</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-500">دەستپێگەیشتن لە بنەڕەتدا بە Supabase RBAC و RLS کۆنترۆڵ دەکرێت.</p>
          <a href="#account" className="mt-6 inline-flex min-h-11 items-center rounded-2xl bg-orange-500 px-5 text-xs font-black text-white">گەڕانەوە بۆ هەژمار</a>
        </main>
      </AppShell>
    );
  }

  return <>{children}</>;
}

export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { loading, user, hasPermission, identityError } = useAuth();

  useEffect(() => {
    if (!loading && !user && !identityError && window.location.hash !== '#auth/sign-in') {
      window.location.hash = '#auth/sign-in';
    }
  }, [loading, user, identityError]);

  if (loading) return <LoadingState label="دڵنیابوون لە دەسەڵاتەکان..." />;
  if (identityError) return <IdentityFailure message={identityError} />;
  if (!user) return <LoadingState label="گواستنەوە..." />;

  if (!hasPermission(permission)) {
    return (
      <AppShell>
        <main dir="rtl" className="rounded-[30px] border border-slate-200 bg-white p-8 text-center shadow-[var(--shakh-shadow-sm)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">PERMISSION DENIED</p>
          <h1 className="mt-3 text-2xl font-black text-slate-950">ئەم کردارە ڕێگەپێدراو نییە</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-500">دەسەڵات لە frontend ـدا تەنها نیشانەیە؛ backend و RLS سەرچاوەی کۆتایی authorization ـن.</p>
          <a href="#dashboard" className="mt-6 inline-flex min-h-11 items-center rounded-2xl bg-orange-500 px-5 text-xs font-black text-white">گەڕانەوە</a>
        </main>
      </AppShell>
    );
  }

  return <>{children}</>;
}
