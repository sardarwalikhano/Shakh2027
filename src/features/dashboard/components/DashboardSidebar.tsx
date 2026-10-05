import type { DashboardModule, DashboardRole } from "../models";

const externalLinks: Record<string, string> = {
  Finance: "#finance",
  Payments: "#payments",
  Delivery: "#delivery",
  "Support": "#support",
  "Audit Logs": "#audit",
  Events: "#events",
  Analytics: "#analytics",
  Promotions: "#promotions",
  Posts: "#posts",
  Vendors: "#vendor",
  Products: "#vendor",
  Catalog: "#vendor",
  "Delivery Pricing": "#delivery-pricing",
  Store: "#vendor",
  Profile: "#account",
  Earnings: "#finance",
  "Available Orders": "#delivery",
  "My Deliveries": "#delivery",
  Captains: "#delivery",
  Assignments: "#delivery",
  "Live Monitor": "#delivery",
  Performance: "#delivery",
  Queue: "#support",
  Customers: "#support",
  Escalations: "#support",
  Knowledge: "#support",
};

const slugify = (value: string) => value.toLowerCase().replaceAll(" ", "-");

export default function DashboardSidebar({
  modules,
  active,
  role,
}: {
  modules: DashboardModule[];
  active: string;
  role: DashboardRole;
}) {
  return (
    <aside className="dashboard-sidebar rounded-[28px] border border-slate-200 bg-white p-2 shadow-[var(--shakh-shadow-sm)]">
      <div className="px-3 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">WORKSPACE</p>
        <p className="mt-1 text-sm font-black text-slate-950">SHAKH Operations</p>
      </div>

      <nav className="space-y-1" aria-label="Dashboard modules">
        {modules.map((item) => {
          const isActive = active === item.label;
          const href = item.label === "Overview"
            ? "#dashboard"
            : externalLinks[item.label] ?? "#dashboard/" + role + "/" + slugify(item.label);

          const content = (
            <>
              <span className="dashboard-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="min-w-0 text-right">
                <b className="block truncate text-xs">{item.label}</b>
                <small className="mt-0.5 block truncate text-[10px]">{item.hint}</small>
              </span>
            </>
          );

          return (
            <a
              key={item.label}
              href={href}
              className={`dashboard-nav-item ${isActive ? "is-active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {content}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
