import { supabase } from '../../lib/supabase';

const env = import.meta.env as ImportMetaEnv & {
  VITE_SUPABASE_PRODUCT_IMAGE_BUCKET?: string;
};

const PRODUCT_IMAGE_BUCKET = env.VITE_SUPABASE_PRODUCT_IMAGE_BUCKET?.trim() || '';

export function resolveProductImageUrl(storagePath: string | null | undefined): string {
  const value = storagePath?.trim() || '';
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (!PRODUCT_IMAGE_BUCKET) return '';
  return supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(value).data.publicUrl || '';
}
