export default function OperationsTable({ title, eyebrow, columns }: { title: string; eyebrow: string; columns: string[] }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[var(--shakh-shadow-sm)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">{eyebrow}</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">{title}</h3>
        </div>
        <button type="button" className="shakh-ghost-btn">پیشاندانی هەموو</button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[680px] w-full text-right text-xs" dir="rtl">
          <thead className="bg-slate-50/80 text-[10px] font-black text-slate-400">
            <tr>{columns.map((column) => <th key={column} className="px-5 py-3 font-black">{column}</th>)}</tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={columns.length} className="px-5 py-10 text-center">
                <div className="mx-auto max-w-md">
                  <p className="text-sm font-black text-slate-800">داتا لە Supabase ـەوە دێت</p>
                  <p className="mt-2 text-xs leading-6 text-slate-500">ئەم module ـە هیچ mock record ـێکی نییە؛ کاتێک permission و query ـی ئەم role ـە جێبەجێ بکرێت، table ـەکە بە داتای ڕاستەقینە پڕ دەبێتەوە.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
