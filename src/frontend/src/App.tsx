import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { Header } from '@/components/Header';
import { SearchSection } from '@/components/SearchSection';
import { RestaurantResults } from '@/components/RestaurantResults';
import { Footer } from '@/components/Footer';
import { FoursquareSettingsPanel } from '@/components/FoursquareSettingsPanel';
import { useRestaurantSearch } from '@/hooks/useQueries';
import { useTrafficCounter } from '@/hooks/useTrafficCounter';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Settings, X } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const {
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
  } = useRestaurantSearch();

  const { totalVisits, isLoading: counterLoading, hasError: counterError } = useTrafficCounter();

  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="home-background-wrapper">
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <SearchSection
            onLocationSearch={searchByLocation}
            onCitySearch={searchByCity}
            isLoading={isLoading}
          />
          <RestaurantResults
            restaurants={restaurants}
            isLoading={isLoading}
            error={error}
            isRetrying={isRetrying}
            retryCount={retryCount}
            safeMode={safeMode}
            isAuthError={isAuthError}
            onClear={clearResults}
            onExitSafeMode={exitSafeMode}
          />
          
          {/* Settings Panel Toggle */}
          <div className="container py-8">
            <div className="flex justify-center">
              <Button
                onClick={() => setShowSettings(!showSettings)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {showSettings ? (
                  <>
                    <X className="h-4 w-4" />
                    Hide Settings
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4" />
                    Show Settings
                  </>
                )}
              </Button>
            </div>
            
            {showSettings && (
              <div className="mx-auto mt-6 max-w-2xl">
                <FoursquareSettingsPanel />
              </div>
            )}
          </div>
        </main>
        <Footer 
          totalVisits={totalVisits}
          counterLoading={counterLoading}
          counterError={counterError}
        />
        <Toaster />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AppContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
