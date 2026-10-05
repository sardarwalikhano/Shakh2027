import { useEffect, useState } from 'react';
import AppShell from '../../components/shell/AppShell';
import { supabase } from '../../lib/supabase';

function formatIqd(value: number) {
  return `${new Intl.NumberFormat('ku-IQ').format(value)} د.ع`;
}

export default function OrdersSummary() {
  const [orders, setOrders] = useState<Array<{ id: string; order_number: string; status: string; total_iqd: number; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('orders')
      .select('id,order_number,status,total_iqd,created_at')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) setError(queryError.message);
        setOrders((data ?? []) as typeof orders);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <AppShell>
      <main dir="rtl" className="space-y-5">
        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shakh-shadow-sm)] sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">REAL ORDERS</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">ئۆردەرە ڕاستەقینەکانت</h1>
          <p className="mt-2 text-sm leading-7 text-slate-500">ئەم لیستە بە ڕاستەوخۆ لە Supabase ـەوە دێت و status history ـی دواتر لێرە پەیوەست دەکرێت.</p>
        </section>

        {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</div> : null}
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[var(--shakh-shadow-sm)]">
          {loading ? <div className="p-8 text-center text-sm font-bold text-slate-500">ئۆردەرەکان بار دەکرێن...</div> : null}
          {!loading && orders.length === 0 ? <div className="p-10 text-center text-sm font-bold text-slate-500">هێشتا ئۆردەرێک نییە.</div> : null}
          {!loading && orders.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {orders.map((order) => (
                <article key={order.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-950">{order.order_number}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{new Intl.DateTimeFormat('ku-IQ').format(new Date(order.created_at))}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="rounded-full bg-orange-50 px-3 py-1 text-[11px] font-black text-orange-700">{order.status}</span>
                    <strong className="text-sm font-black text-slate-950">{formatIqd(Number(order.total_iqd))}</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </AppShell>
  );
}
