import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/shell/AppShell';
import { InlineError, LoadingState } from '../../components/ux/UiStates';
import DashboardSidebar from './components/DashboardSidebar';
import StatCard from './components/StatCard';
import { DASHBOARD_ROLES, ROLE_MODULES, resolveDashboardRole, type DashboardRole } from './models';
import { getOperationsSnapshot, type OperationsSnapshot } from './operationsApi';
import { useAuth } from '../auth/AuthContext';

const money = (value: number | null) => value == null ? '—' : `${new Intl.NumberFormat('ku-IQ', { maximumFractionDigits: 0 }).format(value)} IQD`;
const number = (value: number | null) => value == null ? '—' : new Intl.NumberFormat('ku-IQ').format(value);
const time = (value: string) => new Intl.DateTimeFormat('ku-IQ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

function dashboardRoleFromActualRoles(roles: string[]) {
  if (roles.includes('super_admin')) return 'super_admin' as DashboardRole;
  if (roles.includes('admin')) return 'admin' as DashboardRole;
  if (roles.includes('captain_manager')) return 'captain_manager' as DashboardRole;
  if (roles.includes('support')) return 'support' as DashboardRole;
  if (roles.includes('captain')) return 'captain' as DashboardRole;
  if (roles.some((role) => ['restaurant_vendor','supermarket_vendor','fashion_vendor','car_dealer','umrah_agency','beauty_vendor'].includes(role))) return 'vendor' as DashboardRole;
  return 'super_admin' as DashboardRole;
}

function RoleSwitcher({ role, roles }: { role: DashboardRole; roles: DashboardRole[] }) {
  return <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Workspace role switcher">
    {roles.map((key) => <a key={key} href={`#dashboard/${key}`} className={`dashboard-role-chip ${key === role ? 'is-active' : ''}`}>{DASHBOARD_ROLES[key].label}</a>)}
  </div>;
}

function statusLabel(value: string) {
  const map: Record<string,string> = {
    pending_payment:'چاوەڕوانی پارەدان', placed:'دانراو', confirmed:'پشتڕاستکراو', processing:'لە پرۆسە', ready_for_pickup:'ئامادەی وەرگرتن', out_for_delivery:'لە ڕێگایە', delivered:'گەیشتوو', cancelled:'هەڵوەشاوە', refunded:'گەڕێندرایەوە', paid:'پارەدراو', failed:'شکست', pending:'چاوەڕوان', requires_action:'کردار پێویستە'
  };
  return map[value] ?? value.replaceAll('_',' ');
}

function Stat({ label, value, detail, tone='neutral' }: { label:string; value:string; detail:string; tone?:'neutral'|'accent'|'dark' }) {
  return <StatCard label={label} detail={detail} icon="◉" tone={tone}><span className="text-xl font-black text-slate-950">{value}</span></StatCard>;
}

function OrdersTable({ items }: { items: OperationsSnapshot['recent_orders'] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[var(--shakh-shadow-sm)]">
    <div className="flex items-end justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
      <div>
        <p className="dashboard-eyebrow !text-orange-600">ORDERS</p>
        <h3 className="mt-1 text-lg font-black text-slate-950">دوایین ئۆردەرەکان</h3>
      </div>
      <a href="#dashboard" className="shakh-ghost-btn">هەموو</a>
    </div>
    {!items.length ? (
      <p className="p-8 text-center text-sm font-bold text-slate-500">هێشتا هیچ order ـێک نییە.</p>
    ) : (
      <div className="divide-y divide-slate-100">
        {items.map((item) => {
          const expanded = expandedId === item.id;
          return (
            <article key={item.id}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpandedId((current) => current === item.id ? null : item.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-right transition hover:bg-slate-50 sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-slate-950">{item.customer_name}</p>
                  <p className="mt-1 font-mono text-[10px] font-bold tracking-wide text-slate-400">#{item.order_number}</p>
                </div>
                <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">
                  {expanded ? 'داخستن' : 'وردەکاری'}
                </span>
              </button>
              {expanded && (
                <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">STATUS</p><p className="mt-1 text-xs font-black text-slate-800">{statusLabel(item.status)}</p></div>
                    <div><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">PAYMENT</p><p className="mt-1 text-xs font-black text-slate-800">{statusLabel(item.payment_status)}</p></div>
                    <div><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">TOTAL</p><p className="mt-1 text-xs font-black text-slate-800">{money(Number(item.total_iqd))}</p></div>
                    <div><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">CREATED</p><p className="mt-1 whitespace-nowrap text-xs font-black text-slate-800">{time(item.created_at)}</p></div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    )}
  </section>;
}

export default function DashboardPage() {
  const { roles, hasPermission } = useAuth();
  const availableRoles = useMemo(() => {
    const actual = roles.filter(Boolean);
    const normalized = [...new Set(actual.map((role) => role === 'super_admin' || role === 'admin' || role === 'captain_manager' || role === 'support' || role === 'captain' ? role : ['restaurant_vendor','supermarket_vendor','fashion_vendor','car_dealer','umrah_agency','beauty_vendor'].includes(role) ? 'vendor' : null).filter(Boolean) as DashboardRole[])];
    return normalized.length ? normalized : [dashboardRoleFromActualRoles(roles)];
  }, [roles]);
  const requestedRole = resolveDashboardRole();
  const defaultRole = dashboardRoleFromActualRoles(roles);
  const initialRole = availableRoles.includes(requestedRole) ? requestedRole : defaultRole;
  const [role, setRole] = useState<DashboardRole>(initialRole);
  const [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { const onHashChange = () => setRole((current) => { const next = resolveDashboardRole(); return availableRoles.includes(next) ? next : current; }); window.addEventListener('hashchange', onHashChange); return () => window.removeEventListener('hashchange', onHashChange); }, [availableRoles]);
  useEffect(() => { let cancelled=false; setLoading(true); void getOperationsSnapshot().then((data)=>{ if(!cancelled) setSnapshot(data); }).catch((err)=>{ if(!cancelled) setError(err instanceof Error ? err.message : 'operations_snapshot_load_failed'); }).finally(()=>{ if(!cancelled) setLoading(false); }); return ()=>{cancelled=true;}; }, [roles.join('|')]);

  const modules = ROLE_MODULES[role];
  const canAudit = hasPermission('platform.manage');
  const metrics = snapshot?.metrics;
  if (loading && !snapshot) return <AppShell><LoadingState label="Operations Center بار دەکرێت..." /></AppShell>;

  return <AppShell><main dir="rtl" className="space-y-5">
    <div className="grid gap-5 lg:grid-cols-[244px_minmax(0,1fr)]">
      <DashboardSidebar modules={modules} active="Overview" />
      <div className="space-y-5 min-w-0">
        <section className="dashboard-hero"><div className="dashboard-hero-grid" /><div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2"><span className="dashboard-live-dot" /><p className="dashboard-eyebrow">LIVE OPERATIONS</p></div><h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">ناوەندی بەڕێوەبردنی SHAKH</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">KPI و queue ـەکان ڕاستەوخۆ لە Supabase ـەوە دێن؛ هیچ mock record ـێکی dashboard ـدا نییە.</p></div><div className="rounded-2xl border border-white/10 bg-white/6 p-4"><p className="text-[9px] font-black tracking-[0.16em] text-white/40">ROLE</p><p className="mt-2 text-sm font-black text-white">{DASHBOARD_ROLES[role].labelEn}</p><p className="mt-1 text-[10px] text-white/45">{snapshot ? `نوێکراوەتەوە ${time(snapshot.generated_at)}` : '—'}</p></div></div></section>
        <RoleSwitcher role={role} roles={availableRoles} />
        {error && <InlineError title="Operations بار نەکرا" body={error} />}
        {metrics && (() => {
          const candidates = [
            hasPermission('users.read') && { label: 'بەکارهێنەرە چالاکەکان', value: number(metrics.active_users), detail: 'profiles ـی چالاک', tone: 'neutral' as const },
            hasPermission('orders.read') && { label: 'ئۆردەرەکانی ئەمڕۆ', value: number(metrics.orders_today), detail: 'بەپێی ڕۆژی Asia/Baghdad', tone: 'neutral' as const },
            hasPermission('orders.read') && { label: 'ئۆردەرە چاوەڕوانەکان', value: number(metrics.orders_pending), detail: 'pending / active fulfillment', tone: 'accent' as const },
            hasPermission('finance.read') && { label: 'داهاتی پارەدراوی ئەمڕۆ', value: money(metrics.gross_paid_today_iqd), detail: 'تەنها paid orders', tone: 'dark' as const },
            hasPermission('delivery.manage') && { label: 'Delivery ـی چالاک', value: number(metrics.active_deliveries), detail: 'assigned تا out_for_delivery', tone: 'neutral' as const },
            hasPermission('delivery.manage') && { label: 'ئۆردەری بێ کاپتن', value: number(metrics.unassigned_orders), detail: 'پێویستی dispatch', tone: 'accent' as const },
            hasPermission('delivery.manage') && { label: 'کاپتنی بەردەست', value: number(metrics.available_captains), detail: 'verified + available', tone: 'neutral' as const },
            hasPermission('payments.read') && { label: 'Payment ـی چاوەڕوان', value: number(metrics.pending_payments), detail: 'pending / requires action', tone: 'neutral' as const },
            hasPermission('support.read') && { label: 'Support backlog', value: number(metrics.support_open), detail: metrics.support_urgent == null ? 'open queue' : `${number(metrics.support_urgent)} urgent`, tone: 'accent' as const },
            hasPermission('finance.read') && { label: 'Withdrawal ـی چاوەڕوان', value: number(metrics.pending_withdrawals), detail: 'requested / approved', tone: 'neutral' as const },
          ].filter(Boolean) as Array<{ label: string; value: string; detail: string; tone: 'neutral' | 'accent' | 'dark' }>;
          return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{candidates.slice(0, 8).map((item) => <Stat key={item.label} label={item.label} value={item.value} detail={item.detail} tone={item.tone} />)}</div>;
        })()}
        <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><OrdersTable items={snapshot?.recent_orders ?? []} /><section className="dashboard-side-panel"><p className="dashboard-eyebrow !text-orange-600">QUICK ACTIONS</p><h3 className="mt-2 text-xl font-black text-slate-950">کارە گرنگەکان</h3><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1"><a href="#delivery" className="rounded-2xl border border-slate-200 p-4 transition hover:border-orange-200 hover:bg-orange-50/50"><b className="block text-xs font-black">Dispatch / Delivery</b><span className="mt-1 block text-[10px] text-slate-400">assignment و live monitor</span></a><a href="#payments" className="rounded-2xl border border-slate-200 p-4 transition hover:border-orange-200 hover:bg-orange-50/50"><b className="block text-xs font-black">Payments Center</b><span className="mt-1 block text-[10px] text-slate-400">payment + cash reconciliation</span></a><a href="#support" className="rounded-2xl border border-slate-200 p-4 transition hover:border-orange-200 hover:bg-orange-50/50"><b className="block text-xs font-black">Support Queue</b><span className="mt-1 block text-[10px] text-slate-400">ticket و escalation</span></a>{canAudit && <a href="#audit" className="rounded-2xl border border-slate-200 p-4 transition hover:border-orange-200 hover:bg-orange-50/50"><b className="block text-xs font-black">Audit Console</b><span className="mt-1 block text-[10px] text-slate-400">immutable operational trail</span></a>}</div></section></div>
        {snapshot && snapshot.recent_events.length>0 && <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)]"><div className="flex items-end justify-between"><div><p className="dashboard-eyebrow !text-orange-600">ACTIVITY</p><h3 className="mt-1 text-lg font-black">Event stream</h3></div><a href="#events" className="shakh-ghost-btn">هەموو</a></div><div className="mt-4 space-y-2">{snapshot.recent_events.map((event)=><div key={event.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 px-4 py-3"><span className={`h-2 w-2 rounded-full ${event.severity==='error'?'bg-red-500':event.severity==='warning'?'bg-amber-500':event.severity==='success'?'bg-emerald-500':'bg-slate-400'}`} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-slate-800">{event.title_ckb}</p><p className="mt-1 text-[10px] text-slate-400">{event.event_type} • {time(event.created_at)}</p></div><span className="font-mono text-[9px] text-slate-400">{event.entity_type ?? 'event'}</span></div>)}</div></section>}
        {snapshot && snapshot.support_queue.length>0 && <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)]"><div className="flex items-end justify-between"><div><p className="dashboard-eyebrow !text-orange-600">SUPPORT</p><h3 className="mt-1 text-lg font-black">Queue ـی پشتیوانی</h3></div><a href="#support" className="shakh-ghost-btn">پشتیوانی</a></div><div className="mt-4 grid gap-2">{snapshot.support_queue.map((ticket)=><div key={ticket.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-slate-800">{ticket.ticket_number} — {ticket.subject}</p><p className="mt-1 text-[10px] text-slate-400">{ticket.status}</p></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${ticket.priority==='urgent'?'bg-red-50 text-red-700':ticket.priority==='high'?'bg-amber-50 text-amber-700':'bg-slate-100 text-slate-500'}`}>{ticket.priority}</span></div>)}</div></section>}
      </div>
    </div>
  </main></AppShell>;
}
