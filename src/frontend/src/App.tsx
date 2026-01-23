import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { SearchSection } from './components/SearchSection';
import { RestaurantResults } from './components/RestaurantResults';
import { useRestaurantSearch } from './hooks/useQueries';

export default function App() {
  const { 
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
  } = useRestaurantSearch();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
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
            onClear={clearResults}
            onExitSafeMode={exitSafeMode}
          />
        </main>
        <Footer />
        <Toaster />
      </div>
    </ThemeProvider>
  );
}
