import { Restaurant } from '@/hooks/useQueries';

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: {
    name?: string;
    'addr:street'?: string;
    'addr:housenumber'?: string;
    'addr:city'?: string;
    'addr:country'?: string;
    'addr:postcode'?: string;
    cuisine?: string;
    amenity?: string;
    shop?: string;
    [key: string]: string | undefined;
  };
  center?: {
    lat: number;
    lon: number;
  };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

/**
 * Build an Overpass QL query for halal-related POIs near a coordinate.
 * Searches for restaurants, fast food, cafes, butchers, shops, and supermarkets with halal tags.
 * Includes node, way, and relation elements with expanded halal tag patterns.
 */
export function buildOverpassQuery(
  latitude: number,
  longitude: number,
  radiusMeters: number = 10000
): string {
  const query = `
[out:json][timeout:25];
(
  node["cuisine"~"halal",i](around:${radiusMeters},${latitude},${longitude});
  way["cuisine"~"halal",i](around:${radiusMeters},${latitude},${longitude});
  relation["cuisine"~"halal",i](around:${radiusMeters},${latitude},${longitude});
  
  node["diet:halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  way["diet:halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  relation["diet:halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  
  node["diet:halal"="only"](around:${radiusMeters},${latitude},${longitude});
  way["diet:halal"="only"](around:${radiusMeters},${latitude},${longitude});
  relation["diet:halal"="only"](around:${radiusMeters},${latitude},${longitude});
  
  node["halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  way["halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  relation["halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  
  node["halal"="only"](around:${radiusMeters},${latitude},${longitude});
  way["halal"="only"](around:${radiusMeters},${latitude},${longitude});
  relation["halal"="only"](around:${radiusMeters},${latitude},${longitude});
  
  node["amenity"="restaurant"]["cuisine"~"halal",i](around:${radiusMeters},${latitude},${longitude});
  way["amenity"="restaurant"]["cuisine"~"halal",i](around:${radiusMeters},${latitude},${longitude});
  relation["amenity"="restaurant"]["cuisine"~"halal",i](around:${radiusMeters},${latitude},${longitude});
  
  node["amenity"="fast_food"]["cuisine"~"halal",i](around:${radiusMeters},${latitude},${longitude});
  way["amenity"="fast_food"]["cuisine"~"halal",i](around:${radiusMeters},${latitude},${longitude});
  relation["amenity"="fast_food"]["cuisine"~"halal",i](around:${radiusMeters},${latitude},${longitude});
  
  node["amenity"="cafe"]["diet:halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  way["amenity"="cafe"]["diet:halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  relation["amenity"="cafe"]["diet:halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  
  node["shop"="butcher"]["halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  way["shop"="butcher"]["halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  relation["shop"="butcher"]["halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  
  node["shop"="halal"](around:${radiusMeters},${latitude},${longitude});
  way["shop"="halal"](around:${radiusMeters},${latitude},${longitude});
  relation["shop"="halal"](around:${radiusMeters},${latitude},${longitude});
  
  node["shop"="supermarket"]["halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  way["shop"="supermarket"]["halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  relation["shop"="supermarket"]["halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  
  node["shop"="convenience"]["halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  way["shop"="convenience"]["halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  relation["shop"="convenience"]["halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  
  node["cuisine"~"turkish|middle_eastern|pakistani|indian|indonesian|malaysian|arabic",i]["diet:halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  way["cuisine"~"turkish|middle_eastern|pakistani|indian|indonesian|malaysian|arabic",i]["diet:halal"="yes"](around:${radiusMeters},${latitude},${longitude});
  relation["cuisine"~"turkish|middle_eastern|pakistani|indian|indonesian|malaysian|arabic",i]["diet:halal"="yes"](around:${radiusMeters},${latitude},${longitude});
);
out center;
`.trim();
  return query;
}

/**
 * Parse Overpass API response and map elements to Restaurant model.
 * Safely handles node, way, and relation elements with center coordinates.
 */
export function parseOverpassResponse(
  response: OverpassResponse,
  searchLat: number,
  searchLon: number
): Restaurant[] {
  if (!response || !response.elements || !Array.isArray(response.elements)) {
    return [];
  }

  const restaurants: Restaurant[] = [];

  for (const element of response.elements) {
    const tags = element.tags || {};
    const name = tags.name || 'Unnamed Place';

    // Get coordinates (node has lat/lon directly, way/relation has center)
    let lat: number | undefined;
    let lon: number | undefined;

    if (element.type === 'node' && element.lat && element.lon) {
      lat = element.lat;
      lon = element.lon;
    } else if ((element.type === 'way' || element.type === 'relation') && element.center) {
      lat = element.center.lat;
      lon = element.center.lon;
    }

    if (!lat || !lon) {
      continue; // Skip elements without coordinates
    }

    // Build address from tags
    const addressParts: string[] = [];
    if (tags['addr:housenumber']) addressParts.push(tags['addr:housenumber']);
    if (tags['addr:street']) addressParts.push(tags['addr:street']);
    const address = addressParts.length > 0 ? addressParts.join(' ') : 'Address not available';

    const city = tags['addr:city'] || '';
    const country = tags['addr:country'] || '';

    // Determine cuisine/category
    let cuisine = 'Halal';
    if (tags.cuisine) {
      cuisine = tags.cuisine;
    } else if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food' || tags.amenity === 'cafe') {
      cuisine = 'Restaurant';
    } else if (tags.shop === 'butcher') {
      cuisine = 'Halal Butcher';
    } else if (tags.shop === 'halal') {
      cuisine = 'Halal Shop';
    } else if (tags.shop === 'supermarket') {
      cuisine = 'Halal Supermarket';
    } else if (tags.shop) {
      cuisine = 'Halal Shop';
    }

    // Calculate distance
    const distance = Math.round(
      haversineDistance(searchLat, searchLon, lat, lon)
    );

    restaurants.push({
      id: `osm-${element.type}-${element.id}`,
      name,
      cuisine,
      address,
      city,
      country,
      latitude: lat,
      longitude: lon,
      distance,
    });
  }

  return restaurants;
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
