import { NextResponse, type NextRequest } from "next/server";
import { purgeExpiredDocuments } from "@/lib/purge";

/**
 * GET /api/cron/purge
 * Called by a scheduler (Netlify scheduled function, cron-job.org, etc.)
 * every 5-10 minutes. Protected by CRON_SECRET as a bearer token.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await purgeExpiredDocuments();
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}
