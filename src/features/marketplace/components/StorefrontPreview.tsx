export default function StorefrontPreview() {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[var(--shakh-shadow-md)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">SELLER STOREFRONT</p>
          <h2 className="mt-2 text-2xl font-black">فرۆشگا بە شێوەی Brand Hub</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">لە Product detail ـەوە کاربەر دەتوانێت بچێتە ناو فرۆشگا، collection ـەکان ببینێت، rating و service signals بخوێنێتەوە.</p>
        </div>
        <button type="button" className="shakh-btn-primary shakh-focus bg-orange-500 hover:bg-orange-400">بینینی فرۆشگا</button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {['Collection', 'Trust signals', 'Seller actions'].map((item) => (
          <div key={item} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-black">{item}</p>
            <p className="mt-2 text-xs leading-6 text-slate-400">Data ـی واقعی لە Supabase لێرە جێگیر دەکرێت.</p>
          </div>
        ))}
      </div>
    </section>
  );
}
