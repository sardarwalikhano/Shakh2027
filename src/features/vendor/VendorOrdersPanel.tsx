import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { ManagedOrderSummary } from '../commerce/orderManagementApi';
import { listVendorOrders, updateVendorOrderStatus } from './vendorApi';

const money = (value: number) => new Intl.NumberFormat('ku-IQ').format(value);

const statusLabels: Record<string, string> = {
  pending_payment: 'چاوەڕوانی پارەدان', placed: 'نوێ', confirmed: 'پشتڕاستکراو', processing: 'ئامادەکردن',
  ready_for_pickup: 'ئامادەی وەرگرتن', out_for_delivery: 'لە ڕێگا', delivered: 'گەیەنراو', cancelled: 'هەڵوەشێنراو', refunded: 'گەڕێندرایەوە',
};

const nextActions: Record<string, Array<{ status: 'confirmed' | 'processing' | 'ready_for_pickup' | 'cancelled'; label: string }>> = {
  placed: [{ status: 'confirmed', label: 'پشتڕاستکردنەوە' }, { status: 'cancelled', label: 'هەڵوەشاندنەوە' }],
  confirmed: [{ status: 'processing', label: 'دەستپێکردنی ئامادەکردن' }, { status: 'cancelled', label: 'هەڵوەشاندنەوە' }],
  processing: [{ status: 'ready_for_pickup', label: 'ئامادەی وەرگرتن' }, { status: 'cancelled', label: 'هەڵوەشاندنەوە' }],
};

function statusTone(status: string) {
  if (status === 'delivered') return 'bg-emerald-50 text-emerald-700';
  if (status === 'cancelled' || status === 'refunded') return 'bg-rose-50 text-rose-700';
  if (status === 'out_for_delivery') return 'bg-sky-50 text-sky-700';
  return 'bg-orange-50 text-orange-700';
}

export default function VendorOrdersPanel({ vendorId }: { vendorId: string }) {
  const [orders, setOrders] = useState<ManagedOrderSummary[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try { setOrders(await listVendorOrders(vendorId, status || null)); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'نەتوانرا ئۆردەرەکانی ستۆر باربکرێن.'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!vendorId) return;

    void load();

    const channel = supabase
      .channel(`vendor-orders:${vendorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendorId}` }, () => {
        void load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_assignments' }, () => {
        void load();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [vendorId, status]);

  async function change(orderId: string, nextStatus: 'confirmed' | 'processing' | 'ready_for_pickup' | 'cancelled') {
    setBusy(orderId); setError(null);
    try {
      await updateVendorOrderStatus(orderId, nextStatus);
      setOrders((rows) => rows.map((row) => row.id === orderId ? { ...row, status: nextStatus } : row));
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'نەتوانرا status ـی ئۆردەر بگۆڕدرێت.'); }
    finally { setBusy(null); }
  }

  return <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-600">FULFILLMENT</p><h2 className="mt-1 text-xl font-black text-slate-950">ئۆردەرەکانی ستۆر</h2><p className="mt-2 text-xs leading-6 text-slate-500">نوێ → پشتڕاست → ئامادەکردن → ئامادەی وەرگرتن. Delivery status لە Captain flow ـەوە بەردەوام دەبێت.</p></div>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black"><option value="">هەموو ئۆردەرەکان</option><option value="placed">نوێ</option><option value="confirmed">پشتڕاستکراو</option><option value="processing">ئامادەکردن</option><option value="ready_for_pickup">ئامادەی وەرگرتن</option><option value="out_for_delivery">لە ڕێگا</option><option value="delivered">گەیەنراو</option><option value="cancelled">هەڵوەشێنراو</option></select>
    </div>
    {error ? <div role="alert" className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">{error}</div> : null}
    {loading ? <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">ئۆردەرەکان بار دەکرێن...</div> : null}
    {!loading && orders.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-9 text-center text-sm font-bold text-slate-500">هێشتا ئۆردەرێکی ئەم ستۆرە نییە.</div> : null}
    {!loading && orders.length > 0 ? <div className="mt-5 space-y-2">{orders.map((order) => {
      const actions = nextActions[order.status] ?? [];
      return <article key={order.id} className="rounded-2xl border border-slate-100 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black text-slate-950">{order.order_number}</p><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${statusTone(order.status)}`}>{statusLabels[order.status] ?? order.status}</span></div><p className="mt-2 text-xs font-black text-slate-800">{order.buyer_name || 'کڕیار'} <span className="font-semibold text-slate-400">· {order.total_items} دانە</span></p><p className="mt-1 text-[10px] font-semibold text-slate-400">{order.shipping_city}، {order.shipping_district} · {order.shipping_phone}</p></div>
          <div className="flex flex-wrap items-center gap-2"><strong className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-black">{money(order.total_iqd)} د.ع</strong>{actions.map((action) => <button key={action.status} disabled={busy === order.id} type="button" onClick={() => void change(order.id, action.status)} className={`rounded-xl px-3 py-2 text-[10px] font-black ${action.status === 'cancelled' ? 'border border-rose-200 text-rose-700' : 'bg-slate-950 text-white'} disabled:opacity-50`}>{busy === order.id ? '...' : action.label}</button>)}</div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4"><Mini label="پارەدان" value={order.payment_status} /><Mini label="کۆی کاڵا" value={`${order.item_count} item`} /><Mini label="Delivery" value={order.delivery?.status ?? 'نەدۆزرایەوە'} /><Mini label="کات" value={new Intl.DateTimeFormat('ku-IQ', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(order.created_at))} /></div>
      </article>;
    })}</div> : null}
  </section>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[9px] font-black text-slate-400">{label}</p><p className="mt-1 truncate text-[10px] font-black text-slate-700">{value}</p></div>;
}
