import { useEffect, useState } from "react";
import { useAuth } from "../../features/auth/AuthContext";
import { supabase } from "../../lib/supabase";
import { GridIcon, HeartIcon, HomeIcon, ShoppingBagIcon, UserIcon } from "./icons";

const items = [
  { label: "سەرەتا", href: "#", Icon: HomeIcon, active: true },
  { label: "پۆلەکان", href: "#market", Icon: GridIcon },
  { label: "سەبەت", href: "#checkout", Icon: ShoppingBagIcon },
  { label: "دڵخواز", href: "#account/wishlist", Icon: HeartIcon },
  { label: "پڕۆفایل", href: "#account", Icon: UserIcon },
];

export default function MobileBottomNav() {
  const [hash, setHash] = useState(window.location.hash);
  const [cartCount, setCartCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCount() {
      if (!user) { setCartCount(0); return; }
      const { count } = await supabase.from("cart_items").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      if (!cancelled) setCartCount(count ?? 0);
    }
    void loadCount();
    const onFocus = () => { void loadCount(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("hashchange", onFocus);
    return () => { cancelled = true; window.removeEventListener("focus", onFocus); window.removeEventListener("hashchange", onFocus); };
  }, [user]);

  return (
    <nav className="mobile-bottom-nav lg:hidden" aria-label="ناوبەری مۆبایل">
      {items.map(({ label, href, Icon, active }) => {
        const isActive = active && (hash === "" || hash === "#");
        const routeActive = href === "#account" ? hash.startsWith("#account") : hash === href;
        return (
          <a key={label} href={href} className={`mobile-nav-item ${isActive || routeActive ? "is-active" : ""}`}>
            <span className="relative">
              <Icon className="h-[20px] w-[20px]" />
              {href === "#checkout" && cartCount > 0 && <span className="absolute -right-2.5 -top-2 grid min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[9px] font-black text-white">{cartCount}</span>}
            </span>
            <span>{label}</span>
          </a>
        );
      })}
    </nav>
  );
}
