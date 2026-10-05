import { formatIqd, type AddressDraft, type CartItem, type DeliveryOption, type PaymentMethod } from "../models";
import type { CouponValidation } from "../../commerce/promotionsApi";

export default function CheckoutSummary({ items, address, delivery, payment, isSubmitting, onBack, onContinue, couponCode, couponValidation, validatingCoupon, onCouponCodeChange, onValidateCoupon }: {
  items: CartItem[];
  address: AddressDraft;
  delivery: DeliveryOption | null;
  payment: PaymentMethod | null;
  isSubmitting: boolean;
  onBack: () => void;
  onContinue: () => void;
  couponCode: string;
  couponValidation: CouponValidation | null;
  validatingCoupon: boolean;
  onCouponCodeChange: (value: string) => void;
  onValidateCoupon: () => void;
}) {
  const estimatedSubtotal = items.reduce((sum, item) => sum + item.unitPriceIqd * item.quantity, 0);
  const previewDiscount = couponValidation?.valid ? Number(couponValidation.discount_iqd ?? 0) : 0;
  const previewTotal = Math.max(0, estimatedSubtotal - previewDiscount + Number(delivery?.feeIqd ?? 0));

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
      <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">ORDER REVIEW</p><h2 className="mt-1 text-xl font-black text-slate-950">پشکنینی کۆتایی</h2></div>
      <div className="mt-6 space-y-5 text-sm">
        <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-700">ناونیشان</p><p className="mt-2 leading-7 text-slate-600">{address.recipientName} · {address.phone}<br />{address.city} · {address.district}<br />{address.street}</p></div>
        <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-700">گەیاندن</p><p className="mt-2 font-semibold text-slate-600">{delivery?.title || "—"}</p><p className="mt-1 text-[11px] leading-6 text-slate-400">{delivery?.etaLabel || "—"}</p></div>
        <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-700">پارەدان</p><p className="mt-2 font-semibold text-slate-600">{payment === "cash_on_delivery" ? "پارەدان لە کاتی گەیاندن" : "—"}</p></div>
      </div>
      <div className="mt-6 rounded-2xl border border-orange-100 bg-orange-50/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-xs font-black text-slate-800">Coupon / کۆدی داشکاندن</p><p className="mt-1 text-[11px] text-slate-500">پشتڕاستکردنەوە لە Supabase ـەوە دەکرێت.</p></div>
        </div>
        <div className="mt-3 flex gap-2">
          <input value={couponCode} onChange={(e) => onCouponCodeChange(e.target.value.toUpperCase())} maxLength={64} placeholder="مثلاً SHAKH10" className="min-h-11 min-w-0 flex-1 rounded-xl border border-orange-200 bg-white px-4 text-sm font-black outline-none focus:border-orange-400" />
          <button type="button" onClick={onValidateCoupon} disabled={!couponCode.trim() || validatingCoupon || isSubmitting} className="min-h-11 rounded-xl bg-slate-950 px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{validatingCoupon ? "پشکنین..." : "پشکنین"}</button>
        </div>
        {couponValidation ? <p className={`mt-2 text-xs font-bold ${couponValidation.valid ? "text-emerald-700" : "text-rose-700"}`}>{couponValidation.valid ? `داشکاندن: ${formatIqd(previewDiscount)}` : `کۆد کار ناکات: ${couponValidation.reason ?? "invalid"}`}</p> : null}
      </div>
      <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
        <div className="flex justify-between"><span className="text-slate-500">کۆی پێشبینراوی بەرهەم</span><span className="font-black">{formatIqd(estimatedSubtotal)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">داشکاندن</span><span className="font-black text-emerald-700">{previewDiscount ? `-${formatIqd(previewDiscount)}` : "—"}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">کۆی پێشبینیی دوای داشکاندن</span><span className="font-black">{formatIqd(previewTotal)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">گەیاندن</span><span className="font-black">لە server ـەوە</span></div>
        <div className="rounded-2xl bg-orange-50 px-4 py-3 text-xs font-semibold leading-6 text-orange-800">کۆی گشتیی کۆتایی لە RPC ـی checkout ـەوە دروست دەکرێت؛ نرخەکانی client تەنها بۆ preview ـن.</div>
      </div>
      <div className="mt-6 flex gap-3"><button type="button" className="min-h-11 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700" onClick={onBack} disabled={isSubmitting}>گەڕانەوە</button><button type="button" className="shakh-btn-primary flex-1 disabled:cursor-wait disabled:opacity-60" onClick={onContinue} disabled={items.length === 0 || !address.recipientName || !address.phone || !address.street || !payment || isSubmitting}>{isSubmitting ? "ئۆردەر تۆمار دەکرێت..." : "پشتڕاستکردنەوەی ئۆردەر"}</button></div>
    </section>
  );
}
