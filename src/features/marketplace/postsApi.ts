import { supabase } from "../../lib/supabase";

export const POST_IMAGE_BUCKET = "marketplace-posts";
export const MAX_POST_IMAGES = 8;
export const MAX_POST_IMAGE_BYTES = 6 * 1024 * 1024;

export type PostSection =
  | "marketplace"
  | "food"
  | "supermarket"
  | "fashion"
  | "beauty"
  | "cars"
  | "umrah"
  | "delivery"
  | "offers"
  | "announcement";

export type MarketplacePost = {
  id: string;
  created_by: string;
  section_code: PostSection;
  target_role: string | null;
  category_id: string | null;
  title_ckb: string;
  title_ar: string;
  title_en: string;
  content_ckb: string | null;
  content_ar: string | null;
  content_en: string | null;
  image_urls: string[];
  price_iqd: number | null;
  cta_label_ckb: string | null;
  cta_label_ar: string | null;
  cta_label_en: string | null;
  target_route: string;
  status: "draft" | "published" | "archived";
  is_featured: boolean;
  idempotency_key: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PostInput = {
  sectionCode: PostSection;
  targetRole?: string | null;
  categoryId?: string | null;
  titleCkb: string;
  titleAr: string;
  titleEn: string;
  contentCkb?: string | null;
  contentAr?: string | null;
  contentEn?: string | null;
  imageUrls?: string[];
  priceIqd?: number | null;
  ctaLabelCkb?: string | null;
  ctaLabelAr?: string | null;
  ctaLabelEn?: string | null;
  status?: MarketplacePost["status"];
  isFeatured?: boolean;
};

export type PostRole = {
  code: string;
  nameCkb: string;
  nameAr: string;
  nameEn: string;
};

export type PostCategory = {
  id: string;
  slug: string;
  nameCkb: string;
  nameAr: string;
  nameEn: string;
};

function asPost(row: Record<string, unknown>): MarketplacePost {
  return {
    id: String(row.id),
    created_by: String(row.created_by),
    section_code: row.section_code as PostSection,
    target_role: row.target_role ? String(row.target_role) : null,
    category_id: row.category_id ? String(row.category_id) : null,
    title_ckb: String(row.title_ckb ?? ""),
    title_ar: String(row.title_ar ?? ""),
    title_en: String(row.title_en ?? ""),
    content_ckb: row.content_ckb ? String(row.content_ckb) : null,
    content_ar: row.content_ar ? String(row.content_ar) : null,
    content_en: row.content_en ? String(row.content_en) : null,
    image_urls: Array.isArray(row.image_urls)
      ? row.image_urls.filter((value): value is string => typeof value === "string")
      : [],
    price_iqd: row.price_iqd == null ? null : Number(row.price_iqd),
    cta_label_ckb: row.cta_label_ckb ? String(row.cta_label_ckb) : null,
    cta_label_ar: row.cta_label_ar ? String(row.cta_label_ar) : null,
    cta_label_en: row.cta_label_en ? String(row.cta_label_en) : null,
    target_route: String(row.target_route ?? "#market"),
    status: row.status as MarketplacePost["status"],
    is_featured: Boolean(row.is_featured),
    idempotency_key: String(row.idempotency_key ?? ""),
    published_at: row.published_at ? String(row.published_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function ensurePostStorage(): Promise<void> {
  const { error } = await supabase.functions.invoke("ensure-marketplace-post-storage", {
    method: "POST",
    body: {},
  });
  if (error) throw new Error("post_storage_setup_failed: " + error.message);
}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  const mime = file.type.split("/")[1]?.toLowerCase();
  return mime && /^[a-z0-9]{1,8}$/.test(mime) ? mime : "jpg";
}

async function prepareImage(file: File): Promise<File> {
  if (file.size <= MAX_POST_IMAGE_BYTES) return file;
  if (typeof window === "undefined") throw new Error("image_too_large");

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("image_decode_failed"));
    });

    const maxDimension = 1800;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) throw new Error("image_canvas_unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.82),
    );

    if (!blob || blob.size > MAX_POST_IMAGE_BYTES) {
      throw new Error("image_too_large_after_compression");
    }

    return new File(
      [blob],
      file.name.replace(/\.[^.]+$/, "") + ".webp",
      { type: "image/webp", lastModified: Date.now() },
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadPostImages(
  files: File[],
  userId: string,
): Promise<{ urls: string[]; paths: string[] }> {
  if (!userId) throw new Error("not_authenticated");
  if (files.length > MAX_POST_IMAGES) throw new Error("max_" + MAX_POST_IMAGES + "_images");

  await ensurePostStorage();

  const urls: string[] = [];
  const paths: string[] = [];

  try {
    for (const rawFile of files) {
      if (!rawFile.type.startsWith("image/")) throw new Error("images_only");

      const file = await prepareImage(rawFile);
      if (file.size > MAX_POST_IMAGE_BYTES) throw new Error("image_too_large");

      const path = userId + "/" + crypto.randomUUID() + "." + extensionFor(file);
      const { data, error } = await supabase.storage
        .from(POST_IMAGE_BUCKET)
        .upload(path, file, {
          cacheControl: "31536000",
          contentType: file.type || "image/jpeg",
          upsert: false,
        });

      if (error) throw new Error("post_image_upload_failed: " + error.message);

      const publicUrl = supabase.storage.from(POST_IMAGE_BUCKET).getPublicUrl(data.path).data.publicUrl;
      if (!publicUrl) throw new Error("post_image_public_url_failed");

      paths.push(data.path);
      urls.push(publicUrl);
    }

    return { urls, paths };
  } catch (error) {
    if (paths.length) {
      await supabase.storage.from(POST_IMAGE_BUCKET).remove(paths).catch(() => undefined);
    }
    throw error;
  }
}

export async function createMarketplacePost(input: PostInput): Promise<MarketplacePost> {
  const { data, error } = await supabase.rpc("create_targeted_marketplace_post", {
    p_section_code: input.sectionCode,
    p_target_role: input.targetRole ?? null,
    p_category_id: input.categoryId ?? null,
    p_title_ckb: input.titleCkb,
    p_title_ar: input.titleAr,
    p_title_en: input.titleEn,
    p_content_ckb: input.contentCkb ?? null,
    p_content_ar: input.contentAr ?? null,
    p_content_en: input.contentEn ?? null,
    p_image_urls: input.imageUrls ?? [],
    p_price_iqd: input.priceIqd ?? null,
    p_cta_label_ckb: input.ctaLabelCkb ?? null,
    p_cta_label_ar: input.ctaLabelAr ?? null,
    p_cta_label_en: input.ctaLabelEn ?? null,
    p_status: input.status ?? "published",
    p_is_featured: input.isFeatured ?? false,
    p_idempotency_key: crypto.randomUUID() + "-" + Date.now(),
  });

  if (error) throw new Error("post_create_failed: " + error.message);
  return asPost(data as Record<string, unknown>);
}

export async function listAdminMarketplacePosts(): Promise<MarketplacePost[]> {
  const { data, error } = await supabase.rpc("list_marketplace_posts", {
    p_section_code: null,
    p_limit: 100,
  });
  if (error) throw new Error("post_admin_load_failed: " + error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(asPost);
}

export async function listTargetedMarketplacePosts(
  sectionCode: PostSection | null,
  targetRole: string | null,
  categoryId: string | null,
  limit = 12,
): Promise<MarketplacePost[]> {
  const { data, error } = await supabase.rpc("list_targeted_marketplace_posts", {
    p_section_code: sectionCode,
    p_target_role: targetRole,
    p_category_id: categoryId,
    p_limit: limit,
  });
  if (error) throw new Error("post_feed_load_failed: " + error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(asPost);
}

export async function listPostRoles(): Promise<PostRole[]> {
  const { data, error } = await supabase
    .from("app_roles")
    .select("code,name_ckb,name_ar,name_en")
    .order("code");

  if (error) throw new Error("post_roles_load_failed: " + error.message);
  return (data ?? []).map((row) => ({
    code: row.code,
    nameCkb: row.name_ckb,
    nameAr: row.name_ar,
    nameEn: row.name_en,
  }));
}

export async function listPostCategories(): Promise<PostCategory[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id,slug,name_ckb,name_ar,name_en")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name_ckb", { ascending: true });

  if (error) throw new Error("post_categories_load_failed: " + error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    nameCkb: row.name_ckb,
    nameAr: row.name_ar,
    nameEn: row.name_en,
  }));
}
