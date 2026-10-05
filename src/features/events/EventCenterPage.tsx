import { useEffect, useState } from 'react';
import AppShell from '../../components/shell/AppShell';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';

type PlatformEvent = { id: string; event_type: string; entity_type: string | null; entity_id: string | null; severity: 'info' | 'success' | 'warning' | 'error'; title_ckb: string; body_ckb: string | null; created_at: string };

export default function EventCenterPage() {
  const { hasPermission } = useAuth();
  const [events, setEvents] = useState<PlatformEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!hasPermission('events.read')) { setDenied(true); setLoading(false); return; }
    let cancelled = false;
    void supabase.from('platform_events').select('id,event_type,entity_type,entity_id,severity,title_ckb,body_ckb,created_at').order('created_at', { ascending: false }).limit(100).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setDenied(true); else setEvents((data ?? []) as PlatformEvent[]);
      setLoading(false);
    });
    const channel = supabase.channel('platform-event-center').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'platform_events' }, (payload) => {
      if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) setEvents((current) => [payload.new as PlatformEvent, ...current].slice(0, 100));
    }).subscribe();
    return () => { cancelled = true; void channel.unsubscribe(); };
  }, [hasPermission]);

  return <AppShell><main dir="rtl" className="mx-auto max-w-[1200px] space-y-6"><section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,.06)] sm:p-8"><p className="text-[10px] font-black tracking-[.18em] text-orange-600">EVENT CENTER</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">ناوەندی Event</h1><p className="mt-2 text-sm leading-7 text-slate-500">stream ـی event ـەکانی platform لە یەک شوێن، لەگەڵ realtime updates.</p></section>{denied ? <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-sm font-bold text-red-700">دەسەڵاتی `events.read` ـت نییە.</div> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">{loading ? <div className="p-8 text-center text-sm text-slate-400">بارکردن...</div> : events.map((event) => <article key={event.id} className="flex gap-4 border-b border-slate-100 p-5 last:border-0"><div className={`mt-1 h-3 w-3 rounded-full ${event.severity === 'error' ? 'bg-red-500' : event.severity === 'warning' ? 'bg-amber-500' : event.severity === 'success' ? 'bg-emerald-500' : 'bg-sky-500'}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-black text-slate-900">{event.title_ckb}</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">{event.event_type}</span></div>{event.body_ckb && <p className="mt-1 text-xs leading-6 text-slate-500">{event.body_ckb}</p>}<p className="mt-1 text-[9px] text-slate-400">{new Date(event.created_at).toLocaleString('ku-IQ')}</p></div></article>)}</section>}</main></AppShell>;
}
