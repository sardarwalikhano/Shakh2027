import type { ChangeEvent } from "react";
import { MapPinIcon } from "../../../components/shell/icons";
import type { AddressDraft } from "../models";

export default function AddressStep({ value, onChange }: { value: AddressDraft; onChange: (value: AddressDraft) => void }) {
  const update = (key: keyof AddressDraft) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({ ...value, [key]: event.target.value });
  };

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-50 text-orange-600"><MapPinIcon className="h-5 w-5" /></div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">DELIVERY ADDRESS</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">شوێنی گەیاندن</h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">ناونیشانی گەیاندن پاشان دەتوانێت بە map/GPS پشتڕاست بکرێتەوە.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {[
          ["recipientName", "ناوی وەرگر", "ناوی کەسێک کە ئۆردەرەکە وەردەگرێت"],
          ["phone", "ژمارەی مۆبایل", "07xx xxx xxxx"],
          ["city", "شار", "هەولێر"],
          ["district", "ناوچە", "ناوی ناوچەکە"],
          ["street", "شارەوانی / شەقام", "ناونیشانی ورد"],
          ["landmark", "نیشانەی نزیک", "نزیک چییە؟"],
        ].map(([key, label, placeholder]) => (
          <label key={key} className="block">
            <span className="mb-2 block text-xs font-black text-slate-700">{label}</span>
            <input
              value={value[key as keyof AddressDraft]}
              onChange={update(key as keyof AddressDraft)}
              placeholder={placeholder}
              className="shakh-focus h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-orange-300 focus:bg-white"
            />
          </label>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="mb-2 block text-xs font-black text-slate-700">تێبینی بۆ کاپتن</span>
        <textarea value={value.notes} onChange={update("notes")} rows={4} placeholder="بۆ نموونە: لە نزیک دەروازەی سەرەکی" className="shakh-focus w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-orange-300 focus:bg-white" />
      </label>
    </section>
  );
}
