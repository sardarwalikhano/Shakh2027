import type { DeliveryOption } from "../models";
import { formatIqd } from "../models";

export default function DeliveryStep({ options, selectedId, onSelect }: { options: DeliveryOption[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">DELIVERY METHOD</p>
        <h2 className="mt-1 text-xl font-black text-slate-950">شێوازی گەیاندن هەڵبژێرە</h2>
      </div>
      <div className="mt-6 space-y-3">
        {options.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-semibold leading-7 text-slate-500">
            هێشتا هیچ option ـێکی گەیاندن لە backend نەگەیشتووە.
          </div>
        ) : (
          options.map((option) => {
            const active = option.id === selectedId;
            return (
              <label key={option.id} className={`block cursor-pointer rounded-2xl border p-4 transition ${active ? "border-orange-400 bg-orange-50/70 ring-4 ring-orange-500/5" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                <input type="radio" className="sr-only" name="delivery" checked={active} onChange={() => onSelect(option.id)} />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-slate-900">{option.title}</p>
                    <p className="mt-1 text-xs font-medium leading-6 text-slate-500">{option.description}</p>
                    <p className="mt-2 text-xs font-black text-orange-600">{option.etaLabel}</p>
                  </div>
                  <span className="shrink-0 text-sm font-black text-slate-950">{formatIqd(option.feeIqd)}</span>
                </div>
              </label>
            );
          })
        )}
      </div>
    </section>
  );
}
