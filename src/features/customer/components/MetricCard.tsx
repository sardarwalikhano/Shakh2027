import type { ComponentType, SVGProps } from "react";

type Props = {
  label: string;
  value: string;
  detail: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  href: string;
};

export default function MetricCard({ label, value, detail, Icon, href }: Props) {
  return (
    <a href={href} className="group rounded-[24px] border border-slate-200 bg-white p-4 shadow-[var(--shakh-shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shakh-shadow-md)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-slate-500 transition group-hover:bg-orange-50 group-hover:text-orange-600">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="text-[10px] font-black text-slate-400">بکەوە →</span>
      </div>
      <p className="mt-5 text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-xs font-semibold text-slate-500">{detail}</p>
    </a>
  );
}
