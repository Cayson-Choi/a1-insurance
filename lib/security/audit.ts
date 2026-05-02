const SENSITIVE_KEYS = new Set(["rrnFront", "rrnBack"]);

function maskSensitiveValue(key: string, value: unknown): unknown {
  if (!SENSITIVE_KEYS.has(key)) return value;
  if (value === null || value === undefined || value === "") return value;
  return "[REDACTED]";
}

export function redactAuditPayload<T>(payload: T): T {
  if (Array.isArray(payload)) {
    return payload.map((item) => redactAuditPayload(item)) as T;
  }

  if (payload instanceof Date) {
    return payload.toISOString() as T;
  }

  if (!payload || typeof payload !== "object") return payload;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    out[key] = maskSensitiveValue(key, redactAuditPayload(value));
  }
  return out as T;
}
