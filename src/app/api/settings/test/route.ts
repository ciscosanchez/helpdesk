import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSetting } from "@/lib/settings";

// POST /api/settings/test — test Zammad connection with current credentials
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [url, token] = await Promise.all([
    getSetting("ZAMMAD_URL"),
    getSetting("ZAMMAD_TOKEN"),
  ]);

  if (!url || !token) {
    return NextResponse.json({
      ok: false,
      error: "Zammad URL and Token must be configured before testing.",
    });
  }

  try {
    const res = await fetch(`${url}/api/v1/users/me`, {
      headers: { Authorization: `Token token=${token}` },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const user = await res.json();
      return NextResponse.json({
        ok: true,
        message: `Connected successfully. Logged in as ${user.firstname} ${user.lastname} (${user.email}).`,
      });
    }

    if (res.status === 401) {
      return NextResponse.json({ ok: false, error: "Invalid token — Zammad rejected the credentials." });
    }

    return NextResponse.json({ ok: false, error: `Zammad returned HTTP ${res.status}.` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: `Could not reach Zammad: ${msg}` });
  }
}
