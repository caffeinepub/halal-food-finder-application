import { useState, useCallback } from 'react';
import { useActor } from './useActor';
import { toast } from 'sonner';
import { buildOverpassQuery, parseOverpassResponse } from '@/lib/overpass';
import { mergeAndDeduplicateRestaurants, sortByDistance } from '@/lib/placesMerge';
import { validateCoordinates } from '@/lib/coordinates';

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  rating?: number;
  phone?: string;
  website?: string;
  distance?: number;
}

interface FoursquareVenue {
  fsq_id: string;
  name: string;
  location: {
    address?: string;
    locality?: string;
    region?: string;
    country?: string;
    formatted_address?: string;
  };
  geocodes: {
    main: {
      latitude: number;
      longitude: number;
    };
  };
  categories?: Array<{
    name: string;
  }>;
  distance?: number;
  rating?: number;
  tel?: string;
  website?: string;
}

const MAX_AUTO_RETRIES = 2;
const RETRY_DELAY_MS = 2000;
const MIN_RESULTS_THRESHOLD = 5;
const MAX_RADIUS_METERS = 30000; // 30km maximum

interface ErrorState {
  message: string;
  isRetrying: boolean;
  retryCount: number;
  canRetry: boolean;
  isAuthError: boolean;
}

function getUserFriendlyError(error: unknown, retryCount: number = 0): ErrorState {
  const defaultError: ErrorState = {
    message: 'Unable to search for restaurants at this time. Please try again.',
    isRetrying: false,
    retryCount,
    canRetry: true,
    isAuthError: false,
  };

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Check for authorization/permission errors
    if (message.includes('unauthorized') || message.includes('permission') || message.includes('forbidden') || message.includes('access denied')) {
      return {
        message: 'You need to be logged in to use this feature. Please log in and try again.',
        isRetrying: false,
        retryCount,
        canRetry: false,
        isAuthError: true,
      };
    }
    
    // Check for role-based access errors
    if (message.includes('only admins') || message.includes('only users') || message.includes('admin only')) {
      return {
        message: 'This feature requires special permissions. Please log in with an authorized account.',
        isRetrying: false,
        retryCount,
        canRetry: false,
        isAuthError: true,
      };
    }
    
    if (message.includes('canister') || message.includes('stopped') || message.includes('ic0508') || message.includes('trap')) {
      return {
        message: retryCount > 0 
          ? `Service is recovering (attempt ${retryCount + 1}/${MAX_AUTO_RETRIES + 1}). Please wait...`
          : 'The service is temporarily restarting. Retrying automatically...',
        isRetrying: true,
        retryCount,
        canRetry: true,
        isAuthError: false,
      };
    }
    
    if (message.includes('replication') || message.includes('reject')) {
      return {
        message: 'Service is synchronizing. Retrying automatically...',
        isRetrying: true,
        retryCount,
        canRetry: true,
        isAuthError: false,
      };
    }
    
    if (message.includes('network') || message.includes('fetch')) {
      return {
        message: 'Network connection issue detected. Please check your internet connection.',
        isRetrying: false,
        retryCount,
        canRetry: true,
        isAuthError: false,
      };
    }
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return {
        message: 'Request timed out. Retrying...',
        isRetrying: true,
        retryCount,
        canRetry: true,
        isAuthError: false,
      };
    }
    
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return {
        message: 'Too many requests. Please wait a moment before trying again.',
        isRetrying: false,
        retryCount,
        canRetry: false,
        isAuthError: false,
      };
    }
  }
  
  return defaultError;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Guard to detect backend error responses before JSON parsing.
 * Throws an Error if the response is an error string.
 */
function guardBackendErrorResponse(response: string): void {
  if (typeof response === 'string' && response.startsWith('Error:')) {
    throw new Error(response);
  }
}

