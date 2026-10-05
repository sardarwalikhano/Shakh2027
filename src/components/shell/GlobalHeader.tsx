import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAuth } from "../../features/auth/AuthContext";
import { signOut } from "../../features/auth/auth";
import ThemeToggle from "../ux/ThemeToggle";
import { getUnreadNotificationCount, subscribeToNotifications } from "../../features/notifications/notificationsApi";

import {
  BellIcon,
  HeartIcon,
  MapPinIcon,
  SearchIcon,
  UserIcon,
} from "./icons";

export default function GlobalHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const { user, profile } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    if (!user) { setUnreadNotifications(0); return; }
    let cancelled = false;
    void getUnreadNotificationCount()
      .then((count) => { if (!cancelled) setUnreadNotifications(count); })
      .catch(() => { if (!cancelled) setUnreadNotifications(0); });

    const channel = subscribeToNotifications(user.id, () => {
      void getUnreadNotificationCount()
        .then((count) => { if (!cancelled) setUnreadNotifications(count); })
        .catch(() => { if (!cancelled) setUnreadNotifications(0); });
    });
    return () => { cancelled = true; void channel.unsubscribe(); };
  }, [user]);

  useEffect(() => {
    const onGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (isShortcut) {
        event.preventDefault();
        setSearchOpen(true);
        window.requestAnimationFrame(() => {
          const input = window.matchMedia("(min-width: 1024px)").matches
            ? desktopSearchRef.current
            : mobileSearchRef.current;
          input?.focus();
        });
        return;
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };

    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError("");
    try {
      await signOut();
      window.location.hash = "#market";
    } catch (error: unknown) {
      setSignOutError(error instanceof Error ? error.message : "نەتوانرا لە هەژمار دەرچیت.");
    } finally {
      setSigningOut(false);
    }
  };

  const submitSearch = () => {
    const query = searchQuery.trim();
    setSearchOpen(false);
    window.location.hash = query ? `#marketplace?q=${encodeURIComponent(query)}` : "#market";
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitSearch();
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <a href="#" className="group flex shrink-0 items-center gap-3" aria-label="SHAKH home">
          <img
            src="/brand/shakh-logo.jpg"
            alt="شاخ — SHAKH"
            className="h-11 w-[72px] rounded-[14px] border border-orange-100 object-contain shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md sm:h-12 sm:w-[88px]"
          />
          <span className="hidden leading-none sm:block">
            <strong className="block text-[15px] font-black tracking-[-0.01em] text-slate-950">SHAKH</strong>
            <span className="mt-1 block text-[10px] font-semibold text-slate-500">لووتکەی بازار</span>
          </span>
        </a>

        <div className="mx-auto hidden min-w-0 max-w-[650px] flex-1 lg:block">
          <label className="shakh-search flex h-11 items-center gap-3 rounded-[14px] border border-slate-200 bg-slate-50/90 px-4 transition focus-within:border-orange-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-500/10">
            <SearchIcon className="h-[18px] w-[18px] shrink-0 text-slate-400" />
            <input
              ref={desktopSearchRef}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="بگەڕێ بۆ بەرهەم، فرۆشگا، خواردن..."
              aria-label="گەڕانی SHAKH"
            />
            <kbd className="hidden rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-400 xl:block">Ctrl K</kbd>
          </label>
        </div>

        <div className="mr-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button className="shakh-icon-button lg:hidden" type="button" aria-label="گەڕان" onClick={() => {
            setSearchOpen((open) => {
              const next = !open;
              if (next) window.requestAnimationFrame(() => mobileSearchRef.current?.focus());
              return next;
            });
          }}>
            <SearchIcon className="h-[19px] w-[19px]" />
          </button>
          <ThemeToggle />
          <a href="#account/profile" className="shakh-icon-button hidden sm:grid" aria-label="شوێن و ناونیشان">
            <MapPinIcon className="h-[19px] w-[19px]" />
          </a>
          <a href="#account/wishlist" className="shakh-icon-button hidden md:grid" aria-label="دڵخوازەکان">
            <HeartIcon className="h-[19px] w-[19px]" />
          </a>
          <a href="#notifications" className="shakh-icon-button hidden sm:grid" aria-label="ئاگادارکردنەوەکان">
            <BellIcon className="h-[19px] w-[19px]" />
            {unreadNotifications > 0 && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[8px] font-black leading-4 text-white">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}
          </a>
          {user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <a href="#account" className="flex h-10 items-center gap-2 rounded-[13px] border border-slate-200 bg-white px-2.5 text-right transition hover:border-slate-300 hover:bg-slate-50">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-700"><UserIcon className="h-4 w-4" /></span>
                <span className="hidden leading-tight lg:block"><span className="block text-[10px] font-semibold text-slate-400">بەخێربێیت</span><span className="block max-w-28 truncate text-xs font-bold text-slate-800">{profile?.full_name || user.email || "هەژمار"}</span></span>
              </a>
              <a href="#roles" className="hidden rounded-[10px] px-2 py-2 text-[10px] font-black text-slate-500 transition hover:bg-orange-50 hover:text-orange-700 lg:block">ڕۆڵەکان</a>
              <button type="button" disabled={signingOut} onClick={() => void handleSignOut()} className="hidden text-[10px] font-black text-slate-400 transition hover:text-red-600 disabled:cursor-wait disabled:opacity-50 xl:block">{signingOut ? "دەرچوون..." : "دەرچوون"}</button>
            </div>
          ) : (
            <a href="#auth/sign-in" className="hidden h-10 items-center gap-2 rounded-[13px] border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 transition hover:border-orange-200 hover:bg-orange-50 sm:flex">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-700"><UserIcon className="h-4 w-4" /></span>
              چوونەژوورەوە
            </a>
          )}
        </div>
      </div>

      {signOutError ? (
        <div role="alert" className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-center text-[11px] font-bold text-rose-800">{signOutError}</div>
      ) : null}

      {searchOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
          <label className="flex h-11 items-center gap-3 rounded-[14px] border border-slate-200 bg-slate-50 px-4 focus-within:border-orange-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-500/10">
            <SearchIcon className="h-[18px] w-[18px] text-slate-400" />
            <input
              ref={mobileSearchRef}
              autoFocus
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              placeholder="بگەڕێ..."
              aria-label="گەڕان"
            />
          </label>
        </div>
      )}
    </header>
  );
}
