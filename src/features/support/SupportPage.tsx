import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/shell/AppShell';
import { useAuth } from '../auth/AuthContext';
import { createSupportTicket, getSupportMessages, getSupportTickets, sendSupportMessage, subscribeToSupportTicket, updateSupportTicket, type SupportMessage, type SupportTicket } from './supportApi';

const statusLabel: Record<SupportTicket['status'], string> = { open: 'کراوە', pending_customer: 'چاوەڕوانی کڕیار', pending_support: 'چاوەڕوانی پشتیوانی', resolved: 'چارەسەرکرا', closed: 'داخراو' };
const priorityLabel: Record<SupportTicket['priority'], string> = { low: 'نزم', normal: 'ئاسایی', high: 'بەرز', urgent: 'فۆری' };

export default function SupportPage() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission('support.manage');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [initialMessage, setInitialMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    void getSupportTickets().then((data) => { if (!cancelled) { setTickets(data); if (!selectedId && data[0]) setSelectedId(data[0].id); } }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    let cancelled = false;
    void getSupportMessages(selectedId).then((data) => { if (!cancelled) setMessages(data); });
    const channel = subscribeToSupportTicket(selectedId, (incoming) => setMessages((current) => current.some((item) => item.id === incoming.id) ? current : [...current, incoming]));
    return () => { cancelled = true; void channel.unsubscribe(); };
  }, [selectedId]);

  const selected = useMemo(() => tickets.find((ticket) => ticket.id === selectedId) ?? null, [tickets, selectedId]);

  async function submitTicket() {
    if (!subject.trim() || !initialMessage.trim()) return;
    setCreating(true);
    try {
      const ticket = await createSupportTicket({ category: 'other', priority: 'normal', subject, message: initialMessage });
      setTickets((current) => [ticket, ...current]); setSelectedId(ticket.id); setSubject(''); setInitialMessage('');
    } finally { setCreating(false); }
  }

  async function submitMessage() {
    if (!selectedId || !message.trim()) return;
    const created = await sendSupportMessage(selectedId, message, false);
    setMessages((current) => current.some((item) => item.id === created.id) ? current : [...current, created]);
    setMessage('');
  }

  async function setStatus(status: SupportTicket['status']) {
    if (!selected) return;
    const next = await updateSupportTicket(selected.id, { status });
    setTickets((current) => current.map((ticket) => ticket.id === next.id ? next : ticket));
  }

  return (
    <AppShell>
      <main dir="rtl" className="mx-auto max-w-[1200px] space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,.06)] sm:p-8">
          <p className="text-[10px] font-black tracking-[.18em] text-orange-600">SUPPORT CENTER</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">پشتیوانی SHAKH</h1>
          <p className="mt-2 text-sm leading-7 text-slate-500">تیکەت دروست بکە، وەڵامەکان بە realtime ببینە و لە هەمان شوێن دۆخی ticket ـەکە بەدواداچوون بکە.</p>
        </section>

        <section className="grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between"><h2 className="text-sm font-black text-slate-900">تیکەتەکان</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">{tickets.length}</span></div>
            {loading && <p className="mt-5 text-xs font-bold text-slate-400">بارکردن...</p>}
            <div className="mt-4 space-y-2">
              {tickets.map((ticket) => <button key={ticket.id} onClick={() => setSelectedId(ticket.id)} className={`w-full rounded-xl border p-3 text-right transition ${ticket.id === selectedId ? 'border-orange-300 bg-orange-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black text-slate-400">{ticket.ticket_number}</span><span className="text-[9px] font-black text-slate-500">{statusLabel[ticket.status]}</span></div>
                <p className="mt-1 text-xs font-black text-slate-900">{ticket.subject}</p>
                <p className="mt-1 text-[9px] font-bold text-slate-400">{priorityLabel[ticket.priority]}</p>
              </button>)}
            </div>
            {!canManage && <div className="mt-5 rounded-xl bg-slate-50 p-3 text-[10px] leading-5 text-slate-500">تیم پشتیوانی کاتێک وەڵام بدات، ئەم پەڕەیە بە realtime نوێ دەبێتەوە.</div>}
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            {!selected ? <div className="grid min-h-[420px] place-items-center text-center"><div><p className="text-lg font-black text-slate-800">تیکەتێکت هەڵبژێرە</p><p className="mt-2 text-xs text-slate-400">یان لە خوارەوە تیکەتێکی نوێ دروست بکە.</p></div></div> : <>
              <header className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black text-slate-400">{selected.ticket_number}</p><h2 className="mt-1 text-lg font-black text-slate-950">{selected.subject}</h2></div>{canManage && <select value={selected.status} onChange={(event) => void setStatus(event.target.value as SupportTicket['status'])} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black"><option value="open">کراوە</option><option value="pending_customer">چاوەڕوانی کڕیار</option><option value="pending_support">چاوەڕوانی پشتیوانی</option><option value="resolved">چارەسەرکرا</option><option value="closed">داخراو</option></select>}</header>
              <div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-1">
                {messages.map((item) => <div key={item.id} className={`max-w-[86%] rounded-2xl px-4 py-3 ${item.sender_user_id === user?.id ? 'mr-auto bg-orange-50' : 'bg-slate-50'}`}><p className="whitespace-pre-wrap text-xs leading-6 text-slate-700">{item.body}</p><p className="mt-1 text-[9px] font-bold text-slate-400">{new Date(item.created_at).toLocaleString('ku-IQ')}</p></div>)}
              </div>
              <div className="mt-4 flex gap-2"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submitMessage(); } }} placeholder="پەیامەکەت بنووسە..." className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-xs outline-none focus:border-orange-300"/><button onClick={() => void submitMessage()} className="rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white">ناردن</button></div>
            </>}
          </section>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-black text-slate-950">تیکەتی نوێ</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="سەردێڕ" className="rounded-xl border border-slate-200 px-4 py-3 text-xs outline-none focus:border-orange-300"/><textarea value={initialMessage} onChange={(event) => setInitialMessage(event.target.value)} placeholder="کێشەکەت بە وردی بنووسە" rows={3} className="rounded-xl border border-slate-200 px-4 py-3 text-xs outline-none focus:border-orange-300 sm:col-span-2"/></div>
          <div className="mt-3 flex justify-end"><button disabled={creating} onClick={() => void submitTicket()} className="rounded-xl bg-orange-500 px-5 py-3 text-xs font-black text-white disabled:opacity-50">{creating ? 'دروستکردن...' : 'دروستکردنی تیکەت'}</button></div>
        </section>
      </main>
    </AppShell>
  );
}
