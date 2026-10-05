import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/shell/AppShell';
import { InlineError, LoadingState, SuccessNotice } from '../../components/ux/UiStates';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../../lib/supabase';
import { getCashCollections, getMyPaymentIntents, reconcileCashCollection, type CashCollection, type PaymentIntent } from '../commerce/paymentApi';

const money = (value: number) => new Intl.NumberFormat('ku-IQ', { maximumFractionDigits: 0 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat('ku-IQ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

const statusLabel: Record<PaymentIntent['status'], string> = {
  pending: 'چاوەڕوان', requires_action: 'کردار پێویستە', succeeded: 'سەرکەوتوو', failed: 'شکست', cancelled: 'هەڵوەشاوە', expired: 'بەسەرچوو',
};

function IntentTable({ items }: { items: PaymentIntent[] }) {
  if (!items.length) return <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">هێشتا payment intent ـێک نییە.</div>;
  return <div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-right text-xs"><thead className="bg-slate-50 text-slate-400"><tr><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">بڕ</th><th className="px-4 py-3">status</th><th className="px-4 py-3">کات</th></tr></thead><tbody className="divide-y divide-slate-100 bg-white">{items.map((item) => <tr key={item.id}><td className="px-4 py-3 font-mono text-[10px] text-slate-500">{item.id.slice(0,8)}…</td><td className="px-4 py-3 font-black">{item.provider}</td><td className="px-4 py-3 font-black">{money(Number(item.amount_iqd))} IQD</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 font-black">{statusLabel[item.status]}</span></td><td className="whitespace-nowrap px-4 py-3 text-slate-400">{date(item.created_at)}</td></tr>)}</tbody></table></div>;
}

function CashTable({ items, canManage, onReconciled }: { items: CashCollection[]; canManage: boolean; onReconciled: (item: CashCollection) => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  async function reconcile(item: CashCollection) {
    setBusyId(item.id);
    setActionError("");
    try {
      const next = await reconcileCashCollection(
        item.id,
        "reconciled",
        item.deposit_reference ?? undefined,
        "Reconciled from SHAKH Payments Center"
      );
      onReconciled(next);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "نەتوانرا cash collection reconcile بکرێت.");
    } finally {
      setBusyId(null);
    }
  }

  if (!items.length) return <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">هێشتا COD cash collection ـێک نییە.</div>;

  return (
    <div className="space-y-3">
      {actionError ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">{actionError}</div> : null}
      {items.map((item) => {
        const busy = busyId === item.id;
        return (
          <article key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-slate-800">Order: {item.order_id.slice(0, 8)}…</p>
              <p className="mt-1 text-xs font-black text-orange-700">{money(Number(item.amount_iqd))} IQD</p>
              <p className="mt-1 text-[10px] text-slate-400">{date(item.collected_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500">{item.status}</span>
              {canManage && item.status !== "reconciled" ? (
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-10 rounded-xl bg-slate-950 px-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void reconcile(item)}
                >
                  {busy ? "دەکۆڵێتەوە..." : "reconcile"}
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function PaymentsPage() {
  const { hasPermission } = useAuth();
  const [intents, setIntents] = useState<PaymentIntent[]>([]);
  const [cash, setCash] = useState<CashCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const canManage = hasPermission('payments.manage');

  async function load() {
    setLoading(true); setError('');
    try {
      const [paymentData, cashData] = await Promise.all([getMyPaymentIntents(), getCashCollections()]);
      setIntents(paymentData); setCash(cashData);
    } catch (err) { setError(err instanceof Error ? err.message : 'payments_load_failed'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const refresh = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void Promise.all([getMyPaymentIntents(), getCashCollections()])
          .then(([paymentData, cashData]) => {
            if (cancelled) return;
            setIntents(paymentData);
            setCash(cashData);
            setError('');
          })
          .catch((err: unknown) => {
            if (!cancelled) setError(err instanceof Error ? err.message : 'payments_load_failed');
          });
      }, 200);
    };

    const channel = supabase
      .channel('payments-center-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_intents' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_collections' }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, []);

  const totals = useMemo(() => intents.reduce((acc, item) => { if (item.status === 'succeeded') acc.paid += Number(item.amount_iqd); if (item.status === 'pending' || item.status === 'requires_action') acc.pending += Number(item.amount_iqd); return acc; }, { paid: 0, pending: 0 }), [intents]);

  if (loading) return <AppShell><LoadingState label="Payments Center بار دەکرێت..." /></AppShell>;
  return <AppShell><main dir="rtl" className="space-y-5"><section className="rounded-[30px] bg-slate-950 p-6 text-white shadow-[var(--shakh-shadow-md)] sm:p-8"><p className="text-[10px] font-black tracking-[0.18em] text-orange-300">PAYMENTS CENTER</p><h1 className="mt-2 text-3xl font-black">پارەدان و reconciliation</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">Payment intent، transaction status و COD cash collection لە backend ـی Supabase ـەوە.</p></section>{error && <InlineError title="Payments بار نەکرا" body={error} />}{success && <SuccessNotice title="سەرکەوتوو بوو" body={success} />}<div className="grid gap-3 sm:grid-cols-2"><div className="rounded-[24px] border border-slate-200 bg-white p-5"><p className="text-[10px] font-black text-slate-400">PAID</p><p className="mt-2 text-2xl font-black">{money(totals.paid)} IQD</p></div><div className="rounded-[24px] border border-slate-200 bg-white p-5"><p className="text-[10px] font-black text-slate-400">PENDING</p><p className="mt-2 text-2xl font-black">{money(totals.pending)} IQD</p></div></div><section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7"><div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-black tracking-[0.18em] text-orange-600">PAYMENT INTENTS</p><h2 className="mt-1 text-xl font-black">دوایین پارەدانەکان</h2></div><button type="button" onClick={() => void load()} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">نوێکردنەوە</button></div><IntentTable items={intents} /></section><section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7"><div className="mb-4"><p className="text-[10px] font-black tracking-[0.18em] text-orange-600">COD RECONCILIATION</p><h2 className="mt-1 text-xl font-black">Cash collection</h2></div><CashTable items={cash} canManage={canManage} onReconciled={(item) => { setCash((current) => current.map((row) => row.id === item.id ? item : row)); setSuccess('cash collection بە سەرکەوتوویی reconcile کرا.'); }} /></section>{!canManage ? <p className="rounded-2xl bg-amber-50 p-4 text-xs font-bold leading-6 text-amber-800">تۆ payment ـەکانی خۆت دەتوانیت ببینیت. reconciliation ـی financial تەنها بۆ staff ـی ڕێگەپێدراوە.</p> : null}</main></AppShell>;
}
