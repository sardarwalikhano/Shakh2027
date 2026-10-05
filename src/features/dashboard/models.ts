export type DashboardRole =
  | "super_admin"
  | "admin"
  | "vendor"
  | "captain"
  | "captain_manager"
  | "support";

export type DashboardModule = {
  label: string;
  hint: string;
  icon: string;
  permission?: string;
};

export const DASHBOARD_ROLES: Record<DashboardRole, { label: string; labelEn: string; description: string }> = {
  super_admin: { label: "سوبر ئەدمین", labelEn: "Super Admin", description: "کۆنترۆڵی گشتی و چاودێری پلاتفۆرم" },
  admin: { label: "ئەدمین", labelEn: "Admin", description: "بەڕێوەبردنی ڕۆژانەی پلاتفۆرم" },
  vendor: { label: "فرۆشیار", labelEn: "Vendor", description: "کاتەلۆگ، ئۆردەر و ستۆر" },
  captain: { label: "کاپتن", labelEn: "Captain", description: "ئۆردەر و delivery ـی خۆت" },
  captain_manager: { label: "بەڕێوەبەری کاپتن", labelEn: "Captain Manager", description: "چاودێری تیمی گەیاندن" },
  support: { label: "پشتیوانی", labelEn: "Support", description: "تیکەت و کێشەکانی کڕیار" },
};

export const ROLE_MODULES: Record<DashboardRole, DashboardModule[]> = {
  super_admin: [
    { label: "Overview", hint: "کۆی platform", icon: "◉", permission: "platform.manage" },
    { label: "Users", hint: "بەکارهێنەران", icon: "○", permission: "users.read" },
    { label: "Vendors", hint: "فرۆشیاران و ستۆر", icon: "◇", permission: "catalog.manage" },
    { label: "Orders", hint: "ئۆردەرەکان", icon: "□", permission: "orders.read" },
    { label: "Delivery", hint: "گەیاندن", icon: "↗", permission: "delivery.manage" },
    { label: "Delivery Pricing", hint: "Zone و نرخ", icon: "₿", permission: "delivery.manage" },
    { label: "Finance", hint: "دارایی", icon: "₡", permission: "finance.read" },
    { label: "Payments", hint: "پارەدان و reconciliation", icon: "₿", permission: "payments.read" },
    { label: "Audit Logs", hint: "تۆمارەکان", icon: "≋", permission: "platform.manage" },
    { label: "Analytics", hint: "ئامار و conversion", icon: "⌁", permission: "analytics.read" },
    { label: "Promotions", hint: "coupon و داشکاندن", icon: "%", permission: "promotions.manage" },
    { label: "Posts", hint: "پۆست و وێنە و target", icon: "✦", permission: "platform.manage" },
    { label: "Settings", hint: "ڕێکخستن", icon: "⚙", permission: "platform.manage" },
  ],
  admin: [
    { label: "Overview", hint: "کورتەی کار", icon: "◉" },
    { label: "Users", hint: "بەکارهێنەران", icon: "○", permission: "users.read" },
    { label: "Catalog", hint: "بەرهەم و کاتەلۆگ", icon: "◇", permission: "catalog.manage" },
    { label: "Vendors", hint: "ستۆر و stock", icon: "▦", permission: "catalog.manage" },
    { label: "Orders", hint: "ئۆردەرەکان", icon: "□", permission: "orders.manage" },
    { label: "Delivery", hint: "کاپتن و گەیاندن", icon: "↗", permission: "delivery.manage" },
    { label: "Delivery Pricing", hint: "Zone و نرخ", icon: "₿", permission: "delivery.manage" },
    { label: "Finance", hint: "خوێندنەوەی دارایی", icon: "₡", permission: "finance.read" },
    { label: "Payments", hint: "پارەدان و cash", icon: "₿", permission: "payments.read" },
    { label: "Support", hint: "پشتیوانی", icon: "?", permission: "support.manage" },
    { label: "Analytics", hint: "ئامار و conversion", icon: "⌁", permission: "analytics.read" },
    { label: "Promotions", hint: "coupon و داشکاندن", icon: "%", permission: "promotions.manage" },
    { label: "Posts", hint: "پۆست و وێنە و target", icon: "✦", permission: "platform.manage" },
  ],
  vendor: [
    { label: "Overview", hint: "کورتەی ستۆر", icon: "◉" },
    { label: "Products", hint: "بەرهەم و stock", icon: "◇", permission: "catalog.manage" },
    { label: "Orders", hint: "ئۆردەرەکان", icon: "□", permission: "orders.manage" },
    { label: "Promotions", hint: "پرۆمۆشن", icon: "%", permission: "catalog.manage" },
    { label: "Store", hint: "پڕۆفایلی ستۆر", icon: "⌂" },
  ],
  captain: [
    { label: "Overview", hint: "کاری ئەمڕۆ", icon: "◉" },
    { label: "Available Orders", hint: "ئۆردەرە بەردەستەکان", icon: "□", permission: "orders.read" },
    { label: "My Deliveries", hint: "گەیاندنەکانم", icon: "↗" },
    { label: "Earnings", hint: "داهات", icon: "₡" },
    { label: "Profile", hint: "پڕۆفایل", icon: "○" },
  ],
  captain_manager: [
    { label: "Overview", hint: "کورتەی delivery", icon: "◉" },
    { label: "Captains", hint: "تیمی کاپتن", icon: "○", permission: "delivery.manage" },
    { label: "Delivery Pricing", hint: "Zone و نرخ", icon: "₿", permission: "delivery.manage" },
    { label: "Assignments", hint: "دابەشکردنی ئۆردەر", icon: "↗", permission: "delivery.manage" },
    { label: "Live Monitor", hint: "چاودێری", icon: "◎", permission: "delivery.manage" },
    { label: "Performance", hint: "کارایی", icon: "⌁", permission: "orders.read" },
  ],
  support: [
    { label: "Queue", hint: "تیکەتە چاوەڕوانەکان", icon: "◉", permission: "support.manage" },
    { label: "Customers", hint: "کڕیارەکان", icon: "○", permission: "users.read" },
    { label: "Orders", hint: "پشکنینی ئۆردەر", icon: "□", permission: "orders.read" },
    { label: "Escalations", hint: "گواستنەوە", icon: "!", permission: "support.manage" },
    { label: "Knowledge", hint: "ڕێبەر", icon: "?" },
  ],
};

export function resolveDashboardRole(): DashboardRole {
  const path = window.location.hash.split("/")[1];
  return path && path in DASHBOARD_ROLES ? (path as DashboardRole) : "super_admin";
}
