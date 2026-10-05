import { useEffect, useState } from 'react';
import AppShell from '../../components/shell/AppShell';
import { InlineError, LoadingState } from '../../components/ux/UiStates';
import { useAuth } from '../auth/AuthContext';
import { getAuditConsole, type AuditConsoleItem } from './operationsApi';

const time = (value: string) => new Intl.DateTimeFormat('ku-IQ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const shortId = (value: string | null) => value ? `${value.slice(0, 8)}…` : '—';

export default function AuditConsolePage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<AuditConsoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await getAuditConsole({ action, entityType, limit: 100 });
      setItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'audit_console_load_failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (hasPermission('platform.manage')) void load(); else setLoading(false); }, [hasPermission]);

  if (!hasPermission('platform.manage')) {
    return <AppShell><main dir="rtl" className="rounded-[30px] border border-slate-200 bg-white p-8 text-center"><p className="text-[10px] font-black tracking-[0.18em] text-orange-600">AUDIT CONSOLE</p><h1 className="mt-3 text-2xl font-black">دەستپێگەیشتن ڕەتکرایەوە</h1><p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-500">تەنها Super Admin دەتوانێت audit log ـەکانی platform ببینێت.</p></main></AppShell>;
  }

  return (
    <AppShell>
      <main dir="rtl" className="space-y-5">
        <section className="rounded-[30px] bg-slate-950 p-6 text-white shadow-[var(--shakh-shadow-md)] sm:p-8">
          <p className="text-[10px] font-black tracking-[0.18em] text-orange-300">AUDIT CONSOLE</p>
          <h1 className="mt-2 text-3xl font-black">چاودێری کردارەکان</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">Audit log ـی دەسەڵاتدارەکان لە Supabase ـەوە، بە filter ـی action و entity.</p>
        </section>

        {error && <InlineError title="Audit بار نەکرا" body={error} />}

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-6">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label className="text-xs font-black text-slate-600">Action<input value={action} onChange={(event) => setAction(event.target.value)} placeholder="roles.updated" className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium outline-none focus:border-orange-300" /></label>
            <label className="text-xs font-black text-slate-600">Entity type<input value={entityType} onChange={(event) => setEntityType(event.target.value)} placeholder="order / user / vendor" className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium outline-none focus:border-orange-300" /></label>
            <button type="button" onClick={() => void load()} className="mt-auto min-h-11 rounded-xl bg-slate-950 px-5 text-xs font-black text-white">پشکنین</button>
          </div>
        </section>

        {loading ? <LoadingState label="Audit log بار دەکرێت..." /> : (
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[var(--shakh-shadow-sm)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="text-[10px] font-black tracking-[0.18em] text-orange-600">IMMUTABLE VIEW</p><h2 className="mt-1 text-lg font-black">دوایین کردارەکان</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500">{items.length}</span></div>
            {!items.length ? <p className="p-8 text-center text-sm font-bold text-slate-500">هیچ audit record ـێک بۆ ئەم filter ـە نەدۆزرایەوە.</p> : <div className="overflow-x-auto"><table className="min-w-[840px] w-full text-right text-xs"><thead className="bg-slate-50 text-[10px] text-slate-400"><tr><th className="px-5 py-3">کات</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Entity</th><th className="px-5 py-3">ID</th><th className="px-5 py-3">Actor</th><th className="px-5 py-3">Metadata</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="whitespace-nowrap px-5 py-3 text-slate-400">{time(item.created_at)}</td><td className="px-5 py-3 font-black text-slate-800">{item.action}</td><td className="px-5 py-3">{item.entity_type ?? '—'}</td><td className="px-5 py-3 font-mono text-[10px] text-slate-500">{shortId(item.entity_id)}</td><td className="px-5 py-3 font-mono text-[10px] text-slate-500">{shortId(item.actor_user_id)}</td><td className="max-w-[360px] px-5 py-3"><code className="block truncate rounded-lg bg-slate-50 px-2 py-1 text-[9px] text-slate-500">{JSON.stringify(item.metadata)}</code></td></tr>)}</tbody></table></div>}
          </section>
        )}
      </main>
    </AppShell>
  );
}
