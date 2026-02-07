import { useState, useEffect, useRef, useCallback } from 'react';

export type WatchStatus = 'idle' | 'starting' | 'tracking' | 'stopped' | 'error' | 'permission-denied';
export type LocationSource = 'GPS' | 'IP' | null;

export interface GeolocationWatchState {
  status: WatchStatus;
  source: LocationSource;
  position: GeolocationPosition | null;
  accuracy: number | null;
  lastUpdate: Date | null;
  error: string | null;
  canRetry: boolean;
}

export interface UseGeolocationWatchReturn extends GeolocationWatchState {
  startTracking: () => void;
  stopTracking: () => void;
  isTracking: boolean;
}

export function useGeolocationWatch(): UseGeolocationWatchReturn {
  const [state, setState] = useState<GeolocationWatchState>({
    status: 'idle',
    source: null,
    position: null,
    accuracy: null,
    lastUpdate: null,
    error: null,
    canRetry: true,
  });

  const watchIdRef = useRef<number | null>(null);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      console.log('Geolocation watch stopped');
    }
    setState(prev => ({
      ...prev,
      status: 'stopped',
      error: null,
    }));
  }, []);

  const startTracking = useCallback(() => {
    // Check if geolocation is supported
    if (!('geolocation' in navigator)) {
      setState({
        status: 'error',
        source: null,
        position: null,
        accuracy: null,
        lastUpdate: null,
        error: 'Geolocation is not supported by your browser',
        canRetry: false,
      });
      return;
    }

    // Check secure context
    if (!window.isSecureContext) {
      setState({
        status: 'error',
        source: null,
        position: null,
        accuracy: null,
        lastUpdate: null,
        error: 'Geolocation requires a secure context (HTTPS)',
        canRetry: false,
      });
      return;
    }

    setState(prev => ({
      ...prev,
      status: 'starting',
      error: null,
    }));

    const handleSuccess = (position: GeolocationPosition) => {
      console.log('Geolocation watch update:', {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date(position.timestamp),
      });

      setState({
        status: 'tracking',
        source: 'GPS',
        position,
        accuracy: position.coords.accuracy,
        lastUpdate: new Date(position.timestamp),
        error: null,
        canRetry: true,
      });
    };

    const handleError = (error: GeolocationPositionError) => {
      console.error('Geolocation watch error:', error);

      let errorMessage = 'Failed to get location';
      let canRetry = true;
      let status: WatchStatus = 'error';

      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
          canRetry = false;
          status = 'permission-denied';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information is unavailable. Please check your device settings.';
          canRetry = true;
          status = 'error';
          break;
        case error.TIMEOUT:
          errorMessage = 'Location request timed out. Please try again.';
          canRetry = true;
          status = 'error';
          break;
        default:
          errorMessage = error.message || 'An unknown error occurred';
          canRetry = true;
          status = 'error';
      }

      // Stop the watch on permission denied to prevent retry loops
      if (error.code === error.PERMISSION_DENIED && watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      setState({
        status,
        source: null,
        position: null,
        accuracy: null,
        lastUpdate: null,
        error: errorMessage,
        canRetry,
      });
    };

    // Start watching position with high accuracy
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    console.log('Geolocation watch started with ID:', watchIdRef.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        console.log('Geolocation watch cleaned up on unmount');
      }
    };
  }, []);

  return {
    ...state,
    startTracking,
    stopTracking,
    isTracking: state.status === 'tracking' || state.status === 'starting',
  };
}
