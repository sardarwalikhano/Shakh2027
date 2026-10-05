import { useEffect, useState } from 'react';
import type { ProductDetails } from '../catalog';
import ProductGallery from './ProductGallery';
import { listProductReviews, type ProductReview } from '../../commerce/reviewsApi';

function formatIqd(value: number) {
  return new Intl.NumberFormat('ku-IQ').format(value);
}

export default function ProductDetailPanel({
  product,
  onClose,
  onAddToCart,
  isFavorite = false,
  onToggleFavorite,
}: {
  product: ProductDetails | null;
  onClose?: () => void;
  onAddToCart?: (variantId: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const selectedVariant = product?.variants.find((variant) => variant.id === selectedVariantId) ?? product?.variants.find((variant) => variant.available) ?? product?.variants[0] ?? null;

  useEffect(() => {
    if (!product?.id) {
      setReviews([]);
      setReviewsError(null);
      return;
    }
    let cancelled = false;
    setReviewsLoading(true);
    setReviewsError(null);
    void listProductReviews(product.id, 8)
      .then((next) => { if (!cancelled) setReviews(next); })
      .catch((error: unknown) => { if (!cancelled) setReviewsError(error instanceof Error ? error.message : 'نەتوانرا هەڵسەنگاندنەکان باربکرێن.'); })
      .finally(() => { if (!cancelled) setReviewsLoading(false); });
    return () => { cancelled = true; };
  }, [product?.id]);

  if (!product) {
    return (
      <section className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-[var(--shakh-shadow-sm)]">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-xl text-slate-500">◉</div>
        <h2 className="mt-4 text-lg font-black text-slate-950">بەرهەمێک هەڵبژێرە</h2>
        <p className="mt-2 text-sm leading-7 text-slate-500">Product detail experience ـەکە بۆ data ـی واقعی دامەزراوە.</p>
      </section>
    );
  }

  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-[var(--shakh-shadow-md)] sm:p-6">
      {onClose ? (
        <div className="mb-4 flex justify-end">
          <button type="button" onClick={onClose} className="shakh-icon-button shakh-focus" aria-label="داخستن">×</button>
        </div>
      ) : null}
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,.95fr)]">
        <ProductGallery images={product.images} />
        <div className="flex flex-col">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">PRODUCT DETAIL</p>
          <h1 className="mt-2 text-2xl font-black leading-9 text-slate-950 sm:text-3xl">{product.title}</h1>
          {product.rating ? <p className="mt-2 text-sm font-bold text-amber-600">★ {product.rating.toFixed(1)} · {product.reviewCount ?? 0} هەڵسەنگاندن</p> : null}

          <div className="mt-5 rounded-[22px] bg-slate-50 p-4">
            <p className="text-2xl font-black text-slate-950">{formatIqd(product.priceIqd)} د.ع</p>
            {product.compareAtIqd && product.compareAtIqd > product.priceIqd ? <p className="mt-1 text-sm font-semibold text-slate-400 line-through">{formatIqd(product.compareAtIqd)} د.ع</p> : null}
          </div>

          {product.description ? <p className="mt-5 text-sm leading-8 text-slate-600">{product.description}</p> : null}

          {product.variants.length ? (
            <div className="mt-6 space-y-3">
              <h2 className="text-sm font-black text-slate-950">هەڵبژاردە</h2>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <button key={variant.id} type="button" disabled={!variant.available} onClick={() => setSelectedVariantId(variant.id)} className={`rounded-2xl border px-3.5 py-2 text-xs font-black transition ${selectedVariant?.id === variant.id ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-700'} disabled:cursor-not-allowed disabled:opacity-40`}>{variant.label}: {variant.value}</button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-7 grid gap-2 sm:grid-cols-[1fr_auto]">
            <button type="button" className="shakh-btn-primary shakh-focus min-h-12" disabled={!selectedVariant?.available || !onAddToCart} onClick={() => selectedVariant && onAddToCart?.(selectedVariant.id)}>زیادکردن بۆ سەبەت</button>
            <button type="button" className={`shakh-focus min-h-12 rounded-2xl border px-5 text-sm font-black transition ${isFavorite ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-800'}`} onClick={() => onToggleFavorite?.()} aria-pressed={isFavorite}>{isFavorite ? '♥ دڵخوازە' : '♡ دڵخواز'}</button>
          </div>

          <section className="mt-7 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-600">REVIEWS</p>
                <h2 className="mt-1 text-base font-black text-slate-950">هەڵسەنگاندنی کڕیاران</h2>
              </div>
              {product.reviewCount ? <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">{product.reviewCount} هەڵسەنگاندن</span> : null}
            </div>
            {reviewsLoading ? <p className="mt-4 text-xs font-bold text-slate-500">هەڵسەنگاندنەکان بار دەکرێن...</p> : null}
            {reviewsError ? <p role="alert" className="mt-4 text-xs font-bold text-rose-700">{reviewsError}</p> : null}
            {!reviewsLoading && !reviewsError && reviews.length === 0 ? <p className="mt-4 text-xs font-semibold leading-6 text-slate-500">هێشتا هەڵسەنگاندنێک نییە بۆ ئەم بەرهەمە.</p> : null}
            {!reviewsLoading && !reviewsError && reviews.length > 0 ? (
              <div className="mt-4 divide-y divide-slate-200">
                {reviews.map((review) => (
                  <article key={review.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-slate-950">{review.reviewer_display_name}</p>
                        <p className="mt-1 text-sm font-black tracking-[0.08em] text-amber-500">{'★'.repeat(review.rating)}<span className="text-slate-200">{'★'.repeat(5 - review.rating)}</span></p>
                      </div>
                      {review.verified_purchase ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700">کڕینی پشتڕاستکراو</span> : null}
                    </div>
                    {review.title ? <h3 className="mt-2 text-xs font-black text-slate-900">{review.title}</h3> : null}
                    {review.body ? <p className="mt-1 text-xs leading-6 text-slate-600">{review.body}</p> : null}
                  </article>
                ))}
              </div>
            ) : null}
            <a href="#account/reviews" className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-white px-3.5 text-[10px] font-black text-slate-700 ring-1 ring-slate-200">نووسینی هەڵسەنگاندن لە account</a>
          </section>

          {product.seller ? (
            <div className="mt-7 rounded-[22px] border border-slate-200 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">SELLER</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-950">{product.seller.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{product.seller.responseRate ? `${product.seller.responseRate}% وەڵامدانەوە` : 'فرۆشیارێکی پشتپێبەستراو'}</p>
                </div>
                <a
                  href={`#marketplace?q=${encodeURIComponent(product.seller.name)}`}
                  className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white no-underline transition hover:bg-slate-800"
                >
                  بینینی فرۆشگا
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
