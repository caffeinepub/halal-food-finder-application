import { Restaurant } from '@/hooks/useQueries';

/**
 * Normalize a name for comparison by removing common variations
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate simple string similarity (0-1) using character overlap
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Check if one string contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8;
  }
  
  // Calculate character overlap
  const chars1 = new Set(s1.split(''));
  const chars2 = new Set(s2.split(''));
  const intersection = new Set([...chars1].filter(x => chars2.has(x)));
  const union = new Set([...chars1, ...chars2]);
  
  return intersection.size / union.size;
}

/**
 * Calculate distance between two points in meters using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
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

/**
 * Check if two restaurants are likely duplicates based on name similarity and proximity
 */
function areDuplicates(r1: Restaurant, r2: Restaurant): boolean {
  const NAME_SIMILARITY_THRESHOLD = 0.75;
  const PROXIMITY_THRESHOLD_METERS = 50; // 50 meters

  // Check name similarity
  const nameSim = stringSimilarity(r1.name, r2.name);
  if (nameSim < NAME_SIMILARITY_THRESHOLD) {
    return false;
  }

  // Check proximity
  const distance = calculateDistance(r1.latitude, r1.longitude, r2.latitude, r2.longitude);
  return distance <= PROXIMITY_THRESHOLD_METERS;
}

/**
 * Merge two restaurant records, preferring non-empty fields
 */
function mergeRestaurants(r1: Restaurant, r2: Restaurant): Restaurant {
  return {
    id: r1.id || r2.id,
    name: r1.name || r2.name,
    cuisine: r1.cuisine || r2.cuisine,
    address: r1.address || r2.address,
    city: r1.city || r2.city,
    country: r1.country || r2.country,
    latitude: r1.latitude || r2.latitude,
    longitude: r1.longitude || r2.longitude,
    rating: r1.rating ?? r2.rating,
    phone: r1.phone || r2.phone,
    website: r1.website || r2.website,
    distance: r1.distance ?? r2.distance,
  };
}

/**
 * Merge and deduplicate restaurants from multiple sources
 */
export function mergeAndDeduplicateRestaurants(sources: Restaurant[][]): Restaurant[] {
  const allRestaurants = sources.flat();
  const merged: Restaurant[] = [];
  const processed = new Set<number>();

  for (let i = 0; i < allRestaurants.length; i++) {
    if (processed.has(i)) continue;

    let current = allRestaurants[i];
    processed.add(i);

    // Look for duplicates in remaining restaurants
    for (let j = i + 1; j < allRestaurants.length; j++) {
      if (processed.has(j)) continue;

      if (areDuplicates(current, allRestaurants[j])) {
        // Merge the duplicate into current
        current = mergeRestaurants(current, allRestaurants[j]);
        processed.add(j);
      }
    }

    merged.push(current);
  }

  return merged;
}

/**
 * Sort restaurants by distance with stable ordering.
 * Places with missing distance are pushed to the end.
 * Uses original index as tie-breaker for stability.
 */
export function sortByDistance(restaurants: Restaurant[]): Restaurant[] {
  return restaurants
    .map((r, index) => ({ restaurant: r, originalIndex: index }))
    .sort((a, b) => {
      const distA = a.restaurant.distance;
      const distB = b.restaurant.distance;

      // Push missing distances to the end
      if (distA === undefined && distB === undefined) {
        return a.originalIndex - b.originalIndex; // Stable: preserve original order
      }
      if (distA === undefined) return 1;
      if (distB === undefined) return -1;

      // Sort by distance, use original index as tie-breaker
      if (distA === distB) {
        return a.originalIndex - b.originalIndex;
      }
      return distA - distB;
    })
    .map(item => item.restaurant);
}
