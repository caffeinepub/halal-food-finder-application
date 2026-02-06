import { useState, useRef } from 'react';
import { MapPin, Search, Loader2, RefreshCw, Navigation, AlertCircle, ShieldAlert, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useIPGeolocation } from '@/hooks/useQueries';

interface SearchSectionProps {
  onLocationSearch: (lat: number, lon: number) => void;
  onCitySearch: (city: string) => void;
  isLoading: boolean;
}

type GeolocationStage = 
  | 'idle' 
  | 'requesting-permission' 
  | 'detecting-gps-high' 
  | 'detecting-gps-low' 
  | 'fallback-ip' 
  | 'validating' 
  | 'success' 
  | 'failed'
  | 'permission-denied'
  | 'not-secure'
  | 'not-supported';

type LocationSource = 'GPS' | 'IP' | null;

interface GeolocationState {
  stage: GeolocationStage;
  locationSource: LocationSource;
  coordinates: { lat: number; lon: number } | null;
  city?: string;
  country?: string;
  errorMessage: string | null;
  canRetry: boolean;
}

const GPS_HIGH_ACCURACY_TIMEOUT_MS = 8000;
const GPS_LOW_ACCURACY_TIMEOUT_MS = 6000;

export function SearchSection({ onLocationSearch, onCitySearch, isLoading }: SearchSectionProps) {
  const [cityInput, setCityInput] = useState('');
  const [geoState, setGeoState] = useState<GeolocationState>({
    stage: 'idle',
    locationSource: null,
    coordinates: null,
    errorMessage: null,
    canRetry: true,
  });
  
  const gpsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackExecutedRef = useRef(false);
  const inFlightRef = useRef(false);
  const { getIPLocation, isLoading: isIPLoading } = useIPGeolocation();

  const isGeolocationSupported = (): boolean => {
    return 'geolocation' in navigator && !!navigator.geolocation;
  };

  const isSecureContext = (): boolean => {
    return window.isSecureContext;
  };

  const validateCoordinates = (lat: number, lon: number): boolean => {
    const isValid = (
      !isNaN(lat) &&
      !isNaN(lon) &&
      isFinite(lat) &&
      isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180 &&
      lat !== 0 &&
      lon !== 0
    );
    
    console.log('Coordinate validation:', { lat, lon, isValid });
    return isValid;
  };

  const clearGPSTimeout = () => {
    if (gpsTimeoutRef.current) {
      clearTimeout(gpsTimeoutRef.current);
      gpsTimeoutRef.current = null;
    }
  };

  const fallbackToIPLocation = async () => {
    if (fallbackExecutedRef.current || inFlightRef.current) {
      console.log('IP fallback already executed or in flight, skipping');
      return;
    }

    fallbackExecutedRef.current = true;
    clearGPSTimeout();
    
    console.log('Falling back to IP-based geolocation...');
    setGeoState(prev => ({
      ...prev,
      stage: 'fallback-ip',
      errorMessage: null,
    }));

    toast.info('Using IP-based location detection...', { duration: 2000 });

    try {
      const ipLocation = await getIPLocation();
      
      if (ipLocation && validateCoordinates(ipLocation.lat, ipLocation.lon)) {
        console.log('IP geolocation successful:', ipLocation);
        
        setGeoState({
          stage: 'validating',
          locationSource: 'IP',
          coordinates: { lat: ipLocation.lat, lon: ipLocation.lon },
          city: ipLocation.city,
          country: ipLocation.country,
          errorMessage: null,
          canRetry: true,
        });

        const locationMsg = ipLocation.city && ipLocation.country
          ? `Location detected: ${ipLocation.city}, ${ipLocation.country} (IP-based)`
          : 'Approximate location detected (IP-based)';
        
        toast.success(locationMsg, { duration: 3000 });
        
        setTimeout(() => {
          setGeoState(prev => ({ ...prev, stage: 'success' }));
          onLocationSearch(ipLocation.lat, ipLocation.lon);
          inFlightRef.current = false;
        }, 500);
      } else {
        throw new Error('Invalid IP location data');
      }
    } catch (err) {
      console.error('IP geolocation fallback failed:', err);
      setGeoState({
        stage: 'failed',
        locationSource: null,
        coordinates: null,
        errorMessage: 'Unable to determine your location automatically. Please search by city or country name.',
        canRetry: true,
      });
      toast.error('Location detection failed. Please search by city name.', { duration: 4000 });
      inFlightRef.current = false;
    }
  };

  const handleGeolocationSuccess = (position: GeolocationPosition, isRetry: boolean = false) => {
    if (!inFlightRef.current) {
      console.log('Success callback fired but request not in flight, ignoring');
      return;
    }

    clearGPSTimeout();
    
    const { latitude, longitude, accuracy } = position.coords;
    console.log(`GPS geolocation success (${isRetry ? 'low-accuracy retry' : 'high-accuracy'}):`, { latitude, longitude, accuracy });

    if (!validateCoordinates(latitude, longitude)) {
      console.error('Invalid GPS coordinates received, falling back to IP');
      toast.warning('GPS coordinates invalid, using IP-based location...', { duration: 2000 });
      fallbackToIPLocation();
      return;
    }

    setGeoState({
      stage: 'validating',
      locationSource: 'GPS',
      coordinates: { lat: latitude, lon: longitude },
      errorMessage: null,
      canRetry: true,
    });

    const accuracyMsg = accuracy < 100 
      ? `Precise GPS location detected (±${Math.round(accuracy)}m)`
      : 'GPS location detected';
    
    toast.success(accuracyMsg, { duration: 3000 });
    
    setTimeout(() => {
      setGeoState(prev => ({ ...prev, stage: 'success' }));
      onLocationSearch(latitude, longitude);
      inFlightRef.current = false;
      fallbackExecutedRef.current = false;
    }, 500);
  };

  const handleGeolocationError = (error: GeolocationPositionError, isRetry: boolean = false) => {
    if (!inFlightRef.current) {
      console.log('Error callback fired but request not in flight, ignoring');
      return;
    }

    clearGPSTimeout();
    
    let errorReason = '';
    let shouldRetry = false;

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorReason = 'Location permission denied';
        console.warn('GPS permission denied by user');
        setGeoState({
          stage: 'permission-denied',
          locationSource: null,
          coordinates: null,
          errorMessage: 'Location permission was denied. Please enable location access in your browser settings to use GPS.',
          canRetry: true,
        });
        inFlightRef.current = false;
        return;
      case error.POSITION_UNAVAILABLE:
        errorReason = 'GPS position unavailable';
        console.warn('GPS position unavailable');
        shouldRetry = !isRetry;
        break;
      case error.TIMEOUT:
        errorReason = 'GPS request timed out';
        console.warn('GPS request timed out');
        shouldRetry = !isRetry;
        break;
      default:
        errorReason = 'GPS error';
        console.warn('Unknown GPS error:', error.message);
        shouldRetry = !isRetry;
    }

    if (shouldRetry) {
      console.log('Retrying with low-accuracy GPS settings...');
      setGeoState(prev => ({ ...prev, stage: 'detecting-gps-low' }));
      toast.info('Retrying with less strict GPS settings...', { duration: 2000 });
      
      navigator.geolocation.getCurrentPosition(
        (pos) => handleGeolocationSuccess(pos, true),
        (err) => {
          console.warn('Low-accuracy GPS also failed, falling back to IP');
          toast.info('GPS unavailable, switching to IP-based location...', { duration: 2000 });
          fallbackToIPLocation();
        },
        {
          enableHighAccuracy: false,
          timeout: GPS_LOW_ACCURACY_TIMEOUT_MS,
          maximumAge: 60000,
        }
      );
    } else {
      toast.info(`${errorReason}, switching to IP-based location...`, { duration: 2000 });
      fallbackToIPLocation();
    }
  };

  const requestGeolocation = () => {
    if (inFlightRef.current) {
      console.log('Geolocation request already in flight, ignoring');
      return;
    }

    if (!isSecureContext()) {
      console.warn('Not in secure context (HTTPS required for GPS)');
      setGeoState({
        stage: 'not-secure',
        locationSource: null,
        coordinates: null,
        errorMessage: 'Location access requires a secure connection (HTTPS). Please use city search instead.',
        canRetry: false,
      });
      toast.error('GPS requires HTTPS. Please use city search.', { duration: 4000 });
      return;
    }

    if (!isGeolocationSupported()) {
      console.warn('Geolocation not supported by browser');
      setGeoState({
        stage: 'not-supported',
        locationSource: null,
        coordinates: null,
        errorMessage: 'Your browser does not support location detection. Using IP-based fallback...',
        canRetry: false,
      });
      toast.info('GPS not supported, using IP-based location...', { duration: 2000 });
      fallbackToIPLocation();
      return;
    }

    inFlightRef.current = true;
    fallbackExecutedRef.current = false;
    clearGPSTimeout();

    console.log('Starting geolocation request (high-accuracy)...');
    setGeoState({
      stage: 'requesting-permission',
      locationSource: null,
      coordinates: null,
      errorMessage: null,
      canRetry: true,
    });

    gpsTimeoutRef.current = setTimeout(() => {
      if (inFlightRef.current && !fallbackExecutedRef.current) {
        console.warn('GPS timeout reached, falling back to IP');
        toast.warning('GPS taking too long, using IP-based location...', { duration: 2000 });
        fallbackToIPLocation();
      }
    }, GPS_HIGH_ACCURACY_TIMEOUT_MS);

    setGeoState(prev => ({ ...prev, stage: 'detecting-gps-high' }));

    navigator.geolocation.getCurrentPosition(
      (pos) => handleGeolocationSuccess(pos, false),
      (err) => handleGeolocationError(err, false),
      {
        enableHighAccuracy: true,
        timeout: GPS_HIGH_ACCURACY_TIMEOUT_MS - 1000,
        maximumAge: 0,
      }
    );
  };

  const handleRetryLocation = () => {
    console.log('User requested location retry');
    setGeoState({
      stage: 'idle',
      locationSource: null,
      coordinates: null,
      errorMessage: null,
      canRetry: true,
    });
    inFlightRef.current = false;
    fallbackExecutedRef.current = false;
    clearGPSTimeout();
    toast.info('Retrying location detection...');
    requestGeolocation();
  };

  const handleCitySearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (cityInput.trim()) {
      onCitySearch(cityInput.trim());
    }
  };

  const getStageMessage = (): { title: string; description: string; icon: React.ReactNode; variant?: 'default' | 'warning' | 'info' } | null => {
    switch (geoState.stage) {
      case 'requesting-permission':
        return {
          title: 'Requesting Location Permission',
          description: 'Please allow location access in your browser to find nearby halal restaurants.',
          icon: <Loader2 className="h-4 w-4 animate-spin text-halal" />,
        };
      case 'detecting-gps-high':
        return {
          title: 'Detecting GPS Location',
          description: 'Getting your precise location using GPS...',
          icon: <Loader2 className="h-4 w-4 animate-spin text-halal" />,
        };
      case 'detecting-gps-low':
        return {
          title: 'Retrying GPS Detection',
          description: 'Attempting to get your location with adjusted settings...',
          icon: <Loader2 className="h-4 w-4 animate-spin text-halal" />,
        };
      case 'fallback-ip':
        return {
          title: 'Using IP-Based Location',
          description: 'Determining your approximate location using your IP address...',
          icon: <Loader2 className="h-4 w-4 animate-spin text-blue-600" />,
          variant: 'info',
        };
      case 'validating':
        return {
          title: 'Validating Coordinates',
          description: `Validating ${geoState.locationSource === 'GPS' ? 'GPS' : 'IP-based'} location coordinates...`,
          icon: <Loader2 className="h-4 w-4 animate-spin text-halal" />,
        };
      case 'success':
        if (geoState.locationSource === 'IP') {
          return {
            title: 'Location Detected (IP-Based)',
            description: geoState.city && geoState.country
              ? `Showing results near ${geoState.city}, ${geoState.country}. For more accurate results, enable GPS and retry.`
              : 'Showing results based on approximate location. For more accurate results, enable GPS and retry.',
            icon: <Navigation className="h-4 w-4 text-blue-600" />,
            variant: 'info',
          };
        } else if (geoState.locationSource === 'GPS') {
          return {
            title: 'GPS Location Detected',
            description: 'Showing results based on your precise GPS location.',
            icon: <MapPin className="h-4 w-4 text-halal" />,
          };
        }
        return null;
      case 'permission-denied':
        return {
          title: 'Location Permission Denied',
          description: 'To enable location access: Click the lock icon in your browser\'s address bar, then allow location permissions for this site. After enabling, click the retry button below.',
          icon: <ShieldAlert className="h-4 w-4 text-yellow-600" />,
          variant: 'warning',
        };
      case 'not-secure':
        return {
          title: 'Secure Connection Required',
          description: 'GPS location requires HTTPS. Please use the city search below to find halal restaurants in your area.',
          icon: <AlertCircle className="h-4 w-4 text-yellow-600" />,
          variant: 'warning',
        };
      case 'not-supported':
        return {
          title: 'GPS Not Supported',
          description: 'Your browser does not support GPS location. We\'ll use IP-based location detection or you can search by city name.',
          icon: <Info className="h-4 w-4 text-blue-600" />,
          variant: 'info',
        };
      case 'failed':
        return {
          title: 'Location Detection Failed',
          description: geoState.errorMessage || 'Unable to detect your location. Please search by city or country name below.',
          icon: <AlertCircle className="h-4 w-4 text-yellow-600" />,
          variant: 'warning',
        };
      default:
        return null;
    }
  };

  const stageMessage = getStageMessage();
  const isDetecting = ['requesting-permission', 'detecting-gps-high', 'detecting-gps-low', 'fallback-ip', 'validating'].includes(geoState.stage);

  return (
    <section className="relative overflow-hidden">
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

          {stageMessage && (
            <Alert className={`text-left ${
              stageMessage.variant === 'info'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                : stageMessage.variant === 'warning'
                ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
                : 'border-halal/50 bg-halal/5'
            }`}>
              {stageMessage.icon}
              <AlertTitle className={
                stageMessage.variant === 'info'
                  ? 'text-blue-900 dark:text-blue-100'
                  : stageMessage.variant === 'warning'
                  ? 'text-yellow-900 dark:text-yellow-100'
                  : 'text-halal'
              }>
                {stageMessage.title}
              </AlertTitle>
              <AlertDescription className={
                stageMessage.variant === 'info'
                  ? 'text-blue-800 dark:text-blue-200'
                  : stageMessage.variant === 'warning'
                  ? 'text-yellow-800 dark:text-yellow-200'
                  : ''
              }>
                {stageMessage.description}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <Card className="p-6 shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-halal" />
                  <span>Search by Location</span>
                  {geoState.locationSource === 'IP' && (
                    <span className="ml-auto text-xs text-blue-600 dark:text-blue-400">(IP-Based)</span>
                  )}
                  {geoState.locationSource === 'GPS' && (
                    <span className="ml-auto text-xs text-halal">(GPS)</span>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={requestGeolocation}
                    disabled={isLoading || isDetecting || isIPLoading || geoState.stage === 'not-secure'}
                    size="lg"
                    className="flex-1 bg-halal hover:bg-halal-dark text-white disabled:opacity-50"
                  >
                    {isDetecting || isIPLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {geoState.stage === 'fallback-ip'
                          ? 'Using IP Location...' 
                          : geoState.stage === 'detecting-gps-low'
                          ? 'Retrying GPS...'
                          : 'Detecting Location...'}
                      </>
                    ) : (
                      <>
                        <MapPin className="mr-2 h-5 w-5" />
                        {geoState.coordinates ? 'Refresh Location' : 'Use My Current Location'}
                      </>
                    )}
                  </Button>
                  
                  {geoState.canRetry && geoState.stage !== 'idle' && !isDetecting && geoState.stage !== 'not-secure' && (
                    <Button
                      onClick={handleRetryLocation}
                      disabled={isLoading || isDetecting || isIPLoading}
                      size="lg"
                      variant="outline"
                      className="border-halal text-halal hover:bg-halal hover:text-white"
                      title="Retry location detection"
                    >
                      <RefreshCw className="h-5 w-5" />
                    </Button>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground">
                  {isDetecting 
                    ? geoState.stage === 'fallback-ip'
                      ? 'Determining your approximate location via IP address...'
                      : geoState.stage === 'detecting-gps-low'
                      ? 'Retrying GPS with adjusted settings...'
                      : 'Requesting GPS access for precise location...'
                    : geoState.coordinates
                    ? geoState.locationSource === 'GPS'
                      ? 'GPS location detected successfully! Click to refresh your location.'
                      : 'Using approximate IP-based location. Enable GPS for more accurate results.'
                    : geoState.stage === 'not-secure'
                    ? 'GPS requires HTTPS. Use city search below instead.'
                    : 'Click to detect your location automatically (GPS with IP fallback)'}
                </p>
              </div>
            </Card>

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
