import { useState, useRef, useEffect } from 'react';
import { MapPin, Search, Loader2, RefreshCw, Navigation, AlertCircle, ShieldAlert, Info, CheckCircle, XCircle, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useIPGeolocation } from '@/hooks/useQueries';
import { useLocationDiagnostics } from '@/hooks/useLocationDiagnostics';
import { useGeolocationWatch } from '@/hooks/useGeolocationWatch';
import { validateCoordinates } from '@/lib/coordinates';
import { RateLimiter } from '@/lib/rateLimit';

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
const TRACKING_SEARCH_INTERVAL_MS = 10000; // Minimum 10 seconds between searches

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
  const lastSearchCoordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const searchRateLimiterRef = useRef(new RateLimiter(TRACKING_SEARCH_INTERVAL_MS));
  const isFirstTrackingFixRef = useRef(true);
  
  const { getIPLocation, isLoading: isIPLoading } = useIPGeolocation();
  const diagnostics = useLocationDiagnostics();
  const geoWatch = useGeolocationWatch();

  const isGeolocationSupported = (): boolean => {
    return 'geolocation' in navigator && !!navigator.geolocation;
  };

  const isSecureContext = (): boolean => {
    return window.isSecureContext;
  };

  const clearGPSTimeout = () => {
    if (gpsTimeoutRef.current) {
      clearTimeout(gpsTimeoutRef.current);
      gpsTimeoutRef.current = null;
    }
  };

  // Handle continuous tracking updates
  useEffect(() => {
    if (geoWatch.status === 'tracking' && geoWatch.position) {
      const { latitude, longitude } = geoWatch.position.coords;
      
      // Check for significant coordinate change (>50m)
      let significantChange = false;
      if (lastSearchCoordsRef.current) {
        const latDiff = Math.abs(latitude - lastSearchCoordsRef.current.lat);
        const lonDiff = Math.abs(longitude - lastSearchCoordsRef.current.lon);
        significantChange = latDiff > 0.0005 || lonDiff > 0.0005; // ~50m
      } else {
        // First position update
        significantChange = true;
      }

      if (!significantChange) {
        return;
      }

      // Apply rate limiting to prevent overly frequent searches
      const canSearch = searchRateLimiterRef.current.canExecute();
      if (!canSearch) {
        console.log('Search rate-limited, skipping update');
        return;
      }

      const validation = validateCoordinates(latitude, longitude);
      if (validation.isValid) {
        lastSearchCoordsRef.current = { lat: latitude, lon: longitude };
        searchRateLimiterRef.current.markExecuted();
        onLocationSearch(latitude, longitude);
        
        // Only toast on first fix or meaningful transitions, not every update
        if (isFirstTrackingFixRef.current) {
          toast.success('Location acquired', { duration: 2000 });
          isFirstTrackingFixRef.current = false;
        }
      }
    }
  }, [geoWatch.position, onLocationSearch]);

  // Reset first-fix flag when tracking stops
  useEffect(() => {
    if (geoWatch.status === 'stopped' || geoWatch.status === 'idle') {
      isFirstTrackingFixRef.current = true;
    }
  }, [geoWatch.status]);

  const fallbackToIPLocation = async () => {
    if (fallbackExecutedRef.current) {
      console.log('IP fallback already executed, skipping');
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
      
      if (!ipLocation) {
        throw new Error('IP geolocation returned no data');
      }

      const validation = validateCoordinates(ipLocation.lat, ipLocation.lon);
      
      if (!validation.isValid) {
        console.error('Invalid IP coordinates:', ipLocation, validation.reason);
        throw new Error(validation.reason || 'Invalid IP location data');
      }

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

  const handleGeolocationSuccess = (position: GeolocationPosition, source: 'high-accuracy' | 'low-accuracy') => {
    clearGPSTimeout();
    
    const { latitude, longitude } = position.coords;
    console.log(`GPS geolocation successful (${source}):`, { latitude, longitude });

    const validation = validateCoordinates(latitude, longitude);
    
    if (!validation.isValid) {
      console.error('Invalid GPS coordinates received:', { latitude, longitude }, validation.reason);
      setGeoState(prev => ({
        ...prev,
        errorMessage: validation.reason || 'Invalid GPS coordinates',
      }));
      toast.warning('GPS coordinates invalid, trying IP fallback...', { duration: 2000 });
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

    toast.success('Location detected via GPS', { duration: 2000 });

    setTimeout(() => {
      setGeoState(prev => ({ ...prev, stage: 'success' }));
      onLocationSearch(latitude, longitude);
      inFlightRef.current = false;
      fallbackExecutedRef.current = false;
    }, 500);
  };

  const handleGeolocationError = (error: GeolocationPositionError, isHighAccuracy: boolean) => {
    console.error(`GPS geolocation error (${isHighAccuracy ? 'high' : 'low'} accuracy):`, error);
    clearGPSTimeout();

    if (error.code === error.PERMISSION_DENIED) {
      setGeoState({
        stage: 'permission-denied',
        locationSource: null,
        coordinates: null,
        errorMessage: 'Location access was denied. Please enable location permissions in your browser settings or search by city name.',
        canRetry: false,
      });
      toast.error('Location permission denied. Please search by city name.', { duration: 4000 });
      inFlightRef.current = false;
      return;
    }

    if (isHighAccuracy) {
      console.log('High-accuracy GPS failed, trying low-accuracy GPS...');
      setGeoState(prev => ({ ...prev, stage: 'detecting-gps-low' }));
      
      gpsTimeoutRef.current = setTimeout(() => {
        console.log('Low-accuracy GPS timeout, falling back to IP...');
        fallbackToIPLocation();
      }, GPS_LOW_ACCURACY_TIMEOUT_MS);

      navigator.geolocation.getCurrentPosition(
        (pos) => handleGeolocationSuccess(pos, 'low-accuracy'),
        (err) => handleGeolocationError(err, false),
        {
          enableHighAccuracy: false,
          timeout: GPS_LOW_ACCURACY_TIMEOUT_MS,
          maximumAge: 300000,
        }
      );
    } else {
      console.log('Low-accuracy GPS also failed, falling back to IP...');
      fallbackToIPLocation();
    }
  };

  const handleDetectLocation = () => {
    // Prevent concurrent one-time detection while tracking is active
    if (geoWatch.isTracking) {
      toast.warning('Please stop continuous tracking first', { duration: 3000 });
      return;
    }

    if (inFlightRef.current) {
      console.log('Location detection already in progress, ignoring click');
      return;
    }

    if (!isSecureContext()) {
      setGeoState({
        stage: 'not-secure',
        locationSource: null,
        coordinates: null,
        errorMessage: 'Location detection requires a secure connection (HTTPS). Please search by city name instead.',
        canRetry: false,
      });
      toast.error('Secure connection required for location detection', { duration: 4000 });
      return;
    }

    if (!isGeolocationSupported()) {
      setGeoState({
        stage: 'not-supported',
        locationSource: null,
        coordinates: null,
        errorMessage: 'Your browser does not support location detection. Please search by city name instead.',
        canRetry: false,
      });
      toast.error('Location detection not supported', { duration: 4000 });
      return;
    }

    inFlightRef.current = true;
    fallbackExecutedRef.current = false;

    setGeoState({
      stage: 'requesting-permission',
      locationSource: null,
      coordinates: null,
      errorMessage: null,
      canRetry: true,
    });

    console.log('Starting GPS geolocation (high-accuracy)...');
    setGeoState(prev => ({ ...prev, stage: 'detecting-gps-high' }));

    gpsTimeoutRef.current = setTimeout(() => {
      console.log('High-accuracy GPS timeout, trying low-accuracy...');
      setGeoState(prev => ({ ...prev, stage: 'detecting-gps-low' }));
    }, GPS_HIGH_ACCURACY_TIMEOUT_MS);

    navigator.geolocation.getCurrentPosition(
      (pos) => handleGeolocationSuccess(pos, 'high-accuracy'),
      (err) => handleGeolocationError(err, true),
      {
        enableHighAccuracy: true,
        timeout: GPS_HIGH_ACCURACY_TIMEOUT_MS,
        maximumAge: 0,
      }
    );
  };

  const handleCitySearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (cityInput.trim()) {
      onCitySearch(cityInput.trim());
    }
  };

  const handleRetry = () => {
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
  };

  const handleStartTracking = () => {
    // Prevent tracking while one-time detection is in progress
    if (inFlightRef.current) {
      toast.warning('Please wait for location detection to complete', { duration: 3000 });
      return;
    }

    searchRateLimiterRef.current.reset();
    lastSearchCoordsRef.current = null;
    isFirstTrackingFixRef.current = true;
    geoWatch.startTracking();
    toast.success('Continuous tracking started', { duration: 2000 });
  };

  const handleStopTracking = () => {
    geoWatch.stopTracking();
    lastSearchCoordsRef.current = null;
    searchRateLimiterRef.current.reset();
    isFirstTrackingFixRef.current = true;
    toast.info('Tracking stopped', { duration: 2000 });
  };

  const isDetecting = 
    geoState.stage === 'requesting-permission' ||
    geoState.stage === 'detecting-gps-high' ||
    geoState.stage === 'detecting-gps-low' ||
    geoState.stage === 'fallback-ip' ||
    geoState.stage === 'validating';

  const getDetectionMessage = () => {
    switch (geoState.stage) {
      case 'requesting-permission':
        return 'Requesting location permission...';
      case 'detecting-gps-high':
        return 'Detecting your location (GPS)...';
      case 'detecting-gps-low':
        return 'Refining location detection...';
      case 'fallback-ip':
        return 'Using IP-based location...';
      case 'validating':
        return 'Validating location...';
      case 'success':
        return geoState.locationSource === 'GPS' 
          ? 'Location detected via GPS' 
          : 'Location detected via IP';
      default:
        return null;
    }
  };

  const detectionMessage = getDetectionMessage();

  const formatAccuracy = (meters: number | null): string => {
    if (meters === null) return 'N/A';
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const formatTimestamp = (date: Date | null): string => {
    if (!date) return 'N/A';
    return date.toLocaleTimeString();
  };

  return (
    <section className="relative py-16 px-4 bg-gradient-to-b from-halal/5 to-background">
      <div className="container max-w-4xl">
        <div className="text-center mb-8">
          {/* Arabic Welcome */}
          <div className="mb-4" dir="rtl" lang="ar">
            <p className="text-2xl md:text-3xl font-semibold text-halal">
              مرحباً بكم
            </p>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            Find Halal Food Near You
          </h1>
          <p className="text-lg text-muted-foreground">
            Discover halal restaurants, cafes, and shops worldwide
          </p>
        </div>

        <Card className="p-6 shadow-lg">
          <div className="space-y-6">
            {/* Location Detection */}
            <div className="space-y-3">
              <Button
                onClick={handleDetectLocation}
                disabled={isLoading || isDetecting || !geoState.canRetry || geoWatch.isTracking}
                size="lg"
                className="w-full"
              >
                {isDetecting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {detectionMessage}
                  </>
                ) : (
                  <>
                    <Navigation className="mr-2 h-5 w-5" />
                    Detect My Location
                  </>
                )}
              </Button>

              {/* Continuous Tracking Controls */}
              <div className="flex gap-2">
                <Button
                  onClick={handleStartTracking}
                  disabled={geoWatch.isTracking || isLoading || isDetecting}
                  variant="outline"
                  size="lg"
                  className="flex-1"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Tracking
                </Button>
                <Button
                  onClick={handleStopTracking}
                  disabled={!geoWatch.isTracking || isLoading}
                  variant="outline"
                  size="lg"
                  className="flex-1"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop Tracking
                </Button>
              </div>

              {geoWatch.isTracking && (
                <Alert className="bg-halal/10 border-halal">
                  <Navigation className="h-4 w-4 text-halal animate-pulse" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Continuous tracking active</span>
                      <Badge variant="outline" className="bg-halal/20 text-halal border-halal">
                        Live
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {geoWatch.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Tracking Error</AlertTitle>
                  <AlertDescription>
                    {geoWatch.error}
                    {geoWatch.canRetry && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStartTracking}
                        className="mt-3"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {geoState.stage === 'success' && geoState.coordinates && (
                <Alert className="bg-halal/10 border-halal">
                  <CheckCircle className="h-4 w-4 text-halal" />
                  <AlertDescription>
                    {geoState.locationSource === 'GPS' ? 'GPS location detected' : 'IP-based location detected'}
                    {geoState.city && geoState.country && ` - ${geoState.city}, ${geoState.country}`}
                  </AlertDescription>
                </Alert>
              )}

              {geoState.errorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Location Detection Failed</AlertTitle>
                  <AlertDescription className="mt-2">
                    {geoState.errorMessage}
                    {geoState.canRetry && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRetry}
                        className="mt-3"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Try Again
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {geoState.stage === 'not-secure' && (
                <Alert variant="destructive">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Secure Connection Required</AlertTitle>
                  <AlertDescription>
                    Location detection requires HTTPS. Please use the secure version of this site or search by city name.
                  </AlertDescription>
                </Alert>
              )}

              {geoState.stage === 'not-supported' && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Not Supported</AlertTitle>
                  <AlertDescription>
                    Your browser does not support location detection. Please search by city name instead.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            {/* City Search */}
            <form onSubmit={handleCitySearch} className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Search by city or country (e.g., London, Dubai)"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={isLoading || !cityInput.trim()}>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a city or country name to find halal restaurants in that area
              </p>
            </form>

            {/* Location Diagnostics Panel */}
            {(geoWatch.isTracking || geoWatch.position) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">Location Diagnostics</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Status</div>
                      <div className="font-medium capitalize">{geoWatch.status}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Source</div>
                      <div className="font-medium">{geoWatch.source || 'N/A'}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Accuracy</div>
                      <div className="font-medium">{formatAccuracy(geoWatch.accuracy)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Last Update</div>
                      <div className="font-medium">{formatTimestamp(geoWatch.lastUpdate)}</div>
                    </div>
                    {geoWatch.position && (
                      <>
                        <div className="space-y-1">
                          <div className="text-muted-foreground">Latitude</div>
                          <div className="font-mono text-xs">{geoWatch.position.coords.latitude.toFixed(6)}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-muted-foreground">Longitude</div>
                          <div className="font-mono text-xs">{geoWatch.position.coords.longitude.toFixed(6)}</div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t">
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Secure Context</div>
                      <div className="font-medium">{diagnostics.isSecureContext ? 'Yes' : 'No'}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Geolocation API</div>
                      <div className="font-medium">{diagnostics.isGeolocationSupported ? 'Supported' : 'Not Supported'}</div>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <div className="text-muted-foreground">Permission State</div>
                      <div className="font-medium capitalize">{diagnostics.permissionState || 'Unknown'}</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}
