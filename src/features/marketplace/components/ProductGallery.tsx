import type { ProductImage } from '../catalog';
import { useState } from 'react';

export default function ProductGallery({ images }: { images: ProductImage[] }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? null;

  if (!current) {
    return <div className="grid aspect-square place-items-center rounded-[28px] bg-slate-100 text-sm font-bold text-slate-400">وێنەی بەرهەم بەردەست نییە</div>;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[92px_1fr]">
      <div className="order-2 flex gap-2 overflow-x-auto lg:order-1 lg:flex-col lg:overflow-visible">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setActive(index)}
            className={`h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-slate-50 ${index === active ? 'border-orange-500' : 'border-slate-200'}`}
            aria-label={`وێنە ${index + 1}`}
          >
            <img src={image.url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      <div className="order-1 overflow-hidden rounded-[28px] bg-slate-100 lg:order-2">
        <img src={current.url} alt={current.alt} className="aspect-square h-full w-full object-cover" />
      </div>
    </div>
  );
}
