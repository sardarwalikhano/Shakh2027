import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/shell/AppShell';
import { useAuth } from '../auth/AuthContext';
import {
  getNotificationPreferences,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  updateNotificationPreferences,
  type NotificationPreferences,
  type NotificationRow,
} from './notificationsApi';

function relativeTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'ئێستا';
  if (minutes < 60) return `${minutes} خولەک پێش ئێستا`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} کاتژمێر پێش ئێستا`;
  return `${Math.floor(hours / 24)} ڕۆژ پێش ئێستا`;
}

const labels: Record<NotificationRow['category'], string> = {
  order: 'ئۆردەر', payment: 'پارەدان', delivery: 'گەیاندن', support: 'پشتیوانی', security: 'ئەمنیەت', marketing: 'پڕۆمۆشن', system: 'سیستەم',
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [busy, setBusy] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void Promise.all([getNotifications(), getNotificationPreferences(user.id)]).then(([nextRows, nextPrefs]) => {
      if (!cancelled) { setRows(nextRows); setPrefs(nextPrefs); }
    }).finally(() => { if (!cancelled) setBusy(false); });
    const channel = subscribeToNotifications(user.id, (incoming) => {
      setRows((current) => [incoming, ...current.filter((row) => row.id !== incoming.id)].slice(0, 50));
    });
    return () => { cancelled = true; void channel.unsubscribe(); };
  }, [user]);

  const unread = useMemo(() => rows.filter((row) => !row.read_at).length, [rows]);

  async function readOne(row: NotificationRow) {
    if (row.read_at) return;
    await markNotificationRead(row.id);
    setRows((current) => current.map((item) => item.id === row.id ? { ...item, read_at: new Date().toISOString() } : item));
  }

  async function readAll() {
    await markAllNotificationsRead();
    const now = new Date().toISOString();
    setRows((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })));
  }

  async function savePrefs(next: NotificationPreferences) {
    setPrefs(next); setSavingPrefs(true);
    try { await updateNotificationPreferences(next); } finally { setSavingPrefs(false); }
  }

  return (
    <AppShell>
      <main dir="rtl" className="mx-auto max-w-[1100px] space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,.06)] sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black tracking-[.18em] text-orange-600">NOTIFICATION CENTER</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">ئاگادارکردنەوەکان</h1>
              <p className="mt-2 text-sm leading-7 text-slate-500">هەموو نوێکارییەکانی ئۆردەر، پارەدان، گەیاندن و پشتیوانی لێرە کۆدەکرێنەوە.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black text-orange-700">{unread} نەخوێندراو</span>
              {unread > 0 && <button onClick={() => void readAll()} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50">هەمووی بخوێنەوە</button>}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-3">
            {busy && <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-400">چاوەڕێی ئاگادارکردنەوەکان...</div>}
            {!busy && rows.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-400">هیچ ئاگادارکردنەوەیەک نییە.</div>}
            {rows.map((row) => (
              <article key={row.id} className={`rounded-2xl border bg-white p-5 transition ${row.read_at ? 'border-slate-200' : 'border-orange-200 bg-orange-50/40 shadow-sm'}`}>
                <div className="flex gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-sm font-black text-slate-700">{row.priority === 'urgent' ? '!' : '•'}</div>
                  <button className="min-w-0 flex-1 text-right" onClick={() => void readOne(row)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-black text-slate-950">{row.title_ckb}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">{labels[row.category]}</span>
                    </div>
                    {row.body_ckb && <p className="mt-1.5 text-xs leading-6 text-slate-500">{row.body_ckb}</p>}
                    <p className="mt-2 text-[10px] font-semibold text-slate-400">{relativeTime(row.created_at)}</p>
                  </button>
                  {row.action_hash && <a href={row.action_hash} className="self-start rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black text-slate-700 hover:bg-slate-50">کردار</a>}
                </div>
              </article>
            ))}
          </div>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-black tracking-[.14em] text-slate-400">PREFERENCES</p><h2 className="mt-1 text-lg font-black text-slate-950">ڕێکخستنی ئاگادارکردنەوە</h2></div>
              {savingPrefs && <span className="text-[10px] font-black text-orange-600">دەخەزنرێت...</span>}
            </div>
            <div className="mt-5 space-y-3">
              {prefs && (Object.entries(prefs) as [keyof NotificationPreferences, boolean][]).map(([key, value]) => {
                const names: Record<keyof NotificationPreferences, string> = {
                  order_updates: 'نوێکاریی ئۆردەر', payment_updates: 'نوێکاریی پارەدان', delivery_updates: 'نوێکاریی گەیاندن', support_updates: 'پشتیوانی', security_alerts: 'ئاگاداریی ئەمنیەت', marketing_updates: 'پڕۆمۆشن',
                };
                return <label key={key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3 text-xs font-bold text-slate-700"><span>{names[key]}</span><input type="checkbox" checked={value} onChange={(event) => void savePrefs({ ...prefs, [key]: event.target.checked })} className="h-4 w-4 accent-orange-500" /></label>;
              })}
            </div>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}

