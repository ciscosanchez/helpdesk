import { db } from "./db";

// In-process cache — avoids a DB hit on every triage request
const cache = new Map<string, { value: string; ts: number }>();
const TTL_MS = 60_000; // 1 minute

export const SETTING_KEYS = [
  "ZAMMAD_URL",
  "ZAMMAD_TOKEN",
  "ZAMMAD_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

// Sensitive keys — masked in the UI, never returned in full from the API
export const SENSITIVE_KEYS: SettingKey[] = [
  "ZAMMAD_TOKEN",
  "ZAMMAD_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
  "RESEND_API_KEY",
];

/**
 * Read a setting. Priority: DB value → process.env fallback.
 * Returns undefined if neither is set.
 */
export async function getSetting(key: SettingKey): Promise<string | undefined> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.value;

  try {
    const row = await db.setting.findUnique({ where: { key } });
    if (row?.value) {
      cache.set(key, { value: row.value, ts: Date.now() });
      return row.value;
    }
  } catch {
    // DB not available — fall through to env
  }

  return process.env[key];
}

/**
 * Save a setting to the database and update the cache.
 */
export async function setSetting(
  key: SettingKey,
  value: string,
  updatedBy?: string
): Promise<void> {
  await db.setting.upsert({
    where: { key },
    create: { key, value, updatedBy },
    update: { value, updatedBy },
  });
  cache.set(key, { value, ts: Date.now() });
}

/**
 * Invalidate a single key's cache entry (forces re-read from DB on next access).
 */
export function invalidateCache(key: SettingKey) {
  cache.delete(key);
}

/**
 * Return the source of a setting's current value: "db", "env", or "unset".
 * Used by the settings UI to show where each value is coming from.
 */
export async function getSettingSource(
  key: SettingKey
): Promise<"db" | "env" | "unset"> {
  try {
    const row = await db.setting.findUnique({ where: { key } });
    if (row?.value) return "db";
  } catch {
    // ignore
  }
  if (process.env[key]) return "env";
  return "unset";
}

/**
 * Bulk-read all setting statuses for the settings page.
 * Returns { source, configured } for each key — never returns raw values for sensitive keys.
 */
export async function getAllSettingStatuses(): Promise<
  Record<SettingKey, { source: "db" | "env" | "unset"; configured: boolean; value?: string }>
> {
  const rows = await db.setting.findMany({
    where: { key: { in: [...SETTING_KEYS] } },
  });
  const dbMap = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const result = {} as Record<SettingKey, { source: "db" | "env" | "unset"; configured: boolean; value?: string }>;

  for (const key of SETTING_KEYS) {
    const dbVal = dbMap[key];
    const envVal = process.env[key];
    const source: "db" | "env" | "unset" = dbVal ? "db" : envVal ? "env" : "unset";
    const configured = !!(dbVal || envVal);
    // Only expose the value for non-sensitive keys (so the UI can pre-fill them)
    const value = SENSITIVE_KEYS.includes(key)
      ? undefined
      : (dbVal ?? envVal ?? undefined);

    result[key] = { source, configured, value };
  }

  return result;
}
