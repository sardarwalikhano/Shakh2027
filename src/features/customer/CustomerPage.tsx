import { useEffect, useState } from "react";
import AppShell from "../../components/shell/AppShell";
import { BellRingIcon, ClipboardIcon, CoinIcon, GiftIcon, HeartFillIcon, SettingsIcon, ShareIcon, StarIcon, WalletIcon } from "./components/CustomerIcons";
import CustomerNav from "./components/CustomerNav";
import EmptyState from "./components/EmptyState";
import MetricCard from "./components/MetricCard";
import type { CustomerSection } from "./models";
import { supabase } from "../../lib/supabase";
import { CUSTOMER_SECTION_LABELS } from "./models";
import { listFavoriteProducts, toggleProductFavorite, type FavoriteProduct } from "../commerce/favoritesApi";
import { createProductReview, listReviewableItems, type ReviewableItem } from "../commerce/reviewsApi";
import { getOrderDetails, listCustomerOrders, type ManagedOrderSummary, type OrderDetail } from "../commerce/orderManagementApi";
import { getNotifications, markAllNotificationsRead, markNotificationRead, subscribeToNotifications, type NotificationRow } from "../notifications/notificationsApi";
import { useAuth } from "../auth/AuthContext";

function resolveSection(): CustomerSection {
  const value = window.location.hash.split("/")[1] as CustomerSection | undefined;
  return value && value in CUSTOMER_SECTION_LABELS ? value : "overview";
}

function SectionHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">{body}</p>
    </div>
  );
}

export default function CustomerPage() {
  const [active, setActive] = useState<CustomerSection>(resolveSection);

  useEffect(() => {
    const onHashChange = () => setActive(resolveSection());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <AppShell>
      <main dir="rtl" className="space-y-5">
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[var(--shakh-shadow-sm)]">
          <div className="relative px-5 pb-6 pt-6 sm:px-7 sm:pt-7 lg:px-8">
            <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(90deg,rgba(249,115,22,.10),rgba(249,115,22,0),rgba(15,118,110,.07))]" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">SHAKH CUSTOMER</p>
                <div className="mt-3 flex items-center gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-slate-950 text-lg font-black text-white">ش</div>
                  <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">بەخێربێیت بۆ ناو شوێنی کڕیار</h1>
                    <p className="mt-1 text-xs font-semibold text-slate-500">پڕۆفایل و هەموو چاڵاکییەکانت لە یەک شوێن.</p>
                  </div>
                </div>
              </div>
              <a href="#account/profile" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                <SettingsIcon className="h-4 w-4" />
                ڕێکخستنەکانی پڕۆفایل
              </a>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden self-start rounded-[28px] border border-slate-200 bg-white p-3 shadow-[var(--shakh-shadow-sm)] lg:block">
            <CustomerNav active={active} />
          </aside>

          <section className="min-w-0">
            {active === "overview" && <Overview />}
            {active === "orders" && <Orders />}
            {active === "wishlist" && <Wishlist />}
            {active === "reviews" && <Reviews />}
            {active === "notifications" && <Notifications />}
            {active === "wallet" && <Wallet />}
            {active === "points" && <Points />}
            {active === "referral" && <Referral />}
            {active === "profile" && <Profile />}
          </section>
        </div>

        <div className="overflow-x-auto pb-1 lg:hidden">
          <div className="flex min-w-max gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-[var(--shakh-shadow-sm)]">
            {(Object.keys(CUSTOMER_SECTION_LABELS) as CustomerSection[]).map((section) => (
              <a key={section} href={section === "overview" ? "#account" : `#account/${section}`} className={`rounded-xl px-3 py-2 text-xs font-black ${active === section ? "bg-orange-50 text-orange-700" : "text-slate-500"}`}>
                {CUSTOMER_SECTION_LABELS[section]}
              </a>
            ))}
          </div>
        </div>
      </main>
    </AppShell>
  );
}

