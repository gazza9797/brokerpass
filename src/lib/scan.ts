import "server-only";

/**
 * Asks the scan-deal Edge Function to scan a deal. Returns quickly (202);
 * the function does the work in the background and writes the results.
 */
export async function requestScan(dealId: string): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: "Scanner not configured" };

  try {
    const res = await fetch(`${url}/functions/v1/scan-deal`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ deal_id: dealId }),
    });
    if (!res.ok) return { ok: false, error: `Scanner responded ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Scanner unreachable" };
  }
}
