import type { ReactNode } from "react";
import GlobalHeader from "./GlobalHeader";
import MobileBottomNav from "./MobileBottomNav";
import PrimaryNav from "./PrimaryNav";
import ThemeToggle from "../ux/ThemeToggle";
import PwaInstallPrompt from "../pwa/PwaInstallPrompt";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--shakh-bg)] text-slate-950">
      <a className="shakh-skip-link" href="#main-content">بازکردن بەشی سەرەکی</a>
      <GlobalHeader />
      <PrimaryNav />
      <div id="main-content" tabIndex={-1} className="mx-auto min-h-[calc(100vh-116px)] max-w-[1440px] px-4 pb-28 pt-5 outline-none sm:px-6 sm:pt-7 lg:px-8 lg:pb-12">
        {children}
      </div>
      <footer className="hidden border-t border-slate-200 bg-white lg:block">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-8 py-7 text-xs text-slate-500">
          <span className="font-semibold">© SHAKH — شاخ</span>
          <ThemeToggle />
          <span>بازار • خواردن • گەیاندن • خزمەتگوزاری</span>
        </div>
      </footer>
      <MobileBottomNav />
      <PwaInstallPrompt />
    </div>
  );
}
