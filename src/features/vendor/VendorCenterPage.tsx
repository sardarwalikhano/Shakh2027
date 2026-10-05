import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AppShell from '../../components/shell/AppShell';
import { LoadingState } from '../../components/ux/UiStates';
import { useAuth } from '../auth/AuthContext';
import { getActiveCategories, type CatalogCategory } from '../commerce/catalogApi';
import VendorOrdersPanel from './VendorOrdersPanel';
import {
  createVendorProduct,
  getVendorCenterSnapshot,
  listVendorProducts,
  setVendorProductStatus,
  updateVendorInventory,
  type VendorCenterSnapshot,
  type VendorProduct,
} from './vendorApi';

const money = (value: number) => new Intl.NumberFormat('ku-IQ').format(value);
const vendorName = (vendor: VendorCenterSnapshot['vendor']) => vendor ? (vendor.name_ckb || vendor.name_ar || vendor.name_en) : '';

const initialForm = {
  slug: '', nameCkb: '', nameAr: '', nameEn: '', basePriceIqd: '', quantity: '0', lowStockThreshold: '5', categoryId: '', descriptionCkb: '', descriptionAr: '', descriptionEn: '', status: 'draft' as 'draft' | 'active',
};

export default function VendorCenterPage() {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<VendorCenterSnapshot | null>(null);
  const [vendorId, setVendorId] = useState('');
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);

  async function load(vId: string) {
    setLoading(true); setError(null);
    try {
      const [next, cats] = await Promise.all([getVendorCenterSnapshot(vId || null), getActiveCategories()]);
      setSnapshot(next); setCategories(cats);
      const selected = vId || next.vendor?.id || next.vendors[0]?.id || '';
      setVendorId(selected);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'نەتوانرا Vendor Center باربکرێت.');
    } finally { setLoading(false); }
  }

  useEffect(() => { if (user) void load(vendorId || ''); }, [user]);

  useEffect(() => {
    if (!vendorId) { setProducts([]); return; }
    let cancelled = false;
    setProductsLoading(true);
    listVendorProducts(vendorId, statusFilter || null)
      .then((rows) => { if (!cancelled) setProducts(rows); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'نەتوانرا بەرهەمەکانی ستۆر باربکرێن.'); })
      .finally(() => { if (!cancelled) setProductsLoading(false); });
    return () => { cancelled = true; };
  }, [vendorId, statusFilter]);

  const selectedVendor = useMemo(() => snapshot?.vendors.find((v) => v.id === vendorId) ?? snapshot?.vendors[0], [snapshot, vendorId]);

  async function submitProduct(event: FormEvent) {
    event.preventDefault();
    if (!vendorId) return;
    setSaving(true); setMessage(null); setError(null);
    try {
      await createVendorProduct({
        vendorId, slug: form.slug.trim(), nameCkb: form.nameCkb.trim(), nameAr: form.nameAr.trim(), nameEn: form.nameEn.trim(),
        basePriceIqd: Number(form.basePriceIqd), categoryId: form.categoryId || null,
        descriptionCkb: form.descriptionCkb, descriptionAr: form.descriptionAr, descriptionEn: form.descriptionEn,
        quantity: Math.max(0, Number(form.quantity)), lowStockThreshold: Math.max(0, Number(form.lowStockThreshold)), status: form.status,
      });
      setForm(initialForm); setMessage('بەرهەمەکە بە سەرکەوتوویی دروست کرا.');
      await load(vendorId);
      const rows = await listVendorProducts(vendorId, statusFilter || null); setProducts(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'نەتوانرا بەرهەم دروست بکرێت.');
    } finally { setSaving(false); }
  }

  async function changeStock(product: VendorProduct, nextQuantity: number) {
    if (!product.primary_variant) return;
    setError(null); setMessage(null);
    try {
      await updateVendorInventory(product.primary_variant.id, Math.max(product.primary_variant.reserved_quantity, nextQuantity), product.primary_variant.low_stock_threshold);
      setMessage('Stock نوێکرایەوە.');
      setProducts((rows) => rows.map((row) => row.id === product.id && row.primary_variant ? ({ ...row, is_in_stock: nextQuantity - row.primary_variant.reserved_quantity > 0, primary_variant: { ...row.primary_variant, quantity: Math.max(row.primary_variant.reserved_quantity, nextQuantity), available_quantity: Math.max(0, nextQuantity - row.primary_variant.reserved_quantity) } }) : row));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'نەتوانرا stock نوێ بکرێتەوە.');
    }
  }

  async function changeStatus(product: VendorProduct) {
    const next = product.status === 'active' ? 'draft' : 'active';
    setError(null); setMessage(null);
    try {
      await setVendorProductStatus(product.id, next);
      setProducts((rows) => rows.map((row) => row.id === product.id ? { ...row, status: next } : row));
      setMessage(next === 'active' ? 'بەرهەمەکە بڵاوکرایەوە.' : 'بەرهەمەکە خراوەتە draft.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'نەتوانرا status ـی بەرهەم بگۆڕدرێت.');
    }
  }

  if (loading && !snapshot) return <AppShell><LoadingState label="Vendor Center بار دەکرێت..." /></AppShell>;

  return <AppShell><main dir="rtl" className="space-y-5">
    <section className="rounded-[30px] bg-slate-950 p-6 text-white shadow-[var(--shakh-shadow-md)] sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">SHAKH VENDOR CENTER</p><h1 className="mt-2 text-3xl font-black">کاتەلۆگ و stock ـی ستۆرەکەت لە یەک شوێن.</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">هەموو گۆڕانکارییە سەرەکییەکان لە Supabase RPC ـەوە دەچن و RLS/permission ـەکان لە backend کۆنترۆڵ دەکرێن.</p></div>
        <div className="flex flex-wrap gap-2">{snapshot?.vendors.map((v) => <button key={v.id} type="button" onClick={() => { setVendorId(v.id); setStatusFilter(''); }} className={`rounded-2xl px-4 py-2.5 text-xs font-black ring-1 transition ${v.id === vendorId ? 'bg-white text-slate-950 ring-white' : 'bg-white/10 text-white ring-white/10'}`}>{v.name_ckb || v.name_ar || v.name_en}</button>)}</div>
      </div>
    </section>

    {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div> : null}
    {message ? <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</div> : null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ['هەموو بەرهەم', snapshot?.stats.products ?? 0, 'کاتەلۆگی ستۆر'],
        ['چالاک', snapshot?.stats.active_products ?? 0, 'لە بازاردا'],
        ['Low stock', snapshot?.stats.low_stock ?? 0, 'پێویستی پڕکردنەوە'],
        ['Out of stock', snapshot?.stats.out_of_stock ?? 0, 'نەماوە'],
      ].map(([label, value, detail]) => <div key={String(label)} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)]"><p className="text-[10px] font-black text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p></div>)}
    </section>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-600">PRODUCTS</p><h2 className="mt-1 text-xl font-black text-slate-950">بەرهەمەکانی {vendorName(snapshot?.vendor)}</h2></div><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black"><option value="">هەموو status</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select></div>
        {productsLoading ? <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">بەرهەمەکان بار دەکرێن...</div> : null}
        {!productsLoading && products.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-10 text-center"><p className="text-sm font-black text-slate-800">هێشتا بەرهەمێک نییە.</p><p className="mt-2 text-xs leading-6 text-slate-500">فۆرمی لای راست بەکاربهێنە؛ data ـەکە ڕاستەوخۆ لە Supabase ـەوە پاشەکەوت دەکرێت.</p></div> : null}
        {!productsLoading && products.length > 0 ? <div className="mt-5 space-y-2">{products.map((product) => <article key={product.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-black text-slate-950">{product.name_ckb || product.name_ar || product.name_en}</h3><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${product.status === 'active' ? 'bg-emerald-50 text-emerald-700' : product.status === 'archived' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>{product.status}</span></div><p className="mt-1 text-[10px] font-semibold text-slate-400">/{product.slug} · {product.category_name_ckb || 'بێ کاتەگۆری'}</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-black">{money(product.primary_variant?.available_quantity ?? 0)} بەردەست</span><span className="rounded-xl bg-orange-50 px-3 py-2 text-xs font-black text-orange-700">{money(product.base_price_iqd)} د.ع</span><button type="button" onClick={() => void changeStatus(product)} className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black">{product.status === 'active' ? 'Draft' : 'Publish'}</button></div></div><div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-[10px] font-bold text-slate-400">Reserved: {money(product.primary_variant?.reserved_quantity ?? 0)} · {product.rating ? `★ ${product.rating.toFixed(1)}` : 'بێ هەڵسەنگاندن'}</p>{product.primary_variant ? <div className="flex items-center gap-2"><label className="text-[10px] font-black text-slate-500" htmlFor={`stock-${product.id}`}>Stock</label><input id={`stock-${product.id}`} type="number" min={product.primary_variant.reserved_quantity} defaultValue={product.primary_variant.quantity} onBlur={(e) => { const next=Number(e.target.value); if (Number.isFinite(next)) void changeStock(product,next); }} className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black" /></div> : null}</div></article>)}</div> : null}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-600">CREATE PRODUCT</p><h2 className="mt-1 text-xl font-black text-slate-950">بەرهەمی نوێ</h2><p className="mt-2 text-xs leading-6 text-slate-500">یەک variant ـی سەرەتایی + inventory لە هەمان transaction ـدا دروست دەکرێت.</p>
        <form onSubmit={(e) => void submitProduct(e)} className="mt-5 space-y-3">
          <input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="slug ـی بەرهەم" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold" />
          <input required value={form.nameCkb} onChange={(e) => setForm({ ...form, nameCkb: e.target.value })} placeholder="ناو بە کوردی" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold" />
          <div className="grid gap-2 sm:grid-cols-2"><input required value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} placeholder="ناو بە عەرەبی" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold" /><input required value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="Name in English" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold" /></div>
          <div className="grid gap-2 sm:grid-cols-2"><input required type="number" min="0" step="0.01" value={form.basePriceIqd} onChange={(e) => setForm({ ...form, basePriceIqd: e.target.value })} placeholder="نرخی IQD" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold" /><select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold"><option value="">کاتەگۆری هەڵبژێرە</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nameCkb || category.nameAr || category.nameEn}</option>)}</select></div>
          <div className="grid gap-2 sm:grid-cols-2"><input required type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="Stock" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold" /><input required type="number" min="0" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} placeholder="Low stock threshold" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold" /></div>
          <textarea rows={3} value={form.descriptionCkb} onChange={(e) => setForm({ ...form, descriptionCkb: e.target.value })} placeholder="وەسفی کوردی" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-xs font-semibold leading-6" />
          <div className="grid gap-2 sm:grid-cols-2"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'draft'|'active' })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold"><option value="draft">Draft</option><option value="active">Publish</option></select><div className="rounded-xl bg-slate-50 px-4 py-3 text-[10px] font-bold leading-5 text-slate-500">Publish لە vendor ـی verified/active ڕێگەپێدراوە؛ admin/super_admin دەتوانێت override بکات.</div></div>
          <button disabled={saving || !vendorId} type="submit" className="shakh-btn-primary w-full disabled:cursor-wait disabled:opacity-50">{saving ? 'پاشەکەوت دەکرێت...' : 'دروستکردنی بەرهەم'}</button>
        </form>
      </section>
    </div>

    {vendorId ? <VendorOrdersPanel vendorId={vendorId} /> : null}

    {selectedVendor ? <section className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-[var(--shakh-shadow-sm)]"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">STORE STATUS</p><p className="mt-1 text-sm font-black text-slate-950">{selectedVendor.name_ckb || selectedVendor.name_ar || selectedVendor.name_en}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black">{selectedVendor.vendor_type}</span><span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${selectedVendor.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{selectedVendor.status}</span></div></div></section> : null}
  </main></AppShell>;
}
