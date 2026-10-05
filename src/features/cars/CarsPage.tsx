import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AppShell from '../../components/shell/AppShell';
import { LoadingState } from '../../components/ux/UiStates';
import { useAuth } from '../auth/AuthContext';
import { createCarListing, getCarListingFee, listCarListings, type CarListing } from './carsApi';

const money = (value: number) => `${new Intl.NumberFormat('ku-IQ', { maximumFractionDigits: 0 }).format(value)} IQD`;

export default function CarsPage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<CarListing[]>([]);
  const [fee, setFee] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', make: '', model: '', year: new Date().getFullYear(), price: '', mileage: '', fuel: '', transmission: '', condition: '', city: 'هەولێر', district: '', description: '' });

  const refresh = async () => {
    setLoading(true); setError('');
    try {
      const [rows, activeFee] = await Promise.all([listCarListings(), getCarListingFee()]);
      setListings(rows); setFee(activeFee);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'بارکردنی ئۆتۆمبێل سەرکەوتوو نەبوو.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, []);

  const sorted = useMemo(() => listings, [listings]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user) { window.location.hash = '#auth/sign-in'; return; }
    setBusy(true); setError(''); setMessage('');
    try {
      await createCarListing({
        title_ckb: form.title, title_ar: form.title, title_en: form.title,
        make: form.make, model: form.model, year: Number(form.year), price_iqd: Number(form.price),
        mileage_km: form.mileage ? Number(form.mileage) : null, fuel_type: form.fuel || null, transmission: form.transmission || null,
        condition: form.condition || null, city: form.city, district: form.district || null, description: form.description || null, images: [],
      });
      setMessage('ئۆتۆمبێلەکەت بڵاوکرایەوە. کرێی بڵاوکردنەوە لە جزدانی هەژمارەکەت وەرگیرا.');
      setForm({ title: '', make: '', model: '', year: new Date().getFullYear(), price: '', mileage: '', fuel: '', transmission: '', condition: '', city: 'هەولێر', district: '', description: '' });
      setShowForm(false); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'بڵاوکردنەوەی ئۆتۆمبێل سەرکەوتوو نەبوو.'); }
    finally { setBusy(false); }
  }

  return <AppShell>
    <main dir="rtl" className="space-y-6">
      <section className="overflow-hidden rounded-[32px] bg-slate-950 px-5 py-7 text-white shadow-[var(--shakh-shadow-md)] sm:px-8 sm:py-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-[10px] font-black tracking-[.18em] text-orange-300">SHAKH CARS</p><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">بازاری ئۆتۆمبێل، بەڵام بە سیستەمی پارەدانی ڕوون</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/65">هەموو بەکارهێنەرێکی پشتڕاستکراو دەتوانێت ئۆتۆمبێل بڵاو بکاتەوە. بڵاوکردنەوە بە کرێی پلاتفۆرمە و تەنها دوای پارەدان listing ـەکە چالاک دەبێت.</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-[9px] font-black tracking-[.16em] text-white/40">LISTING FEE</p><strong className="mt-2 block text-xl">{fee == null ? 'دانراو نییە' : money(fee)}</strong><span className="mt-1 block text-[10px] text-white/45">لە لایەن بەڕێوەبەری داراییەوە دیاری دەکرێت.</span></div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3"><button className="shakh-btn-primary" type="button" onClick={() => { setShowForm(true); setMessage(''); setError(''); }}>+ بڵاوکردنەوەی ئۆتۆمبێل</button><a className="shakh-btn-dark" href="#market">گەڕانەوە بۆ بازار</a></div>
      </section>

      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</div>}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div>}

      {loading ? <LoadingState label="ئۆتۆمبێلەکان بار دەکرێن..." /> : <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {!sorted.length ? <div className="col-span-full rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-bold text-slate-500">هێشتا هیچ ئۆتۆمبێلێکی چالاک نییە.</div> : sorted.map((car) => <article key={car.id} className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[var(--shakh-shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shakh-shadow-md)]">
          <div className="grid h-44 place-items-center bg-gradient-to-br from-orange-50 via-slate-50 to-blue-50"><span className="text-6xl">🚘</span></div>
          <div className="space-y-3 p-5"><div><p className="text-[10px] font-black tracking-[.14em] text-orange-600">{car.make.toUpperCase()} • {car.year}</p><h2 className="mt-1 text-lg font-black text-slate-950">{car.title_ckb}</h2></div><p className="text-sm font-black text-slate-900">{money(Number(car.price_iqd))}</p><div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-500"><span className="rounded-full bg-slate-100 px-2.5 py-1">{car.model}</span>{car.mileage_km != null && <span className="rounded-full bg-slate-100 px-2.5 py-1">{new Intl.NumberFormat('ku-IQ').format(Number(car.mileage_km))} km</span>}<span className="rounded-full bg-slate-100 px-2.5 py-1">{car.city}</span></div>{car.description && <p className="line-clamp-3 text-xs leading-6 text-slate-500">{car.description}</p>}</div>
        </article>)}
      </section>}

      {showForm && <div className="fixed inset-0 z-[70] grid place-items-end bg-slate-950/35 p-3 backdrop-blur-sm sm:place-items-center"><section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[30px] border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black tracking-[.18em] text-orange-600">PAID LISTING</p><h2 className="mt-2 text-2xl font-black">بڵاوکردنەوەی ئۆتۆمبێل</h2><p className="mt-2 text-xs leading-6 text-slate-500">تەنها کرێی بڵاوکردنەوە دەدرێت؛ هیچ commission ـێکی فروش لەم flow ـەدا نییە.</p></div><button type="button" className="shakh-icon-button" onClick={() => setShowForm(false)} aria-label="داخستن">×</button></div>
        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <Field label="ناونیشانی ئۆتۆمبێل" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} required className="sm:col-span-2" />
          <Field label="مارک" value={form.make} onChange={(v) => setForm((f) => ({ ...f, make: v }))} required /><Field label="مۆدێل" value={form.model} onChange={(v) => setForm((f) => ({ ...f, model: v }))} required />
          <Field label="ساڵ" type="number" value={String(form.year)} onChange={(v) => setForm((f) => ({ ...f, year: Number(v) }))} required /><Field label="نرخی فروش" type="number" value={form.price} onChange={(v) => setForm((f) => ({ ...f, price: v }))} required />
          <Field label="کێلۆمەتری" type="number" value={form.mileage} onChange={(v) => setForm((f) => ({ ...f, mileage: v }))} /><Field label="جۆری سووتەمەنی" value={form.fuel} onChange={(v) => setForm((f) => ({ ...f, fuel: v }))} />
          <Field label="گێڕ" value={form.transmission} onChange={(v) => setForm((f) => ({ ...f, transmission: v }))} /><Field label="دۆخ" value={form.condition} onChange={(v) => setForm((f) => ({ ...f, condition: v }))} />
          <Field label="شار" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} required /><Field label="ناوچە" value={form.district} onChange={(v) => setForm((f) => ({ ...f, district: v }))} />
          <label className="grid gap-2 sm:col-span-2"><span className="text-xs font-black text-slate-700">وەسف</span><textarea rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-300 focus:bg-white" /></label>
          {fee == null ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-6 text-amber-800 sm:col-span-2">نرخی بڵاوکردنەوە لەلایەن Finance ـەوە دانەنراوە؛ بۆ ئێستا posting ـەکە ناتوانرێت تەواو بکرێت.</div> : <div className="flex items-center justify-between gap-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 sm:col-span-2"><span className="text-xs font-bold text-orange-800">کرێی ئەم listing ـە</span><strong className="text-sm text-orange-900">{money(fee)}</strong></div>}
          <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end"><button type="button" className="shakh-ghost-btn" onClick={() => setShowForm(false)}>هەڵوەشاندنەوە</button><button disabled={busy || fee == null} type="submit" className="shakh-btn-primary disabled:opacity-50">{busy ? 'لە پارەدان و بڵاوکردنەوە...' : 'پارەدان و بڵاوکردنەوە'}</button></div>
        </form>
      </section></div>}
    </main>
  </AppShell>;
}

function Field({ label, value, onChange, required, type = 'text', className = '' }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; className?: string }) {
  return <label className={`grid gap-2 ${className}`}><span className="text-xs font-black text-slate-700">{label}</span><input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none focus:border-orange-300 focus:bg-white" /></label>;
}
