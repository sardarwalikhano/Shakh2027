export type CartItem = {
  id: string;
  productId: string;
  variantId: string;
  vendorId: string;
  availableQuantity?: number;
  title: string;
  sellerName: string;
  unitPriceIqd: number;
  quantity: number;
  imageUrl?: string;
  variantLabel?: string;
};

export type AddressDraft = {
  recipientName: string;
  phone: string;
  city: string;
  district: string;
  street: string;
  landmark: string;
  notes: string;
};

export type DeliveryOption = {
  id: string;
  title: string;
  description: string;
  feeIqd: number;
  etaLabel: string;
};

export type PaymentMethod =
  | "cash_on_delivery"
  | "wallet"
  | "mobile_cash";

export type ShoppingStep = "cart" | "address" | "delivery" | "payment" | "review";

export const EMPTY_ADDRESS: AddressDraft = {
  recipientName: "",
  phone: "",
  city: "هەولێر",
  district: "",
  street: "",
  landmark: "",
  notes: "",
};

export const SHOPPING_STEPS: Array<{ id: ShoppingStep; label: string }> = [
  { id: "cart", label: "سەبەتە" },
  { id: "address", label: "ناونیشان" },
  { id: "delivery", label: "گەیاندن" },
  { id: "payment", label: "پارەدان" },
  { id: "review", label: "پشکنین" },
];

export function formatIqd(value: number): string {
  return new Intl.NumberFormat("ku-IQ", {
    maximumFractionDigits: 0,
  }).format(value) + " د.ع";
}
