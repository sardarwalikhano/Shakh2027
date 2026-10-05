import { useEffect, useState } from 'react';
import AppShell from '../../components/shell/AppShell';
import { InlineError, LoadingState } from '../../components/ux/UiStates';
import { getAnalyticsOverview, type AnalyticsOverview } from '../commerce/analyticsApi';

const money = (value: number) => new Intl.NumberFormat('ku-IQ', { maximumFractionDigits: 0 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat('ku-IQ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)]"><p className="text-[10px] font-black tracking-[0.16em] text-slate-400">{label}</p><p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p><p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">{hint}</p></div>;
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setData(await getAnalyticsOverview(days)); }
    catch (err) { setError(err instanceof Error ? err.message : 'analytics_load_failed'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [days]);

  return <AppShell><main dir="rtl" className="space-y-5">
    <section className="rounded-[30px] bg-slate-950 p-6 text-white shadow-[var(--shakh-shadow-md)] sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[10px] font-black tracking-[0.18em] text-orange-300">ANALYTICS CENTER</p><h1 className="mt-2 text-3xl font-black tracking-tight">ئەنالیتیکسی ڕاستەقینەی SHAKH</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">event ـەکان لە Supabase کۆدەکرێنەوە و conversion ـەکان لە server aggregation ـەوە هەژمار دەکرێن.</p></div>
        <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">{[7,30,90].map((value)=><button key={value} type="button" onClick={()=>setDays(value)} className={`rounded-xl px-4 py-2 text-xs font-black ${days===value?'bg-white text-slate-950':'text-white/60 hover:bg-white/10'}`}>{value} ڕۆژ</button>)}</div>
      </div>
    </section>
    {error && <InlineError title="Analytics بار نەکرا" body={error} />}
    {loading && !data ? <LoadingState label="ئەنالیتیکس بار دەکرێت..." /> : null}
    {data ? <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="EVENTS" value={money(data.events)} hint={`${data.unique_users} unique users`} />
        <Metric label="PRODUCT VIEWS" value={money(data.product_views)} hint="product_view" />
        <Metric label="ADD TO CART" value={money(data.add_to_cart)} hint={`${data.conversion.view_to_cart_pct}% view → cart`} />
        <Metric label="PAID REVENUE" value={`${money(data.paid_revenue_iqd)} د.ع`} hint={`لە ${data.days} ڕۆژی دوا`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="CHECKOUT" value={money(data.checkout_started)} hint={`${data.conversion.cart_to_checkout_pct}% cart → checkout`} />
        <Metric label="ORDERS" value={money(data.order_created)} hint={`${data.conversion.checkout_to_order_pct}% checkout → order`} />
        <Metric label="DELIVERED" value={money(data.order_delivered)} hint="server order event" />
        <Metric label="PAYMENTS" value={money(data.payment_succeeded)} hint={`${data.conversion.order_to_paid_pct}% order → paid`} />
        <Metric label="COUPONS" value={money(data.coupon_redeemed)} hint="redemption events" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_.75fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
          <div className="flex items-end justify-between"><div><p className="text-[10px] font-black tracking-[0.18em] text-orange-600">CONVERSION</p><h2 className="mt-1 text-xl font-black text-slate-950">فانڵی کڕین</h2></div><span className="text-[10px] font-bold text-slate-400">{date(data.generated_at)}</span></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">{[
            ['View → Cart', data.conversion.view_to_cart_pct], ['Cart → Checkout', data.conversion.cart_to_checkout_pct], ['Checkout → Order', data.conversion.checkout_to_order_pct], ['Order → Paid', data.conversion.order_to_paid_pct],
          ].map(([label,value])=><div key={String(label)} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-700">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{Number(value).toFixed(2)}%</p></div>)}</div>
        </section>
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
          <p className="text-[10px] font-black tracking-[0.18em] text-orange-600">TOP EVENTS</p><h2 className="mt-1 text-xl font-black text-slate-950">چالاکترین event ـەکان</h2>
          <div className="mt-5 space-y-2">{data.top_events.length ? data.top_events.map((event)=><div key={event.event_name} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span className="font-mono text-[11px] text-slate-600">{event.event_name}</span><b className="text-sm text-slate-950">{money(event.count)}</b></div>) : <p className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">هێشتا event ـی تۆمارکراو نییە.</p>}</div>
        </section>
      </div>
    </> : null}
  </main></AppShell>;
}
