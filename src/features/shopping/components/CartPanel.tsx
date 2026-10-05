import { useState } from "react";
import { ShoppingBagIcon } from "../../../components/shell/icons";
import { formatIqd, type CartItem } from "../models";
import { removeCartItem, updateCartItem } from "../../commerce/cartApi";

export default function CartPanel({ items, onItemsChange }: { items: CartItem[]; onItemsChange: (items: CartItem[]) => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (items.length === 0) {
    return (
      <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-[var(--shakh-shadow-sm)] sm:p-12">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-orange-50 text-orange-600"><ShoppingBagIcon className="h-7 w-7" /></div>
          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">YOUR CART</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">سەبەتەکەت هێشتا بەتاڵە</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">کاتێک بەرهەمێکی ڕاستەقینە لە Supabase بۆ سەبەت زیاد بکەیت، لێرە دەردەکەوێت.</p>
          <a href="#marketplace" className="shakh-btn-primary mt-6 no-underline">گەڕان بۆ کڕین</a>
        </div>
      </section>
    );
  }

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const subtotal = items.reduce((sum, item) => sum + item.unitPriceIqd * item.quantity, 0);
  const changeQuantity = async (item: CartItem, quantity: number) => {
    setBusyId(item.id);
    setError("");
    try {
      if (quantity < 1) {
        await removeCartItem(item.id);
        onItemsChange(items.filter((entry) => entry.id !== item.id));
        return;
      }
      if (item.availableQuantity !== undefined && quantity > item.availableQuantity) {
        setError("ئەم بڕە لە stock ـی بەردەست زیاترە.");
        return;
      }
      await updateCartItem(item.id, quantity);
      onItemsChange(items.map((entry) => entry.id === item.id ? { ...entry, quantity } : entry));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "نەتوانرا سەبەت نوێ بکرێتەوە؛ تکایە دووبارە هەوڵ بدە.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">CART</p><h2 className="mt-1 text-xl font-black text-slate-950">بەرهەمە هەڵبژێردراوەکان</h2></div>
        <span className="text-xs font-black text-slate-400">{items.length} جۆر</span>
      </div>
      {error ? <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">{error}</div> : null}
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <article key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-black text-slate-900">{item.title}</h3>
              <p className="mt-1 text-xs font-semibold text-slate-400">{item.sellerName}</p>
              {item.variantLabel ? <p className="mt-1 text-xs font-semibold text-slate-500">{item.variantLabel}</p> : null}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-black text-orange-600">{formatIqd(item.unitPriceIqd)}</span>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <button type="button" disabled={busyId === item.id} className="grid h-7 w-7 place-items-center rounded-lg bg-white text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-30" onClick={() => void changeQuantity(item, item.quantity - 1)} aria-label="کەمکردنەوەی بڕ">−</button>
                  <span className="min-w-7 text-center text-xs font-black text-slate-700">{busyId === item.id ? "…" : item.quantity}</span>
                  <button type="button" disabled={busyId === item.id || (item.availableQuantity !== undefined && item.quantity >= item.availableQuantity)} className="grid h-7 w-7 place-items-center rounded-lg bg-white text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-30" onClick={() => void changeQuantity(item, item.quantity + 1)} aria-label="زیادکردنی بڕ">+</button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-6 border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between"><span className="text-sm font-bold text-slate-500">کۆی پێشبینراوی بەرهەم</span><span className="text-base font-black text-slate-950">{formatIqd(subtotal)}</span></div>
        <p className="mt-2 text-[11px] leading-6 text-slate-400">نرخ و total ـی کۆتایی لە checkout ـی server-side دووبارە پشتڕاست دەکرێن.</p>
      </div>
    </section>
  );
}
