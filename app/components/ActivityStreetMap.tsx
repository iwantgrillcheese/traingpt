'use client';

import { useEffect, useRef, useState } from 'react';
import { decodeRouteCoordinates } from '@/lib/strava/route-geometry';

type Props = {
  polyline: string;
  onUnavailable: () => void;
};

const cartoKey = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY;
const tileUrl = cartoKey
  ? 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=' + encodeURIComponent(cartoKey)
  : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const attribution = cartoKey
  ? '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution/" target="_blank" rel="noopener noreferrer">CARTO</a>'
  : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

/**
 * Real, pannable street map for Strava run/ride routes.
 * Load Leaflet only when an activity with GPS is opened, not for the calendar.
 * Wheel zoom is intentionally disabled to preserve scrolling inside the modal.
 */
export default function ActivityStreetMap({ polyline, onUnavailable }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [tilesReady, setTilesReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: import('leaflet').Map | null = null;
    let resizeId: ReturnType<typeof setTimeout> | undefined;
    let loadingTimeout: ReturnType<typeof setTimeout> | undefined;

    const initialize = async () => {
      const coordinates = decodeRouteCoordinates(polyline);
      if (!coordinates) {
        onUnavailable();
        return;
      }

      const L = await import('leaflet');
      if (cancelled || !container.current) return;

      map = L.map(container.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: true,
        touchZoom: true,
        dragging: true,
        zoomSnap: 0.5,
      });

      let successfulTiles = 0;
      let failedTiles = 0;
      const tiles = L.tileLayer(tileUrl, {
        attribution,
        maxZoom: 19,
        minZoom: 2,
        // Load only the visible viewport. Honour tile-server caching headers.
        keepBuffer: 1,
        updateWhenIdle: true,
      });
      tiles.on('tileload', () => {
        successfulTiles += 1;
        if (loadingTimeout) clearTimeout(loadingTimeout);
        if (!cancelled) setTilesReady(true);
      });
      tiles.on('tileerror', () => {
        failedTiles += 1;
        if (!cancelled && successfulTiles === 0 && failedTiles >= 3) onUnavailable();
      });
      tiles.addTo(map);
      // If a tile server hangs rather than returning errors, restore the SVG route.
      loadingTimeout = setTimeout(() => {
        if (!cancelled && successfulTiles === 0) onUnavailable();
      }, 12000);

      const positions = coordinates.map(([lat, lng]) => L.latLng(lat, lng));
      const route = L.polyline(positions, {
        color: '#FC4C02',
        weight: 4,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      });

      // A narrow white casing keeps the route readable against busy roads.
      L.polyline(positions, {
        color: '#FFFFFF',
        weight: 7,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(map);
      route.addTo(map);

      L.circleMarker(positions[0], {
        radius: 5, color: '#FFFFFF', weight: 2, fillColor: '#22A06B', fillOpacity: 1,
      }).addTo(map);
      L.circleMarker(positions[positions.length - 1], {
        radius: 5, color: '#FFFFFF', weight: 2, fillColor: '#FC4C02', fillOpacity: 1,
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);
      map.fitBounds(route.getBounds(), { padding: [26, 26], maxZoom: 15, animate: false });
      // Leaflet needs a second measurement after a flex-based modal is laid out.
      resizeId = setTimeout(() => {
        if (!cancelled) map?.invalidateSize({ animate: false });
      }, 0);
    };

    void initialize().catch(() => {
      if (!cancelled) onUnavailable();
    });

    return () => {
      cancelled = true;
      if (resizeId) clearTimeout(resizeId);
      if (loadingTimeout) clearTimeout(loadingTimeout);
      map?.remove();
    };
  }, [polyline, onUnavailable]);

  return (
    <div className="relative h-full w-full bg-[#F1F3F1]">
      <div
        ref={container}
        className="h-full w-full"
        role="region"
        aria-label="Interactive street map of your Strava GPS route"
      />
      {!tilesReady ? (
        <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center bg-[#F1F3F1]/90 text-xs font-medium text-zinc-500">
          Loading street map…
        </div>
      ) : null}
    </div>
  );
}
