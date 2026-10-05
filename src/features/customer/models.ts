export type CustomerSection =
  | "overview"
  | "orders"
  | "wishlist"
  | "reviews"
  | "notifications"
  | "wallet"
  | "points"
  | "referral"
  | "profile";

export type OrderStatus = "pending" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

export type CustomerOrderSummary = {
  id: string;
  status: OrderStatus;
  createdAt: string;
  totalIqd: number;
  itemCount: number;
  storeName: string;
};

export type CustomerNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export const CUSTOMER_SECTION_LABELS: Record<CustomerSection, string> = {
  overview: "پوختە",
  orders: "ئۆردەرەکانم",
  wishlist: "دڵخوازەکان",
  reviews: "هەڵسەنگاندنەکان",
  notifications: "ئاگادارکردنەوەکان",
  wallet: "جزدان",
  points: "D_SH Points",
  referral: "هاوبەشکردن",
  profile: "پڕۆفایل",
};
