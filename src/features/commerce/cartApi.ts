import { supabase } from '../../lib/supabase';
import type { CartItem } from '../shopping/models';
import { resolveProductImageUrl } from './storageApi';

type CartRow = {
  id: string;
  quantity: number;
  variant_id: string;
  product_variants: {
    id: string;
    product_id: string;
    label_ckb: string;
    label_ar: string;
    label_en: string;
    price_iqd: number;
    is_active: boolean;
    inventory: { quantity: number; reserved_quantity: number } | null;
    products: {
      id: string;
      vendor_id: string;
      name_ckb: string;
      name_ar: string;
      name_en: string;
      vendors: { name_ckb: string; name_ar: string; name_en: string } | null;
      product_images: Array<{ storage_path: string; sort_order: number }> | null;
    } | null;
  } | null;
};

function localizeCkb(ckb: string, ar: string, en: string) {
  return ckb || ar || en;
}

export async function getMyCart(): Promise<CartItem[]> {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(`cart_user_load_failed: ${userError.message}`);
  if (!userResult.user) throw new Error('not_authenticated');

  const { data, error } = await supabase
    .from('cart_items')
    .select(`
      id,
      quantity,
      variant_id,
      product_variants!inner(
        id,
        product_id,
        label_ckb,
        label_ar,
        label_en,
        price_iqd,
        is_active,
        inventory(quantity,reserved_quantity),
        products!inner(
          id,
          vendor_id,
          name_ckb,
          name_ar,
          name_en,
          vendors(name_ckb,name_ar,name_en,status),
          product_images(storage_path,sort_order)
        )
      )
    `)
    .eq('user_id', userResult.user.id);

  if (error) throw new Error(`cart_load_failed: ${error.message}`);

  return ((data ?? []) as unknown as CartRow[])
    .filter((row) => row.product_variants?.is_active && row.product_variants.products)
    .map((row) => {
      const variant = row.product_variants!;
      const product = variant.products!;
      const vendor = product.vendors;
      const firstImage = [...(product.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
      return {
        id: row.id,
        productId: product.id,
        variantId: variant.id,
        vendorId: product.vendor_id,
        title: localizeCkb(product.name_ckb, product.name_ar, product.name_en),
        sellerName: vendor ? localizeCkb(vendor.name_ckb, vendor.name_ar, vendor.name_en) : 'فرۆشیار',
        unitPriceIqd: Number(variant.price_iqd),
        imageUrl: resolveProductImageUrl(firstImage?.storage_path),
        quantity: row.quantity,
        variantLabel: localizeCkb(variant.label_ckb, variant.label_ar, variant.label_en),
        availableQuantity: variant.inventory
          ? Math.max(0, variant.inventory.quantity - variant.inventory.reserved_quantity)
          : 0,
      };
    });
}

export async function addVariantToCart(variantId: string, quantity = 1) {
  if (!variantId || quantity < 1) throw new Error('invalid_cart_input');

  const { data, error } = await supabase.rpc('add_variant_to_cart', {
    p_variant_id: variantId,
    p_quantity: quantity,
  });

  if (error) throw new Error(`cart_add_failed: ${error.message}`);
  return data;
}

export async function updateCartItem(itemId: string, quantity: number) {
  if (!itemId || quantity < 1) throw new Error('invalid_cart_quantity');

  const { data: itemResult, error: itemError } = await supabase
    .from('cart_items')
    .select('variant_id')
    .eq('id', itemId)
    .maybeSingle();

  if (itemError) throw new Error(`cart_lookup_failed: ${itemError.message}`);
  if (!itemResult) throw new Error('cart_item_not_found');

  const { error } = await supabase.rpc('set_cart_item_quantity', {
    p_variant_id: itemResult.variant_id,
    p_quantity: quantity,
  });

  if (error) throw new Error(`cart_update_failed: ${error.message}`);
}

export async function removeCartItem(itemId: string) {
  const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
  if (error) throw new Error(`cart_remove_failed: ${error.message}`);
}
