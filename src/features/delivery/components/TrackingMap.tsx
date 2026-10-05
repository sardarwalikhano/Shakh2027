import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type Point = { latitude: number; longitude: number } | null;

const env = import.meta.env as ImportMetaEnv & {
  VITE_MAPBOX_TOKEN?: string;
};

const MAPBOX_TOKEN = env.VITE_MAPBOX_TOKEN?.trim() || '';

function fallbackProject(point: Point, bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) {
  if (!point) return null;
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.0001);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.0001);
  const x = ((point.longitude - bounds.minLng) / lngSpan) * 100;
  const y = 100 - ((point.latitude - bounds.minLat) / latSpan) * 100;
  return { x: Math.min(92, Math.max(8, x)), y: Math.min(92, Math.max(8, y)) };
}

function resolveBounds(points: Point[]) {
  const valid = points.filter(Boolean) as Array<{ latitude: number; longitude: number }>;
  if (!valid.length) return null;
  return new mapboxgl.LngLatBounds(
    [Math.min(...valid.map((p) => p.longitude)), Math.min(...valid.map((p) => p.latitude))],
    [Math.max(...valid.map((p) => p.longitude)), Math.max(...valid.map((p) => p.latitude))],
  );
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
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const captainMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const dropoffMarkerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/standard',
      center: captain ? [captain.longitude, captain.latitude] : pickup ? [pickup.longitude, pickup.latitude] : [47.0, 35.9],
      zoom: 12,
      attributionControl: true,
      cooperativeGestures: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    return () => {
      captainMarkerRef.current?.remove();
      pickupMarkerRef.current?.remove();
      dropoffMarkerRef.current?.remove();
      captainMarkerRef.current = null;
      pickupMarkerRef.current = null;
      dropoffMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = [
      { key: 'captain', point: captain, ref: captainMarkerRef, label: 'کاپتن' },
      { key: 'pickup', point: pickup, ref: pickupMarkerRef, label: 'وەرگرتن' },
      { key: 'dropoff', point: dropoff, ref: dropoffMarkerRef, label: 'گەیاندن' },
    ] as const;

    for (const item of markers) {
      if (!item.point) {
        item.ref.current?.remove();
        item.ref.current = null;
        continue;
      }

      const lngLat: [number, number] = [item.point.longitude, item.point.latitude];
      if (item.ref.current) {
        item.ref.current.setLngLat(lngLat);
      } else {
        const element = document.createElement('div');
        element.className = `delivery-mapbox-marker delivery-mapbox-marker-${item.key}`;
        element.setAttribute('aria-label', item.label);
        element.title = item.label;
        item.ref.current = new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat(lngLat).addTo(map);
      }
    }

    const bounds = resolveBounds([captain, pickup, dropoff]);
    if (bounds) {
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const isSinglePoint = ne.lng === sw.lng && ne.lat === sw.lat;
      if (isSinglePoint) {
        map.easeTo({ center: [ne.lng, ne.lat], zoom: 14, duration: 350 });
      } else {
        map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 450 });
      }
    }

    const updateRoute = () => {
      const coordinates = [pickup, captain, dropoff]
        .filter(Boolean)
        .map((point) => [point!.longitude, point!.latitude]);

      const source = map.getSource('shakh-tracking-route') as mapboxgl.GeoJSONSource | undefined;
      if (source) {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coordinates.length > 1 ? coordinates : [] },
        });
        return;
      }

      if (!map.isStyleLoaded()) return;
      map.addSource('shakh-tracking-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coordinates.length > 1 ? coordinates : [] },
        },
      });
      map.addLayer({
        id: 'shakh-tracking-route-line',
        type: 'line',
        source: 'shakh-tracking-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f97316', 'line-width': 5, 'line-opacity': 0.82 },
      });
    };

    if (map.isStyleLoaded()) updateRoute();
    else map.once('load', updateRoute);
  }, [captain, pickup, dropoff]);

  const points = [captain, pickup, dropoff];
  const valid = points.filter(Boolean) as Array<{ latitude: number; longitude: number }>;
  const bounds = valid.length
    ? {
        minLat: Math.min(...valid.map((p) => p.latitude)) - 0.001,
        maxLat: Math.max(...valid.map((p) => p.latitude)) + 0.001,
        minLng: Math.min(...valid.map((p) => p.longitude)) - 0.001,
        maxLng: Math.max(...valid.map((p) => p.longitude)) + 0.001,
      }
    : { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };

  const captainP = fallbackProject(captain, bounds);
  const pickupP = fallbackProject(pickup, bounds);
  const dropoffP = fallbackProject(dropoff, bounds);

  if (MAPBOX_TOKEN) {
    return (
      <div className="delivery-map-shell delivery-mapbox-shell" aria-label="نقشەی شوێنی گەیاندن">
        <div ref={mapContainerRef} className="delivery-mapbox-canvas" />
        <div className="delivery-map-legend delivery-mapbox-legend">
          <span><i className="legend-dot captain-dot" />کاپتن</span>
          <span><i className="legend-dot pickup-dot" />وەرگرتن</span>
          <span><i className="legend-dot dropoff-dot" />گەیاندن</span>
        </div>
      </div>
    );
  }

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
