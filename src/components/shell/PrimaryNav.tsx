import { useEffect, useState } from "react";
import { ChevronLeftIcon, GridIcon } from "./icons";

const items = [
  { label: "سەرەتا", href: "#" },
  { label: "بازار", href: "#market" },
  { label: "خواردن", href: "#food" },
  { label: "سوپەرمارکێت", href: "#supermarket" },
  { label: "جل و بەرگ", href: "#fashion" },
  { label: "ئۆتۆمبێل", href: "#cars" },
  { label: "عومرە", href: "#umrah" },
  { label: "جوانکاری", href: "#beauty" },
  { label: "هەژماری ڕۆڵ", href: "#roles" },
];

export default function PrimaryNav() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const isActive = (href: string) => href === "#" ? (hash === "" || hash === "#") : hash.startsWith(href);

  return (
    <nav className="hidden border-b border-slate-200 bg-white lg:block" aria-label="ناوبەری سەرەکی">
      <div className="mx-auto flex max-w-[1440px] items-center px-4 sm:px-6 lg:px-8">
        <a href="#market" className="flex h-11 shrink-0 items-center gap-2 border-l border-slate-200 pl-5 pr-1 text-xs font-black text-slate-800" aria-label="هەموو پۆلەکان">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-orange-50 text-orange-600"><GridIcon className="h-4 w-4" /></span>
          هەموو پۆلەکان
          <ChevronLeftIcon className="h-3.5 w-3.5 text-slate-400" />
        </a>
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item, index) => (
            <a key={item.label} href={item.href} className={`shakh-nav-link ${isActive(item.href) ? "is-active" : ""}`}>{item.label}</a>
          ))}
        </div>
        <a href="#offers" className="mr-auto hidden shrink-0 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black text-orange-700 xl:block">پێشنیارە تایبەتەکان</a>
      </div>
    </nav>
  );
}
