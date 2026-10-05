import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AppShell from '../../components/shell/AppShell';
import { InlineError, LoadingState, SuccessNotice } from '../../components/ux/UiStates';
import { useAuth } from '../auth/AuthContext';
import {
  getAccessibleWallets,
  getCommissionRules,
  getCarListingFeeRules,
  setCarListingFee,
  getCaptainFinanceSnapshot,
  getFinanceReconciliationSnapshot,
  getCaptainEarningRules,
  createCaptainEarningRule,
  updateCaptainEarningRule,
  reconcileCashCollection,
  getFinancialDisputes,
  createFinancialDispute,
  updateFinancialDispute,
  type CaptainFinanceSnapshot,
  type FinanceReconciliationSnapshot,
  type CaptainEarningRule,
  type FinancialDispute,
  type FinancialDisputeStatus,
  type FinancialDisputeType,
  getFinanceSummary,
  getMyWithdrawals,
  getWalletLedger,
  requestWithdrawal,
  type FinanceSummary,
  type LedgerEntry,
  type Wallet,
  type Withdrawal,
} from './financeApi';

const money = (value: number) => new Intl.NumberFormat('ku-IQ', { maximumFractionDigits: 0 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat('ku-IQ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)]">
      <p className="text-[10px] font-black tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">{hint}</p>
    </div>
  );
}

function LedgerRows({ entries }: { entries: LedgerEntry[] }) {
  if (!entries.length) {
    return <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">هێشتا transaction ـێکی جزدان نییە.</div>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full text-right text-xs">
        <thead className="bg-slate-50 text-slate-400">
          <tr>
            <th className="px-4 py-3 font-black">جۆر</th>
            <th className="px-4 py-3 font-black">بڕ</th>
            <th className="px-4 py-3 font-black">balance دوای transaction</th>
            <th className="px-4 py-3 font-black">کات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="px-4 py-3 font-black text-slate-800">{entry.entry_type}</td>
              <td className={`px-4 py-3 font-black ${entry.direction === 'credit' ? 'text-emerald-700' : 'text-rose-700'}`}>
                {entry.direction === 'credit' ? '+' : '−'} {money(entry.amount_iqd)} IQD
              </td>
              <td className="px-4 py-3 font-bold text-slate-700">{money(entry.balance_after_iqd)} IQD</td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-400">{date(entry.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WalletPanel({ wallet, onRefresh }: { wallet: Wallet; onRefresh: () => Promise<void> }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [ledger, ownWithdrawals] = await Promise.all([getWalletLedger(wallet.id), getMyWithdrawals()]);
      setEntries(ledger);
      setWithdrawals(ownWithdrawals.filter((item) => item.wallet_id === wallet.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'wallet_load_failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [wallet.id]);

  async function submitWithdrawal(event: FormEvent) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > wallet.balance_iqd) {
      setError('بڕی withdrawal نادروستە یان لە balance زیاترە.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const key = crypto.randomUUID() + crypto.randomUUID().replaceAll('-', '');
      await requestWithdrawal(wallet.id, numericAmount, key);
      setAmount('');
      setSuccess('داواکاریی withdrawal تۆمار کرا.');
      await load();
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'withdrawal_request_failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-[30px] bg-slate-950 p-6 text-white shadow-[var(--shakh-shadow-md)] sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black tracking-[0.18em] text-orange-300">SHAKH WALLET</p>
            <p className="mt-3 text-sm font-bold text-white/55">{wallet.wallet_type}</p>
            <p className="mt-1 text-4xl font-black">{money(wallet.balance_iqd)} <span className="text-lg text-white/40">IQD</span></p>
          </div>
          <div className="rounded-2xl bg-white/7 px-4 py-3 text-xs font-bold text-white/60">status: {wallet.status}</div>
        </div>
      </div>

      {error && <InlineError title="کێشەی finance" body={error} />}
      {success && <SuccessNotice title="سەرکەوتوو بوو" body={success} />}

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[10px] font-black tracking-[0.18em] text-orange-600">WITHDRAWAL</p><h2 className="mt-1 text-xl font-black text-slate-950">داوای دەرکردنی پارە</h2></div>
          <p className="text-xs font-bold text-slate-400">تەنها بڕی available دەتوانرێت دابخرێت.</p>
        </div>
        <form onSubmit={submitWithdrawal} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input className="min-h-11 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-orange-400 focus:bg-white" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="بڕ بە IQD" aria-label="بڕی withdrawal" />
          <button type="submit" disabled={submitting} className="min-h-11 rounded-2xl bg-orange-500 px-5 text-sm font-black text-white disabled:opacity-50">{submitting ? 'تۆمار دەکرێت...' : 'داواکاری بنێرە'}</button>
        </form>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
        <div className="mb-4"><p className="text-[10px] font-black tracking-[0.18em] text-orange-600">LEDGER</p><h2 className="mt-1 text-xl font-black text-slate-950">جووڵەکانی جزدان</h2></div>
        {loading ? <LoadingState label="ledger بار دەکرێت..." /> : <LedgerRows entries={entries} />}
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
        <div className="mb-4"><p className="text-[10px] font-black tracking-[0.18em] text-orange-600">PAYOUT REQUESTS</p><h2 className="mt-1 text-xl font-black text-slate-950">withdrawal history</h2></div>
        {!withdrawals.length ? <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">هێشتا داواکارییەک نییە.</p> : <div className="space-y-2">{withdrawals.map((item) => <div key={item.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span className="text-xs font-black text-slate-800">{money(item.amount_iqd)} IQD</span><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500">{item.status}</span></div>)}</div>}
      </div>
    </section>
  );
}


function CaptainFinancePanel({ wallet }: { wallet: Wallet }) {
  const [snapshot, setSnapshot] = useState<CaptainFinanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try { setSnapshot(await getCaptainFinanceSnapshot(wallet.owner_user_id ?? undefined)); }
    catch (err) { setError(err instanceof Error ? err.message : 'captain_finance_load_failed'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [wallet.owner_user_id]);

  if (loading) return <div className="rounded-[28px] border border-slate-200 bg-white p-6"><LoadingState label="داهاتی کاپتن بار دەکرێت..." /></div>;
  if (error || !snapshot) return <InlineError title="Captain Finance" body={error || 'داتا بەردەست نییە.'} />;
  return <section className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="LIFETIME EARNINGS" value={`${money(Number(snapshot.earnings.lifetime_iqd))} IQD`} hint={`${snapshot.earnings.deliveries} گەیاندن`} />
      <Metric label="LAST 30 DAYS" value={`${money(Number(snapshot.earnings.last_30_days_iqd))} IQD`} hint="داهاتی ٣٠ ڕۆژی ڕابردوو" />
      <Metric label="COD OUTSTANDING" value={`${money(Number(snapshot.cash_collection.outstanding_iqd))} IQD`} hint="پارەی کۆکراو تا reconciliation" />
    </div>
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
      <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black tracking-[0.18em] text-orange-600">CAPTAIN EARNINGS</p><h2 className="mt-1 text-xl font-black text-slate-950">داهاتی گەیاندن</h2></div><button type="button" onClick={() => void load()} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">نوێکردنەوە</button></div>
      {!snapshot.recent_earnings.length ? <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">هێشتا داهاتێکی settled نییە.</p> : <div className="mt-4 space-y-2">{snapshot.recent_earnings.slice(0,8).map(item => <div key={item.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><div><p className="text-xs font-black text-slate-800">#{item.order_number}</p><p className="text-[11px] font-semibold text-slate-400">{date(item.created_at)}</p></div><strong className="text-sm font-black text-emerald-700">+{money(item.earning_iqd)} IQD</strong></div>)}</div>}
    </div>
  </section>;
}

function disputeTypeLabel(type: FinancialDisputeType) {
  const labels: Record<FinancialDisputeType, string> = {
    chargeback: 'Chargeback',
    payment_dispute: 'کێشەی پارەدان',
    refund_dispute: 'کێشەی refund',
    cash_dispute: 'کێشەی cash',
    payout_dispute: 'کێشەی payout',
    order_dispute: 'کێشەی ئۆردەر',
    other: 'کێشەی تر',
  };
  return labels[type];
}

function disputeStatusLabel(status: FinancialDisputeStatus) {
  const labels: Record<FinancialDisputeStatus, string> = {
    open: 'کراوە',
    in_review: 'لە پشکنین',
    accepted: 'پەسەندکراو',
    rejected: 'ڕەتکراوەتەوە',
    resolved: 'چارەسەرکراو',
    cancelled: 'هەڵوەشێنراوەتەوە',
  };
  return labels[status];
}

function anomalyTone(severity: string) {
  return severity === 'critical' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800';
}

function FinancialDisputesPanel({
  disputes,
  loading,
  saving,
  onReload,
  onUpdate,
}: {
  disputes: FinancialDispute[];
  loading: boolean;
  saving: boolean;
  onReload: () => Promise<void>;
  onUpdate: (id: string, status: FinancialDisputeStatus, resolution?: string) => Promise<void>;
}) {
  const [resolution, setResolution] = useState('');
  const nextStatuses = (status: FinancialDisputeStatus): FinancialDisputeStatus[] => {
    if (status === 'open') return ['in_review', 'cancelled'];
    if (status === 'in_review') return ['accepted', 'rejected', 'resolved', 'cancelled'];
    if (status === 'accepted') return ['resolved'];
    return [];
  };

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black tracking-[0.18em] text-orange-600">DISPUTES + CHARGEBACKS</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">کۆنترۆڵی ناکۆکییە داراییەکان</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">هەموو گۆڕانکارییەکان لە audit log تۆمار دەکرێن و state transition ـەکان server-side ـن.</p>
        </div>
        <button type="button" onClick={() => void onReload()} disabled={loading || saving} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50">نوێکردنەوە</button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!loading && disputes.slice(0, 4).map((item) => (
          <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[10px] font-black tracking-[0.12em] text-slate-400">{disputeTypeLabel(item.dispute_type)}</p>
            <p className="mt-1 text-sm font-black text-slate-900">{money(item.amount_iqd)} IQD</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{disputeStatusLabel(item.status)}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <label className="block text-xs font-black text-slate-600">Resolution note <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={2} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-orange-400" placeholder="بۆ گۆڕینی دۆخ هۆکار/بڕیار بنووسە..." /></label>
      </div>

      {loading ? <div className="mt-4"><LoadingState label="dispute queue بار دەکرێت..." /></div> : !disputes.length ? (
        <p className="mt-4 rounded-2xl bg-emerald-50 p-5 text-sm font-bold text-emerald-700">هیچ financial dispute ـێک تۆمار نەکراوە.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-400"><tr><th className="px-4 py-3">جۆر</th><th className="px-4 py-3">ئۆردەر</th><th className="px-4 py-3">بڕ</th><th className="px-4 py-3">دۆخ</th><th className="px-4 py-3">provider</th><th className="px-4 py-3">کردار</th></tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {disputes.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-black">{disputeTypeLabel(item.dispute_type)}</td>
                  <td className="px-4 py-3 font-black">{item.order_id ? `#${item.order_id.slice(0, 8)}` : '—'}</td>
                  <td className="px-4 py-3 font-black">{money(item.amount_iqd)} IQD</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 font-black text-slate-600">{disputeStatusLabel(item.status)}</span></td>
                  <td className="px-4 py-3 text-slate-500">{item.provider_case_id ?? item.provider ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {nextStatuses(item.status).map((status) => (
                        <button key={status} type="button" disabled={saving} onClick={() => void onUpdate(item.id, status, resolution || undefined)} className={`rounded-xl px-3 py-2 font-black disabled:opacity-50 ${status === 'rejected' || status === 'cancelled' ? 'bg-rose-50 text-rose-700' : status === 'accepted' ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-700'}`}>
                          {disputeStatusLabel(status)}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ReconciliationPanel() {
  const [snapshot, setSnapshot] = useState<FinanceReconciliationSnapshot | null>(null);
  const [rules, setRules] = useState<CaptainEarningRule[]>([]);
  const [disputes, setDisputes] = useState<FinancialDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ratePercent, setRatePercent] = useState('');
  const [fixedFee, setFixedFee] = useState('');
  const [disputeType, setDisputeType] = useState<FinancialDisputeType>('chargeback');
  const [disputeOrderId, setDisputeOrderId] = useState('');
  const [disputeAmount, setDisputeAmount] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeProvider, setDisputeProvider] = useState('');
  const [disputeCaseId, setDisputeCaseId] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const [nextSnapshot, nextRules, nextDisputes] = await Promise.all([
        getFinanceReconciliationSnapshot(),
        getCaptainEarningRules(),
        getFinancialDisputes(),
      ]);
      setSnapshot(nextSnapshot); setRules(nextRules); setDisputes(nextDisputes);
      const global = nextRules.find((r) => r.vendor_type === null && r.is_active);
      if (global) { setRatePercent(String(global.rate_bps / 100)); setFixedFee(String(global.fixed_fee_iqd)); }
    } catch (err) { setError(err instanceof Error ? err.message : 'finance_reconciliation_failed'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function saveRule() {
    const rate = Number(ratePercent); const fixed = Number(fixedFee);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100 || !Number.isFinite(fixed) || fixed < 0) { setError('نرخی earning نادروستە.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const current = rules.find((r) => r.vendor_type === null && r.is_active);
      const payload = { vendor_type: null, rate_bps: Math.round(rate * 100), fixed_fee_iqd: fixed, min_earning_iqd: 0, max_earning_iqd: null, effective_from: new Date().toISOString(), effective_to: null, priority: 0, is_active: true };
      if (current) await updateCaptainEarningRule(current.id, { rate_bps: payload.rate_bps, fixed_fee_iqd: fixed, is_active: true });
      else await createCaptainEarningRule(payload);
      setSuccess('Captain earning rule نوێ کرایەوە.'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'captain_earning_rule_save_failed'); }
    finally { setSaving(false); }
  }

  async function reconcile(id: string, status: 'deposited' | 'reconciled' | 'disputed') {
    setSaving(true); setError('');
    try { await reconcileCashCollection(id, status); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'cash_reconciliation_failed'); }
    finally { setSaving(false); }
  }

  async function createDispute() {
    const amount = Number(disputeAmount);
    if (!disputeOrderId.trim() || !Number.isFinite(amount) || amount <= 0 || disputeReason.trim().length < 3) {
      setError('Order ID، بڕ و هۆکاری dispute پڕبکەوە.'); return;
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      await createFinancialDispute({
        dispute_type: disputeType,
        order_id: disputeOrderId.trim(),
        amount_iqd: amount,
        reason: disputeReason.trim(),
        provider: disputeProvider.trim() || undefined,
        provider_case_id: disputeCaseId.trim() || undefined,
      });
      setDisputeOrderId(''); setDisputeAmount(''); setDisputeReason(''); setDisputeProvider(''); setDisputeCaseId('');
      setSuccess('Financial dispute تۆمار کرا.'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'financial_dispute_create_failed'); }
    finally { setSaving(false); }
  }

  async function updateDispute(id: string, status: FinancialDisputeStatus, resolution?: string) {
    setSaving(true); setError(''); setSuccess('');
    try { await updateFinancialDispute(id, status, resolution); setSuccess(`Dispute بۆ «${disputeStatusLabel(status)}» گۆڕدرا.`); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'financial_dispute_update_failed'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="rounded-[28px] border border-slate-200 bg-white p-6"><LoadingState label="reconciliation بار دەکرێت..." /></div>;
  if (error && !snapshot) return <InlineError title="Reconciliation" body={error} />;
  if (!snapshot) return null;

  return <section className="space-y-4">
    {error && <InlineError title="Reconciliation کێشەی هەیە" body={error} />}
    {success && <SuccessNotice title="سەرکەوتوو بوو" body={success} />}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Metric label="CAPTAIN EARNED" value={`${money(snapshot.captain.earned_iqd)} IQD`} hint={`${snapshot.captain.settled_deliveries} settled deliveries`} />
      <Metric label="LEDGER CREDITED" value={`${money(snapshot.captain.ledger_credited_iqd)} IQD`} hint="wallet ledger" />
      <Metric label="COD COLLECTED" value={`${money(snapshot.cash.collected_iqd)} IQD`} hint={`${money(snapshot.cash.reconciled_iqd)} IQD reconciled`} />
      <Metric label="COD DISPUTED" value={`${money(snapshot.cash.disputed_iqd)} IQD`} hint="needs review" />
      <Metric label="OPEN DISPUTES" value={String(snapshot.disputes.open_count)} hint={`${snapshot.disputes.in_review_count} لە پشکنین`} />
      <Metric label="ANOMALIES" value={String(snapshot.anomalies.length)} hint="financial reconciliation" />
    </div>

    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
      <div><p className="text-[10px] font-black tracking-[0.18em] text-orange-600">FINANCIAL RECONCILIATION</p><h2 className="mt-1 text-xl font-black text-slate-950">دۆخی anomaly ـە داراییەکان</h2><p className="mt-1 text-xs font-semibold text-slate-500">پشکنین لە refund، ledger، captain earning، payout و payment/order consistency.</p></div>
      {!snapshot.anomalies.length ? <p className="mt-4 rounded-2xl bg-emerald-50 p-5 text-sm font-bold text-emerald-700">هیچ financial mismatch ـێکی دۆزرایەوە نییە.</p> : <div className="mt-4 space-y-2">{snapshot.anomalies.map((item) => <div key={`${item.code}:${item.entity_id}`} className={`rounded-2xl border p-4 ${anomalyTone(item.severity)}`}><div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black">{item.code}</p><p className="mt-1 text-xs font-semibold leading-5">{item.message}</p></div><span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black">{item.severity}</span></div><p className="mt-2 text-[11px] font-bold">Observed: {money(Number(item.observed_iqd))} IQD · Expected: {money(Number(item.expected_iqd))} IQD</p></div>)}</div>}
    </div>

    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
      <div><p className="text-[10px] font-black tracking-[0.18em] text-orange-600">OPEN FINANCIAL DISPUTE</p><h2 className="mt-1 text-xl font-black text-slate-950">تۆمارکردنی chargeback / dispute</h2><p className="mt-1 text-xs font-semibold text-slate-500">هیچ provider credential یان fake reference دروست ناکرێت؛ تەنها reference ـی ڕاستەقینەی provider داخڵ بکە.</p></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-xs font-black text-slate-600">جۆر<select value={disputeType} onChange={(e) => setDisputeType(e.target.value as FinancialDisputeType)} className="mt-1 min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold"><option value="chargeback">Chargeback</option><option value="payment_dispute">کێشەی پارەدان</option><option value="refund_dispute">کێشەی refund</option><option value="cash_dispute">کێشەی cash</option><option value="payout_dispute">کێشەی payout</option><option value="order_dispute">کێشەی ئۆردەر</option><option value="other">تر</option></select></label>
        <label className="text-xs font-black text-slate-600">Order ID<input value={disputeOrderId} onChange={(e) => setDisputeOrderId(e.target.value)} className="mt-1 min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold" placeholder="UUID" /></label>
        <label className="text-xs font-black text-slate-600">Amount IQD<input value={disputeAmount} onChange={(e) => setDisputeAmount(e.target.value)} inputMode="decimal" className="mt-1 min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold" placeholder="0" /></label>
        <label className="text-xs font-black text-slate-600">Provider<input value={disputeProvider} onChange={(e) => setDisputeProvider(e.target.value)} className="mt-1 min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold" placeholder="provider" /></label>
        <label className="text-xs font-black text-slate-600">Case ID<input value={disputeCaseId} onChange={(e) => setDisputeCaseId(e.target.value)} className="mt-1 min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold" placeholder="case/reference" /></label>
      </div>
      <textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} rows={2} className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-400" placeholder="هۆکاری dispute..." />
      <button type="button" onClick={() => void createDispute()} disabled={saving} className="mt-3 min-h-11 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-50">{saving ? '...' : 'Dispute تۆمار بکە'}</button>
    </div>

    <FinancialDisputesPanel disputes={disputes} loading={loading} saving={saving} onReload={load} onUpdate={updateDispute} />

    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
      <div><p className="text-[10px] font-black tracking-[0.18em] text-orange-600">CAPTAIN EARNING RULE</p><h2 className="mt-1 text-xl font-black text-slate-950">ڕێکخستنی داهاتی کاپتن</h2><p className="mt-1 text-xs font-semibold text-slate-500">هیچ rule ـێک seed ناکرێت؛ ئەم نرخە تەنها پاش configuration کاری دەکات.</p></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-black text-slate-600">Rate %<input className="mt-1 min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold" inputMode="decimal" value={ratePercent} onChange={(e)=>setRatePercent(e.target.value)} /></label>
        <label className="text-xs font-black text-slate-600">Fixed IQD<input className="mt-1 min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold" inputMode="decimal" value={fixedFee} onChange={(e)=>setFixedFee(e.target.value)} /></label>
        <button type="button" onClick={()=>void saveRule()} disabled={saving} className="min-h-11 self-end rounded-2xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-50">{saving ? '...' : 'Rule ـەکە هەڵبگرە'}</button>
      </div>
    </div>

    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
      <div><p className="text-[10px] font-black tracking-[0.18em] text-orange-600">COD RECONCILIATION</p><h2 className="mt-1 text-xl font-black text-slate-950">پارەی Cash ـی کاپتن</h2></div>
      {!snapshot.outstanding_cash_collections.length ? <p className="mt-4 rounded-2xl bg-emerald-50 p-5 text-sm font-bold text-emerald-700">هیچ cash collection ـێکی چاوەڕوان نییە.</p> : <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-right text-xs"><thead className="bg-slate-50 text-slate-400"><tr><th className="px-4 py-3">ئۆردەر</th><th className="px-4 py-3">کاپتن</th><th className="px-4 py-3">بڕ</th><th className="px-4 py-3">دۆخ</th><th className="px-4 py-3">کردار</th></tr></thead><tbody className="divide-y divide-slate-100">{snapshot.outstanding_cash_collections.map(item=><tr key={item.id}><td className="px-4 py-3 font-black">#{item.order_number}</td><td className="px-4 py-3">{item.captain_code}</td><td className="px-4 py-3 font-black">{money(item.amount_iqd)} IQD</td><td className="px-4 py-3">{item.status}</td><td className="px-4 py-3"><div className="flex gap-2"><button type="button" disabled={saving} onClick={()=>void reconcile(item.id,'deposited')} className="rounded-xl border border-slate-200 px-3 py-2 font-black">Deposited</button><button type="button" disabled={saving} onClick={()=>void reconcile(item.id,'reconciled')} className="rounded-xl bg-emerald-600 px-3 py-2 font-black text-white">Reconcile</button><button type="button" disabled={saving} onClick={()=>void reconcile(item.id,'disputed')} className="rounded-xl bg-rose-50 px-3 py-2 font-black text-rose-700">Dispute</button></div></td></tr>)}</tbody></table></div>}
    </div>
  </section>;
}


function CarListingFeePanel() {
  const [rules, setRules] = useState<import('./financeApi').CarListingFeeRule[]>([]);
  const [fee, setFee] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const data = await getCarListingFeeRules();
      setRules(data);
      const active = data.find((rule) => rule.is_active && new Date(rule.effective_from).getTime() <= Date.now() && (!rule.effective_to || new Date(rule.effective_to).getTime() > Date.now()));
      if (active) setFee(String(active.fee_iqd));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'car_fee_load_failed'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    const value = Number(fee);
    if (!Number.isFinite(value) || value <= 0) { setError('کرێی listing دەبێت بڕێکی دروست و گەورەتر لە سفر بێت.'); return; }
    setSaving(true); setMessage(''); setError('');
    try { await setCarListingFee(value); setMessage('کرێی نوێی SHAKH Cars دانرا.'); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'car_fee_save_failed'); }
    finally { setSaving(false); }
  }

  return <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black tracking-[0.18em] text-orange-600">SHAKH CARS FEE</p><h2 className="mt-1 text-xl font-black text-slate-950">کرێی بڵاوکردنەوەی ئۆتۆمبێل</h2><p className="mt-1 text-xs font-semibold text-slate-500">هەموو بەکارهێنەرێک دەتوانێت post بکات، بەڵام پێش چالاکبوون کرێی listing ـەکە لە wallet وەردەگیرێت.</p></div><a href="#cars" className="text-xs font-black text-orange-700 hover:text-orange-800">بینینی SHAKH Cars ←</a></div>
    {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">{error}</div>}
    {message && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">{message}</div>}
    <div className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={fee} onChange={(e)=>setFee(e.target.value)} inputMode="decimal" className="min-h-11 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black outline-none focus:border-orange-400 focus:bg-white" placeholder="مثلاً 10000" aria-label="کرێی listing بەپێی IQD" /><button type="button" disabled={saving || loading} onClick={()=>void save()} className="min-h-11 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-50">{saving ? 'هەڵدەگیرێت...' : 'هەڵگرتنی کرێ'}</button></div>
    {!loading && <div className="mt-4 flex flex-wrap gap-2">{rules.slice(0,4).map((rule) => <span key={rule.id} className="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-black text-slate-600">{money(rule.fee_iqd)} IQD · priority {rule.priority}</span>)}</div>}
  </section>;
}

function AdminFinance({ summary, onReload }: { summary: FinanceSummary; onReload: () => Promise<void> }) {
  const [rules, setRules] = useState<Array<{ id: string; vendor_type: string | null; base_type: string; rate_bps: number; effective_from: string; effective_to: string | null; is_active: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getCommissionRules().then((data) => setRules(data as typeof rules)).finally(() => setLoading(false)); }, []);
  return (
    <section className="space-y-5">
      <div className="rounded-[30px] bg-slate-950 p-6 text-white shadow-[var(--shakh-shadow-md)] sm:p-8">
        <p className="text-[10px] font-black tracking-[0.18em] text-orange-300">FINANCE CENTER</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">چاودێری دارایی SHAKH</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">کۆی داهات، commission، vendor net، refund، withdrawal و payout لە financial ledger ـی ڕاستەقینەوە.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Gross" value={`${money(Number(summary.gross_iqd))} IQD`} hint="settled order volume" />
        <Metric label="Commission" value={`${money(Number(summary.commission_iqd))} IQD`} hint="platform commission" />
        <Metric label="Vendor Net" value={`${money(Number(summary.vendor_net_iqd))} IQD`} hint="vendor settlements" />
        <Metric label="Refunds" value={`${money(Number(summary.refunded_iqd))} IQD`} hint="processed refunds" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Pending Withdrawals" value={`${money(Number(summary.pending_withdrawals_iqd))} IQD`} hint="requested / processing" />
        <Metric label="Paid Payouts" value={`${money(Number(summary.paid_payouts_iqd))} IQD`} hint="completed payouts" />
        <Metric label="Active Wallets" value={String(summary.active_wallets)} hint="wallet accounts" />
      </div>
      <ReconciliationPanel />
      <CarListingFeePanel />
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
        <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black tracking-[0.18em] text-orange-600">COMMISSION RULES</p><h2 className="mt-1 text-xl font-black text-slate-950">یاساکانی commission</h2></div><button type="button" onClick={() => void onReload()} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">نوێکردنەوە</button></div>
        {loading ? <div className="mt-4"><LoadingState label="rules بار دەکرێن..." /></div> : !rules.length ? <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">هێشتا هیچ commission rule ـێکی active/configured نییە.</p> : <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-right text-xs"><thead className="bg-slate-50 text-slate-400"><tr><th className="px-4 py-3">vendor type</th><th className="px-4 py-3">base</th><th className="px-4 py-3">rate</th><th className="px-4 py-3">status</th></tr></thead><tbody className="divide-y divide-slate-100">{rules.map((rule) => <tr key={rule.id}><td className="px-4 py-3 font-black">{rule.vendor_type ?? 'global'}</td><td className="px-4 py-3">{rule.base_type}</td><td className="px-4 py-3 font-black">{(rule.rate_bps / 100).toFixed(2)}%</td><td className="px-4 py-3">{rule.is_active ? 'active' : 'inactive'}</td></tr>)}</tbody></table></div>}
      </section>
    </section>
  );
}

export default function FinancePage() {
  const { hasPermission } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canReadFinance = hasPermission('finance.read');
  const primaryWallet = useMemo(() => wallets.find((wallet) => wallet.wallet_type !== 'platform') ?? null, [wallets]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      if (canReadFinance) {
        const summaryData = await getFinanceSummary();
        setSummary(summaryData);
        setWallets([]);
        return;
      }

      const walletData = await getAccessibleWallets();
      setWallets(walletData);
      setSummary(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'finance_load_failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [canReadFinance]);

  if (loading) return <AppShell><LoadingState label="Finance Center بار دەکرێت..." /></AppShell>;
  return (
    <AppShell>
      <main dir="rtl" className="space-y-5">
        {error && <InlineError title="Finance بار نەکرا" body={error} />}
        {canReadFinance && summary ? <AdminFinance summary={summary} onReload={load} /> : primaryWallet ? <>{<WalletPanel wallet={primaryWallet} onRefresh={load} />}{primaryWallet.wallet_type === 'captain' && <CaptainFinancePanel wallet={primaryWallet} />}</> : <InlineError title="Wallet نەدۆزرایەوە" body="بەکارهێنەرەکە wallet ـێکی چالاکی نییە." />}
      </main>
    </AppShell>
  );
}
