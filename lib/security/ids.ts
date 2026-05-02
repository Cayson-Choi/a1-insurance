const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function normalizeUuidList(
  values: readonly string[],
  maxItems: number,
): string[] | null {
  if (values.length === 0 || values.length > maxItems) return null;

  const seen = new Set<string>();
  for (const value of values) {
    if (!isUuid(value)) return null;
    seen.add(value);
  }

  return Array.from(seen);
}
