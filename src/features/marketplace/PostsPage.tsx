import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import AppShell from "../../components/shell/AppShell";
import { InlineError, LoadingState, SuccessNotice } from "../../components/ux/UiStates";
import { useAuth } from "../auth/AuthContext";
import {
  createMarketplacePost,
  getAllowedPostSections,
  listAdminMarketplacePosts,
  listPostCategories,
  listPostRoles,
  uploadPostImages,
  MAX_POST_IMAGES,
  MAX_POST_IMAGE_BYTES,
  type MarketplacePost,
  type PostCategory,
  type PostRole,
  type PostSection,
} from "./postsApi";

const SECTIONS: Array<{ value: PostSection; label: string }> = [
  { value: "marketplace", label: "بازار" },
  { value: "food", label: "خواردن" },
  { value: "supermarket", label: "سوپەرمارکێت" },
  { value: "fashion", label: "جل و بەرگ" },
  { value: "beauty", label: "جوانکاری" },
  { value: "cars", label: "ئۆتۆمبێل" },
  { value: "umrah", label: "عومرە" },
  { value: "delivery", label: "گەیاندن" },
  { value: "offers", label: "پێشنیارەکان" },
  { value: "announcement", label: "ڕاگەیاندن" },
];

type FormState = {
  sectionCode: PostSection;
  targetRole: string;
  categoryId: string;
  titleCkb: string;
  titleAr: string;
  titleEn: string;
  contentCkb: string;
  contentAr: string;
  contentEn: string;
  priceIqd: string;
  ctaLabelCkb: string;
  ctaLabelAr: string;
  ctaLabelEn: string;
  status: MarketplacePost["status"];
  isFeatured: boolean;
};

const INITIAL_FORM: FormState = {
  sectionCode: "marketplace",
  targetRole: "",
  categoryId: "",
  titleCkb: "",
  titleAr: "",
  titleEn: "",
  contentCkb: "",
  contentAr: "",
  contentEn: "",
  priceIqd: "",
  ctaLabelCkb: "",
  ctaLabelAr: "",
  ctaLabelEn: "",
  status: "published",
  isFeatured: false,
};

const MAX_FILE_SIZE_LABEL = "6MB";

function localizeRole(role: PostRole) {
  return role.nameCkb || role.nameAr || role.nameEn;
}

function localizeCategory(category: PostCategory) {
  return category.nameCkb || category.nameAr || category.nameEn;
}

