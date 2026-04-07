export function EmptyState() {
  return (
    <section className="container py-16">
      <div className="mx-auto max-w-md text-center">
        <img
          src="/assets/generated/search-empty-state.dim_400x300.png"
          alt="No results"
          className="mx-auto mb-6 h-48 w-auto opacity-50"
        />
        <h3 className="mb-2 text-xl font-semibold">Start Your Search</h3>
        <p className="text-muted-foreground">
          Click "Use My Current Location" to find nearby halal restaurants, or search by city name if location access is unavailable or blocked.
        </p>
      </div>
    </section>
  );
}
