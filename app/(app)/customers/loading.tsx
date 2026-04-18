export default function LoadingCustomers() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 rounded-md bg-muted animate-pulse" />
      <div className="h-24 rounded-lg border bg-card animate-pulse" />
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="h-12 bg-muted/50" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 border-t animate-pulse bg-muted/20" />
        ))}
      </div>
    </div>
  );
}
