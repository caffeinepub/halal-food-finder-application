import { Heart } from 'lucide-react';
import { useFoursquareConfig } from '@/hooks/useFoursquareConfig';

interface FooterProps {
  totalVisits: number | null;
  counterLoading: boolean;
  counterError: boolean;
}

export function Footer({ totalVisits, counterLoading, counterError }: FooterProps) {
  const { isFoursquareConfigured } = useFoursquareConfig();

  const formatVisits = (count: number | null): string => {
    if (count === null) return 'unavailable';
    return count.toLocaleString();
  };

  return (
    <footer className="border-t border-border/40 bg-muted/30">
      <div className="container py-8">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>© 2026. Built with</span>
            <Heart className="h-4 w-4 fill-halal text-halal" />
            <span>using</span>
            <a
              href="https://caffeine.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-halal hover:underline"
            >
              caffeine.ai
            </a>
          </div>
          <div className="text-xs text-muted-foreground">
            Author: <span className="font-medium text-foreground">Neil Hillman</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Data provided by{' '}
            {isFoursquareConfigured && (
              <>
                <a
                  href="https://foursquare.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-halal hover:underline"
                >
                  Foursquare
                </a>
                {' and '}
              </>
            )}
            <a
              href="https://www.openstreetmap.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-halal hover:underline"
            >
              OpenStreetMap
            </a>
            {' (Overpass API)'}
          </div>
          <div className="text-xs text-muted-foreground">
            {counterLoading ? (
              <span>Loading visits...</span>
            ) : (
              <span>Total visits: {formatVisits(totalVisits)}</span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
