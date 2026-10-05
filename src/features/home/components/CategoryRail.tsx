import {
  GridIcon,
  HeartIcon,
  MapPinIcon,
  ShoppingBagIcon,
} from "../../../components/shell/icons";
import SectionHeading from "./SectionHeading";

const categories = [
  { label: "بازار", meta: "هەموو شتەکان", href: "#market", tone: "bg-orange-50 text-orange-600" },
  { label: "خواردن", meta: "ڕێستۆران", href: "#food", tone: "bg-emerald-50 text-emerald-700" },
  { label: "سوپەرمارکێت", meta: "خێرا و نزیک", href: "#supermarket", tone: "bg-blue-50 text-blue-700" },
  { label: "جل و بەرگ", meta: "فاشن", href: "#fashion", tone: "bg-violet-50 text-violet-700" },
  { label: "ئۆتۆمبێل", meta: "SHAKH Cars", href: "#cars", tone: "bg-slate-100 text-slate-700" },
  { label: "عومرە", meta: "تەنها حجز", href: "#umrah", tone: "bg-amber-50 text-amber-700" },
  { label: "جوانکاری", meta: "Beauty", href: "#beauty", tone: "bg-rose-50 text-rose-700" },
];

function CategoryGlyph({ index }: { index: number }) {
  const common = "h-5 w-5";
  if (index === 1) return <ShoppingBagIcon className={common} />;
  if (index === 2) return <GridIcon className={common} />;
  if (index === 3) return <HeartIcon className={common} />;
  if (index === 4) return <MapPinIcon className={common} />;
  return <span className="text-[16px] font-black">{["◈", "✦", "▣", "◇", "▱", "✧", "◌"][index]}</span>;
}

export default function CategoryRail() {
  return (
    <section aria-labelledby="category-heading">
      <SectionHeading
        eyebrow="Discover"
        title="بەپەلە بڕۆ بۆ شوێنی خۆت"
        action={<a className="hover:text-slate-950" href="#market">هەمووی ببینە ←</a>}
      />
      <div id="category-heading" className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((category, index) => (
          <a
            key={category.label}
            href={category.href}
            className="group flex min-w-[138px] snap-start flex-col items-start rounded-[22px] border border-slate-200 bg-white p-3.5 text-right shadow-[var(--shakh-shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[var(--shakh-shadow-md)] sm:min-w-[155px] sm:p-4"
          >
            <span className={`grid h-11 w-11 place-items-center rounded-2xl ${category.tone}`}>
              <CategoryGlyph index={index} />
            </span>
            <strong className="mt-4 text-sm font-black text-slate-950">{category.label}</strong>
            <span className="mt-1 text-[11px] font-medium text-slate-500">{category.meta}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
