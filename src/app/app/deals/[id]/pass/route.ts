import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { dealTypeLabel } from "@/lib/deal-types";
import { buildPassPdf } from "@/lib/pass-pdf";

/** GET /app/deals/:id/pass → the stamped pass as a PDF (only if the deal has one). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { supabase } = await requireUser();

  const { data: pass } = await supabase
    .from("passes")
    .select("ref, issued_at, ruleset_version, rules_run, scan_id")
    .eq("deal_id", id)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pass) return new NextResponse("No pass issued for this deal.", { status: 404 });

  const [{ data: deal }, { data: scan }] = await Promise.all([
    supabase
      .from("deal_overview")
      .select("property_address, deal_type, agent_name, agent_email")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("scans").select("summary, created_at").eq("id", pass.scan_id).maybeSingle(),
  ]);
  const { data: brokerage } = await supabase.from("brokerages").select("name").limit(1).maybeSingle();
  if (!deal || !scan) return new NextResponse("Deal not found.", { status: 404 });

  const pdf = await buildPassPdf({
    ref: pass.ref,
    issuedAt: pass.issued_at,
    brokerage: brokerage?.name ?? "",
    dealName: deal.property_address ?? "Deal",
    dealType: dealTypeLabel(deal.deal_type),
    agent: deal.agent_name || deal.agent_email || "",
    rulesetVersion: pass.ruleset_version,
    rulesRun: pass.rules_run,
    scanSummary: scan.summary,
    scannedAt: scan.created_at,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${pass.ref}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
