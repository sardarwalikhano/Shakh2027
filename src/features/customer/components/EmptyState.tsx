import { ArrowLeftIcon } from "./CustomerIcons";

export default function EmptyState({
  eyebrow,
  title,
  body,
  actionHref,
  actionLabel,
}: {
  eyebrow: string;
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center sm:p-12">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-slate-300 shadow-sm">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
      </div>
      <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-black text-slate-950">{title}</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">{body}</p>
      {actionHref && actionLabel && (
        <a href={actionHref} className="shakh-btn-primary mt-6 gap-2">
          {actionLabel}
          <ArrowLeftIcon className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
