import { useState, useCallback } from 'react';
import { useActor } from './useActor';
import { toast } from 'sonner';

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

const FOURSQUARE_API_KEY = 'fsq3YOUR_ACTUAL_API_KEY_HERE';
const MAX_AUTO_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

interface ErrorState {
  message: string;
  isRetrying: boolean;
  retryCount: number;
  canRetry: boolean;
}

function getUserFriendlyError(error: unknown, retryCount: number = 0): ErrorState {
  const defaultError: ErrorState = {
    message: 'Unable to search for restaurants at this time. Please try again.',
    isRetrying: false,
    retryCount,
    canRetry: true,
  };

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('canister') || message.includes('stopped') || message.includes('ic0508') || message.includes('trap')) {
      return {
        message: retryCount > 0 
          ? `Service is recovering (attempt ${retryCount + 1}/${MAX_AUTO_RETRIES + 1}). Please wait...`
          : 'The service is temporarily restarting. Retrying automatically...',
        isRetrying: true,
        retryCount,
        canRetry: true,
      };
    }
    
    if (message.includes('replication') || message.includes('reject')) {
      return {
        message: 'Service is synchronizing. Retrying automatically...',
        isRetrying: true,
        retryCount,
        canRetry: true,
      };
    }
    
    if (message.includes('network') || message.includes('fetch')) {
      return {
        message: 'Network connection issue detected. Please check your internet connection.',
        isRetrying: false,
        retryCount,
        canRetry: true,
      };
    }
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return {
        message: 'Request timed out. Retrying...',
        isRetrying: true,
        retryCount,
        canRetry: true,
      };
    }
    
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return {
        message: 'Too many requests. Please wait a moment before trying again.',
        isRetrying: false,
        retryCount,
        canRetry: false,
      };
    }
  }
  
  return defaultError;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function useRestaurantSearch() {
  const { actor } = useActor();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [safeMode, setSafeMode] = useState(false);

  const parseVenues = (venues: FoursquareVenue[]): Restaurant[] => {
    return venues.map(venue => ({
      id: venue.fsq_id,
      name: venue.name,
      cuisine: venue.categories?.[0]?.name || 'Restaurant',
      address: venue.location.address || venue.location.formatted_address || 'Address not available',
      city: venue.location.locality || '',
      country: venue.location.country || '',
      latitude: venue.geocodes.main.latitude,
      longitude: venue.geocodes.main.longitude,
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

  const searchByLocation = async (latitude: number, longitude: number) => {
    if (!actor) {
      const errorMsg = 'Service connection not available. Please refresh the page and try again.';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      const errorMsg = 'Invalid location coordinates. Please try searching by city name instead.';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      const errorMsg = 'Location coordinates are out of range. Please try searching by city name instead.';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = `https://api.foursquare.com/v3/places/search?ll=${latitude},${longitude}&query=halal&categories=13065&limit=50&radius=10000`;
      const urlWithAuth = `${url}&Authorization=${FOURSQUARE_API_KEY}`;
      
      const response = await executeWithRetry(
        () => actor.proxyExternalApiGet(urlWithAuth),
        'location search'
      );
      
      const data = JSON.parse(response);

      if (data.results && data.results.length > 0) {
        const parsedRestaurants = parseVenues(data.results);
        setRestaurants(parsedRestaurants);
        toast.success(`Found ${parsedRestaurants.length} halal restaurants nearby`);
      } else {
        setRestaurants([]);
        toast.info('No halal restaurants found in this area. Try searching a different location.');
      }
    } catch (err) {
      console.error('Search error:', err);
      const errorState = getUserFriendlyError(err);
      setError(errorState.message);
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
      toast.error(errorMsg);
      return;
    }

    if (!cityName.trim()) {
      toast.error('Please enter a city name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=1`;
      
      let geocodeData;
      try {
        const geocodeResponse = await executeWithRetry(
          () => actor.proxyExternalApiGet(geocodeUrl),
          'geocoding'
        );
        geocodeData = JSON.parse(geocodeResponse);
      } catch (geocodeError) {
        console.error('Geocoding error:', geocodeError);
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

      if (isNaN(latitude) || isNaN(longitude)) {
        const errorMsg = 'Unable to determine location coordinates. Please try a different city.';
        setError(errorMsg);
        toast.error(errorMsg);
        setRestaurants([]);
        setIsLoading(false);
        return;
      }

      const url = `https://api.foursquare.com/v3/places/search?ll=${latitude},${longitude}&query=halal&categories=13065&limit=50&radius=15000`;
      const urlWithAuth = `${url}&Authorization=${FOURSQUARE_API_KEY}`;
      
      const response = await executeWithRetry(
        () => actor.proxyExternalApiGet(urlWithAuth),
        'city search'
      );
      
      const data = JSON.parse(response);

      if (data.results && data.results.length > 0) {
        const parsedRestaurants = parseVenues(data.results);
        setRestaurants(parsedRestaurants);
        toast.success(`Found ${parsedRestaurants.length} halal restaurants in ${cityName}`);
      } else {
        setRestaurants([]);
        toast.info(`No halal restaurants found in ${cityName}. Try searching a nearby city.`);
      }
    } catch (err) {
      console.error('Search error:', err);
      const errorState = getUserFriendlyError(err);
      setError(errorState.message);
      toast.error(errorState.message);
      setRestaurants([]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setRestaurants([]);
    setError(null);
    setIsRetrying(false);
    setRetryCount(0);
  };

  const exitSafeMode = () => {
    setSafeMode(false);
    setError(null);
  };

  return {
    restaurants,
    isLoading,
    error,
    isRetrying,
    retryCount,
    safeMode,
    searchByLocation,
    searchByCity,
    clearResults,
    exitSafeMode,
  };
}
