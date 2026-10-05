import type { CustomerSection } from "../models";
import { BellRingIcon, ClipboardIcon, CoinIcon, GiftIcon, HeartFillIcon, SettingsIcon, StarIcon, UserIcon, WalletIcon } from "./CustomerIcons";
import type { ComponentType, SVGProps } from "react";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

type Item = { section: CustomerSection; label: string; Icon: Icon };

const items: Item[] = [
  { section: "overview", label: "پوختە", Icon: UserIcon },
  { section: "orders", label: "ئۆردەرەکانم", Icon: ClipboardIcon },
  { section: "wishlist", label: "دڵخوازەکان", Icon: HeartFillIcon },
  { section: "reviews", label: "هەڵسەنگاندنەکان", Icon: StarIcon },
  { section: "notifications", label: "ئاگادارکردنەوە", Icon: BellRingIcon },
  { section: "wallet", label: "جزدان", Icon: WalletIcon },
  { section: "points", label: "D_SH Points", Icon: CoinIcon },
  { section: "referral", label: "هاوبەشکردن", Icon: GiftIcon },
  { section: "profile", label: "ڕێکخستن", Icon: SettingsIcon },
];

export default function CustomerNav({ active }: { active: CustomerSection }) {
  return (
    <nav className="grid gap-1" aria-label="بەشی کڕیار">
      {items.map(({ section, label, Icon }) => (
        <a
          key={section}
          href={section === "overview" ? "#account" : `#account/${section}`}
          className={`flex min-h-11 items-center gap-3 rounded-2xl px-3 text-right text-sm font-extrabold transition ${
            active === section
              ? "bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
          }`}
        >
          <span className={`grid h-8 w-8 place-items-center rounded-xl ${active === section ? "bg-white text-orange-600" : "bg-slate-100 text-slate-500"}`}>
            <Icon className="h-[17px] w-[17px]" />
          </span>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {active === section && <span className="h-1.5 w-1.5 rounded-full bg-orange-500" aria-hidden="true" />}
        </a>
      ))}
    </nav>
  );
}
