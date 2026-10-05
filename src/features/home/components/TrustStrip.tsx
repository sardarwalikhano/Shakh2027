import { BellIcon, HeartIcon, MapPinIcon, ShoppingBagIcon } from "../../../components/shell/icons";

const items = [
  [MapPinIcon, "شوێنی دروست", "delivery بە location ـی تۆ"],
  [ShoppingBagIcon, "Marketplace یەکگرتوو", "هەموو category ـەکان"],
  [BellIcon, "ئاگادارکردنەوە", "status ـی داواکاری بە ڕاستەوخۆ"],
  [HeartIcon, "دڵخوازەکان", "شتە گرنگەکانت هەڵبگرە"],
] as const;

export default function TrustStrip() {
  return (
    <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([Icon, title, meta]) => (
        <div key={title} className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-[var(--shakh-shadow-sm)]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700"><Icon className="h-[18px] w-[18px]" /></span>
          <div className="min-w-0"><p className="text-xs font-black text-slate-950">{title}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{meta}</p></div>
        </div>
      ))}
    </section>
  );
}
