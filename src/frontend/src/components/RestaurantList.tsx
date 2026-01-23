import { Phone, Globe, MapPin, Star, Navigation } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Restaurant } from '../hooks/useQueries';

interface RestaurantListProps {
  restaurants: Restaurant[];
  selectedRestaurant: Restaurant | null;
  onSelectRestaurant: (restaurant: Restaurant | null) => void;
}

export function RestaurantList({ restaurants, selectedRestaurant, onSelectRestaurant }: RestaurantListProps) {
  const formatDistance = (meters?: number) => {
    if (!meters) return null;
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const openInMaps = (restaurant: Restaurant) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`;
    window.open(url, '_blank');
  };

  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {restaurants.map((restaurant) => (
          <Card
            key={restaurant.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedRestaurant?.id === restaurant.id ? 'ring-2 ring-halal' : ''
            }`}
            onClick={() => onSelectRestaurant(restaurant)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg leading-tight">{restaurant.name}</CardTitle>
                {restaurant.distance && (
                  <Badge variant="secondary" className="shrink-0">
                    {formatDistance(restaurant.distance)}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="border-halal/50 text-halal">
                  {restaurant.cuisine}
                </Badge>
                {restaurant.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{restaurant.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {restaurant.address}
                  {restaurant.city && `, ${restaurant.city}`}
                  {restaurant.country && `, ${restaurant.country}`}
                </span>
              </div>

              {restaurant.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${restaurant.phone}`} className="text-halal hover:underline">
                    {restaurant.phone}
                  </a>
                </div>
              )}

              {restaurant.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={restaurant.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-halal hover:underline"
                  >
                    Visit Website
                  </a>
                </div>
              )}

              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  openInMaps(restaurant);
                }}
                className="w-full bg-halal hover:bg-halal-dark text-white"
                size="sm"
              >
                <Navigation className="mr-2 h-4 w-4" />
                Get Directions
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
