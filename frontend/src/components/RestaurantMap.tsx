import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { X, Navigation, Phone, Globe, MapPinOff, RefreshCw, Loader2 } from 'lucide-react';
import type { Restaurant } from '../hooks/useQueries';

interface RestaurantMapProps {
  restaurants: Restaurant[];
  selectedRestaurant: Restaurant | null;
  onSelectRestaurant: (restaurant: Restaurant | null) => void;
}

export function RestaurantMap({ restaurants, selectedRestaurant, onSelectRestaurant }: RestaurantMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [L, setL] = useState<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLoadingMap, setIsLoadingMap] = useState(true);
  const [retryAttempt, setRetryAttempt] = useState(0);

  const loadLeaflet = async () => {
    try {
      setIsLoadingMap(true);
      
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      
      script.onload = () => {
        setL((window as any).L);
        setMapError(null);
        setIsLoadingMap(false);
      };

      script.onerror = () => {
        setMapError('Unable to load map resources. Please check your internet connection.');
        setIsLoadingMap(false);
      };
      
      document.body.appendChild(script);
    } catch (error) {
      setMapError('Failed to initialize the map. Please try refreshing the page.');
      setIsLoadingMap(false);
      console.error('Leaflet loading error:', error);
    }
  };

  useEffect(() => {
    loadLeaflet();
  }, []);

  useEffect(() => {
    if (!L || !mapRef.current || map) return;

    try {
      const newMap = L.map(mapRef.current).setView([51.505, -0.09], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(newMap);

      setMap(newMap);
      setMapError(null);
    } catch (error) {
      setMapError('Unable to display the map. The list view is still available.');
      console.error('Map initialization error:', error);
    }

    return () => {
      if (map) {
        try {
          map.remove();
        } catch (e) {
          console.error('Error removing map:', e);
        }
      }
    };
  }, [L, map]);

  useEffect(() => {
    if (!map || !L || restaurants.length === 0) return;

    try {
      markers.forEach(marker => {
        try {
          marker.remove();
        } catch (e) {
          console.error('Error removing marker:', e);
        }
      });

      const halalIcon = L.icon({
        iconUrl: '/assets/generated/halal-marker-icon.dim_64x64.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      const newMarkers = restaurants.map(restaurant => {
        const marker = L.marker([restaurant.latitude, restaurant.longitude], {
          icon: halalIcon,
        }).addTo(map);

        marker.on('click', () => {
          onSelectRestaurant(restaurant);
        });

        const popupContent = `
          <div style="min-width: 200px;">
            <h3 style="font-weight: bold; margin-bottom: 8px;">${restaurant.name}</h3>
            <p style="font-size: 12px; color: #666; margin-bottom: 4px;">${restaurant.cuisine}</p>
            <p style="font-size: 12px; color: #666;">${restaurant.address}</p>
          </div>
        `;

        marker.bindPopup(popupContent);

        return marker;
      });

      setMarkers(newMarkers);

      if (newMarkers.length > 0) {
        const group = L.featureGroup(newMarkers);
        map.fitBounds(group.getBounds().pad(0.1));
      }
      
      setMapError(null);
    } catch (error) {
      setMapError('Unable to display restaurant locations. The list view is still available.');
      console.error('Marker creation error:', error);
    }
  }, [map, L, restaurants]);

  useEffect(() => {
    if (!map || !selectedRestaurant) return;

    try {
      map.setView([selectedRestaurant.latitude, selectedRestaurant.longitude], 15);

      const marker = markers.find(m => {
        const latLng = m.getLatLng();
        return latLng.lat === selectedRestaurant.latitude && latLng.lng === selectedRestaurant.longitude;
      });

      if (marker) {
        marker.openPopup();
      }
    } catch (error) {
      console.error('Map navigation error:', error);
    }
  }, [selectedRestaurant, map, markers]);

  const openInMaps = (restaurant: Restaurant) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`;
    window.open(url, '_blank');
  };

  const handleRetry = () => {
    setMapError(null);
    setRetryAttempt(prev => prev + 1);
    loadLeaflet();
  };

  if (isLoadingMap) {
    return (
      <div className="flex h-[600px] w-full items-center justify-center rounded-lg border bg-muted/20">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-halal mx-auto" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="flex h-[600px] w-full items-center justify-center rounded-lg border bg-muted/20">
        <Alert variant="destructive" className="max-w-md">
          <MapPinOff className="h-5 w-5" />
          <AlertTitle>Map Temporarily Unavailable</AlertTitle>
          <AlertDescription className="space-y-4">
            <p>{mapError}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleRetry} variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Map Load
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              You can still view all restaurants in the List View tab. The map will be available once the connection is restored.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={mapRef} className="h-[600px] w-full rounded-lg border shadow-lg" />

      {selectedRestaurant && (
        <Card className="absolute bottom-4 left-4 right-4 z-[1000] shadow-xl md:left-auto md:w-96">
          <CardContent className="p-4">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="font-bold">{selectedRestaurant.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedRestaurant.cuisine}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSelectRestaurant(null)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">{selectedRestaurant.address}</p>

              {selectedRestaurant.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${selectedRestaurant.phone}`} className="text-halal hover:underline">
                    {selectedRestaurant.phone}
                  </a>
                </div>
              )}

              {selectedRestaurant.website && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={selectedRestaurant.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-halal hover:underline"
                  >
                    Visit Website
                  </a>
                </div>
              )}
            </div>

            <Button
              onClick={() => openInMaps(selectedRestaurant)}
              className="mt-4 w-full bg-halal hover:bg-halal-dark text-white"
              size="sm"
            >
              <Navigation className="mr-2 h-4 w-4" />
              Get Directions
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
