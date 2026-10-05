import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  requestPasswordReset,
  resendSignupConfirmation,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updatePassword,
} from './auth';
import { useAuth } from './AuthContext';

function resolveMode(): 'sign-in' | 'sign-up' | 'reset-password' {
  const hashMode = window.location.hash.split('/')[1];
  if (hashMode === 'sign-up' || hashMode === 'reset-password') return hashMode;

  const query = new URLSearchParams(window.location.search);
  if (query.get('auth') === 'password-recovery') return 'reset-password';

  return 'sign-in';
}

function validatePassword(password: string) {
  if (password.length < 8) return 'وشەی نهێنی دەبێت لانیکەم ٨ پیت بێت.';
  return null;
}

function friendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) return 'ئیمەیڵ یان وشەی نهێنی هەڵەیە.';
  if (normalized.includes('email not confirmed')) return 'ئیمەیڵەکەت هێشتا پشتڕاست نەکراوەتەوە. تکایە پەیامی پشتڕاستکردنەوەکە بکەرەوە.';
  if (normalized.includes('password')) return message || 'وشەی نهێنی پەسەند نەکرا.';
  if (normalized.includes('rate limit')) return 'داواکارییەکان زۆرن. تکایە دواتر هەوڵ بدەرەوە.';
  if (normalized.includes('redirect')) return 'لینکی authentication ڕێک نەخراوە. Redirect URL ـەکانی Supabase پشکنە.';
  return message || 'هەڵەیەک لە authentication ڕوویدا.';
}

