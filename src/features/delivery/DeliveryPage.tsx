import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import {
  getCaptainAssignments,
  assignCaptainToOrder,
  releaseDeliveryAssignment,
  reassignDeliveryAssignment,
  getCaptainProfile,
  getDispatchBoard,
  getDispatchCaptainRecommendations,
  getCaptainMobileSnapshot,
  getDeliveryTracking,
  recordCaptainLocation,
  respondToAssignment,
  setCaptainAvailability,
  updateDeliveryStatus,
  type CaptainProfile,
  type DeliveryAssignment,
  type DeliveryTracking,
  type CaptainMobileSnapshot,
  type DispatchCaptainRecommendation,
} from './deliveryApi';
import TrackingMap from './components/TrackingMap';

function formatIQD(value: number) {
  return `${new Intl.NumberFormat('ckb-IQ').format(Math.round(value))} د.ع`;
}

function StatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = {
    unassigned: 'بێ کاپتن', assigned: 'نێردراوە', accepted: 'قبوڵکراوە', at_pickup: 'گەیشتووەتە وەرگرتن',
    picked_up: 'وەرگیراوە', out_for_delivery: 'لە ڕێگایە', delivered: 'گەیێندرا', failed: 'سەرکەوتوو نەبوو', cancelled: 'هەڵوەشێنراوە',
  };
  return <span className="delivery-status-pill">{labels[status] ?? status}</span>;
}


function formatMinutesRemaining(minutes: number | null) {
  if (minutes == null) return '—';
  if (minutes < 0) return `${Math.abs(minutes)} خولەک دواكەوتووە`;
  if (minutes === 0) return 'لە ئێستادا';
  return `${minutes} خولەک ماوە`;
}

function slaLabel(state: 'overdue' | 'at_risk' | 'on_track' | 'not_available' | null | undefined) {
  if (state === 'overdue') return 'دواكەوتووە';
  if (state === 'at_risk') return 'لە مەترسیدایە';
  if (state === 'on_track') return 'لە کاتدایە';
  return 'ETA نەزانراوە';
}

function slaClass(state: string | null | undefined) {
  return state ? `sla-${state}` : 'sla-not-available';
}

function getClientSla(order: { created_at: string; assignment: DeliveryAssignment | { status?: string | null; assigned_at?: string | null; accepted_at?: string | null; picked_up_at?: string | null; estimated_minutes?: number | null } | null }) {
  const now = Date.now();
  const status = order.assignment?.status ?? null;
  const assignment = order.assignment;
  const anchor = (value: string | null | undefined) => value ? new Date(value).getTime() : new Date(order.created_at).getTime();
  let deadline: number | null = null;
  if (!status || ['unassigned', 'failed', 'cancelled'].includes(status)) deadline = new Date(order.created_at).getTime() + 10 * 60_000;
  else if (status === 'assigned') deadline = anchor(assignment?.assigned_at) + 3 * 60_000;
  else if (status === 'accepted' || status === 'at_pickup') deadline = anchor(assignment?.accepted_at ?? assignment?.assigned_at) + 20 * 60_000;
  else if ((status === 'picked_up' || status === 'out_for_delivery') && assignment?.estimated_minutes != null) deadline = anchor(assignment?.picked_up_at ?? assignment?.accepted_at ?? assignment?.assigned_at) + assignment.estimated_minutes * 60_000;
  const remaining = deadline == null ? null : Math.ceil((deadline - now) / 60_000);
  const state = remaining == null ? 'not_available' : remaining < 0 ? 'overdue' : remaining <= 5 ? 'at_risk' : 'on_track';
  return { deadline, remaining, state, ageMinutes: Math.max(0, Math.floor((now - new Date(order.created_at).getTime()) / 60_000)) } as const;
}

