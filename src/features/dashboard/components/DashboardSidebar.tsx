import type { DashboardModule } from "../models";

export default function DashboardSidebar({ modules, active }: { modules: DashboardModule[]; active: string }) {
  return (
    <aside className="dashboard-sidebar rounded-[28px] border border-slate-200 bg-white p-2 shadow-[var(--shakh-shadow-sm)]">
      <div className="px-3 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">WORKSPACE</p>
        <p className="mt-1 text-sm font-black text-slate-950">SHAKH Operations</p>
      </div>
      <nav className="space-y-1" aria-label="Dashboard modules">
        {modules.map((item) => {
          const content = (
            <>
              <span className="dashboard-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="min-w-0 text-right">
                <b className="block truncate text-xs">{item.label}</b>
                <small className="mt-0.5 block truncate text-[10px]">{item.hint}</small>
              </span>
            </>
          );
          if (["Finance","Payments","Delivery","Support","Audit Logs","Events","Analytics","Promotions","Vendors","Products","Delivery Pricing"].includes(item.label)) {
            const href = item.label === "Finance" ? "#finance" : item.label === "Payments" ? "#payments" : item.label === "Delivery" ? "#delivery" : item.label === "Support" ? "#support" : item.label === "Audit Logs" ? "#audit" : item.label === "Events" ? "#events" : item.label === "Analytics" ? "#analytics" : item.label === "Promotions" ? "#promotions" : item.label === "Delivery Pricing" ? "#delivery-pricing" : "#vendor";
            return <a key={item.label} href={href} className={`dashboard-nav-item ${active === item.label ? "is-active" : ""}`} aria-current={active === item.label ? "page" : undefined}>{content}</a>;
          }
          return <button key={item.label} type="button" className={`dashboard-nav-item ${active === item.label ? "is-active" : ""}`} aria-current={active === item.label ? "page" : undefined}>{content}</button>;
        })}
      </nav>
    </aside>
  );
}