export default function AuthPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState(resolveMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('هەولێر');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const passwordError = useMemo(() => validatePassword(password), [password]);

  useEffect(() => {
    const onLocationChange = () => setMode(resolveMode());
    window.addEventListener('hashchange', onLocationChange);
    window.addEventListener('popstate', onLocationChange);
    return () => {
      window.removeEventListener('hashchange', onLocationChange);
      window.removeEventListener('popstate', onLocationChange);
    };
  }, []);

  const navigateToSignIn = () => {
    window.history.replaceState({}, '', window.location.pathname);
    window.location.hash = '#auth/sign-in';
    setMode('sign-in');
    setPassword('');
    setConfirmPassword('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'sign-in') {
        if (passwordError) throw new Error(passwordError);
        const { error: signInError } = await signInWithPassword(email, password);
        if (signInError) throw signInError;
        window.location.hash = '#market';
        return;
      }

      if (mode === 'sign-up') {
        if (!fullName.trim()) throw new Error('ناوی تەواو پێویستە.');
        if (!email.trim()) throw new Error('ئیمەیڵ پێویستە.');
        if (passwordError) throw new Error(passwordError);
        if (password !== confirmPassword) throw new Error('دوو وشەی نهێنییەکە وەک یەک نین.');

        const { data, error: signUpError } = await signUpWithPassword({
          email,
          password,
          fullName,
          city,
          phone,
        });
        if (signUpError) throw signUpError;

        if (!data.session) {
          setMessage('هەژمارەکە دروست کرا. پەیامی پشتڕاستکردنەوە بۆ ئیمەیڵەکەت نێردرا؛ دوای پشتڕاستکردنەوە دەتوانیت بچیتە ژوورەوە.');
        } else {
          window.location.hash = '#market';
        }
        return;
      }

      if (passwordError) throw new Error(passwordError);
      if (password !== confirmPassword) throw new Error('دوو وشەی نهێنییەکە وەک یەک نین.');

      const { error: updateError } = await updatePassword(password);
      if (updateError) throw updateError;

      await signOut();
      window.history.replaceState({}, '', window.location.pathname);
      window.location.hash = '#auth/sign-in';
      setMode('sign-in');
      setPassword('');
      setConfirmPassword('');
      setMessage('وشەی نهێنی بە سەرکەوتوویی نوێکرایەوە. ئێستا دەتوانیت بچیتە ژوورەوە.');
    } catch (caught) {
      setError(friendlyAuthError(caught));
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('سەرەتا ئیمەیڵەکەت بنووسە.');
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { error: resetError } = await requestPasswordReset(normalizedEmail);
      if (resetError) throw resetError;
      setMessage('ئەگەر ئەم ئیمەیڵە هەژمارێکی دروستی هەبێت، لینکی گۆڕینی وشەی نهێنی بۆی نێردرا.');
    } catch (caught) {
      setError(friendlyAuthError(caught));
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('ئیمەیڵەکەت بنووسە بۆ دووبارە ناردنی پەیامی پشتڕاستکردنەوە.');
      return;
    }

    setResending(true);
    setError(null);
    setMessage(null);
    try {
      const { error: resendError } = await resendSignupConfirmation(normalizedEmail);
      if (resendError) throw resendError;
      setMessage('پەیامی پشتڕاستکردنەوە دووبارە نێردرا.');
    } catch (caught) {
      setError(friendlyAuthError(caught));
    } finally {
      setResending(false);
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-[var(--shakh-bg)] px-4 py-8 sm:px-6 lg:grid lg:place-items-center lg:py-12">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[var(--shakh-shadow-md)] lg:grid-cols-[.85fr_1.15fr]">
        <section className="hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div><p className="text-xs font-black tracking-[.18em] text-orange-300">SHAKH 2027</p><h1 className="mt-5 text-5xl font-black tracking-tight">شاخ</h1><p className="mt-4 max-w-sm text-sm leading-8 text-white/60">هەموو بازار، خواردن، خزمەتگوزاری و گەیاندن لە یەک ecosystem ـدا.</p></div>
          <div className="grid gap-3 text-xs text-white/55"><span>Supabase Auth</span><span>Database-backed RBAC</span><span>Kurdish-first • RTL</span></div>
        </section>

        <section className="p-6 sm:p-10">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-orange-600">ACCOUNT</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                {mode === 'sign-in' ? 'بچۆ ژوورەوە' : mode === 'sign-up' ? 'هەژمار دروست بکە' : 'وشەی نهێنی نوێ بکەوە'}
              </h2>
            </div>
            <a href="#market" className="text-xs font-black text-slate-400 hover:text-slate-700">بۆ بازار</a>
          </div>

          <form onSubmit={submit} className="grid gap-4">
            {mode === 'sign-up' && <>
              <Field label="ناوی تەواو" value={fullName} onChange={setFullName} required autoComplete="name" />
              <Field label="ژمارەی مۆبایل" value={phone} onChange={setPhone} autoComplete="tel" />
              <Field label="شار" value={city} onChange={setCity} required />
            </>}

            {mode !== 'reset-password' && (
              <Field label="ئیمەیڵ" value={email} onChange={setEmail} required type="email" autoComplete="email" />
            )}

            <Field
              label={mode === 'reset-password' ? 'وشەی نهێنیی نوێ' : 'وشەی نهێنی'}
              value={password}
              onChange={setPassword}
              required
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            />

            {(mode === 'sign-up' || mode === 'reset-password') && (
              <>
                <Field
                  label="دووبارە وشەی نهێنی"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  required
                  type="password"
                  autoComplete="new-password"
                />
                <p className="text-[11px] font-semibold leading-5 text-slate-400">لانیکەم ٨ پیت.</p>
              </>
            )}

            {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold leading-6 text-red-700">{error}</div>}
            {message && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold leading-6 text-emerald-700">{message}</div>}

            <button disabled={busy} className="mt-1 min-h-12 rounded-2xl bg-orange-500 px-5 text-sm font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60" type="submit">
              {busy ? 'چاوەڕوان بە...' : mode === 'sign-in' ? 'چوونەژوورەوە' : mode === 'sign-up' ? 'دروستکردنی هەژمار' : 'نوێکردنەوەی وشەی نهێنی'}
            </button>

            {mode === 'sign-up' && (
              <>
                <button type="button" onClick={() => void resendConfirmation()} disabled={busy || resending || !email.trim()} className="text-xs font-black text-slate-500 hover:text-orange-600 disabled:opacity-40">
                  {resending ? 'دووبارە دەنێردرێت...' : 'پەیامی پشتڕاستکردنەوە دووبارە بنێرە'}
                </button>
                <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-xs font-semibold leading-6 text-orange-900">
                  هەموو هەژمارە نوێکان سەرەتا کڕیارن.
                </div>
              </>
            )}
          </form>

          {mode === 'sign-in' && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => void forgotPassword()} disabled={busy || !email.trim()} className="text-xs font-black text-slate-500 hover:text-orange-600 disabled:opacity-40">وشەی نهێنیت لەبیرچووە؟</button>
              <a href="#auth/sign-up" className="text-xs font-black text-orange-600">هەژمارت نییە؟</a>
            </div>
          )}

          {mode === 'sign-up' && (
            <div className="mt-4 text-center text-xs font-black text-slate-500">
              هەژمارت هەیە؟ <a href="#auth/sign-in" className="text-orange-600">بچۆ ژوورەوە</a>
            </div>
          )}

          {mode === 'reset-password' && (
            <div className="mt-4 text-center text-xs font-black text-slate-500">
              گەڕانەوە بۆ <button type="button" onClick={navigateToSignIn} className="font-black text-orange-600">چوونەژوورەوە</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black text-slate-700">{props.label}</span>
      <input
        required={props.required}
        type={props.type ?? 'text'}
        autoComplete={props.autoComplete}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="min-h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
      />
    </label>
  );
}
