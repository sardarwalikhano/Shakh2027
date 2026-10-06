import type { AuthResponse } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

const env = import.meta.env as ImportMetaEnv & {
  VITE_PUBLIC_SITE_URL?: string;
};

export function normalizeIraqPhone(value: string) {
  const compact = value.trim().replace(/[()\s-]/g, '');
  let national = compact;

  if (national.startsWith('+964')) national = national.slice(4);
  else if (national.startsWith('00964')) national = national.slice(5);
  else if (national.startsWith('0')) national = national.slice(1);

  const digits = national.replace(/\D/g, '');
  if (!/^7\d{9}$/.test(digits)) {
    throw new Error('ژمارەی مۆبایل بە فۆرماتی عێراق دروست نییە. نموونە: 07XXXXXXXXX');
  }

  return '+964' + digits;
}

function authRedirectUrl(flow: 'email-confirmation' | 'password-recovery' | 'google') {
  const configuredSiteUrl = env.VITE_PUBLIC_SITE_URL?.trim();
  const baseUrl = configuredSiteUrl || window.location.origin;
  const url = new URL(window.location.pathname || '/', baseUrl);
  url.search = '';
  url.hash = '';
  if (flow !== 'google') url.searchParams.set('auth', flow);
  return url.toString();
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResponse> {
  return supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
}

export async function requestWhatsAppOtp(phone: string) {
  const normalizedPhone = normalizeIraqPhone(phone);
  return supabase.auth.signInWithOtp({
    phone: normalizedPhone,
    options: {
      channel: 'whatsapp',
      shouldCreateUser: false,
    },
  });
}

export async function verifyWhatsAppOtp(phone: string, token: string) {
  const normalizedPhone = normalizeIraqPhone(phone);
  return supabase.auth.verifyOtp({
    phone: normalizedPhone,
    token: token.trim(),
    type: 'sms',
  });
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: authRedirectUrl('google'),
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
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

export async function updatePassword(password: string) {
  return supabase.auth.updateUser({ password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function signOutAllSessions() {
  return supabase.auth.signOut({ scope: 'global' });
}
