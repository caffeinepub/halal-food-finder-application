import { useState } from 'react';
import { Map, List, X, AlertCircle, RefreshCw, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { RestaurantList } from './RestaurantList';
import { RestaurantMap } from './RestaurantMap';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';
import type { Restaurant } from '../hooks/useQueries';

interface RestaurantResultsProps {
  restaurants: Restaurant[];
  isLoading: boolean;
  error: string | null;
  isRetrying?: boolean;
  retryCount?: number;
  safeMode?: boolean;
  onClear: () => void;
  onExitSafeMode?: () => void;
}

export function RestaurantResults({ 
  restaurants, 
  isLoading, 
  error, 
  isRetrying = false,
  retryCount = 0,
  safeMode = false,
  onClear,
  onExitSafeMode,
}: RestaurantResultsProps) {
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <LoadingState />
        {isRetrying && (
          <div className="container">
            <Alert className="mx-auto max-w-2xl border-halal/50 bg-halal/5">
              <Loader2 className="h-5 w-5 animate-spin text-halal" />
              <AlertTitle className="text-lg font-semibold">Retrying Connection</AlertTitle>
              <AlertDescription className="mt-2 space-y-3">
                <p>The service is recovering. Automatically retrying (attempt {retryCount + 1}/3)...</p>
                <Progress value={(retryCount / 3) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Please wait while we restore the connection. This usually takes just a few seconds.
                </p>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    );
  }

  if (safeMode) {
    return (
      <section className="container py-8">
        <Alert className="mx-auto max-w-2xl border-amber-500/50 bg-amber-500/5">
          <Shield className="h-5 w-5 text-amber-500" />
          <AlertTitle className="text-lg font-semibold">Safe Mode Active</AlertTitle>
          <AlertDescription className="mt-2 space-y-4">
            <p>
              The backend service is temporarily recovering. You can continue searching by city or country name while we restore full functionality.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onExitSafeMode} variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Full Service Again
              </Button>
              <Button onClick={onClear} variant="outline" size="sm">
                Clear & Continue
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Global search by city name is fully functional. Location-based search will be restored shortly.
            </p>
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  if (error) {
    return (
      <section className="container py-8">
        <Alert variant="destructive" className="mx-auto max-w-2xl">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="text-lg font-semibold">Search Temporarily Unavailable</AlertTitle>
          <AlertDescription className="mt-2 space-y-4">
            <p>{error}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onClear} variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline" 
                size="sm"
              >
                Refresh Page
              </Button>
            </div>
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs font-medium">Recovery Tips:</p>
              <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-muted-foreground">
                <li>The service automatically retries failed requests</li>
                <li>Try searching by city name if location search fails</li>
                <li>Wait a moment and try again if you see this message</li>
                <li>Refresh the page to restart the connection</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  if (restaurants.length === 0) {
    return <EmptyState />;
  }

  return (
    <section className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">Search Results</h3>
          <p className="text-sm text-muted-foreground">
            Found {restaurants.length} halal restaurant{restaurants.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={onClear} variant="outline" size="sm">
          <X className="mr-2 h-4 w-4" />
          Clear Results
        </Button>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="list" className="gap-2">
            <List className="h-4 w-4" />
            List View
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-2">
            <Map className="h-4 w-4" />
            Map View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <RestaurantList 
            restaurants={restaurants}
            selectedRestaurant={selectedRestaurant}
            onSelectRestaurant={setSelectedRestaurant}
          />
        </TabsContent>

        <TabsContent value="map" className="mt-6">
          <RestaurantMap 
            restaurants={restaurants}
            selectedRestaurant={selectedRestaurant}
            onSelectRestaurant={setSelectedRestaurant}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
