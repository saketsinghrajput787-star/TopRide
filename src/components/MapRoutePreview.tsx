import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Navigation, Clock, AlertCircle } from 'lucide-react';
import { 
  MAPBOX_ACCESS_TOKEN, 
  isMapboxAvailable, 
  getFallbackCoordinates, 
  getMapboxRoute, 
  RouteData 
} from '../services/mapbox';

interface MapRoutePreviewProps {
  origin?: string;
  destination?: string;
  originCoords?: { latitude: number; longitude: number };
  destCoords?: { latitude: number; longitude: number };
  routeGeometry?: any;
  height?: string;
  interactive?: boolean;
  className?: string;
  showSummary?: boolean;
}

export const MapRoutePreview: React.FC<MapRoutePreviewProps> = ({
  origin = 'Bengaluru',
  destination = 'Hyderabad',
  originCoords,
  destCoords,
  routeGeometry,
  height = 'h-56 sm:h-72',
  interactive = true,
  className = '',
  showSummary = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteData | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // 1. Resolve coordinates (from props or fallback cities)
  const resolvedOrigin = originCoords?.latitude && originCoords?.longitude
    ? originCoords
    : getFallbackCoordinates(origin)
    ? { latitude: getFallbackCoordinates(origin)!.lat, longitude: getFallbackCoordinates(origin)!.lng }
    : null;

  const resolvedDest = destCoords?.latitude && destCoords?.longitude
    ? destCoords
    : getFallbackCoordinates(destination)
    ? { latitude: getFallbackCoordinates(destination)!.lat, longitude: getFallbackCoordinates(destination)!.lng }
    : null;

  useEffect(() => {
    if (!isMapboxAvailable()) {
      setMapError('Map service is currently unavailable.');
      return;
    }

    if (!resolvedOrigin || !resolvedDest) {
      setMapError('Map unavailable for this trip.');
      return;
    }

    setMapError(null);

    // Initialize Mapbox map
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current!,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [resolvedOrigin.longitude, resolvedOrigin.latitude],
      zoom: 6,
      interactive: interactive,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    if (interactive) {
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    }

    // Add Origin Marker (Emerald Pin)
    const originEl = document.createElement('div');
    originEl.className = 'w-6 h-6 rounded-full bg-emerald-500 border-2 border-white shadow-md flex items-center justify-center text-[10px] text-white font-black cursor-pointer';
    originEl.innerText = 'A';
    new mapboxgl.Marker({ element: originEl })
      .setLngLat([resolvedOrigin.longitude, resolvedOrigin.latitude])
      .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML(`<strong>${origin}</strong>`))
      .addTo(map);

    // Add Destination Marker (Rose Pin)
    const destEl = document.createElement('div');
    destEl.className = 'w-6 h-6 rounded-full bg-rose-500 border-2 border-white shadow-md flex items-center justify-center text-[10px] text-white font-black cursor-pointer';
    destEl.innerText = 'B';
    new mapboxgl.Marker({ element: destEl })
      .setLngLat([resolvedDest.longitude, resolvedDest.latitude])
      .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML(`<strong>${destination}</strong>`))
      .addTo(map);

    // Fit bounds initially around the two endpoints
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([resolvedOrigin.longitude, resolvedOrigin.latitude]);
    bounds.extend([resolvedDest.longitude, resolvedDest.latitude]);
    map.fitBounds(bounds, { padding: 45, maxZoom: 13, duration: 800 });

    // Fetch and render driving route
    async function loadRoute() {
      try {
        let route = null;
        if (routeGeometry) {
          route = { geometry: routeGeometry, distanceKm: 0, durationText: '' };
        } else {
          route = await getMapboxRoute(resolvedOrigin!, resolvedDest!);
        }

        if (route && mapInstanceRef.current) {
          setRouteInfo(route);

          map.on('load', () => {
            if (!mapInstanceRef.current) return;

            // Add route GeoJSON source and layer
            if (!mapInstanceRef.current.getSource('route')) {
              mapInstanceRef.current.addSource('route', {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: route.geometry,
                },
              });

              // Route Line Outer Glow
              mapInstanceRef.current.addLayer({
                id: 'route-glow',
                type: 'line',
                source: 'route',
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round',
                },
                paint: {
                  'line-color': '#2563eb',
                  'line-width': 8,
                  'line-opacity': 0.25,
                },
              });

              // Main Route Line
              mapInstanceRef.current.addLayer({
                id: 'route-main',
                type: 'line',
                source: 'route',
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round',
                },
                paint: {
                  'line-color': '#0f172a',
                  'line-width': 4.5,
                },
              });

              // Adjust bounds to route geometry
              if (route.geometry.coordinates && Array.isArray(route.geometry.coordinates)) {
                const routeBounds = new mapboxgl.LngLatBounds();
                route.geometry.coordinates.forEach((coord: [number, number]) => {
                  routeBounds.extend(coord);
                });
                mapInstanceRef.current.fitBounds(routeBounds, { padding: 45, maxZoom: 13, duration: 800 });
              }
            }
          });

          // In case map is already loaded
          if (map.isStyleLoaded() && !map.getSource('route')) {
            map.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: route.geometry,
              },
            });
            map.addLayer({
              id: 'route-glow',
              type: 'line',
              source: 'route',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#2563eb', 'line-width': 8, 'line-opacity': 0.25 },
            });
            map.addLayer({
              id: 'route-main',
              type: 'line',
              source: 'route',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#0f172a', 'line-width': 4.5 },
            });
          }
        }
      } catch (err) {
        console.warn('[MapRoutePreview] Could not load route line:', err);
      }
    }

    loadRoute();

    // Ensure map container renders sharp across responsive resize
    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.resize();
      }
    };
    window.addEventListener('resize', handleResize);
    const resizeTimer = setTimeout(handleResize, 180);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [
    origin,
    destination,
    resolvedOrigin?.latitude,
    resolvedOrigin?.longitude,
    resolvedDest?.latitude,
    resolvedDest?.longitude,
    interactive,
  ]);

  if (mapError) {
    return (
      <div className={`relative w-full ${height} rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex flex-col items-center justify-center p-6 text-center select-none ${className}`}>
        <AlertCircle className="w-8 h-8 text-slate-400 mb-2" />
        <span className="text-xs font-bold text-slate-700">{mapError}</span>
        <span className="text-[11px] text-slate-500 mt-1">{origin} → {destination}</span>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${height} rounded-2xl overflow-hidden border border-slate-200 shadow-xs ${className}`}>
      {/* Mapbox container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Route Distance / Duration Summary Pill */}
      {showSummary && (
        <div className="absolute top-3 left-3 flex items-center gap-2 z-10 pointer-events-none max-w-[calc(100%-1.5rem)]">
          <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md border border-slate-200 text-xs font-bold text-slate-900 flex items-center gap-2 overflow-hidden truncate">
            <Navigation className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">{origin} → {destination}</span>
            {routeInfo && routeInfo.distanceKm > 0 && (
              <>
                <span className="text-slate-300 shrink-0">•</span>
                <span className="text-slate-600 font-semibold shrink-0">{routeInfo.distanceKm} km</span>
              </>
            )}
            {routeInfo && routeInfo.durationText && (
              <>
                <span className="text-slate-300 shrink-0">•</span>
                <span className="text-slate-600 font-semibold flex items-center gap-1 shrink-0">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {routeInfo.durationText}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
