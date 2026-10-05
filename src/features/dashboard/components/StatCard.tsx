import type { ReactNode } from 'react';

export default function StatCard({ label, detail, icon, tone = 'neutral', children }: { label: string; detail: string; icon: string; tone?: 'neutral' | 'accent' | 'dark'; children?: ReactNode }) {
  const toneClass = tone === 'accent' ? 'dashboard-stat-accent' : tone === 'dark' ? 'dashboard-stat-dark' : '';
  return <article className={`dashboard-stat ${toneClass}`}>
    <div className="flex items-start justify-between gap-3"><span className="dashboard-stat-icon" aria-hidden="true">{icon}</span><span className="dashboard-stat-kicker">LIVE DATA</span></div>
    <p className="mt-6 text-[11px] font-bold text-slate-500">{label}</p>
    <div className="mt-1">{children}</div>
    <p className="mt-2 text-[10px] leading-5 text-slate-400">{detail}</p>
  </article>;
}
