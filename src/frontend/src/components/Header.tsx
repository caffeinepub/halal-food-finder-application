import { MapPin } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src="/assets/generated/halal-finder-logo-transparent.dim_200x200.png" 
            alt="Halal Finder Logo" 
            className="h-10 w-10"
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Halal Food Finder</h1>
            <p className="text-xs text-muted-foreground">Discover halal restaurants worldwide</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span className="hidden sm:inline">Find halal food near you</span>
        </div>
      </div>
    </header>
  );
}
