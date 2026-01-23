import { Heart } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-muted/30">
      <div className="container py-8">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>© 2025. Built with</span>
            <Heart className="h-4 w-4 fill-halal text-halal" />
            <span>using</span>
            <a 
              href="https://caffeine.ai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-halal transition-colors"
            >
              caffeine.ai
            </a>
          </div>
          <p className="text-xs text-muted-foreground max-w-md">
            Helping Muslims discover halal dining options around the world. 
            Data provided by Foursquare and OpenStreetMap.
          </p>
        </div>
      </div>
    </footer>
  );
}
