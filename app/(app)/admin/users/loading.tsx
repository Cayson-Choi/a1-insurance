export default function LoadingUsers() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-48 rounded-md bg-muted animate-pulse" />
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="h-12 bg-muted/50" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 border-t animate-pulse bg-muted/20" />
        ))}
      </div>
    </div>
  );
}
