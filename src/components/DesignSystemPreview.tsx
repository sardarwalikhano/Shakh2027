import type { ReactNode } from "react";

const categories = [
  ["بازار","هەموو شتەکان","◈"],["خواردن","ڕێستۆران","✦"],["سوپەرمارکێت","خێرا و نزیک","▣"],
  ["جل و بەرگ","Fashion","◇"],["ئۆتۆمبێل","SHAKH Cars","▱"],["عومرە","Hajj & Umrah","✧"],
] as const;

function IconButton({label,children}:{label:string;children:ReactNode}){
 return <button aria-label={label} className="shakh-focus grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className="text-lg">{children}</span></button>
}

export default function DesignSystemPreview(){
 return <div className="min-h-screen px-[var(--shakh-space-page)] py-5 sm:py-8">
  <header className="shakh-glass sticky top-3 z-20 mx-auto flex max-w-7xl items-center gap-3 rounded-[22px] border border-white/80 px-3 py-3 shadow-[var(--shakh-shadow-sm)] sm:px-4">
   <div className="grid min-w-0 flex-1 grid-cols-[auto_1fr] items-center gap-3">
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-500 font-black text-white shadow-sm">ش</div>
    <div className="hidden min-w-0 sm:block"><p className="truncate text-xs font-semibold text-orange-600">SHAKH</p><p className="truncate text-sm font-bold text-slate-950">لووتکەی بازار و گەیاندن</p></div>
    <label className="col-span-2 flex h-11 min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 sm:col-span-1 sm:mr-2">
      <span className="text-slate-400">⌕</span><input className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="بگەڕێ بۆ بەرهەم، فرۆشگا، خواردن..." aria-label="گەڕان"/><kbd className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500 sm:block">⌘ K</kbd>
    </label>
   </div>
   <div className="hidden items-center gap-2 md:flex"><IconButton label="دڵخوازەکان">♡</IconButton><IconButton label="ئاگادارکردنەوەکان">◔</IconButton><button className="shakh-focus h-11 rounded-full bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800">چوونەژوورەوە</button></div>
  </header>
  <main className="mx-auto max-w-7xl space-y-8 pb-28 pt-6 sm:pt-8">
   <section className="grid gap-4 lg:grid-cols-[1.45fr_0.55fr]">
    <article className="relative overflow-hidden rounded-[28px] bg-slate-950 p-6 text-white shadow-[var(--shakh-shadow-md)] sm:p-9"><div className="absolute -left-16 -top-24 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl"/><div className="relative max-w-2xl"><span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-orange-200">SHAKH DESIGN FOUNDATION</span><h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">هەموو ئەوەی پێویستتە، لە یەک لووتکە.</h1><p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">Discovery-first marketplace experience ـێکی نوێ؛ وەرگیراوی باشترین UX principle ـەکان، بە براند و هەستی تایبەتی شاخ.</p><div className="mt-7 flex flex-wrap gap-3"><button className="shakh-focus rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white transition hover:bg-orange-400">دەستپێبکە</button><button className="shakh-focus rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15">بینینی پێشنیارەکان</button></div></div></article>
    <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold text-orange-600">DESIGN LANGUAGE</p><h2 className="mt-2 text-xl font-black text-slate-950">پاک، خێرا، ئاشکرا</h2><div className="mt-5 space-y-3 text-sm leading-7 text-slate-600"><div className="rounded-2xl bg-slate-50 p-4">RTL-first بەبێ ئەوەی spacing و hierarchy تێکبچێت.</div><div className="rounded-2xl bg-orange-50 p-4 text-orange-900">Orange = action، نەک هەموو شوێن.</div><div className="rounded-2xl bg-slate-950 p-4 text-slate-200">Dark surfaces تەنها بۆ هەیڵایت و focus.</div></div></aside>
   </section>
   <section><div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs font-bold text-orange-600">DISCOVER</p><h2 className="mt-1 text-2xl font-black">پۆلەکان</h2></div><button className="text-sm font-bold text-slate-600 hover:text-slate-950">هەمووی ببینە ←</button></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{categories.map(([title,meta,icon])=><button key={title} className="shakh-focus rounded-[20px] border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:-translate-y-1 hover:shadow-md"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-xl text-orange-600">{icon}</div><p className="mt-4 text-sm font-black text-slate-950">{title}</p><p className="mt-1 text-xs text-slate-500">{meta}</p></button>)}</div></section>
   <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-orange-600">COMPONENT TOKENS</p><h2 className="mt-1 text-xl font-black">بەشە سەرەکییەکانی UI</h2></div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white">Primary</span><span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700">Accent</span><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Success</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">Neutral</span></div></div></section>
  </main>
  <nav className="shakh-glass fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-md items-center justify-around rounded-[24px] border border-white/80 p-2 shadow-[var(--shakh-shadow-md)] md:hidden">{[["⌂","سەرەتا"],["◈","بازار"],["◉","سەبەت"],["♡","دڵخواز"],["☻","پڕۆفایل"]].map(([icon,label])=><button key={label} className="shakh-focus flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold text-slate-600"><span className="text-lg leading-none">{icon}</span><span>{label}</span></button>)}</nav>
 </div>
}