function Overview() {
  const { profile } = useAuth();
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [favoriteCount, setFavoriteCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    Promise.all([listCustomerOrders(null, 100), listFavoriteProducts(100)])
      .then(([orders, favorites]) => {
        if (cancelled) return;
        setOrderCount(orders.length);
        setFavoriteCount(favorites.length);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "نەتوانرا KPI ـەکانی account باربکرێن.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const formatCount = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("ku-IQ").format(value);
  const formatMoney = (value: number | null | undefined) => value == null ? "— IQD" : new Intl.NumberFormat("ku-IQ", { maximumFractionDigits: 0 }).format(Number(value)) + " IQD";

  return (
    <div className="space-y-5">
      {loadError ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">{loadError}</div> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="ئۆردەرەکان" value={loading ? "…" : formatCount(orderCount)} detail="کۆی order ـەکانی account" Icon={ClipboardIcon} href="#account/orders" />
        <MetricCard label="دڵخوازەکان" value={loading ? "…" : formatCount(favoriteCount)} detail="کۆی بەرهەمە سەیڤکراوەکان" Icon={HeartFillIcon} href="#account/wishlist" />
        <MetricCard label="جزدان" value={formatMoney(profile?.wallet_balance_iqd)} detail="بڕی ڕاستەقینەی profile" Icon={WalletIcon} href="#account/wallet" />
        <MetricCard label="D_SH Points" value={formatCount(Number(profile?.d_sh_points ?? 0))} detail="خاڵی ئێستای account" Icon={CoinIcon} href="#account/points" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-6">
          <SectionHeader eyebrow="ACTIVITY" title="دوایین چاڵاکی" body="ئەم شوێنە بۆ order timeline، notification و activity feed ـی ڕاستەقینەی بەکارهێنەرە." />
          <EmptyState eyebrow="SUPABASE DATA" title="هێشتا چاڵاکییەکی تۆمارکراو نییە" body="کاتێک بەکارهێنەر بچێتە ژوورەوە و data ـی ڕاستەقینەی هەبێت، timeline ـەکە بە شێوەی خۆکار پڕ دەبێتەوە." actionHref="#market" actionLabel="بڕۆ بۆ بازار" />
        </div>

        <div className="rounded-[28px] bg-slate-950 p-5 text-white shadow-[var(--shakh-shadow-md)] sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">SHAKH BENEFITS</p>
          <h3 className="mt-2 text-xl font-black">سوودەکانت لە یەک شوێن</h3>
          <div className="mt-6 grid gap-3">
            <BenefitRow Icon={BellRingIcon} title="ئاگادارکردنەوەی ئۆردەر" detail="Status و delivery updates" />
            <BenefitRow Icon={GiftIcon} title="هاوبەشکردن" detail="Referral attribution ـی ڕاستەقینە" />
            <BenefitRow Icon={StarIcon} title="D_SH Points" detail="Rewards لەسەر purchase ـی پشتڕاستکراو" />
          </div>
        </div>
      </div>
    </div>
  );
}

function BenefitRow({ Icon, title, detail }: { Icon: typeof GiftIcon; title: string; detail: string }) {
  return <div className="flex items-center gap-3 rounded-2xl bg-white/7 px-3 py-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-orange-300"><Icon className="h-4 w-4" /></span><span className="min-w-0"><b className="block text-xs font-black">{title}</b><small className="mt-1 block text-[10px] font-semibold text-white/50">{detail}</small></span></div>;
}

function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending_payment: 'چاوەڕوانی پارەدان', placed: 'لە تۆمارکردن', confirmed: 'پشتڕاستکراوە',
    processing: 'ئامادە دەکرێت', ready_for_pickup: 'ئامادەی وەرگرتن', out_for_delivery: 'لە ڕێگادایە',
    delivered: 'گەیەنراوە', cancelled: 'هەڵوەشێنراوە', refunded: 'گەڕێندرایەوە',
  };
  return labels[status] ?? status;
}

function statusClass(status: string) {
  if (status === 'delivered') return 'bg-emerald-50 text-emerald-700';
  if (status === 'cancelled' || status === 'refunded') return 'bg-rose-50 text-rose-700';
  if (status === 'out_for_delivery') return 'bg-sky-50 text-sky-700';
  return 'bg-orange-50 text-orange-700';
}

function Orders() {
  const [orders, setOrders] = useState<ManagedOrderSummary[]>([]);
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try { setOrders(await listCustomerOrders(statusFilter || null)); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'نەتوانرا ئۆردەرەکان باربکرێن.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [statusFilter]);

  async function openOrder(orderId: string) {
    setDetailLoading(true); setError(null);
    try { setSelected(await getOrderDetails(orderId)); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'نەتوانرا وردەکاری ئۆردەر باربکرێت.'); }
    finally { setDetailLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader eyebrow="ORDERS" title="ئۆردەرەکانم" body="هەر ئۆردەرێک لە Supabase ـەوە دێت؛ کلیکی لەسەر بکە بۆ بینینی item، payment، timeline و delivery." />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black">
            <option value="">هەموو status</option><option value="pending_payment">چاوەڕوانی پارەدان</option><option value="placed">تۆمارکراو</option><option value="confirmed">پشتڕاستکراو</option><option value="processing">ئامادەکردن</option><option value="ready_for_pickup">ئامادەی وەرگرتن</option><option value="out_for_delivery">لە ڕێگا</option><option value="delivered">گەیەنراو</option><option value="cancelled">هەڵوەشێنراو</option>
          </select>
        </div>
        {error ? <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">{error}</div> : null}
        {loading ? <div className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">ئۆردەرەکان بار دەکرێن...</div> : null}
        {!loading && orders.length === 0 ? <EmptyState eyebrow="NO ORDERS" title="هێشتا هیچ ئۆردەرێکت نییە" body="لە کاتی یەکەم کڕینەوە، ئۆردەرەکانت لێرە بە timeline و status ـی ڕاستەقینە پیشان دەدرێن." actionHref="#market" actionLabel="دەستپێکردنی کڕین" /> : null}
        {!loading && orders.length > 0 ? <div className="mt-2 space-y-2">{orders.map((order) => <button key={order.id} type="button" onClick={() => void openOrder(order.id)} className="w-full rounded-2xl border border-slate-100 p-4 text-right transition hover:border-orange-200 hover:bg-orange-50/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-slate-950">{order.order_number}</p><p className="mt-1 text-xs font-semibold text-slate-400">{order.vendor_name_ckb || order.vendor_name_ar || order.vendor_name_en || 'SHAKH Store'} · {order.total_items} دانە</p><p className="mt-1 text-[10px] font-semibold text-slate-400">{new Intl.DateTimeFormat('ku-IQ').format(new Date(order.created_at))}</p></div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${statusClass(order.status)}`}>{orderStatusLabel(order.status)}</span><strong className="text-sm font-black text-slate-950">{new Intl.NumberFormat('ku-IQ').format(order.total_iqd)} د.ع</strong></div></div>
        </button>)}</div> : null}
      </div>

      {(detailLoading || selected) ? <OrderDetailPanel detail={selected} loading={detailLoading} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function OrderDetailPanel({ detail, loading, onClose }: { detail: OrderDetail | null; loading: boolean; onClose: () => void }) {
  if (loading || !detail) return <div className="rounded-[28px] border border-slate-200 bg-white p-7 text-center text-sm font-bold text-slate-500">وردەکاری ئۆردەر بار دەکرێت...</div>;
  const order = detail.order;
  return <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
    <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">ORDER DETAIL</p><h3 className="mt-1 text-2xl font-black text-slate-950">{order.order_number}</h3><p className="mt-1 text-xs font-semibold text-slate-400">{new Intl.DateTimeFormat('ku-IQ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.created_at))}</p></div><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black">داخستن</button></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black text-slate-400">Status</p><p className="mt-1 text-sm font-black">{orderStatusLabel(order.status)}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black text-slate-400">پارەدان</p><p className="mt-1 text-sm font-black">{order.payment_status}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black text-slate-400">کۆی گشتی</p><p className="mt-1 text-sm font-black">{new Intl.NumberFormat('ku-IQ').format(order.total_iqd)} د.ع</p></div></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_.8fr]">
      <div><h4 className="text-sm font-black text-slate-950">دانەکانی ئۆردەر</h4><div className="mt-3 space-y-2">{detail.items.map((item) => <div key={item.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black">{item.product_name_ckb || item.product_name_ar || item.product_name_en}</p><span className="text-[10px] font-black text-slate-400">×{item.quantity}</span></div><div className="mt-2 flex items-center justify-between text-[10px] font-bold text-slate-500"><span>{item.variant_label_ckb || item.variant_label_ar || item.variant_label_en}</span><strong className="text-slate-800">{new Intl.NumberFormat('ku-IQ').format(item.line_total_iqd)} د.ع</strong></div></div>)}</div></div>
      <div><h4 className="text-sm font-black text-slate-950">شوێنی گەیاندن</h4><div className="mt-3 rounded-2xl bg-slate-50 p-4 text-xs font-semibold leading-7 text-slate-600"><p className="font-black text-slate-900">{order.shipping_recipient_name}</p><p>{order.shipping_phone}</p><p>{order.shipping_city}، {order.shipping_district}</p><p>{order.shipping_street}</p>{order.shipping_landmark ? <p>{order.shipping_landmark}</p> : null}</div>{detail.delivery ? <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50 p-4"><p className="text-[10px] font-black text-sky-700">DELIVERY</p><p className="mt-1 text-sm font-black text-slate-900">{orderStatusLabel(detail.delivery.status === 'out_for_delivery' ? 'out_for_delivery' : detail.delivery.status)}</p>{detail.delivery.estimated_minutes ? <p className="mt-1 text-[10px] font-bold text-slate-500">نزیکەی {detail.delivery.estimated_minutes} خولەک</p> : null}{['assigned','accepted','at_pickup','picked_up','out_for_delivery'].includes(detail.delivery.status) ? <a href={`#tracking:${order.id}`} className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-slate-950 px-4 text-[10px] font-black text-white">شوێنکەوتنی ئۆردەر</a> : null}</div> : null}</div>
    </div>
    <div className="mt-5"><h4 className="text-sm font-black text-slate-950">Timeline</h4><div className="mt-3 grid gap-2">{detail.status_history.map((event) => <div key={event.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-4 py-3"><div><p className="text-xs font-black">{orderStatusLabel(event.status)}</p>{event.note ? <p className="mt-1 text-[10px] font-semibold text-slate-500">{event.note}</p> : null}</div><time className="text-[10px] font-bold text-slate-400">{new Intl.DateTimeFormat('ku-IQ', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(event.created_at))}</time></div>)}</div></div>
  </div>;
}

function Wishlist() {
  const [items, setItems] = useState<FavoriteProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await listFavoriteProducts());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "نەتوانرا دڵخوازەکان باربکرێن.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function remove(productId: string) {
    try {
      await toggleProductFavorite(productId);
      setItems((current) => current.filter((item) => item.id !== productId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "نەتوانرا لە دڵخوازەکان بسڕدرێتەوە.");
    }
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
      <SectionHeader eyebrow="WISHLIST" title="دڵخوازەکانم" body="ئەم لیستە لە Supabase ـەوە دێت و هەر گۆڕانکارییەک بۆ account ـەکەت تەنها لە backend ـدا تۆمار دەکرێت." />
      {error ? <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">{error}</div> : null}
      {loading ? <div className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">دڵخوازەکان بار دەکرێن...</div> : null}
      {!loading && items.length === 0 ? <EmptyState eyebrow="NO SAVED ITEMS" title="هێشتا هیچ بەرهەمێک سەیڤ نەکراوە" body="لە بازاردا لەسەر دڵی بەرهەمێک کرتە بکە بۆ زیادکردنی بۆ دڵخوازەکان." actionHref="#market" actionLabel="گەڕان لە بازار" /> : null}
      {!loading && items.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-black text-slate-950">{item.name_ckb || item.name_ar || item.name_en}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{item.vendor_name_ckb || item.vendor_name_ar || item.vendor_name_en}</p>
                </div>
                <button type="button" onClick={() => void remove(item.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-orange-600" aria-label="لابردن لە دڵخوازەکان">♥</button>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div><p className="text-sm font-black">{new Intl.NumberFormat("ku-IQ").format(item.base_price_iqd)} د.ع</p>{item.compare_at_iqd && item.compare_at_iqd > item.base_price_iqd ? <p className="text-[10px] text-slate-400 line-through">{new Intl.NumberFormat("ku-IQ").format(item.compare_at_iqd)} د.ع</p> : null}</div>
                <span className="text-xs font-black text-amber-600">{item.rating ? `★ ${item.rating.toFixed(1)}` : "نوێ"}</span>
              </div>
              <a href="#market" className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-slate-950 px-3 text-xs font-black text-white">بینین لە بازار</a>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Reviews() {
  const [items, setItems] = useState<ReviewableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, { rating: number; title: string; body: string }>>({});

  useEffect(() => {
    let cancelled = false;
    listReviewableItems().then((next) => { if (!cancelled) setItems(next); }).catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "نەتوانرا بەرهەمە پێشنیارکراوەکان باربکرێن."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function submit(item: ReviewableItem) {
    const values = form[item.product_id] ?? { rating: 5, title: "", body: "" };
    setSubmitting(item.product_id);
    setError(null);
    try {
      await createProductReview({ productId: item.product_id, orderId: item.order_id, rating: values.rating, title: values.title, body: values.body });
      setItems((current) => current.filter((row) => row.product_id !== item.product_id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "نەتوانرا هەڵسەنگاندن تۆمار بکرێت.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
      <SectionHeader eyebrow="REVIEWS" title="هەڵسەنگاندنەکانی من" body="تەنها بەرهەمێک هەڵسەنگێنە کە لە order ـێکی گەیەنراودا کڕیوتە؛ ئەمە verified purchase ـە." />
      {error ? <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">{error}</div> : null}
      {loading ? <div className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">بەرهەمەکانی هەڵسەنگاندن بار دەکرێن...</div> : null}
      {!loading && items.length === 0 ? <EmptyState eyebrow="ALL CAUGHT UP" title="هیچ بەرهەمێک بۆ هەڵسەنگاندن نییە" body="کاتێک order ـێکت بە سەرکەوتوویی بگەیەنرێت، لێرە بۆ تۆمارکردنی هەڵسەنگاندن دەردەکەوێت." actionHref="#account/orders" actionLabel="بینینی ئۆردەرەکانم" /> : null}
      {!loading && items.length > 0 ? <div className="space-y-3">{items.map((item) => {
        const values = form[item.product_id] ?? { rating: 5, title: "", body: "" };
        return <article key={`${item.order_id}:${item.product_id}`} className="rounded-[24px] border border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-sm font-black text-slate-950">{item.product_name_ckb || item.product_name_ar || item.product_name_en}</p><p className="mt-1 text-[11px] font-bold text-slate-400">ئۆردەر {item.order_number}</p></div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">کڕینی پشتڕاستکراو</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-1">{[1,2,3,4,5].map((star) => <button key={star} type="button" onClick={() => setForm((current) => ({ ...current, [item.product_id]: { ...values, rating: star } }))} className={`text-2xl ${values.rating >= star ? "text-amber-500" : "text-slate-200"}`} aria-label={`${star} ستێرە`}>★</button>)}</div>
          <input value={values.title} onChange={(e) => setForm((current) => ({ ...current, [item.product_id]: { ...values, title: e.target.value } }))} maxLength={120} placeholder="سەردێڕی کورت (ئاختیاری)" className="mt-3 min-h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-orange-400" />
          <textarea value={values.body} onChange={(e) => setForm((current) => ({ ...current, [item.product_id]: { ...values, body: e.target.value } }))} maxLength={3000} rows={4} placeholder="بۆچی ئەم بەرهەمەت بە دڵ بوو؟" className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold leading-7 outline-none focus:border-orange-400" />
          <button type="button" disabled={submitting === item.product_id} onClick={() => void submit(item)} className="mt-3 min-h-11 rounded-2xl bg-slate-950 px-5 text-xs font-black text-white disabled:opacity-50">{submitting === item.product_id ? "تۆمار دەکرێت..." : "ناردنی هەڵسەنگاندن"}</button>
        </article>;
      })}</div> : null}
    </div>
  );
}

function notificationCategoryLabel(category: NotificationRow["category"]) {
  const labels: Record<NotificationRow["category"], string> = {
    order: "ئۆردەر",
    payment: "پارەدان",
    delivery: "گەیاندن",
    support: "پشتیوانی",
    security: "ئاسایش",
    marketing: "مارکێتینگ",
    system: "سیستەم",
  };
  return labels[category];
}

function notificationPriorityClass(priority: NotificationRow["priority"]) {
  if (priority === "urgent") return "bg-rose-50 text-rose-700";
  if (priority === "high") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getNotifications().then((next) => {
      if (!cancelled) setItems(next);
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "نەتوانرا ئاگادارکردنەوەکان باربکرێن.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    const channel = subscribeToNotifications(user.id, (row) => {
      setItems((current) => [row, ...current.filter((item) => item.id !== row.id)].slice(0, 50));
    });

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, [user]);

  async function read(id: string) {
    try {
      await markNotificationRead(id);
      setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "نەتوانرا ئاگادارکردنەوەکە خوێندراوە نیشان بدرێت.");
    }
  }

  async function readAll() {
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "نەتوانرا هەموو ئاگادارکردنەوەکان خوێندراوە بکرێن.");
    }
  }

  async function openNotification(item: NotificationRow) {
    await read(item.id);
    if (item.action_hash) window.location.hash = item.action_hash;
  }

  const unread = items.filter((item) => !item.read_at).length;

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeader eyebrow="NOTIFICATIONS" title="ئاگادارکردنەوەکان" body="Order updates، promotion alerts، support events و security notices لێرە لە Supabase ـەوە کۆدەکرێنەوە." />
        {unread > 0 ? <button type="button" onClick={() => void readAll()} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700 transition hover:border-orange-200 hover:bg-orange-50">هەمووی خوێندراوە</button> : null}
      </div>

      {error ? <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">{error}</div> : null}
      {loading ? <div className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">ئاگادارکردنەوەکان بار دەکرێن...</div> : null}

      {!loading && items.length === 0 ? (
        <EmptyState eyebrow="NO NOTIFICATIONS" title="ئاگادارکردنەوەی نوێ نییە" body="کاتێک event ـێکی پەیوەندیدار بۆ account ـەکەت ڕووبدات، لێرە بە شێوەی realtime دەردەکەوێت." />
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void openNotification(item)}
              className={`w-full rounded-2xl border p-4 text-right transition hover:border-orange-200 hover:bg-orange-50/40 ${item.read_at ? "border-slate-100 bg-white" : "border-orange-100 bg-orange-50/25"}`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 rounded-full px-2.5 py-1 text-[9px] font-black ${notificationPriorityClass(item.priority)}`}>{item.priority}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-black text-slate-950">{item.title_ckb || item.title_ar || item.title_en}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[8px] font-black text-slate-500">{notificationCategoryLabel(item.category)}</span>
                    {!item.read_at ? <span className="h-2 w-2 rounded-full bg-orange-500" aria-label="نوێ" /> : null}
                  </div>
                  {item.body_ckb || item.body_ar || item.body_en ? <p className="mt-2 text-[11px] font-semibold leading-6 text-slate-500">{item.body_ckb || item.body_ar || item.body_en}</p> : null}
                  <p className="mt-2 text-[9px] font-bold text-slate-400">{new Intl.DateTimeFormat("ku-IQ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Wallet() {
  const { profile } = useAuth();
  return <div className="space-y-5"><div className="rounded-[30px] bg-slate-950 p-6 text-white shadow-[var(--shakh-shadow-md)] sm:p-8"><div className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">SHAKH WALLET</p><p className="mt-3 text-sm font-bold text-white/60">بەڵانسی ئێستات</p><p className="mt-1 text-4xl font-black tracking-tight">{Number(profile?.wallet_balance_iqd ?? 0).toLocaleString("ku-IQ")} <span className="text-lg font-extrabold text-white/50">IQD</span></p></div><a href="#finance" className="mb-2 inline-flex w-fit items-center rounded-xl bg-white/10 px-3 py-2 text-[10px] font-black text-white/80 ring-1 ring-white/10 transition hover:bg-white/15 sm:absolute sm:left-8 sm:top-8">بەڕێوەبردنی wallet</a>
          <div className="grid grid-cols-2 gap-2 sm:min-w-[260px]"><div className="rounded-2xl bg-white/8 p-3"><p className="text-[10px] text-white/45">کۆی deposit</p><p className="mt-1 text-sm font-black">— IQD</p></div><div className="rounded-2xl bg-white/8 p-3"><p className="text-[10px] text-white/45">کۆی withdrawal</p><p className="mt-1 text-sm font-black">— IQD</p></div></div></div></div><EmptyState eyebrow="WALLET LEDGER" title="هێشتا transaction ـێک نییە" body="ledger ـی جزدان دواتر لە Supabase پڕ دەکرێتەوە و هەر transaction ـێک بە reference و audit trail دەردەکەوێت." /></div>;
}

function Points() {
  const { profile } = useAuth();
  const points = Number(profile?.d_sh_points ?? 0);

  return <div className="space-y-5">
    <div className="rounded-[28px] border border-orange-100 bg-orange-50 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-700">D_SH POINTS</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">{new Intl.NumberFormat("ku-IQ").format(points)} Points</h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-slate-600">بڕی خاڵەکەت لە profile ـی ڕاستەقینەی Supabase ـەوە خوێندراوەتەوە. خاڵە نوێکان لە purchase ـی پشتڕاستکراو، promotion یان referral rewards ـەوە دەتوانرێن زیاد بن.</p>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-orange-600 shadow-sm"><CoinIcon className="h-5 w-5" /></span>
      </div>
    </div>
    <EmptyState eyebrow="REWARDS HISTORY" title="هێشتا history ـی خاڵ نییە" body="بڕی سەرەکیی خاڵ لە backend ـەوە دەهێنرێت؛ ledger ـی وردی reward دواتر لە notification/reward transactions ـەوە پڕ دەکرێتەوە." />
  </div>;
}

function Referral() {
  return <div className="space-y-5"><div className="overflow-hidden rounded-[30px] bg-gradient-to-br from-orange-500 to-orange-600 p-6 text-white shadow-[var(--shakh-shadow-md)] sm:p-8"><div className="max-w-2xl"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-100">REFERRAL & SHARE</p><h2 className="mt-2 text-3xl font-black">بە هاوبەشکردن، growth ـی خۆت دروست بکە.</h2><p className="mt-3 max-w-xl text-sm leading-7 text-white/80">هەر بەکارهێنەرێک کە لینکە تایبەتەکەی خۆی بەکاربهێنێت، attribution ـەکە بە شێوەی server-side تۆمار دەکرێت و self-referral guard جێبەجێ دەبێت.</p><div className="mt-6 flex flex-wrap gap-2"><button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-orange-700 shadow-sm" onClick={async () => { if (navigator.share) await navigator.share({ title: "SHAKH", text: "SHAKH marketplace", url: window.location.href }); }}><ShareIcon className="h-4 w-4" /> هاوبەشکردن</button><a href="#account/points" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-black/15 px-4 text-xs font-black text-white ring-1 ring-white/15">بینینی rewards</a></div></div></div><EmptyState eyebrow="REFERRAL LINK" title="لینکی تایبەتی لە backend ـەوە دروست دەبێت" body="هیچ referral code ـی ساختە لەم قۆناغەدا نادەین؛ لە Phase ـی Growth ـدا link ID، click attribution، purchase attribution و anti-fraud logic بە Supabase زیاد دەکرێن." /></div>;
}

function Profile() {
  const { user, profile } = useAuth();
  const languageLabel: Record<"ckb" | "ar" | "en", string> = {
    ckb: "کوردی — RTL",
    ar: "العربية — RTL",
    en: "English — LTR",
  };

  return <div className="space-y-5">
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
      <SectionHeader eyebrow="PROFILE" title="پڕۆفایلی من" body="زانیاریی account لە AuthContext و profiles ـی Supabase ـەوە دێت؛ هیچ city/phone/name ـێکی hardcoded نییە." />
      <div className="grid gap-3 sm:grid-cols-2">
        <ProfileRow label="ناوی تەواو" value={profile?.full_name || "ناوی تۆمارکراو نییە"} />
        <ProfileRow label="ئیمەیڵ" value={user?.email || "—"} />
        <ProfileRow label="ژمارەی مۆبایل" value={profile?.phone || "تۆمار نەکراوە"} />
        <ProfileRow label="زمان" value={languageLabel[profile?.preferred_language ?? "ckb"]} />
        <ProfileRow label="شار" value={profile?.city || "دیاری نەکراوە"} />
        <ProfileRow label="D_SH Points" value={new Intl.NumberFormat("ku-IQ").format(Number(profile?.d_sh_points ?? 0))} />
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <a href="#account/notifications" className="rounded-[24px] border border-slate-200 bg-white p-5 text-right shadow-[var(--shakh-shadow-sm)] transition hover:border-slate-300"><BellRingIcon className="h-5 w-5 text-orange-600" /><p className="mt-4 text-sm font-black">پەیام و ئاگادارکردنەوە</p><p className="mt-2 text-xs leading-6 text-slate-500">کۆنترۆڵی notification preferences و message center.</p></a>
      <a href="#account/referral" className="rounded-[24px] border border-slate-200 bg-white p-5 text-right shadow-[var(--shakh-shadow-sm)] transition hover:border-slate-300"><GiftIcon className="h-5 w-5 text-orange-600" /><p className="mt-4 text-sm font-black">Referral center</p><p className="mt-2 text-xs leading-6 text-slate-500">لینک و rewards لە یەک شوێن.</p></a>
    </div>
  </div>;
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 px-4 py-4"><p className="text-[10px] font-black text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-slate-800">{value}</p></div>;
}
