import SectionHeading from "./SectionHeading";

const promos = [
  { tag: "MARKETPLACE", title: "بازارەکەت لە یەک شوێن", meta: "کاتێک دەتەوێت، هەموو category ـەکان لەبەردەستە", href: "#market", className: "bg-orange-50", accent: "text-orange-700" },
  { tag: "DELIVERY", title: "گەیاندنی خێرا", meta: "شوێن، داواکاری و tracking لە یەک flow", href: "#delivery", className: "bg-blue-50", accent: "text-blue-700" },
  { tag: "SERVICES", title: "لە شتەکان تەنها مەوەستە", meta: "خزمەتگوزاری و marketplace بە یەک ئەزموون", href: "#umrah", className: "bg-slate-950", accent: "text-orange-300" },
];

export default function PromoMosaic() {
  return (
    <section id="offers">
      <SectionHeading
        eyebrow="Explore SHAKH"
        title="ئەمڕۆ چی دەگەڕێیت؟"
        action={<span className="text-[11px] font-bold text-slate-400">دیزاینکراو بۆ discovery</span>}
      />
      <div className="grid gap-3 md:grid-cols-3">
        {promos.map((promo, index) => (
          <a
            key={promo.title}
            href={promo.href}
            className={`group relative min-h-[190px] overflow-hidden rounded-[26px] border border-slate-200 p-5 text-right transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shakh-shadow-md)] ${promo.className}`}
          >
            <div className="relative z-10 max-w-[235px]">
              <p className={`text-[10px] font-black tracking-[0.18em] ${promo.accent}`}>{promo.tag}</p>
              <h3 className={`mt-4 text-xl font-black tracking-tight ${index === 2 ? "text-white" : "text-slate-950"}`}>{promo.title}</h3>
              <p className={`mt-2 text-xs leading-6 ${index === 2 ? "text-slate-300" : "text-slate-600"}`}>{promo.meta}</p>
            </div>
            <span className={`absolute bottom-4 left-5 text-lg transition-transform duration-200 group-hover:-translate-x-1 ${index === 2 ? "text-orange-300" : "text-orange-600"}`} aria-hidden="true">↙</span>
            <div className={`pointer-events-none absolute -bottom-14 -left-10 h-36 w-36 rounded-full blur-2xl ${index === 2 ? "bg-orange-500/15" : "bg-white/80"}`} />
          </a>
        ))}
      </div>
    </section>
  );
}