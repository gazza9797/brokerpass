"use server";

import { requireUser } from "@/lib/current-user";
import { DOCUMENT_TTL_MINUTES } from "@/lib/deal-types";
import { requestScan } from "@/lib/scan";

export interface StartDealResult {
  ok: true;
  dealId: string;
  brokerageId: string;
}
export interface ActionError {
  ok: false;
  error: string;
}

/**
 * Step 1 of an upload: create the deal row so the browser has a folder
 * to upload into. Files go browser → Supabase Storage directly (RLS
 * enforced), which avoids the ~6 MB request cap on server functions.
 */
export async function startDeal(input: {
  name: string;
  agentId?: string;
}): Promise<StartDealResult | ActionError> {
  const { supabase, user, profile, isAdmin, isActive } = await requireUser();
  if (!profile?.brokerage_id || !isActive) return { ok: false, error: "Your account is not active yet." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Give the deal a name (the address, any way you like)." };

  const agentId = isAdmin && input.agentId ? input.agentId : user.id;

  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      brokerage_id: profile.brokerage_id,
      agent_id: agentId,
      submitted_by: user.id,
      deal_type: "pending",
      property_address: name,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !deal) return { ok: false, error: error?.message ?? "Could not create the deal." };
  return { ok: true, dealId: deal.id, brokerageId: profile.brokerage_id };
}

/** Step 2: the browser has uploaded the files; record them and start the scan. */
export async function finishDeal(input: {
  dealId: string;
  files: { path: string; name: string; size: number }[];
}): Promise<ActionError | { ok: true }> {
  const { supabase, user, profile } = await requireUser();
  if (!profile?.brokerage_id) return { ok: false, error: "Not active." };
  if (!input.files.length) return { ok: false, error: "No files were uploaded." };

  const expiresAt = new Date(Date.now() + DOCUMENT_TTL_MINUTES * 60_000).toISOString();
  const { error } = await supabase.from("documents").insert(
    input.files.map((f) => ({
      deal_id: input.dealId,
      brokerage_id: profile.brokerage_id,
      uploaded_by: user.id,
      storage_path: f.path,
      file_name: f.name,
      file_size: f.size,
      mime_type: "application/pdf",
      expires_at: expiresAt,
    })),
  );
  if (error) return { ok: false, error: error.message };

  await supabase.from("deals").update({ status: "scanning" }).eq("id", input.dealId);
  const scan = await requestScan(input.dealId);
  if (!scan.ok) {
    await supabase
      .from("deals")
      .update({ status: "needs_attention", scan_error: scan.error ?? "Scanner unavailable" })
      .eq("id", input.dealId);
  }
  return { ok: true };
}

/** Abandon a deal whose upload failed part-way. */
export async function abandonDeal(dealId: string) {
  const { supabase } = await requireUser();
  await supabase.from("deals").delete().eq("id", dealId);
}
