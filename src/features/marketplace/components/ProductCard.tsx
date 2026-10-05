import type { ProductSummary } from '../catalog';

function formatIqd(value: number) {
  return new Intl.NumberFormat('ku-IQ').format(value);
}

export default function ProductCard({
  product,
  isWishlisted = false,
  onOpen,
  onToggleWishlist,
}: {
  product: ProductSummary;
  isWishlisted?: boolean;
  onOpen?: (product: ProductSummary) => void;
  onToggleWishlist?: (product: ProductSummary) => void;
}) {
  const discount = product.compareAtIqd && product.compareAtIqd > product.priceIqd
    ? Math.round((1 - product.priceIqd / product.compareAtIqd) * 100)
    : null;

  return (
    <article className="group overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[var(--shakh-shadow-sm)] transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shakh-shadow-md)]">
      <div className="relative aspect-[4/5] overflow-hidden bg-slate-100">
          {product.image?.url ? (
            <img
              src={product.image.url}
              alt={product.image.alt || product.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="grid h-full place-items-center bg-gradient-to-br from-slate-100 via-white to-orange-50 px-4 text-center text-xs font-bold text-slate-400">
              وێنەی بەرهەم بەردەست نییە
            </div>
          )}
          <button
            type="button"
            className="absolute inset-0 z-0"
            onClick={() => onOpen?.(product)}
            aria-label={`بینینی ${product.title}`}
          />
          <div className="absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2">
            {product.badge ? <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black text-white">{product.badge}</span> : <span />}
            {discount ? <span className="rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-black text-white">-{discount}%</span> : null}
          </div>
        </div>
        <div className="space-y-2 p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <button type="button" className="shakh-focus min-w-0 text-right" onClick={() => onOpen?.(product)} aria-label={`بینینی ${product.title}`}>
              <h3 className="line-clamp-2 text-sm font-black leading-6 text-slate-950">{product.title}</h3>
            </button>
            {onToggleWishlist ? (
              <button
                type="button"
                aria-label={isWishlisted ? 'لابردنی لە دڵخوازەکان' : 'زیادکردن بۆ دڵخوازەکان'}
                className={`shakh-focus grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${isWishlisted ? 'border-orange-200 bg-orange-50 text-orange-600' : 'border-slate-200 bg-white text-slate-500'} transition`}
                onClick={(event) => { event.stopPropagation(); onToggleWishlist(product); }}
              >
                {isWishlisted ? '♥' : '♡'}
              </button>
            ) : null}
          </div>

          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-base font-black text-slate-950">{formatIqd(product.priceIqd)} د.ع</p>
              {product.compareAtIqd && product.compareAtIqd > product.priceIqd ? (
                <p className="text-[11px] font-semibold text-slate-400 line-through">{formatIqd(product.compareAtIqd)} د.ع</p>
              ) : null}
            </div>
            {product.rating ? (
              <span className="text-[11px] font-bold text-amber-600">★ {product.rating.toFixed(1)}</span>
            ) : null}
          </div>

          <p className="truncate text-[11px] font-semibold text-slate-500">{product.vendorName ?? 'فرۆشیار'}</p>
        </div>
    </article>
  );
}
