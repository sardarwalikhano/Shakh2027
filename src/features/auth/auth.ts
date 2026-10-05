import type { AuthResponse } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

const redirectUrl = (path: string) => `${window.location.origin}${window.location.pathname}${path}`;

export async function signInWithPassword(email: string, password: string): Promise<AuthResponse> {
  return supabase.auth.signInWithPassword({ email: email.trim(), password });
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  fullName: string;
  city: string;
  phone?: string;
}): Promise<AuthResponse> {
  return supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: redirectUrl('#auth/sign-in'),
      data: {
        full_name: input.fullName.trim(),
        preferred_language: 'ckb',
        city: input.city.trim() || 'هەولێر',
        ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
      },
    },
  });
}

export async function requestPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: redirectUrl('#auth/reset-password'),
  });
}

export async function updatePassword(password: string) {
  return supabase.auth.updateUser({ password });
}

export async function signOut() {
  return supabase.auth.signOut();
}