function localizePost(post: MarketplacePost) {
  return post.title_ckb || post.title_ar || post.title_en;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ku-IQ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatIqd(value: number | null) {
  return value == null ? "—" : new Intl.NumberFormat("ku-IQ").format(value) + " د.ع";
}

function statusLabel(status: MarketplacePost["status"]) {
  return status === "published" ? "بڵاوکراوەتەوە" : status === "draft" ? "draft" : "ئەرشیف";
}

export default function PostsPage() {
  const { user, roles: userRoles } = useAuth();
  const allowedSectionCodes = useMemo(() => getAllowedPostSections(userRoles), [userRoles]);
  const isSuperAdmin = userRoles.includes("super_admin");
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [roles, setRoles] = useState<PostRole[]>([]);
  const [categories, setCategories] = useState<PostCategory[]>([]);
  const [posts, setPosts] = useState<MarketplacePost[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const previewUrls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => {
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [previewUrls]);

  async function load(initial = false) {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const [nextRoles, nextCategories, nextPosts] = await Promise.all([
        listPostRoles(),
        listPostCategories(),
        listAdminMarketplacePosts(),
      ]);
      setRoles(nextRoles);
      setCategories(nextCategories);
      setPosts(nextPosts);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "نەتوانرا Posts باربکرێن.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load(true);
  }, []);

  useEffect(() => {
    if (!allowedSectionCodes.length) return;
    setForm((current) => allowedSectionCodes.includes(current.sectionCode)
      ? current
      : { ...current, sectionCode: allowedSectionCodes[0] });
  }, [allowedSectionCodes]);

  function mergeSelectedFiles(nextFiles: File[]) {
    setError("");

    const combined = [...files, ...nextFiles];
    if (combined.length > MAX_POST_IMAGES) {
      setError("زۆرترین 8 وێنە بۆ هەر پۆستێک ڕێگەپێدراوە.");
      return;
    }

    const invalid = combined.find((file) => !file.type.startsWith("image/"));
    if (invalid) {
      setError("تەنها فایلە وێنەییەکان ڕێگەپێدراون.");
      return;
    }

    const tooLarge = combined.find((file) => file.size > MAX_POST_IMAGE_BYTES);
    if (tooLarge) {
      setError("قەبارەی هەر وێنەیەک نابێت لە " + MAX_FILE_SIZE_LABEL + " زیاتر بێت.");
      return;
    }

    setFiles(combined);
  }

  function handleGalleryChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    mergeSelectedFiles(selected);
    event.target.value = "";
  }

  function handleCameraChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []).slice(0, 1);
    mergeSelectedFiles(selected);
    event.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user?.id) {
      setError("تکایە سەرەتا بچۆ ژوورەوە.");
      return;
    }

    if (!allowedSectionCodes.includes(form.sectionCode)) {
      setError("ئەم بەشە بۆ ڕۆڵی هەژمارەکەت ڕێگەپێدراو نییە.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const uploaded = files.length ? await uploadPostImages(files, user.id) : { urls: [], paths: [] };

      await createMarketplacePost({
        sectionCode: form.sectionCode,
        targetRole: form.targetRole || null,
        categoryId: form.categoryId || null,
        titleCkb: form.titleCkb.trim(),
        titleAr: form.titleAr.trim(),
        titleEn: form.titleEn.trim(),
        contentCkb: form.contentCkb.trim() || null,
        contentAr: form.contentAr.trim() || null,
        contentEn: form.contentEn.trim() || null,
        imageUrls: uploaded.urls,
        priceIqd: form.priceIqd.trim() ? Number(form.priceIqd) : null,
        ctaLabelCkb: form.ctaLabelCkb.trim() || null,
        ctaLabelAr: form.ctaLabelAr.trim() || null,
        ctaLabelEn: form.ctaLabelEn.trim() || null,
        status: form.status,
        isFeatured: form.isFeatured,
      });

      setForm({ ...INITIAL_FORM, sectionCode: allowedSectionCodes[0] ?? "cars" });
      setFiles([]);
      setSuccess("پۆست بە سەرکەوتوویی تۆمار کرا.");
      await load(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "نەتوانرا پۆست تۆمار بکرێت.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <main dir="rtl" className="space-y-5">
        <section className="rounded-[30px] bg-slate-950 p-6 text-white shadow-[var(--shakh-shadow-md)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">POSTS CENTER</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">پۆستەکانی SHAKH</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
                پۆستێک بۆ بەش، ڕۆڵ و کاتەگۆری دیاری بکە؛ وێنە لە گەلەری یان کامێرا زیاد بکە و هەموو data ـەکە لە Supabase تۆمار دەکرێت.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white/8 px-3 py-3"><p className="text-[9px] font-black text-white/40">ROLES</p><p className="mt-1 text-sm font-black">{roles.length}</p></div>
              <div className="rounded-2xl bg-white/8 px-3 py-3"><p className="text-[9px] font-black text-white/40">CATEGORIES</p><p className="mt-1 text-sm font-black">{categories.length}</p></div>
              <div className="rounded-2xl bg-white/8 px-3 py-3"><p className="text-[9px] font-black text-white/40">POSTS</p><p className="mt-1 text-sm font-black">{posts.length}</p></div>
            </div>
          </div>
        </section>

        {error ? <InlineError title="Posts کێشەی هەیە" body={error} /> : null}
        {success ? <SuccessNotice title="سەرکەوتوو" body={success} /> : null}
        {loading ? <LoadingState label="Posts Center بار دەکرێت..." /> : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,.9fr)]">
          <form onSubmit={(event) => void submit(event)} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">CREATE POST</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">پۆستی نوێ</h2>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  {isSuperAdmin
                    ? "سوبر ئەدمین دەتوانێت لە هەموو بەش و کاتەگۆرییەکان پۆست بکات."
                    : "هەژمارەکەت تەنها لە بەشی ڕۆڵی خۆی و ئۆتۆمبێل دەتوانێت پۆست بکات."}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-black text-slate-500">MAX {MAX_POST_IMAGES} IMAGES</span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <label className="space-y-1.5">
                <span className="text-[10px] font-black text-slate-500">بەش</span>
                <select value={form.sectionCode} onChange={(event) => update("sectionCode", event.target.value as PostSection)} className="min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-black outline-none focus:border-orange-300">
                  {SECTIONS.filter((item) => allowedSectionCodes.includes(item.value)).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>

              {isSuperAdmin ? (
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-500">ڕۆڵی ئامانج</span>
                  <select value={form.targetRole} onChange={(event) => update("targetRole", event.target.value)} className="min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-black outline-none focus:border-orange-300">
                    <option value="">هەمووان</option>
                    {roles.map((role) => <option key={role.code} value={role.code}>{localizeRole(role)}</option>)}
                  </select>
                </label>
              ) : (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-500">دەسەڵاتی پۆست</span>
                  <div className="min-h-11 rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2 text-[10px] font-black leading-5 text-orange-800">
                    تەنها: {allowedSectionCodes.map((code) => SECTIONS.find((item) => item.value === code)?.label ?? code).join(" + ")}
                  </div>
                </div>
              )}

              <label className="space-y-1.5">
                <span className="text-[10px] font-black text-slate-500">کاتەگۆری</span>
                <select value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)} className="min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-black outline-none focus:border-orange-300">
                  <option value="">هەموو کاتەگۆرییەکان</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{localizeCategory(category)}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <input required minLength={2} value={form.titleCkb} onChange={(event) => update("titleCkb", event.target.value)} placeholder="ناونیشانی کوردی" className="min-h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-orange-300" />
              <input required minLength={2} value={form.titleAr} onChange={(event) => update("titleAr", event.target.value)} placeholder="العنوان العربي" dir="rtl" className="min-h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-orange-300" />
              <input required minLength={2} value={form.titleEn} onChange={(event) => update("titleEn", event.target.value)} placeholder="English title" dir="ltr" className="min-h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-orange-300" />
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <textarea value={form.contentCkb} onChange={(event) => update("contentCkb", event.target.value)} placeholder="ناوەڕۆکی کوردی" className="min-h-32 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-7 outline-none focus:border-orange-300" />
              <textarea value={form.contentAr} onChange={(event) => update("contentAr", event.target.value)} placeholder="المحتوى العربي" dir="rtl" className="min-h-32 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-7 outline-none focus:border-orange-300" />
              <textarea value={form.contentEn} onChange={(event) => update("contentEn", event.target.value)} placeholder="English content" dir="ltr" className="min-h-32 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-7 outline-none focus:border-orange-300" />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <input type="number" min="0" step="1" value={form.priceIqd} onChange={(event) => update("priceIqd", event.target.value)} placeholder="نرخ بە دینار" className="min-h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-orange-300" />
              <input value={form.ctaLabelCkb} onChange={(event) => update("ctaLabelCkb", event.target.value)} placeholder="دوگمەی CTA ـی کوردی" className="min-h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-orange-300" />
              <input value={form.ctaLabelEn} onChange={(event) => update("ctaLabelEn", event.target.value)} placeholder="English CTA" dir="ltr" className="min-h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-orange-300" />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <select value={form.status} onChange={(event) => update("status", event.target.value as MarketplacePost["status"])} className="min-h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-black">
                <option value="published">بڵاوکراوە</option>
                <option value="draft">Draft</option>
                <option value="archived">ئەرشیف</option>
              </select>
              <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-black">
                <input type="checkbox" checked={form.isFeatured} onChange={(event) => update("isFeatured", event.target.checked)} className="accent-orange-500" />
                Featured
              </label>
              <button type="submit" disabled={saving || loading} className="shakh-btn-primary min-h-11 px-6">
                {saving ? "تۆمار دەکرێت..." : "بڵاوکردنەوەی پۆست"}
              </button>
            </div>

            <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black text-slate-950">وێنەکانی پۆست</p>
                  <p className="mt-1 text-[10px] font-semibold leading-5 text-slate-500">لە گەلەری یان کامێرا زیاد بکە. هەر فایلێک تا {MAX_FILE_SIZE_LABEL}؛ کۆی گشتی تا {MAX_POST_IMAGES} وێنە.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleGalleryChange} className="hidden" />
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleCameraChange} className="hidden" />
                  <button type="button" onClick={() => galleryInputRef.current?.click()} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-black text-slate-700 transition hover:border-orange-200 hover:bg-orange-50">📁 گەلەری</button>
                  <button type="button" onClick={() => cameraInputRef.current?.click()} className="rounded-xl bg-slate-950 px-4 py-2.5 text-[10px] font-black text-white transition hover:bg-slate-800">📷 کامێرا</button>
                </div>
              </div>

              {files.length ? (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {files.map((file, index) => (
                    <div key={previewUrls[index] ?? file.name + index} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <img src={previewUrls[index]} alt={file.name} className="aspect-square w-full object-cover" />
                      <button type="button" onClick={() => removeFile(index)} className="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-slate-950/85 text-xs font-black text-white" aria-label="سڕینەوەی وێنە">×</button>
                      <p className="truncate px-2 py-2 text-[9px] font-bold text-slate-500">{file.name}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-white px-4 py-7 text-center text-xs font-bold text-slate-400">هێشتا هیچ وێنەیەک هەڵنەبژێردراوە.</div>
              )}
            </div>
          </form>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">LIVE POSTS</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">پۆستە تۆمارکراوەکان</h2>
              </div>
              <button type="button" onClick={() => void load(false)} disabled={refreshing} className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black text-slate-600 disabled:opacity-50">
                {refreshing ? "نوێ دەکرێتەوە..." : "نوێکردنەوە"}
              </button>
            </div>

            {!loading && !posts.length ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center">
                <p className="text-sm font-black text-slate-800">هێشتا هیچ پۆستێک نییە.</p>
                <p className="mt-2 text-xs leading-6 text-slate-500">یەکەم پۆستت دروست بکە بۆ ئەوەی لێرە دەربکەوێت.</p>
              </div>
            ) : null}

            {posts.length ? (
              <div className="mt-5 space-y-3">
                {posts.map((post) => (
                  <article key={post.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/70">
                    <div className="flex gap-3 p-3">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white">
                        {post.image_urls[0] ? <img src={post.image_urls[0]} alt={localizePost(post)} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[9px] font-black text-slate-400">NO IMAGE</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="line-clamp-2 text-xs font-black text-slate-950">{localizePost(post)}</h3>
                          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-slate-500">{statusLabel(post.status)}</span>
                        </div>
                        <p className="mt-2 truncate text-[10px] font-bold text-slate-500">{post.target_role || "هەمووان"} · {post.category_id ? "کاتەگۆری دیاریکراو" : "هەموو کاتەگۆرییەکان"}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] font-black text-slate-400">
                          <span>{post.section_code}</span>
                          <span>•</span>
                          <span>{post.image_urls.length} وێنە</span>
                          <span>•</span>
                          <span>{formatIqd(post.price_iqd)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-slate-200/70 px-3 py-2 text-[9px] font-semibold text-slate-400">{formatDate(post.created_at)}</div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </AppShell>
  );
}
