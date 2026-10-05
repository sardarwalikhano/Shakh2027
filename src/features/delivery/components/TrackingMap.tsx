import { useMemo } from 'react';

type Point = { latitude: number; longitude: number } | null;

function project(point: Point, bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) {
  if (!point) return null;
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.0001);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.0001);
  const x = ((point.longitude - bounds.minLng) / lngSpan) * 100;
  const y = 100 - ((point.latitude - bounds.minLat) / latSpan) * 100;
  return { x: Math.min(92, Math.max(8, x)), y: Math.min(92, Math.max(8, y)) };
}

export default function TrackingMap({
  captain,
  pickup,
  dropoff,
}: {
  captain: Point;
  pickup: Point;
  dropoff: Point;
}) {
  const bounds = useMemo(() => {
    const points = [captain, pickup, dropoff].filter(Boolean) as Array<{ latitude: number; longitude: number }>;
    if (!points.length) return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
    return {
      minLat: Math.min(...points.map((p) => p.latitude)) - 0.001,
      maxLat: Math.max(...points.map((p) => p.latitude)) + 0.001,
      minLng: Math.min(...points.map((p) => p.longitude)) - 0.001,
      maxLng: Math.max(...points.map((p) => p.longitude)) + 0.001,
    };
  }, [captain, pickup, dropoff]);

  const captainP = project(captain, bounds);
  const pickupP = project(pickup, bounds);
  const dropoffP = project(dropoff, bounds);

  return (
    <div className="delivery-map-shell" aria-label="نقشەی شوێنی گەیاندن">
      <div className="delivery-map-grid" aria-hidden="true" />
      <div className="delivery-map-road road-a" />
      <div className="delivery-map-road road-b" />
      <div className="delivery-map-road road-c" />
      {pickupP && <span className="delivery-pin pickup" style={{ left: `${pickupP.x}%`, top: `${pickupP.y}%` }}>P</span>}
      {dropoffP && <span className="delivery-pin dropoff" style={{ left: `${dropoffP.x}%`, top: `${dropoffP.y}%` }}>D</span>}
      {captainP && <span className="delivery-pin captain" style={{ left: `${captainP.x}%`, top: `${captainP.y}%` }}>●</span>}
      <div className="delivery-map-legend">
        <span><i className="legend-dot captain-dot" />کاپتن</span>
        <span><i className="legend-dot pickup-dot" />وەرگرتن</span>
        <span><i className="legend-dot dropoff-dot" />گەیاندن</span>
      </div>
    </div>
  );
}
