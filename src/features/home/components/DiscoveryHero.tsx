import { MapPinIcon, SearchIcon, ShoppingBagIcon } from "../../../components/shell/icons";

export default function DiscoveryHero() {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,.45fr)]">
      <article className="relative min-h-[360px] overflow-hidden rounded-[30px] bg-slate-950 p-6 text-white shadow-[var(--shakh-shadow-md)] sm:min-h-[420px] sm:p-9 lg:min-h-[440px]">
        <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-orange-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 right-8 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-90px] left-1/2 h-56 w-[72%] -translate-x-1/2 rounded-[50%] border border-white/10 bg-white/[0.03]" />
        <div className="relative flex h-full flex-col justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-black tracking-[0.14em] text-orange-200">
              SHAKH • DISCOVERY 01
            </span>
            <h1 className="mt-5 max-w-xl text-[34px] font-black leading-[1.2] tracking-[-0.035em] sm:text-5xl lg:text-[58px]">
              هەموو ئەوەی پێویستتە، لە یەک لووتکە.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              بازاڕ و خزمەتگوزاری بە شێوەیەکی خێرا بدۆزەرەوە؛ لە گەڕان تا داواکاری، هەموو experience ـەکە یەکگرتووە.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button className="shakh-btn-primary" type="button">
              <SearchIcon className="mr-2 h-4 w-4" />
              دەست بکە بە گەڕان
            </button>
            <button className="shakh-btn-dark" type="button">
              پێشنیارەکان ببینە
            </button>
          </div>
        </div>
      </article>

      <aside className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-6">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xs font-black text-orange-600">
            <MapPinIcon className="h-4 w-4" />
            شوێنی تۆ
          </span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">هەولێر</span>
        </div>
        <div className="mt-8 rounded-[26px] bg-slate-950 p-5 text-white">
          <p className="text-xs font-bold text-slate-400">نزیکترین ئەنجامەکان</p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-black tracking-tight">GPS</p>
              <p className="mt-1 text-xs text-slate-400">شوێنەکەت دیاری بکە بۆ discovery ـی وردتر</p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-500">
              <MapPinIcon className="h-6 w-6" />
            </span>
          </div>
        </div>
        <button type="button" className="mt-4 flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-800 transition hover:border-orange-200 hover:bg-orange-50">
          <span>ناونیشانی گەیاندن هەڵبژێرە</span>
          <span className="text-orange-600">←</span>
        </button>
      </aside>
    </section>
  );
}
