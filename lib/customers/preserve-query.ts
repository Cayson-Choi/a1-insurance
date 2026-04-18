export function preserveQuery(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      if (v.length && v[0]) clean[k] = v[0];
    } else if (v) {
      clean[k] = v;
    }
  }
  const qs = new URLSearchParams(clean).toString();
  return qs ? `?${qs}` : "";
}