function CaptainConsole() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CaptainProfile | null>(null);
  const [assignments, setAssignments] = useState<DeliveryAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [mobileSnapshot, setMobileSnapshot] = useState<CaptainMobileSnapshot | null>(null);
  const [gpsState, setGpsState] = useState<'off' | 'searching' | 'live' | 'error'>('off');
  const [lastGpsAt, setLastGpsAt] = useState<string | null>(null);
  const active = useMemo(() => assignments.find((a) => ['assigned','accepted','at_pickup','picked_up','out_for_delivery'].includes(a.status)) ?? null, [assignments]);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const [nextProfile, nextAssignments, nextSnapshot] = await Promise.all([
        getCaptainProfile(user.id),
        getCaptainAssignments(user.id),
        getCaptainMobileSnapshot(user.id),
      ]);
      setProfile(nextProfile);
      setAssignments(nextAssignments);
      setMobileSnapshot(nextSnapshot);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'هەڵەیەک ڕوویدا');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`captain-assignments:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_assignments', filter: `captain_user_id=eq.${user.id}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (!profile || !user || !['available', 'busy'].includes(profile.status)) { setGpsState('off'); return; }
    if (!navigator.geolocation) {
      setGpsState('error');
      setMessage('GPS لەم ئامێرەدا بەردەست نییە.');
      return;
    }
    setGpsState('searching');
    const id = navigator.geolocation.watchPosition(
      (position) => {
        setGpsState('live');
        setLastGpsAt(new Date().toISOString());
        void recordCaptainLocation(active?.id ?? null, position).catch((e) => { setGpsState('error'); setMessage(e instanceof Error ? e.message : 'GPS update failed'); });
      },
      (error) => { setGpsState('error'); setMessage(`GPS: ${error.message}`); },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [profile?.status, active?.id, user]);

  async function toggleAvailability() {
    if (!profile) return;
    try {
      const next = await setCaptainAvailability(profile.status === 'available' ? 'offline' : 'available');
      setProfile(next);
      setMessage(next.status === 'available' ? 'ئێستا بەردەستیت.' : 'ئێستا offline ـیت.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'availability failed'); }
  }

  async function respond(assignmentId: string, accept: boolean) {
    try {
      await respondToAssignment(assignmentId, accept);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'assignment response failed'); }
  }

  async function move(status: Exclude<DeliveryAssignment['status'], 'unassigned' | 'assigned' | 'accepted'>) {
    if (!active) return;
    try {
      await updateDeliveryStatus(active.id, status);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'status update failed'); }
  }

  if (loading) return <main className="delivery-page"><div className="delivery-card"><div className="delivery-skeleton" /><div className="delivery-skeleton wide" /></div></main>;

  return (
    <main className="delivery-page">
      <section className="delivery-hero">
        <div><span className="delivery-eyebrow">CAPTAIN CONSOLE</span><h1>کونسۆڵی کاپتن</h1><p>کارەکان، GPS و دۆخی گەیاندن لە شوێنێکەوە بەڕێوە ببە.</p></div>
        <div className="delivery-profile-box">
          <strong>{profile?.captain_code ?? '—'}</strong>
          <span className={`delivery-online ${profile?.status === 'available' ? 'on' : ''}`}>{profile?.status === 'available' ? 'بەردەستم' : profile?.status === 'busy' ? 'لە کاردام' : 'Offline'}</span>
          <button className="delivery-primary-btn" onClick={() => void toggleAvailability()} disabled={profile?.status === 'busy' || profile?.status === 'suspended'}>{profile?.status === 'available' ? 'Offline بکە' : 'بەردەست بم'}</button>
        </div>
      </section>

      {message && <div className="delivery-alert" role="status">{message}</div>}

      <section className="captain-mobile-status">
        <div><span className="delivery-kicker">MOBILE OPERATIONS</span><strong>{gpsState === 'live' ? 'GPS زیندووە' : gpsState === 'searching' ? 'GPS لە گەڕانە' : gpsState === 'error' ? 'کێشەی GPS' : 'GPS چالاک نییە'}</strong><small>{lastGpsAt ? `کۆتا ناردن ${new Intl.DateTimeFormat('ck-IQ',{timeStyle:'short'}).format(new Date(lastGpsAt))}` : 'کاتێک online بیت، شوێنەکەت بۆ dispatch نێردراوە.'}</small></div>
        <div className="captain-mobile-status-pill">{gpsState === 'live' ? 'LIVE' : gpsState.toUpperCase()}</div>
      </section>

      {assignments.filter((a) => a.status === 'assigned').map((assignment) => (
        <section className="delivery-card" key={assignment.id}>
          <div className="delivery-card-head"><div><span className="delivery-kicker">NEW ASSIGNMENT</span><h2>ئۆردەر #{assignment.order_id.slice(0, 8)}</h2></div><StatusPill status={assignment.status} /></div>
          <p className="delivery-muted">کاتی خەمڵاندن: {assignment.estimated_minutes ?? '—'} خولەک</p><div className={`sla-banner ${slaClass(getClientSla({created_at: assignment.assigned_at ?? new Date().toISOString(), assignment}).state)}`}><strong>بڕی SLA</strong><span>{formatMinutesRemaining(getClientSla({created_at: assignment.assigned_at ?? new Date().toISOString(), assignment}).remaining)}</span></div>
          <div className="delivery-actions"><button className="delivery-primary-btn" onClick={() => void respond(assignment.id, true)}>قبوڵکردن</button><button className="delivery-secondary-btn" onClick={() => void respond(assignment.id, false)}>ڕەتکردنەوە</button></div>
        </section>
      ))}

      <section className="delivery-grid-two">
        <div className="delivery-card">
          <div className="delivery-card-head"><div><span className="delivery-kicker">ACTIVE ROUTE</span><h2>{mobileSnapshot?.active_assignment ? `ئۆردەر #${mobileSnapshot.active_assignment.order_number}` : active ? `ئۆردەر #${active.order_id.slice(0, 8)}` : 'هیچ کارێکی چالاک نییە'}</h2><p className="delivery-muted route-assignee">{mobileSnapshot?.active_assignment ? `${mobileSnapshot.active_assignment.vendor_name} · ${mobileSnapshot.active_assignment.buyer_name}` : ''}</p></div>{active && <StatusPill status={active.status} />}</div>
          {active && mobileSnapshot?.active_assignment && <div className={`sla-banner ${slaClass(mobileSnapshot.active_assignment.sla.sla_state)}`}><strong>{slaLabel(mobileSnapshot.active_assignment.sla.sla_state)}</strong><span>{formatMinutesRemaining(mobileSnapshot.active_assignment.sla.remaining_minutes)}</span><small>{mobileSnapshot.active_assignment.sla.next_action}</small></div>}
          {active && mobileSnapshot?.active_assignment && <div className="captain-route-contact"><div><span>کڕیار</span><strong>{mobileSnapshot.active_assignment.buyer_name}</strong></div><a href={`tel:${mobileSnapshot.active_assignment.buyer_phone}`}>{mobileSnapshot.active_assignment.buyer_phone}</a><div><span>ناونیشان</span><strong>{mobileSnapshot.active_assignment.shipping_district} · {mobileSnapshot.active_assignment.shipping_street ?? mobileSnapshot.active_assignment.shipping_landmark ?? '—'}</strong></div></div>}
          {active ? <div className="delivery-progress"><div className="delivery-step active">١<br /><span>قبوڵ</span></div><div className={['at_pickup','picked_up','out_for_delivery','delivered'].includes(active.status) ? 'delivery-step active' : 'delivery-step'}>٢<br /><span>وەرگرتن</span></div><div className={['picked_up','out_for_delivery','delivered'].includes(active.status) ? 'delivery-step active' : 'delivery-step'}>٣<br /><span>لە ڕێگا</span></div><div className={active.status === 'delivered' ? 'delivery-step active' : 'delivery-step'}>٤<br /><span>گەیاندن</span></div></div> : <div className="delivery-empty">کاتێک assignment ـێک بۆت دەنێردرێت، لێرە دەردەکەوێت.</div>}
          {active && <div className="delivery-actions">
            {active.status === 'accepted' && <button className="delivery-primary-btn" onClick={() => void move('at_pickup')}>گەیشتنە وەرگرتن</button>}
            {active.status === 'at_pickup' && <button className="delivery-primary-btn" onClick={() => void move('picked_up')}>وەرگرتنی ئۆردەر</button>}
            {active.status === 'picked_up' && <button className="delivery-primary-btn" onClick={() => void move('out_for_delivery')}>دەستپێکردنی گەیاندن</button>}
            {active.status === 'out_for_delivery' && <button className="delivery-primary-btn" onClick={() => void move('delivered')}>گەیاندن تەواو بوو</button>}
            <button className="delivery-secondary-btn" onClick={() => void load()}>نوێکردنەوە</button>
          </div>}
        </div>

        <div className="delivery-card">
          <span className="delivery-kicker">EARNINGS</span><h2>{formatIQD(active?.captain_earning_iqd ?? 0)}</h2><p className="delivery-muted">داهاتی ئەم assignment ـە لە backend ـەوە دێت.</p>
          <div className="delivery-mini-metrics"><div><span>Delivery fee</span><strong>{formatIQD(active?.delivery_fee_iqd ?? 0)}</strong></div><div><span>ETA</span><strong>{mobileSnapshot?.active_assignment?.sla.remaining_minutes ?? active?.estimated_minutes ?? '—'} min</strong></div></div>
        </div>
      </section>
    </main>
  );
}


