import { SHOPPING_STEPS, type ShoppingStep } from "../models";

const stepIndex = (step: ShoppingStep) => SHOPPING_STEPS.findIndex((item) => item.id === step);

export default function ShoppingStepper({ current }: { current: ShoppingStep }) {
  const activeIndex = stepIndex(current);

  return (
    <nav aria-label="پڕۆسەی کڕین" className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-2">
        {SHOPPING_STEPS.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li key={step.id} className="flex items-center gap-2">
              <span
                className={`grid h-9 min-w-9 place-items-center rounded-full px-2 text-[11px] font-black transition ${
                  done
                    ? "bg-orange-500 text-white"
                    : active
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-400"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              <span className={`text-xs font-black ${active ? "text-slate-950" : "text-slate-400"}`}>
                {step.label}
              </span>
              {index !== SHOPPING_STEPS.length - 1 && (
                <span className="mx-1 h-px w-7 bg-slate-200" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
