import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
  listTargetedMarketplacePosts,
  type MarketplacePost,
  type PostSection,
} from "../../marketplace/postsApi";

function primaryRole(roles: string[]) {
  const priority = [
    "customer",
    "restaurant_vendor",
    "supermarket_vendor",
    "fashion_vendor",
    "beauty_vendor",
    "car_dealer",
    "umrah_agency",
    "captain",
    "captain_manager",
    "support",
    "admin",
    "super_admin",
  ];
  return priority.find((role) => roles.includes(role)) ?? roles[0] ?? null;
}

function localizedContent(post: MarketplacePost) {
  return post.content_ckb || post.content_ar || post.content_en || "";
}

function localizedCta(post: MarketplacePost) {
  return post.cta_label_ckb || post.cta_label_ar || post.cta_label_en || "بینین";
}

function targetBadge(post: MarketplacePost) {
  return post.target_role ? "بۆ ڕۆڵی دیاریکراو" : "بۆ هەمووان";
}

export default function MarketplacePostsRail({
  sectionCode = null,
  categoryId = null,
  title = "پۆستە تایبەتەکان",
}: {
  sectionCode?: PostSection | null;
  categoryId?: string | null;
  title?: string;
}) {
  const { roles } = useAuth();
  const role = useMemo(() => primaryRole(roles), [roles]);
  const [posts, setPosts] = useState<MarketplacePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    void listTargetedMarketplacePosts(sectionCode, role, categoryId, 8)
      .then((rows) => {
        if (!cancelled) setPosts(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "نەتوانرا پۆستەکان باربکرێن.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sectionCode, role, categoryId]);

  if (!loading && !error && posts.length === 0) return null;

  return (
    <section className="space-y-4" aria-label={title}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">SHAKH POSTS</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">{title}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-400">پۆستەکان بە پێی ڕۆڵ و کاتەگۆریی account ـەکەت دیاریدەکرێن.</p>
        </div>
        <span className="hidden rounded-full bg-orange-50 px-3 py-1.5 text-[9px] font-black text-orange-700 sm:inline-flex">
          TARGETED
        </span>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-[220px] min-w-[250px] animate-pulse rounded-[24px] bg-slate-100 sm:min-w-[300px]" />
          ))}
        </div>
      ) : (
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {posts.map((post) => (
            <article key={post.id} className="min-w-[270px] max-w-[330px] shrink-0 snap-start overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[var(--shakh-shadow-sm)] sm:min-w-[310px]">
              <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                {post.image_urls[0] ? (
                  <img src={post.image_urls[0]} alt={post.title_ckb || post.title_ar || post.title_en} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center bg-gradient-to-br from-slate-100 via-white to-orange-50 px-6 text-center text-xs font-black text-slate-400">
                    SHAKH POST
                  </div>
                )}
                <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[9px] font-black text-slate-700 shadow-sm">
                  {targetBadge(post)}
                </span>
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <h3 className="line-clamp-2 text-sm font-black leading-6 text-slate-950">{post.title_ckb || post.title_ar || post.title_en}</h3>
                  {localizedContent(post) ? <p className="mt-2 line-clamp-3 text-xs leading-6 text-slate-500">{localizedContent(post)}</p> : null}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black text-slate-400">{post.price_iqd == null ? "SHAKH" : new Intl.NumberFormat("ku-IQ").format(post.price_iqd) + " د.ع"}</span>
                  <a href={post.target_route || "#market"} className="rounded-xl bg-slate-950 px-3.5 py-2.5 text-[10px] font-black text-white transition hover:bg-slate-800">
                    {localizedCta(post)}
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
