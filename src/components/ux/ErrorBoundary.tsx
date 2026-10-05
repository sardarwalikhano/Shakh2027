import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep production logging centralized; wire this to the observability provider in Phase 9.
    console.error("SHAKH UI error boundary", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main dir="rtl" className="grid min-h-screen place-items-center bg-[var(--shakh-bg)] px-4 py-10 text-center">
        <section className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shakh-shadow-md)] sm:p-8">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-xl font-black text-orange-600" aria-hidden="true">!</span>
          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">SHAKH RECOVERY</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">کێشەیەکی کاتی لە interface ـەکە ڕوویدا</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">پەڕەکە دوبارە باربکەرەوە. هەموو هەوڵەکانی تۆ لە backend ـدا نابڕێت.</p>
          <button
            type="button"
            className="shakh-btn-primary mt-6"
            onClick={() => window.location.reload()}
          >
            دوبارە بارکردن
          </button>
        </section>
      </main>
    );
  }
}
