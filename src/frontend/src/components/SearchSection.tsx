import { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Loader2, AlertCircle, MapPinOff, RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';

interface SearchSectionProps {
  onLocationSearch: (lat: number, lon: number) => void;
  onCitySearch: (city: string) => void;
  isLoading: boolean;
}

type GeolocationErrorType = 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNSUPPORTED' | 'INVALID_COORDS' | 'UNKNOWN';

interface GeolocationState {
  isRequesting: boolean;
  hasAttempted: boolean;
  errorType: GeolocationErrorType | null;
  errorMessage: string | null;
  canRetry: boolean;
  coordinates: { lat: number; lon: number } | null;
}

export function SearchSection({ onLocationSearch, onCitySearch, isLoading }: SearchSectionProps) {
  const [cityInput, setCityInput] = useState('');
  const [geoState, setGeoState] = useState<GeolocationState>({
    isRequesting: false,
    hasAttempted: false,
    errorType: null,
    errorMessage: null,
    canRetry: true,
    coordinates: null,
  });
  
  const autoRequestAttemptedRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);

  // Detect if geolocation is supported
  const isGeolocationSupported = (): boolean => {
    return 'geolocation' in navigator && !!navigator.geolocation;
  };

  // Get user-friendly error message based on error type
  const getErrorMessage = (errorType: GeolocationErrorType): string => {
    switch (errorType) {
      case 'PERMISSION_DENIED':
        return 'Location access was denied. To use this feature, please enable location permissions in your browser settings and click "Retry Location" below. Alternatively, you can search by city or country name.';
      case 'POSITION_UNAVAILABLE':
        return 'Your location is currently unavailable. This may be due to GPS signal issues or device settings. Please try again or search by city name.';
      case 'TIMEOUT':
        return 'Location request timed out. Please ensure your device has a clear GPS signal and try again, or search by city name.';
      case 'UNSUPPORTED':
        return 'Your browser does not support geolocation. Please use a modern browser (Chrome, Firefox, Safari, or Edge) or search by city or country name instead.';
      case 'INVALID_COORDS':
        return 'Unable to retrieve valid location coordinates. Please try again or search by city name.';
      default:
        return 'An unexpected error occurred while accessing your location. Please try searching by city or country name.';
    }
  };

  // Validate coordinates
  const validateCoordinates = (lat: number, lon: number): boolean => {
    return (
      !isNaN(lat) &&
      !isNaN(lon) &&
      isFinite(lat) &&
      isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    );
  };

  // Handle successful geolocation
  const handleGeolocationSuccess = (position: GeolocationPosition) => {
    const { latitude, longitude } = position.coords;

    // Validate coordinates
    if (!validateCoordinates(latitude, longitude)) {
      const errorType: GeolocationErrorType = 'INVALID_COORDS';
      setGeoState({
        isRequesting: false,
        hasAttempted: true,
        errorType,
        errorMessage: getErrorMessage(errorType),
        canRetry: true,
        coordinates: null,
      });
      toast.error('Invalid location coordinates received. Please try again or search by city name.');
      return;
    }

    // Success - update state and trigger search
    setGeoState({
      isRequesting: false,
      hasAttempted: true,
      errorType: null,
      errorMessage: null,
      canRetry: true,
      coordinates: { lat: latitude, lon: longitude },
    });

    toast.success('Location detected! Searching for nearby halal restaurants...');
    onLocationSearch(latitude, longitude);
  };

  // Handle geolocation error
  const handleGeolocationError = (error: GeolocationPositionError) => {
    let errorType: GeolocationErrorType;
    let canRetry = true;

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorType = 'PERMISSION_DENIED';
        canRetry = true;
        break;
      case error.POSITION_UNAVAILABLE:
        errorType = 'POSITION_UNAVAILABLE';
        canRetry = true;
        break;
      case error.TIMEOUT:
        errorType = 'TIMEOUT';
        canRetry = true;
        break;
      default:
        errorType = 'UNKNOWN';
        canRetry = true;
    }

    const errorMessage = getErrorMessage(errorType);

    setGeoState({
      isRequesting: false,
      hasAttempted: true,
      errorType,
      errorMessage,
      canRetry,
      coordinates: null,
    });

    toast.error(errorMessage, { duration: 5000 });
    console.error('Geolocation error:', error);
  };

  // Request geolocation with optimal settings
  const requestGeolocation = () => {
    // Check if geolocation is supported
    if (!isGeolocationSupported()) {
      const errorType: GeolocationErrorType = 'UNSUPPORTED';
      setGeoState({
        isRequesting: false,
        hasAttempted: true,
        errorType,
        errorMessage: getErrorMessage(errorType),
        canRetry: false,
        coordinates: null,
      });
      toast.error('Geolocation is not supported by your browser. Please search by city name.');
      return;
    }

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Update state to requesting
    setGeoState(prev => ({
      ...prev,
      isRequesting: true,
      errorType: null,
      errorMessage: null,
    }));

    // Request current position with optimized settings
    navigator.geolocation.getCurrentPosition(
      handleGeolocationSuccess,
      handleGeolocationError,
      {
        enableHighAccuracy: true,
        timeout: 15000, // 15 seconds timeout
        maximumAge: 0, // Don't use cached position
      }
    );
  };

  // Automatic geolocation request on mount
  useEffect(() => {
    // Only attempt once automatically
    if (autoRequestAttemptedRef.current) return;
    autoRequestAttemptedRef.current = true;

    // Check if geolocation is supported
    if (!isGeolocationSupported()) {
      const errorType: GeolocationErrorType = 'UNSUPPORTED';
      setGeoState({
        isRequesting: false,
        hasAttempted: true,
        errorType,
        errorMessage: getErrorMessage(errorType),
        canRetry: false,
        coordinates: null,
      });
      return;
    }

    // Show info toast about location request
    toast.info('Requesting location access to find nearby halal restaurants...', {
      duration: 3000,
    });

    // Request location automatically
    requestGeolocation();

    // Cleanup function
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // Manual retry handler
  const handleRetryLocation = () => {
    setGeoState(prev => ({
      ...prev,
      errorType: null,
      errorMessage: null,
    }));
    toast.info('Retrying location access...');
    requestGeolocation();
  };

  // City search handler
  const handleCitySearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (cityInput.trim()) {
      onCitySearch(cityInput.trim());
    }
  };

  // Determine if we should show error alert
  const showErrorAlert = geoState.hasAttempted && geoState.errorMessage && !geoState.isRequesting;

  return (
    <section className="relative overflow-hidden">
      {/* Hero Background */}
      <div className="absolute inset-0 -z-10">
        <img 
          src="/assets/generated/halal-food-hero.dim_1200x400.png" 
          alt="Halal Food" 
          className="h-full w-full object-cover opacity-20 dark:opacity-10"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background" />
      </div>

      <div className="container py-12 md:py-20">
        <div className="mx-auto max-w-3xl space-y-8 text-center">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Find Halal Restaurants
              <span className="block text-halal">Near You</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Discover authentic halal dining options locally and around the world
            </p>
          </div>

          {/* Geolocation Status Info */}
          {geoState.isRequesting && (
            <Alert className="text-left border-halal/50 bg-halal/5">
              <Loader2 className="h-4 w-4 animate-spin text-halal" />
              <AlertTitle className="text-halal">Requesting Location Access</AlertTitle>
              <AlertDescription>
                Please allow location access in your browser to find nearby halal restaurants. This helps us show you the most relevant results.
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {showErrorAlert && (
            <Alert className={`text-left ${
              geoState.errorType === 'PERMISSION_DENIED' 
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' 
                : geoState.errorType === 'UNSUPPORTED'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                : 'border-destructive'
            }`}>
              {geoState.errorType === 'PERMISSION_DENIED' ? (
                <MapPinOff className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              ) : geoState.errorType === 'UNSUPPORTED' ? (
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle className={
                geoState.errorType === 'PERMISSION_DENIED' 
                  ? 'text-orange-900 dark:text-orange-100'
                  : geoState.errorType === 'UNSUPPORTED'
                  ? 'text-blue-900 dark:text-blue-100'
                  : ''
              }>
                {geoState.errorType === 'PERMISSION_DENIED' 
                  ? 'Location Access Denied'
                  : geoState.errorType === 'UNSUPPORTED'
                  ? 'Geolocation Not Supported'
                  : 'Location Error'}
              </AlertTitle>
              <AlertDescription className={
                geoState.errorType === 'PERMISSION_DENIED' 
                  ? 'text-orange-800 dark:text-orange-200'
                  : geoState.errorType === 'UNSUPPORTED'
                  ? 'text-blue-800 dark:text-blue-200'
                  : ''
              }>
                {geoState.errorMessage}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {/* Location Search */}
            <Card className="p-6 shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-halal" />
                  <span>Search by Location</span>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={requestGeolocation}
                    disabled={isLoading || geoState.isRequesting || geoState.errorType === 'UNSUPPORTED'}
                    size="lg"
                    className="flex-1 bg-halal hover:bg-halal-dark text-white disabled:opacity-50"
                  >
                    {geoState.isRequesting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Getting Location...
                      </>
                    ) : (
                      <>
                        <MapPin className="mr-2 h-5 w-5" />
                        Use My Current Location
                      </>
                    )}
                  </Button>
                  
                  {geoState.hasAttempted && geoState.canRetry && geoState.errorType && (
                    <Button
                      onClick={handleRetryLocation}
                      disabled={isLoading || geoState.isRequesting}
                      size="lg"
                      variant="outline"
                      className="border-halal text-halal hover:bg-halal hover:text-white"
                      title="Retry location access"
                    >
                      <RefreshCw className="h-5 w-5" />
                    </Button>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground">
                  {geoState.isRequesting 
                    ? 'Requesting location access from your browser...'
                    : geoState.errorType === 'UNSUPPORTED'
                    ? 'Your browser does not support geolocation. Please use city search below.'
                    : geoState.errorType === 'PERMISSION_DENIED'
                    ? 'Location access denied. Click "Retry Location" or search by city below.'
                    : geoState.coordinates
                    ? 'Location detected successfully! Click again to refresh your location.'
                    : 'Click to detect your location and find nearby halal restaurants'}
                </p>
              </div>
            </Card>

            {/* City Search */}
            <Card className="p-6 shadow-lg">
              <form onSubmit={handleCitySearch} className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Search className="h-4 w-4 text-halal" />
                  <span>Search by City or Country</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Enter city name (e.g., London, Dubai, New York)"
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button 
                    type="submit" 
                    disabled={isLoading || !cityInput.trim()}
                    size="lg"
                    className="bg-halal hover:bg-halal-dark text-white"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Search className="h-5 w-5" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Search for halal restaurants in any city or country worldwide
                </p>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
