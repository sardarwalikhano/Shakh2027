import { useEffect, useState } from "react";
import { getActiveCategories, type CatalogCategory } from "../../commerce/catalogApi";
import {
  GridIcon,
  HeartIcon,
  MapPinIcon,
  ShoppingBagIcon,
} from "../../../components/shell/icons";
import SectionHeading from "./SectionHeading";

const marketCategory = { id: "market", label: "بازار", meta: "هەموو شتەکان", href: "#market" };

function CategoryGlyph({ index }: { index: number }) {
  const common = "h-5 w-5";
  if (index === 1) return <ShoppingBagIcon className={common} />;
  if (index === 2) return <GridIcon className={common} />;
  if (index === 3) return <HeartIcon className={common} />;
  if (index === 4) return <MapPinIcon className={common} />;
  return <span className="text-[16px] font-black">{["◈", "✦", "▣", "◇", "▱", "✧", "◌"][index % 7]}</span>;
}

function mapCategory(category: CatalogCategory) {
  return {
    id: category.id,
    label: category.nameCkb || category.nameAr || category.nameEn,
    meta: category.nameEn || category.nameAr || "SHAKH Marketplace",
    href: `#${category.slug}`,
  };
}

export default function CategoryRail() {
  const [categories, setCategories] = useState<Array<ReturnType<typeof mapCategory>>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getActiveCategories()
      .then((rows) => {
        if (cancelled) return;
        setCategories(rows.map(mapCategory));
        setError("");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "نەتوانرا کاتەگۆرییەکانی بازار باربکرێن.");
      });
    return () => { cancelled = true; };
  }, []);

  const items = [marketCategory, ...categories.filter((category) => category.id !== "market")];

  return (
    <section aria-labelledby="category-heading">
      <SectionHeading
        eyebrow="Discover"
        title="بەپەلە بڕۆ بۆ شوێنی خۆت"
        action={<a className="hover:text-slate-950" href="#market">هەمووی ببینە ←</a>}
      />
      {error ? <div role="alert" className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">{error}</div> : null}
      <div id="category-heading" className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((category, index) => (
          <a
            key={category.id}
            href={category.href}
            className="group flex min-w-[138px] snap-start flex-col items-start rounded-[22px] border border-slate-200 bg-white p-3.5 text-right shadow-[var(--shakh-shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[var(--shakh-shadow-md)] sm:min-w-[155px] sm:p-4"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-orange-600">
              <CategoryGlyph index={index} />
            </span>
            <strong className="mt-4 text-sm font-black text-slate-950">{category.label}</strong>
            <span className="mt-1 text-[11px] font-medium text-slate-500">{category.meta}</span>
          </a>
        ))}
        {!items.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-xs font-bold text-slate-500">هێشتا کاتەگۆرییەکی چالاک لە بازاردا نییە.</div> : null}
      </div>
    </section>
  );
}