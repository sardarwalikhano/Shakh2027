export type ProductImage = { id: string; url: string; alt: string };

export type ProductSummary = {
  id: string;
  title: string;
  slug: string;
  priceIqd: number;
  compareAtIqd?: number | null;
  currency: 'IQD';
  rating?: number | null;
  reviewCount?: number | null;
  image?: ProductImage | null;
  vendorName?: string | null;
  categoryName?: string | null;
  badge?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export type ProductDetails = ProductSummary & {
  description?: string | null;
  images: ProductImage[];
  variants: Array<{ id: string; label: string; value: string; available: boolean }>;
  seller: { id: string; name: string; rating?: number | null; responseRate?: number | null } | null;
};

export type MarketplaceFilters = {
  query: string;
  sort: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating';
  categoryId: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  onlyAvailable: boolean;
};

export const DEFAULT_FILTERS: MarketplaceFilters = {
  query: '',
  sort: 'relevance',
  categoryId: null,
  minPrice: null,
  maxPrice: null,
  onlyAvailable: true,
};
