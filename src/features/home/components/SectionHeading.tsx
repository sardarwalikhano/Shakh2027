import type { ReactNode } from "react";

export default function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
      <div>
        {eyebrow ? (
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-slate-950 sm:text-2xl">
          {title}
        </h2>
      </div>
      {action ? (
        <div className="shrink-0 text-xs font-black text-slate-500">{action}</div>
      ) : null}
    </div>
  );
}
