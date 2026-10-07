import { LocationData } from '../types';

export const MAPBOX_ACCESS_TOKEN = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '')
  .trim()
  .replace(/^["']|["']$/g, '');

export function isMapboxAvailable(): boolean {
  return typeof MAPBOX_ACCESS_TOKEN === 'string' && MAPBOX_ACCESS_TOKEN.length > 10;
}

// Known coordinates for top cities to gracefully assist legacy trips
export const CITY_COORDINATES: Record<string, { lat: number; lng: number; address: string }> = {
  bengaluru: { lat: 12.9716, lng: 77.5946, address: 'Bengaluru, Karnataka, India' },
  bangalore: { lat: 12.9716, lng: 77.5946, address: 'Bengaluru, Karnataka, India' },
  hyderabad: { lat: 17.3850, lng: 78.4867, address: 'Hyderabad, Telangana, India' },
  chennai: { lat: 13.0827, lng: 80.2707, address: 'Chennai, Tamil Nadu, India' },
  mumbai: { lat: 19.0760, lng: 72.8777, address: 'Mumbai, Maharashtra, India' },
  pune: { lat: 18.5204, lng: 73.8567, address: 'Pune, Maharashtra, India' },
  mysuru: { lat: 12.2958, lng: 76.6394, address: 'Mysuru, Karnataka, India' },
  mysore: { lat: 12.2958, lng: 76.6394, address: 'Mysuru, Karnataka, India' },
  delhi: { lat: 28.6139, lng: 77.2090, address: 'New Delhi, Delhi, India' },
  'new delhi': { lat: 28.6139, lng: 77.2090, address: 'New Delhi, Delhi, India' },
  goa: { lat: 15.2993, lng: 74.1240, address: 'Goa, India' },
  panaji: { lat: 15.4909, lng: 73.8278, address: 'Panaji, Goa, India' },
  kochi: { lat: 9.9312, lng: 76.2673, address: 'Kochi, Kerala, India' },
  coimbatore: { lat: 11.0168, lng: 76.9558, address: 'Coimbatore, Tamil Nadu, India' },
  jaipur: { lat: 26.9124, lng: 75.7873, address: 'Jaipur, Rajasthan, India' },
  ahmedabad: { lat: 23.0225, lng: 72.5714, address: 'Ahmedabad, Gujarat, India' },
  kolkata: { lat: 22.5726, lng: 88.3639, address: 'Kolkata, West Bengal, India' },
};

export function getFallbackCoordinates(cityName: string): { lat: number; lng: number; address: string } | null {
  if (!cityName) return null;
  const clean = cityName.trim().toLowerCase();
  for (const [key, val] of Object.entries(CITY_COORDINATES)) {
    if (clean.includes(key)) {
      return val;
    }
  }
  return null;
}

export interface RouteData {
  geometry: any;
  distanceKm: number;
  durationText: string;
  summary?: string;
}

// Browser/session-local in-memory caches to minimize Mapbox API calls within the active tab/session.
// Note: These JavaScript Maps are strictly browser-local and session-local (scoped to the current tab lifecycle).
// They are not shared across separate browser tabs, sessions, or backend server instances.
const placesCache = new Map<string, LocationData[]>();
const routeCache = new Map<string, RouteData>();
const inFlightPlaces = new Map<string, Promise<LocationData[]>>();
const inFlightRoutes = new Map<string, Promise<RouteData | null>>();

/**
 * Perform real Mapbox Places search with autocomplete, session caching, and request deduplication
 */
export async function searchMapboxLocations(query: string, signal?: AbortSignal): Promise<LocationData[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const cacheKey = trimmed.toLowerCase();
  if (placesCache.has(cacheKey)) {
    return placesCache.get(cacheKey)!;
  }

  if (inFlightPlaces.has(cacheKey)) {
    return inFlightPlaces.get(cacheKey)!;
  }

  if (!isMapboxAvailable()) {
    console.warn('[Mapbox] Access token is missing or not configured');
    return [];
  }

  const fetchPromise = (async () => {
    try {
      const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&autocomplete=true&limit=6&language=en`;
      let response: Response;
      try {
        response = await fetch(endpoint, { signal });
      } catch (firstErr: any) {
        if (firstErr?.name === 'AbortError') return [];
        // Maximum one controlled retry for transient network failure
        response = await fetch(endpoint, { signal });
      }

      if (!response.ok) {
        console.warn(`[Mapbox] Geocoding API returned status ${response.status}`);
        return [];
      }

      const data = await response.json();
      if (!data.features || !Array.isArray(data.features)) return [];

      const results: LocationData[] = data.features.map((feature: any) => {
        const center = Array.isArray(feature?.center) ? feature.center : [0, 0];
        const lng = typeof center[0] === 'number' && !isNaN(center[0]) ? center[0] : 0;
        const lat = typeof center[1] === 'number' && !isNaN(center[1]) ? center[1] : 0;
        const rawPlaceName = typeof feature?.place_name === 'string' ? feature.place_name : '';
        const rawText = typeof feature?.text === 'string' ? feature.text : '';
        const name = rawText || (rawPlaceName ? rawPlaceName.split(',')[0].trim() : 'Location');
        return {
          name: name || 'Location',
          formattedAddress: rawPlaceName || undefined,
          latitude: lat,
          longitude: lng,
          placeId: String(feature?.id || Math.random().toString(36).substring(2)),
        };
      });

      placesCache.set(cacheKey, results);
      return results;
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('[Mapbox] searchMapboxLocations error:', error);
      }
      return [];
    } finally {
      inFlightPlaces.delete(cacheKey);
    }
  })();

  inFlightPlaces.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Fetch real driving route between origin and destination coordinates with session caching & deduplication
 */
export async function getMapboxRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  signal?: AbortSignal
): Promise<RouteData | null> {
  if (!isMapboxAvailable()) return null;
  if (!origin?.latitude || !origin?.longitude || !destination?.latitude || !destination?.longitude) {
    return null;
  }

  const cacheKey = `${origin.longitude.toFixed(5)},${origin.latitude.toFixed(5)};${destination.longitude.toFixed(5)},${destination.latitude.toFixed(5)}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!;
  }

  if (inFlightRoutes.has(cacheKey)) {
    return inFlightRoutes.get(cacheKey)!;
  }

  const routePromise = (async () => {
    try {
      const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${MAPBOX_ACCESS_TOKEN}`;

      let response: Response;
      try {
        response = await fetch(url, { signal });
      } catch (firstErr: any) {
        if (firstErr?.name === 'AbortError') return null;
        // Maximum one controlled retry for transient network failure
        response = await fetch(url, { signal });
      }

      if (!response.ok) {
        console.warn(`[Mapbox Directions] API returned ${response.status}`);
        return null;
      }

      const data = await response.json();
      if (!data.routes || data.routes.length === 0) return null;

      const primaryRoute = data.routes[0];
      const distanceMeters = primaryRoute.distance || 0;
      const durationSeconds = primaryRoute.duration || 0;

      const distanceKm = Math.round(distanceMeters / 1000);
      const hours = Math.floor(durationSeconds / 3600);
      const minutes = Math.round((durationSeconds % 3600) / 60);

      let durationText = '';
      if (hours > 0) {
        durationText = `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`.trim();
      } else {
        durationText = `${minutes}m`;
      }

      const routeResult: RouteData = {
        geometry: primaryRoute.geometry,
        distanceKm,
        durationText,
        summary: primaryRoute.legs?.[0]?.summary || '',
      };

      routeCache.set(cacheKey, routeResult);
      return routeResult;
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('[Mapbox Directions] Route fetch error:', error);
      }
      return null;
    } finally {
      inFlightRoutes.delete(cacheKey);
    }
  })();

  inFlightRoutes.set(cacheKey, routePromise);
  return routePromise;
}

