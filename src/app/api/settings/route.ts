import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllSettingStatuses, setSetting, SETTING_KEYS, type SettingKey } from "@/lib/settings";
import { z } from "zod";

// GET /api/settings — return all setting statuses (no raw sensitive values)
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const statuses = await getAllSettingStatuses();
  return NextResponse.json(statuses);
}

const saveSchema = z.record(z.string(), z.string());

// POST /api/settings — save one or more settings
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const data = saveSchema.parse(body);
  const updatedBy = session.user.email ?? session.user.name ?? "admin";

  const saved: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (!SETTING_KEYS.includes(key as SettingKey)) continue; // ignore unknown keys
    if (!value.trim()) continue; // ignore empty — don't overwrite with blank
    await setSetting(key as SettingKey, value.trim(), updatedBy);
    saved.push(key);
  }

  return NextResponse.json({ ok: true, saved });
}
