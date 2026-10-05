import { useEffect, useState } from 'react';
import AppShell from '../../components/shell/AppShell';
import type { MarketplaceFilters, ProductDetails, ProductSummary } from './catalog';
import { DEFAULT_FILTERS } from './catalog';
import MarketplaceToolbar from './components/MarketplaceToolbar';
import ProductGrid from './components/ProductGrid';
import ProductDetailPanel from './components/ProductDetailPanel';
import StorefrontPreview from './components/StorefrontPreview';
import { getActiveCategories, getMarketplaceProducts, getProductDetails, type CatalogCategory } from '../commerce/catalogApi';
import { addVariantToCart } from '../commerce/cartApi';
import { useAuth } from '../auth/AuthContext';
import { recordAnalyticsEvent } from '../commerce/analyticsApi';
import { listActivePromotions, type Promotion } from '../commerce/promotionsApi';
import { listFavoriteIds, toggleProductFavorite } from '../commerce/favoritesApi';
import { setPageSeo } from '../../lib/seo';

export default function MarketplacePage() {
  const [filters, setFilters] = useState<MarketplaceFilters>(DEFAULT_FILTERS);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteMessage, setFavoriteMessage] = useState<string | null>(null);
  const [favoriteLoadError, setFavoriteLoadError] = useState<string | null>(null);
  const { user } = useAuth();
  const [analyticsSessionId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setFavoriteIds(new Set());
      setFavoriteLoadError(null);
      return;
    }
    setFavoriteLoadError(null);
    listFavoriteIds()
      .then((ids) => { if (!cancelled) setFavoriteIds(new Set(ids)); })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFavoriteLoadError(error instanceof Error ? error.message : 'نەتوانرا دڵخوازەکان باربکرێن.');
      });
    return () => { cancelled = true; };
  }, [user]);


  useEffect(() => {
    setPageSeo({
      title: filters.query.trim() ? `گەڕان: ${filters.query.trim()} | SHAKH` : "بازار | SHAKH — شاخ",
      description: "بازار و کاتەلۆگی ڕاستەوخۆی SHAKH؛ بەرهەم، فرۆشیار و کاتەگۆرییەکان.",
      canonicalPath: window.location.pathname + (filters.query.trim() ? `#marketplace?q=${encodeURIComponent(filters.query.trim())}` : "#marketplace"),
    });
  }, [filters.query]);

  useEffect(() => {
    const syncSearchFromHash = () => {
      const rawHash = window.location.hash.slice(1);
      const [route, rawQuery] = rawHash.split('?');
      const query = route === 'marketplace' ? new URLSearchParams(rawQuery ?? '').get('q') ?? '' : '';

      setFilters((current) => current.query === query ? current : { ...current, query });
    };

    syncSearchFromHash();
    window.addEventListener('hashchange', syncSearchFromHash);
    return () => window.removeEventListener('hashchange', syncSearchFromHash);
  }, []);

  useEffect(() => {
    const syncCategoryFromHash = () => {
      const route = window.location.hash.slice(1).split('?')[0].split('/')[0];
      if (route === 'market' || route === 'marketplace' || !route) {
        setFilters((current) => current.categoryId === null ? current : { ...current, categoryId: null });
        return;
      }

      const category = categories.find((item) => item.slug === route);
      if (category) {
        setFilters((current) => current.categoryId === category.id ? current : { ...current, categoryId: category.id });
      }
    };

    syncCategoryFromHash();
    window.addEventListener('hashchange', syncCategoryFromHash);
    return () => window.removeEventListener('hashchange', syncCategoryFromHash);
  }, [categories]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    Promise.all([getActiveCategories(), getMarketplaceProducts(filters), listActivePromotions()])
      .then(([nextCategories, nextProducts, nextPromotions]) => {
        if (cancelled) return;
        setCategories(nextCategories);
        setProducts(nextProducts);
        setActivePromotions(nextPromotions);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : 'کێشەیەک لە بارکردنی کاتەلۆگ ڕوویدا.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [filters]);

  async function addProductVariantToCart(variantId: string) {
    if (!user) {
      window.location.hash = '#auth/sign-in';
      return;
    }
    setCartMessage(null);
    try {
      await addVariantToCart(variantId, 1);
      void recordAnalyticsEvent({ eventName: "add_to_cart", entityType: "variant", entityId: variantId, sessionId: analyticsSessionId, properties: { quantity: 1 } }).catch(() => undefined);
      setCartMessage('بە سەرکەوتوویی بۆ سەبەت زیاد کرا.');
    } catch (error: unknown) {
      setCartMessage(error instanceof Error ? error.message : 'نەتوانرا بەرهەم بۆ سەبەت زیاد بکرێت.');
    }
  }

  async function toggleFavorite(productId: string) {
    if (!user) {
      window.location.hash = '#auth/sign-in';
      return;
    }
    setFavoriteMessage(null);
    try {
      const next = await toggleProductFavorite(productId);
      setFavoriteIds((current) => {
        const copy = new Set(current);
        if (next) copy.add(productId);
        else copy.delete(productId);
        return copy;
      });
      setFavoriteMessage(next ? 'بەرهەمەکە بۆ دڵخوازەکان زیاد کرا.' : 'بەرهەمەکە لە دڵخوازەکان لابرا.');
    } catch (error: unknown) {
      setFavoriteMessage(error instanceof Error ? error.message : 'نەتوانرا دڵخوازەکان نوێ بکرێنەوە.');
    }
  }

  async function openProduct(product: ProductSummary) {
    setDetailsLoading(true);
    setErrorMessage(null);
    try {
      const details = await getProductDetails(product.id);
      setSelectedProduct(details);
      void recordAnalyticsEvent({ eventName: "product_view", entityType: "product", entityId: details.id, sessionId: analyticsSessionId, properties: { product_slug: details.slug } }).catch(() => undefined);
      setPageSeo({
        title: details.seoTitle || `${details.title} | SHAKH`,
        description: details.seoDescription || details.description || "SHAKH marketplace",
        canonicalPath: `#marketplace/product/${details.slug || details.id}`,
      });
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'نەتوانرا وردەکاری بەرهەم باربکرێت.');
    } finally {
      setDetailsLoading(false);
    }
  }

  return (
    <AppShell>
      <main className="space-y-7" dir="rtl">
        <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">SHAKH MARKETPLACE</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">بازارێکی خێرا بۆ دۆزینەوە، هەڵبژاردن و کڕین.</h1>
              <p className="mt-3 text-sm leading-7 text-slate-500 sm:text-base">ئەم کاتەلۆگە بە ڕاستەوخۆ لە Supabase ـەوە data وەردەگرێت. هیچ بەرهەمێکی ساختە لە UI ـدا نیشان نادرێت.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[['پۆل', categories.length], ['بەرهەم', products.length], ['داتای ڕاستەقینە', 'DB']].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-[10px] font-black text-slate-400">CATALOG</p>
                  <p className="mt-1 text-xs font-black text-slate-900">{value}</p>
                  <p className="text-[10px] font-semibold text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <MarketplaceToolbar value={filters} onChange={setFilters} categories={categories} />

        {activePromotions.length ? (
          <section aria-label="پرۆمۆشنە چالاکەکان" className="overflow-hidden rounded-[24px] border border-orange-100 bg-gradient-to-l from-orange-50 to-white p-4 shadow-[var(--shakh-shadow-sm)] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-600">LIVE OFFER</p><h2 className="mt-1 text-lg font-black text-slate-950">{activePromotions[0].name_ckb || activePromotions[0].name_ar || activePromotions[0].name_en}</h2><p className="mt-1 text-xs font-semibold text-slate-500">{activePromotions[0].discount_type === 'percentage' ? `${activePromotions[0].discount_value}% داشکاندن` : `${new Intl.NumberFormat('ku-IQ').format(activePromotions[0].discount_value)} د.ع داشکاندن`}{activePromotions[0].promotion_type === 'coupon' ? ' · بە کۆدی coupon' : ' · خۆکار'}</p></div>
              {activePromotions.length > 1 ? <span className="rounded-full bg-white px-3 py-2 text-[10px] font-black text-slate-500 shadow-sm">+{activePromotions.length - 1} offer</span> : null}
            </div>
          </section>
        ) : null}

        {errorMessage ? (
          <section role="alert" className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800">
            {errorMessage}
          </section>
        ) : null}

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">REAL DATA GRID</p>
              <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">بەرهەمەکان</h2>
            </div>
            <span className="text-xs font-black text-slate-400">{loading ? '...' : `${products.length} بەرهەم`}</span>
          </div>
          <ProductGrid products={products} loading={loading} onOpen={openProduct} favoriteIds={favoriteIds} onToggleWishlist={(product) => void toggleFavorite(product.id)} />
        </section>

        {detailsLoading ? <div className="rounded-[24px] border border-slate-200 bg-white p-5 text-center text-sm font-bold text-slate-500">وردەکاری بەرهەم بار دەکرێت...</div> : null}
        <ProductDetailPanel product={selectedProduct} onClose={() => setSelectedProduct(null)} onAddToCart={(variantId) => void addProductVariantToCart(variantId)} isFavorite={selectedProduct ? favoriteIds.has(selectedProduct.id) : false} onToggleFavorite={() => { if (selectedProduct) void toggleFavorite(selectedProduct.id); }} />
        {favoriteLoadError ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{favoriteLoadError}</div> : null}
        {favoriteMessage ? <div role="status" className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800">{favoriteMessage}</div> : null}
        {cartMessage ? <div role="status" className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800">{cartMessage}</div> : null}
        <StorefrontPreview />
      </main>
    </AppShell>
  );
}
