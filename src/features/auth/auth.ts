import type { AuthResponse } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

const env = import.meta.env as ImportMetaEnv & {
  VITE_PUBLIC_SITE_URL?: string;
};

function authRedirectUrl(flow: 'email-confirmation' | 'password-recovery') {
  const configuredSiteUrl = env.VITE_PUBLIC_SITE_URL?.trim();
  const baseUrl = configuredSiteUrl || window.location.origin;
  const url = new URL('/', baseUrl);
  url.searchParams.set('auth', flow);
  return url.toString();
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResponse> {
  return supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  fullName: string;
  city: string;
  phone?: string;
}): Promise<AuthResponse> {
  return supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      emailRedirectTo: authRedirectUrl('email-confirmation'),
      data: {
        full_name: input.fullName.trim(),
        preferred_language: 'ckb',
        city: input.city.trim() || 'هەولێر',
        ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
      },
    },
  });
}

export async function resendSignupConfirmation(email: string) {
  return supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: authRedirectUrl('email-confirmation'),
    },
  });
}

export async function requestPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: authRedirectUrl('password-recovery'),
  });
}

export async function verifyAuthTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const tokenHash = params.get('token_hash');
  const type = params.get('type');

  if (!tokenHash || (type !== 'email' && type !== 'recovery')) {
    return null;
  }

  const result = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (!result.error) {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('token_hash');
    cleanUrl.searchParams.delete('type');
    window.history.replaceState({}, '', cleanUrl.toString());
  }

  return result;
}

export async function updatePassword(password: string) {
  return supabase.auth.updateUser({ password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function signOutAllSessions() {
  return supabase.auth.signOut({ scope: 'global' });
}
