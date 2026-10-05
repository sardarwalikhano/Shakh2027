import type { ProductSummary } from '../catalog';
import ProductCard from './ProductCard';

export default function ProductGrid({
  products,
  loading,
  emptyTitle = 'هیچ بەرهەمێک نەدۆزرایەوە',
  emptyMeta = 'کاتێک data ـی واقعی لە Supabase هەبێت، بەرهەمەکان لێرە دەردەکەون.',
  onOpen,
  favoriteIds,
  onToggleWishlist,
}: {
  products: ProductSummary[];
  loading: boolean;
  emptyTitle?: string;
  emptyMeta?: string;
  onOpen?: (product: ProductSummary) => void;
  favoriteIds?: Set<string>;
  onToggleWishlist?: (product: ProductSummary) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
            <div className="aspect-[4/5] animate-pulse bg-slate-100" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-2/5 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-[26px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-[var(--shakh-shadow-sm)]">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-orange-50 text-2xl text-orange-600">◈</div>
        <h3 className="mt-4 text-lg font-black text-slate-950">{emptyTitle}</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-500">{emptyMeta}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => <ProductCard key={product.id} product={product} onOpen={onOpen} isWishlisted={favoriteIds?.has(product.id)} onToggleWishlist={onToggleWishlist} />)}
    </div>
  );
}
