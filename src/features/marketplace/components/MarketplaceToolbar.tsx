import { useMemo } from 'react';
import type { CatalogCategory } from '../../commerce/catalogApi';
import type { MarketplaceFilters } from '../catalog';

const sortLabels: Record<MarketplaceFilters['sort'], string> = {
  relevance: 'پەیوەندیدارترین',
  newest: 'نوێترین',
  price_asc: 'نرخ: کەم بۆ زۆر',
  price_desc: 'نرخ: زۆر بۆ کەم',
  rating: 'هەڵسەنگاندن',
};

export default function MarketplaceToolbar({
  value,
  onChange,
  categories,
}: {
  value: MarketplaceFilters;
  onChange: (next: MarketplaceFilters) => void;
  categories: CatalogCategory[];
}) {
  const activeFilters = useMemo(
    () =>
      Number(Boolean(value.categoryId)) +
      Number(value.minPrice !== null) +
      Number(value.maxPrice !== null) +
      Number(!value.onlyAvailable),
    [value],
  );

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-[var(--shakh-shadow-sm)] sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[16px] border border-slate-200 bg-slate-50 px-3">
            <span className="text-slate-400" aria-hidden="true">⌕</span>
            <input
              value={value.query}
              onChange={(event) => onChange({ ...value, query: event.target.value })}
              placeholder="بگەڕێ بۆ ناوی بەرهەم..."
              aria-label="گەڕانی بەرهەم"
              className="h-11 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
            />
          </div>
          <select
            value={value.categoryId ?? 'all'}
            onChange={(event) => onChange({ ...value, categoryId: event.target.value === 'all' ? null : event.target.value })}
            className="h-11 rounded-[16px] border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none"
            aria-label="پۆل"
          >
            <option value="all">هەموو پۆلەکان</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.nameCkb}</option>
            ))}
          </select>
          <label className="flex h-11 items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={value.onlyAvailable}
              onChange={(event) => onChange({ ...value, onlyAvailable: event.target.checked })}
              className="accent-orange-500"
            />
            تەنها بەردەست
          </label>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 xl:border-t-0 xl:border-r xl:pt-0 xl:pr-3">
          <span className="text-xs font-bold text-slate-500">{activeFilters > 0 ? `${activeFilters} فلتەر چالاکە` : 'فلتەرێک نییە'}</span>
          <label className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">ڕیزکردن</span>
            <select
              value={value.sort}
              onChange={(event) => onChange({ ...value, sort: event.target.value as MarketplaceFilters['sort'] })}
              className="h-10 rounded-[14px] border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 outline-none"
              aria-label="ڕیزکردنی بەرهەم"
            >
              {Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        </div>
      </div>
    </section>
  );
}