export function useRestaurantSearch() {
  const { actor } = useActor();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [safeMode, setSafeMode] = useState(false);
  const [isAuthError, setIsAuthError] = useState(false);

  const parseVenues = (venues: FoursquareVenue[]): Restaurant[] => {
    return venues.map(venue => ({
      id: venue.fsq_id,
      name: venue.name || 'Unknown',
      cuisine: venue.categories?.[0]?.name || 'Restaurant',
      address: venue.location?.address || venue.location?.formatted_address || '',
      city: venue.location?.locality || '',
      country: venue.location?.country || '',
      latitude: venue.geocodes?.main?.latitude || 0,
      longitude: venue.geocodes?.main?.longitude || 0,
      rating: venue.rating,
      phone: venue.tel,
      website: venue.website,
      distance: venue.distance,
    }));
  };

  const executeWithRetry = useCallback(async <T,>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    let lastError: unknown;
    
    for (let attempt = 0; attempt <= MAX_AUTO_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          setIsRetrying(true);
          setRetryCount(attempt);
          await delay(RETRY_DELAY_MS * attempt);
        }
        
        const result = await operation();
        
        if (attempt > 0) {
          toast.success('Connection restored! Search completed successfully.');
          setSafeMode(false);
        }
        
        setIsRetrying(false);
        setRetryCount(0);
        return result;
      } catch (err) {
        lastError = err;
        const errorState = getUserFriendlyError(err, attempt);
        
        // Don't retry authorization errors
        if (errorState.isAuthError) {
          setIsAuthError(true);
          throw err;
        }
        
        if (attempt < MAX_AUTO_RETRIES && errorState.canRetry) {
          toast.info(errorState.message, {
            duration: RETRY_DELAY_MS,
          });
        } else if (!errorState.canRetry) {
          break;
        }
      }
    }
    
    setIsRetrying(false);
    setRetryCount(0);
    
    const finalErrorState = getUserFriendlyError(lastError, MAX_AUTO_RETRIES);
    
    if (finalErrorState.isRetrying || finalErrorState.message.includes('service')) {
      setSafeMode(true);
      toast.error(
        'Service is temporarily unavailable. You can still search by city name while we recover.',
        { duration: 5000 }
      );
    }
    
    throw lastError;
  }, []);

  /**
   * Fetch Foursquare results using the backend's foursquarePlacesSearch method.
   * The backend handles the API key internally and will return an error message if not configured.
   * Returns empty array on failure (non-blocking).
   */
  const fetchFoursquareResults = async (
    latitude: number,
    longitude: number,
    radius: number
  ): Promise<Restaurant[]> => {
    if (!actor) return [];

    try {
      // Initial strict search with halal category
      const strictUrl = `https://api.foursquare.com/v3/places/search?ll=${latitude},${longitude}&query=halal&categories=13065&limit=50&radius=${radius}`;
      
      const strictResponse = await actor.foursquarePlacesSearch(strictUrl);

      // Check if backend returned an error (not configured or other issue)
      if (strictResponse.startsWith('Error:')) {
        if (strictResponse.includes('not configured')) {
          console.info('Foursquare not configured, skipping');
          return [];
        }
        throw new Error(strictResponse);
      }

      const strictData = JSON.parse(strictResponse);
      let allResults: FoursquareVenue[] = strictData.results || [];

      // If initial results are sparse, perform broader halal-focused search
      if (allResults.length < MIN_RESULTS_THRESHOLD) {
        try {
          const broadUrl = `https://api.foursquare.com/v3/places/search?ll=${latitude},${longitude}&query=halal restaurant food&limit=50&radius=${radius}`;
          
          const broadResponse = await actor.foursquarePlacesSearch(broadUrl);

          if (!broadResponse.startsWith('Error:')) {
            const broadData = JSON.parse(broadResponse);
            
            if (broadData.results && broadData.results.length > 0) {
              const existingIds = new Set(allResults.map(v => v.fsq_id));
              const newResults = broadData.results.filter((v: FoursquareVenue) => !existingIds.has(v.fsq_id));
              allResults = [...allResults, ...newResults];
            }
          }
        } catch (broadErr) {
          console.warn('Foursquare broader search failed:', broadErr);
        }
      }

      if (allResults.length > 0) {
        return parseVenues(allResults);
      }
      return [];
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      
      // If Foursquare is not configured, silently skip (non-blocking)
      if (errorMsg.includes('not configured')) {
        console.info('Foursquare API not configured, using OpenStreetMap only');
        return [];
      }
      
      // For other errors, log but don't block Overpass results
      console.warn('Foursquare search failed:', err);
      return [];
    }
  };

  /**
   * Fetch Overpass (OpenStreetMap) results via backend proxy.
   * Returns empty array on failure (non-blocking).
   */
  const fetchOverpassResults = async (
    latitude: number,
    longitude: number,
    radius: number
  ): Promise<Restaurant[]> => {
    if (!actor) return [];

    try {
      const query = buildOverpassQuery(latitude, longitude, radius);
      const overpassUrl = 'https://overpass-api.de/api/interpreter';

      const response = await executeWithRetry(
        () => actor.proxyExternalApiPost(overpassUrl, query),
        'Overpass search'
      );

      guardBackendErrorResponse(response);
      const data = JSON.parse(response);

      return parseOverpassResponse(data, latitude, longitude);
    } catch (err) {
      console.error('Overpass search failed:', err);
      return [];
    }
  };

  /**
   * Search with automatic radius expansion if results are below threshold.
   */
  const searchWithRadiusExpansion = async (
    latitude: number,
    longitude: number,
    initialRadius: number,
    searchType: 'location' | 'city'
  ): Promise<Restaurant[]> => {
    const radii = [initialRadius];
    
    // Add expansion radii up to maximum
    if (initialRadius < 20000) radii.push(20000);
    if (initialRadius < MAX_RADIUS_METERS) radii.push(MAX_RADIUS_METERS);

    let allResults: Restaurant[] = [];
    let currentRadius = initialRadius;

    for (let i = 0; i < radii.length; i++) {
      currentRadius = radii[i];
      
      if (i > 0) {
        toast.info(`Expanding search radius to ${Math.round(currentRadius / 1000)}km to find more places...`, {
          duration: 2000,
        });
      }

      // Fetch from multiple providers in parallel
      // Foursquare failures will not block Overpass results
      const [foursquareResults, overpassResults] = await Promise.all([
        fetchFoursquareResults(latitude, longitude, currentRadius),
        fetchOverpassResults(latitude, longitude, currentRadius),
      ]);

      // Merge and deduplicate with existing results
      const newMerged = mergeAndDeduplicateRestaurants([
        allResults,
        foursquareResults,
        overpassResults,
      ]);

      allResults = newMerged;

      // Check if we have enough results
      if (allResults.length >= MIN_RESULTS_THRESHOLD) {
        break;
      }

      // Don't expand further if this is the last radius
      if (i === radii.length - 1) {
        break;
      }
    }

    return allResults;
  };

  const searchByLocation = async (latitude: number, longitude: number) => {
    if (!actor) {
      const errorMsg = 'Service connection not available. Please refresh the page and try again.';
      setError(errorMsg);
      setIsAuthError(false);
      toast.error(errorMsg);
      return;
    }

    // Use the shared coordinate validator
    const validation = validateCoordinates(latitude, longitude);
    
    if (!validation.isValid) {
      const errorMsg = validation.reason || 'Invalid location coordinates. Please try searching by city name instead.';
      setError(errorMsg);
      setIsAuthError(false);
      toast.error(errorMsg);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsAuthError(false);

    try {
      const initialRadius = 10000; // 10km
      const results = await searchWithRadiusExpansion(latitude, longitude, initialRadius, 'location');

      if (results.length === 0) {
        setRestaurants([]);
        toast.info('No halal restaurants found in this area. Try searching a different location.');
        return;
      }

      const sorted = sortByDistance(results);
      setRestaurants(sorted);
      toast.success(`Found ${sorted.length} halal restaurants nearby`);
    } catch (err) {
      console.error('Search error:', err);
      const errorState = getUserFriendlyError(err);
      setError(errorState.message);
      setIsAuthError(errorState.isAuthError);
      toast.error(errorState.message);
      setRestaurants([]);
    } finally {
      setIsLoading(false);
    }
  };

  const searchByCity = async (cityName: string) => {
    if (!actor) {
      const errorMsg = 'Service connection not available. Please refresh the page and try again.';
      setError(errorMsg);
      setIsAuthError(false);
      toast.error(errorMsg);
      return;
    }

    if (!cityName.trim()) {
      toast.error('Please enter a city name');
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsAuthError(false);

    try {
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=1`;
      
      let geocodeData;
      try {
        const geocodeResponse = await executeWithRetry(
          () => actor.proxyExternalApiGet(geocodeUrl),
          'geocoding'
        );
        guardBackendErrorResponse(geocodeResponse);
        geocodeData = JSON.parse(geocodeResponse);
      } catch (geocodeError) {
        console.error('Geocoding error:', geocodeError);
        const errorState = getUserFriendlyError(geocodeError);
        
        if (errorState.isAuthError) {
          setError(errorState.message);
          setIsAuthError(true);
          toast.error(errorState.message);
          setRestaurants([]);
          setIsLoading(false);
          return;
        }
        
        const friendlyError = 'Unable to find that location. Please check the spelling and try again.';
        setError(friendlyError);
        toast.error(friendlyError);
        setRestaurants([]);
        setIsLoading(false);
        return;
      }

      if (!geocodeData || geocodeData.length === 0) {
        const errorMsg = 'City not found. Please check the spelling or try a different location.';
        setError(errorMsg);
        toast.error(errorMsg);
        setRestaurants([]);
        setIsLoading(false);
        return;
      }

      const { lat, lon } = geocodeData[0];
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);

      // Use the shared coordinate validator
      const validation = validateCoordinates(latitude, longitude);
      
      if (!validation.isValid) {
        const errorMsg = validation.reason || 'Unable to determine location coordinates. Please try a different city.';
        setError(errorMsg);
        toast.error(errorMsg);
        setRestaurants([]);
        setIsLoading(false);
        return;
      }

      const initialRadius = 15000; // 15km for city searches
      const results = await searchWithRadiusExpansion(latitude, longitude, initialRadius, 'city');

      if (results.length === 0) {
        setRestaurants([]);
        toast.info(`No halal restaurants found in ${cityName}. Try searching a nearby city.`);
        return;
      }

      const sorted = sortByDistance(results);
      setRestaurants(sorted);
      toast.success(`Found ${sorted.length} halal restaurants in ${cityName}`);
    } catch (err) {
      console.error('Search error:', err);
      const errorState = getUserFriendlyError(err);
      setError(errorState.message);
      setIsAuthError(errorState.isAuthError);
      toast.error(errorState.message);
      setRestaurants([]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = useCallback(() => {
    setRestaurants([]);
    setError(null);
    setIsAuthError(false);
  }, []);

  const exitSafeMode = useCallback(() => {
    setSafeMode(false);
    setError(null);
    setIsAuthError(false);
    toast.success('Safe mode disabled. You can now try location-based search again.');
  }, []);

  return {
    restaurants,
    isLoading,
    error,
    searchByLocation,
    searchByCity,
    clearResults,
    exitSafeMode,
    isRetrying,
    retryCount,
    safeMode,
    isAuthError,
  };
}

/**
 * Hook for IP-based geolocation using the backend proxy.
 */
export function useIPGeolocation() {
  const { actor } = useActor();
  const [isLoading, setIsLoading] = useState(false);

  const getIPLocation = useCallback(async (): Promise<{
    lat: number;
    lon: number;
    city?: string;
    country?: string;
  } | null> => {
    if (!actor) {
      console.error('Actor not available for IP geolocation');
      return null;
    }

    setIsLoading(true);
    try {
      const response = await actor.getIpApiGeolocation();
      
      guardBackendErrorResponse(response);
      const data = JSON.parse(response);

      // Check for success status and valid coordinate data
      // Note: lat/lon can be 0 (valid coordinates), so check for existence with 'in' operator
      if (data.status === 'success' && 'lat' in data && 'lon' in data) {
        const lat = typeof data.lat === 'number' ? data.lat : parseFloat(data.lat);
        const lon = typeof data.lon === 'number' ? data.lon : parseFloat(data.lon);
        
        return {
          lat,
          lon,
          city: data.city,
          country: data.country,
        };
      }

      console.error('IP geolocation failed:', data.message || 'Unknown error');
      return null;
    } catch (err) {
      console.error('IP geolocation error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [actor]);

  return {
    getIPLocation,
    isLoading,
  };
}
