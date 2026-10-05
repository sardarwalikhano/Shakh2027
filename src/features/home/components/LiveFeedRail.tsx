import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { ShoppingBagIcon } from "../../../components/shell/icons";
import { DEFAULT_FILTERS, type ProductSummary } from "../../marketplace/catalog";
import ProductCard from "../../marketplace/components/ProductCard";
import { getMarketplaceProducts } from "../../commerce/catalogApi";
import SectionHeading from "./SectionHeading";

function ProductSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <article className={`overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[var(--shakh-shadow-sm)] ${wide ? "min-w-[290px]" : "min-w-[245px]"}`} aria-hidden="true">
      <div className="aspect-[1.05/1] animate-pulse bg-slate-100" />
      <div className="space-y-3 p-4">
        <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-100" />
        <div className="h-4 w-[82%] animate-pulse rounded-full bg-slate-100" />
        <div className="h-3 w-[58%] animate-pulse rounded-full bg-slate-100" />
        <div className="flex items-center justify-between pt-1">
          <div className="h-5 w-24 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    </article>
  );
}

export default function LiveFeedRail() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const refresh = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void getMarketplaceProducts({ ...DEFAULT_FILTERS, sort: "newest", onlyAvailable: true })
          .then((rows) => {
            if (cancelled) return;
            setProducts(rows.slice(0, 8));
            setError("");
          })
          .catch((err: unknown) => {
            if (!cancelled) setError(err instanceof Error ? err.message : "نەتوانرا پێشنیارەکانی بازار باربکرێن.");
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      }, 200);
    };

    setLoading(true);
    refresh();

    const channel = supabase
      .channel("home-marketplace-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "vendors" }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <section>
      <SectionHeading
        eyebrow="Marketplace Feed"
        title="پێشنیارەکان بۆ تۆ"
        action={<span className="inline-flex items-center gap-1 text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> dynamic data</span>}
      />
      {error ? <div role="alert" className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">{error}</div> : null}
      {loading ? (
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ProductSkeleton />
          <ProductSkeleton />
          <ProductSkeleton wide />
          <ProductSkeleton />
        </div>
      ) : products.length ? (
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {products.map((product) => (
            <div key={product.id} className="w-[245px] shrink-0 snap-start sm:w-[280px]">
              <ProductCard product={product} onOpen={(item) => { window.location.hash = `#marketplace/product/${item.slug || item.id}`; }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[22px] border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm font-bold text-slate-500">
          هێشتا بەرهەمی بەردەست بۆ feed ـی Home نییە.
        </div>
      )}
      <div className="mt-4 flex items-center gap-3 rounded-[22px] border border-dashed border-slate-300 bg-white px-4 py-4">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-50 text-orange-600"><ShoppingBagIcon className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="text-xs font-black text-slate-950">feed ـەکە لە catalog ـی ڕاستەقینەی SHAKH ـەوەیە.</p>
          <p className="mt-0.5 text-[11px] leading-5 text-slate-500">تەنها products ـی active و بەردەست لە Supabase لێرە پیشان دەدرێن؛ هیچ mock product data بەکارناهێنرێت.</p>
        </div>
      </div>
    </section>
  );
}