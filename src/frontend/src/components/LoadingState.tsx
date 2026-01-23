import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function LoadingState() {
  return (
    <section className="container py-8">
      <div className="mb-6 flex items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-halal" />
        <p className="text-lg font-medium">Searching for halal restaurants...</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border p-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