function DispatchMetric({ label, value, tone = '' }: { label: string; value: number; tone?: string }) {
  return <div className={`dispatch-metric ${tone}`}><span>{label}</span><strong>{new Intl.NumberFormat('ckb-IQ').format(value)}</strong></div>;
}

function DispatchConsole() {
  const [board, setBoard] = useState<Awaited<ReturnType<typeof getDispatchBoard>> | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedCaptain, setSelectedCaptain] = useState('');
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'active'>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [live, setLive] = useState<'connecting' | 'live' | 'error'>('connecting');
  const [recommendations, setRecommendations] = useState<DispatchCaptainRecommendation[]>([]);

  const load = async () => {
    try {
      const next = await getDispatchBoard();
      setBoard(next);
      setError('');
      setLive('live');
      setSelectedOrderId((current) => current && next.orders.some((order) => order.id === current) ? current : next.orders[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'dispatch board failed');
      setLive('error');
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('delivery-dispatch-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_assignments' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'captain_profiles' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { void load(); })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setLive('live');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setLive('error');
      });
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const selectedOrder = board?.orders.find((order) => order.id === selectedOrderId) ?? null;
  const availableCaptains = board?.captains.filter((captain) => captain.status === 'available' && captain.is_verified) ?? [];
  const slaSummary = useMemo(() => {
    let overdue = 0; let atRisk = 0;
    for (const order of board?.orders ?? []) {
      const sla = getClientSla(order);
      if (sla.state === 'overdue') overdue += 1;
      if (sla.state === 'at_risk') atRisk += 1;
    }
    return { overdue, atRisk };
  }, [board]);

  const visibleOrders = (board?.orders ?? []).filter((order) => {
    const status = order.assignment?.status ?? null;
    if (filter === 'unassigned') return !status || ['unassigned', 'failed', 'cancelled'].includes(status);
    if (filter === 'active') return ['assigned', 'accepted', 'at_pickup', 'picked_up', 'out_for_delivery'].includes(status ?? '');
    return true;
  });

  useEffect(() => {
    setSelectedCaptain(selectedOrder?.assignment?.captain_user_id ?? '');
  }, [selectedOrderId, selectedOrder?.assignment?.captain_user_id]);
  useEffect(() => {
    let cancelled = false;
    if (!selectedOrderId) { setRecommendations([]); return () => { cancelled = true; }; }
    void getDispatchCaptainRecommendations(selectedOrderId, 6)
      .then((next) => { if (!cancelled) setRecommendations(next); })
      .catch(() => { if (!cancelled) setRecommendations([]); });
    return () => { cancelled = true; };
  }, [selectedOrderId]);

  async function assignSelected() {
    if (!selectedOrder || !selectedCaptain) return;
    setBusy(true);
    try {
      const assignment = selectedOrder.assignment;
      if (assignment.id && assignment.status === 'assigned' && assignment.captain_user_id) {
        await reassignDeliveryAssignment(assignment.id, selectedCaptain, 'dispatch board reassignment');
      } else {
        await assignCaptainToOrder(
          selectedOrder.id,
          selectedCaptain,
          Number(assignment?.delivery_fee_iqd ?? selectedOrder.delivery_fee_iqd ?? 0),
          assignment?.estimated_minutes ?? undefined,
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'assignment failed');
    } finally {
      setBusy(false);
    }
  }

  async function releaseSelected() {
    if (!selectedOrder?.assignment?.id || selectedOrder.assignment.status !== 'assigned') return;
    setBusy(true);
    try {
      await releaseDeliveryAssignment(selectedOrder.assignment.id, 'dispatch released');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'release failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="delivery-page">
      <section className="delivery-hero dispatch-hero">
        <div>
          <div className="dispatch-hero-meta"><span className="delivery-eyebrow">DISPATCH OPERATIONS</span><span className={`dispatch-live-state ${live}`}>{live === 'live' ? 'LIVE' : live === 'connecting' ? 'CONNECTING' : 'SYNC ERROR'}</span></div>
          <h1>ناوەندی Dispatch</h1>
          <p>دابەشکردنی ئۆردەر، وەرگرتنەوەی assignment و چاودێری دۆخی کاپتنەکان لە یەک شوێن. هەموو کردارێکی dispatch لە backend ـی Supabase دڵنیایی لەوە دەکات.</p>
        </div>
        <button className="delivery-secondary-btn light" onClick={() => void load()} disabled={busy}>نوێکردنەوە</button>
      </section>

      {error && <div className="delivery-alert" role="alert">{error}</div>}

      {board && <>
        <section className="dispatch-metrics-grid">
          <DispatchMetric label="بێ کاپتن" value={board.metrics.unassigned_orders} tone="accent" />
          <DispatchMetric label="نێردراو" value={board.metrics.assigned_orders} />
          <DispatchMetric label="لە گەیاندن" value={board.metrics.active_deliveries} />
          <DispatchMetric label="کاپتنی بەردەست" value={board.metrics.available_captains} />
          <DispatchMetric label="کاپتنی busy" value={board.metrics.busy_captains} />
          <DispatchMetric label="GPS ـی کۆن" value={board.metrics.stale_active_captains} tone={board.metrics.stale_active_captains ? 'danger' : ''} />
          <DispatchMetric label="SLA ـی دواكەوتوو" value={slaSummary.overdue} tone={slaSummary.overdue ? 'danger' : ''} />
          <DispatchMetric label="SLA ـی لە مەترسیدا" value={slaSummary.atRisk} tone={slaSummary.atRisk ? 'accent' : ''} />
        </section>

        <section className="dispatch-board-shell">
          <div className="dispatch-orders-panel">
            <div className="dispatch-panel-head">
              <div><span className="delivery-kicker">ORDER QUEUE</span><h2>{new Intl.NumberFormat('ckb-IQ').format(visibleOrders.length)} ئۆردەر</h2></div>
              <div className="dispatch-filters" role="tablist" aria-label="فلتەری ئۆردەر">
                {([['all','هەموو'],['unassigned','بێ کاپتن'],['active','چالاک']] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'is-active' : ''} onClick={() => setFilter(key)}>{label}</button>)}
              </div>
            </div>
            <div className="dispatch-order-list">
              {visibleOrders.map((order) => {
                const a = order.assignment;
                const status = a?.status ?? 'unassigned';
                const needsCaptain = !a?.id || ['unassigned','failed','cancelled'].includes(status);
                return <button type="button" className={`dispatch-order-card ${selectedOrderId === order.id ? 'is-selected' : ''}`} key={order.id} onClick={() => setSelectedOrderId(order.id)}>
                  <span className={`dispatch-priority-dot ${needsCaptain ? 'urgent' : ''}`} />
                  <div className="dispatch-order-main"><div><strong>#{order.order_number}</strong><StatusPill status={status} /></div><p>{order.vendor_name} · {order.buyer_name}</p><small>{order.shipping_city}، {order.shipping_district} · {formatIQD(order.total_iqd)}</small></div>
                  {(() => { const sla = getClientSla(order); return <div className="dispatch-order-side"><span>{status === 'unassigned' || ['failed','cancelled'].includes(status) ? 'بێ کاپتن' : a.captain_code ?? '—'}</span><small>{a.estimated_minutes ? `${a.estimated_minutes} خولەک` : 'ETA —'}</small><em className={`sla-chip ${slaClass(sla.state)}`}>{formatMinutesRemaining(sla.remaining)}</em></div>; })()}
                </button>;
              })}
              {!visibleOrders.length && <div className="delivery-empty">لە فلتەرەکەدا هیچ ئۆردەرێک نییە.</div>}
            </div>
          </div>

          <aside className="dispatch-detail-panel">
            {selectedOrder ? <>
              <div className="dispatch-detail-head"><div><span className="delivery-kicker">SELECTED ORDER</span><h2>#{selectedOrder.order_number}</h2><p>{selectedOrder.vendor_name}</p></div><StatusPill status={selectedOrder.assignment?.status ?? 'unassigned'} /></div>
              <div className="dispatch-detail-grid">
                <div><span>کڕیار</span><strong>{selectedOrder.buyer_name}</strong></div>
                <div><span>ژمارە</span><strong>{selectedOrder.buyer_phone}</strong></div>
                <div><span>گەیاندن</span><strong>{selectedOrder.shipping_city} · {selectedOrder.shipping_district}</strong></div>
                <div><span>کۆی گشتی</span><strong>{formatIQD(selectedOrder.total_iqd)}</strong></div>
              </div>
              {(() => { const sla = getClientSla(selectedOrder); return <div className={`dispatch-sla-card ${slaClass(sla.state)}`}><div><span>SLA</span><strong>{slaLabel(sla.state)}</strong></div><div><span>ماوە</span><strong>{formatMinutesRemaining(sla.remaining)}</strong></div><div><span>تەمەن</span><strong>{sla.ageMinutes} خولەک</strong></div></div>; })()}
              <div className="dispatch-route-card"><div><span className="route-label">FROM</span><strong>{selectedOrder.vendor_name}</strong><small>pickup</small></div><span className="route-arrow">→</span><div><span className="route-label">TO</span><strong>{selectedOrder.shipping_district}</strong><small>{selectedOrder.shipping_street ?? selectedOrder.shipping_landmark ?? 'ناونیشان'}</small></div></div>
              <div className="dispatch-captain-control">
                <div className="dispatch-control-label"><span>کاپتنی گەیاندن</span><small>{availableCaptains.length} بەردەستە</small></div>
                {!!recommendations.length && <div className="dispatch-recommendations"><div className="dispatch-control-label"><span>پێشنیاری زیرەک</span><small>نزیکترین کاپتنی بەردەست</small></div><div className="dispatch-recommendation-grid">{recommendations.slice(0, 4).map((captain) => <button key={captain.user_id} type="button" className={`dispatch-recommendation-card ${selectedCaptain === captain.user_id ? 'is-selected' : ''}`} onClick={() => setSelectedCaptain(captain.user_id)} disabled={busy}><strong>{captain.captain_code}</strong><span>{captain.distance_to_pickup_km != null ? `${captain.distance_to_pickup_km.toFixed(1)} km` : 'GPS نییە'}</span><small>{captain.vehicle_type ?? 'vehicle'} · {captain.location_age_seconds != null ? `${captain.location_age_seconds}s` : 'GPS —'}</small></button>)}</div></div>}
                <select value={selectedCaptain} onChange={(event) => setSelectedCaptain(event.target.value)} disabled={busy} aria-label="هەڵبژاردنی کاپتن">
                  <option value="">کاپتن هەڵبژێرە</option>
                  {selectedOrder.assignment?.captain_user_id && selectedOrder.assignment.status === 'assigned' && !availableCaptains.some((captain) => captain.user_id === selectedOrder.assignment.captain_user_id) && <option value={selectedOrder.assignment.captain_user_id}>{selectedOrder.assignment.captain_code ?? 'کاپتنی هەنووکەیی'}</option>}
                  {availableCaptains.map((captain) => <option value={captain.user_id} key={captain.user_id}>{captain.captain_code} — {captain.vehicle_type ?? 'vehicle'}</option>)}
                </select>
                <div className="dispatch-action-row">
                  <button className="delivery-primary-btn" onClick={() => void assignSelected()} disabled={!selectedCaptain || busy}>{busy ? '...' : selectedOrder.assignment?.status === 'assigned' ? 'گۆڕینی کاپتن' : 'نێردنی کاپتن'}</button>
                  {selectedOrder.assignment?.status === 'assigned' && <button className="delivery-secondary-btn" onClick={() => void releaseSelected()} disabled={busy}>وەرگرتنەوەی assignment</button>}
                </div>
              </div>
              {selectedOrder.assignment?.last_location && <div className="dispatch-live-location"><span className="dispatch-location-dot" /><div><strong>کاپتن live ـە</strong><small>{selectedOrder.assignment.last_location.latitude.toFixed(4)}, {selectedOrder.assignment.last_location.longitude.toFixed(4)} · {selectedOrder.assignment.last_location.age_seconds ? `${selectedOrder.assignment.last_location.age_seconds}s لەمەوپێش` : 'نوێ'}</small></div></div>}
            </> : <div className="delivery-empty">ئۆردەرێک هەڵبژێرە بۆ بەڕێوەبردنی assignment.</div>}
          </aside>
        </section>

        <section className="dispatch-captains-section">
          <div className="dispatch-panel-head"><div><span className="delivery-kicker">CAPTAIN ROSTER</span><h2>تیمی کاپتن</h2></div><span className="dispatch-sync-note">Sync: {new Intl.DateTimeFormat('ck-IQ',{timeStyle:'short'}).format(new Date(board.generated_at))}</span></div>
          <div className="dispatch-captain-grid">
            {board.captains.map((captain) => <div className="dispatch-captain-card" key={captain.user_id}>
              <div className="dispatch-captain-top"><span className={`dispatch-avatar ${captain.status}`}>●</span><div><strong>{captain.captain_code}</strong><small>{captain.vehicle_make ?? ''} {captain.vehicle_model ?? ''} {captain.vehicle_plate ? `· ${captain.vehicle_plate}` : ''}</small></div><StatusPill status={captain.status} /></div>
              <div className="dispatch-captain-bottom">{captain.active_order_number ? <span>ئۆردەر #{captain.active_order_number}</span> : <span>کاری چالاک نییە</span>}{captain.last_location ? <span>{captain.last_location.age_seconds ?? 0}s GPS</span> : <span>GPS —</span>}</div>
            </div>)}
            {!board.captains.length && <div className="delivery-empty">هیچ کاپتنێکی verified نییە.</div>}
          </div>
        </section>
      </>}
    </main>
  );
}

function TrackingConsole({ orderId }: { orderId: string }) {
  const [tracking, setTracking] = useState<DeliveryTracking | null>(null);
  const [error, setError] = useState('');

  async function load() {
    try { setTracking(await getDeliveryTracking(orderId)); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'tracking failed'); }
  }
  useEffect(() => { void load(); }, [orderId]);
  useEffect(() => {
    const channel = supabase
      .channel(`delivery-tracking:${orderId}`, { config: { private: true } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_assignments', filter: `order_id=eq.${orderId}` }, () => { void load(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'captain_live_locations', filter: `assignment_id=eq.${tracking?.assignment_id ?? '00000000-0000-0000-0000-000000000000'}` }, (payload) => {
        const row = payload.new as { assignment_id?: string; latitude?: number; longitude?: number; heading?: number | null; speed_kmh?: number | null; accuracy_m?: number | null; recorded_at?: string };
        if (row.assignment_id === tracking?.assignment_id && typeof row.latitude === 'number' && typeof row.longitude === 'number') {
          setTracking((current) => current ? { ...current, location: { latitude: row.latitude!, longitude: row.longitude!, heading: row.heading ?? null, speed_kmh: row.speed_kmh ?? null, accuracy_m: row.accuracy_m ?? null, recorded_at: row.recorded_at ?? new Date().toISOString() } } : current);
        }
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [orderId, tracking?.assignment_id]);

  return (
    <main className="delivery-page">
      <section className="delivery-hero tracking-hero"><div><span className="delivery-eyebrow">LIVE DELIVERY</span><h1>شوێنی ئۆردەر بە زیندوویی</h1><p>دۆخی گەیاندن و شوێنی کاپتن لە داتای ڕاستەقینەی Supabase ـەوە نوێ دەکرێتەوە.</p></div><button className="delivery-secondary-btn light" onClick={() => void load()}>نوێکردنەوە</button></section>
      {error && <div className="delivery-alert">{error}</div>}
      {tracking && <div className="delivery-grid-two"><div className="delivery-card"><div className="delivery-card-head"><div><span className="delivery-kicker">ORDER TRACKING</span><h2>#{orderId.slice(0, 8)}</h2></div><StatusPill status={tracking.status} /></div><TrackingMap captain={tracking.location} pickup={tracking.pickup} dropoff={tracking.dropoff}/></div><div className="delivery-card"><span className="delivery-kicker">CAPTAIN</span><h2>{tracking.captain?.captain_code ?? 'لە چاوەڕوانیدا'}</h2><p className="delivery-muted">{tracking.captain ? `${tracking.captain.vehicle_make ?? ''} ${tracking.captain.vehicle_model ?? ''}` : 'کاپتن هێشتا دیاری نەکراوە.'}</p><div className="delivery-mini-metrics"><div><span>ETA</span><strong>{tracking.estimated_minutes ?? '—'} min</strong></div><div><span>Location</span><strong>{tracking.location ? 'LIVE' : 'Waiting'}</strong></div></div>{tracking.location && <p className="delivery-coordinates">{tracking.location.latitude.toFixed(5)}, {tracking.location.longitude.toFixed(5)}</p>}</div></div>}
      {!tracking && !error && <div className="delivery-card"><div className="delivery-empty">شوێنی گەیاندن هێشتا بەردەست نییە.</div></div>}
    </main>
  );
}

export default function DeliveryPage({ orderId }: { orderId?: string }) {
  const { hasRole } = useAuth();
  if (orderId) return <TrackingConsole orderId={orderId} />;
  if (hasRole('captain')) return <CaptainConsole />;
  if (hasRole(['super_admin', 'admin', 'captain_manager'])) return <DispatchConsole />;
  return <main className="delivery-page"><section className="delivery-card"><h1>دەستگەیشتن ڕێگەپێنەدراوە</h1><p className="delivery-muted">ئەم بەشە تەنها بۆ captain و delivery operations ـە.</p></section></main>;
}
