
export function LoadingState({ label = "بارکردن..." }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="shakh-state">
      <span className="shakh-state-icon" aria-hidden="true">…</span>
      <div>
        <h3 className="text-sm font-black text-slate-900">{label}</h3>
      </div>
    </div>
  );
}
import type { ReactNode } from "react";

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`shakh-skeleton ${className}`} />;
}

export function InlineError({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div role="alert" className="shakh-state shakh-state-error">
      <span className="shakh-state-icon" aria-hidden="true">!</span>
      <div className="min-w-0">
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
        <p className="mt-1 text-xs leading-6 text-slate-500">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function SuccessNotice({ title, body }: { title: string; body: string }) {
  return (
    <div role="status" className="shakh-state shakh-state-success">
      <span className="shakh-state-icon" aria-hidden="true">✓</span>
      <div>
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
        <p className="mt-1 text-xs leading-6 text-slate-500">{body}</p>
      </div>
    </div>
  );
}

export function LiveRegion({ children }: { children: ReactNode }) {
  return <div className="sr-only" aria-live="polite" aria-atomic="true">{children}</div>;
}
