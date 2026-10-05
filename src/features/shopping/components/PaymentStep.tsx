import type { PaymentMethod } from "../models";

const methods: Array<{ id: PaymentMethod; title: string; description: string; enabled: boolean }> = [
  { id: "cash_on_delivery", title: "پارەدان لە کاتی گەیاندن", description: "پارەکە لە کاتی وەرگرتنی ئۆردەر وەردەگیرێت و بە cash collection تۆمار دەکرێت.", enabled: true },
  { id: "wallet", title: "SHAKH Wallet", description: "بڕی تەواو بە atomic server-side debit لە wallet کەم دەکرێت و ledger ـەکە دەگۆڕدرێت.", enabled: true },
  { id: "mobile_cash", title: "Mobile Cash", description: "Payment intent و signed webhook ـی ئامادەیە؛ چالاکبوونی provider پێویستی credentials ـی provider ـی ڕاستەقینە هەیە.", enabled: false },
];

export default function PaymentStep({ value, onChange, walletBalance = 0 }: { value: PaymentMethod | null; onChange: (value: PaymentMethod) => void; walletBalance?: number }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
      <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">PAYMENT</p><h2 className="mt-1 text-xl font-black text-slate-950">شێوازی پارەدان</h2></div>
      <div className="mt-6 grid gap-3">
        {methods.map((method) => {
          const active = value === method.id;
          return (
            <label key={method.id} className={`block rounded-2xl border p-4 transition ${method.enabled ? "cursor-pointer" : "cursor-not-allowed opacity-55"} ${active ? "border-orange-400 bg-orange-50/70" : "border-slate-200 bg-white"}`}>
              <input type="radio" className="sr-only" name="payment" checked={active} disabled={!method.enabled} onChange={() => onChange(method.id)} />
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full border ${active ? "border-orange-500" : "border-slate-300"}`}><span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-orange-500" : "bg-transparent"}`} /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-900">{method.title}</p><p className="mt-1 text-xs leading-6 text-slate-500">{method.description}</p>{method.id === 'wallet' ? <p className="mt-2 text-[10px] font-black text-slate-400">بەڵانسی wallet: {new Intl.NumberFormat('ku-IQ').format(walletBalance)} د.ع</p> : null}</div>
                {!method.enabled ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">دواتر</span> : null}
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
}
