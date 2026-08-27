"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { requestScan } from "@/lib/scan";

async function recompute(dealId: string) {
  const { supabase } = await requireUser();
  await supabase.rpc("recompute_deal_status", { p_deal_id: dealId });
  revalidatePath(`/app/deals/${dealId}`);
  revalidatePath("/app");
}

/** Agent (or admin) ticks a Confirm attestation. */
export async function confirmFinding(formData: FormData) {
  const findingId = String(formData.get("finding_id"));
  const dealId = String(formData.get("deal_id"));
  const { supabase, user } = await requireUser();

  await supabase
    .from("findings")
    .update({ confirmed_by: user.id, confirmed_at: new Date().toISOString(), dismissed_by: null, dismissed_at: null, dismiss_reason: null })
    .eq("id", findingId);

  await recompute(dealId);
}

/** Dismiss a Confirm item with a written reason (logged). */
export async function dismissFinding(formData: FormData) {
  const findingId = String(formData.get("finding_id"));
  const dealId = String(formData.get("deal_id"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) redirect(`/app/deals/${dealId}?error=${encodeURIComponent("Give a short reason to dismiss.")}`);

  const { supabase, user } = await requireUser();
  await supabase
    .from("findings")
    .update({ dismissed_by: user.id, dismissed_at: new Date().toISOString(), dismiss_reason: reason, confirmed_by: null, confirmed_at: null })
    .eq("id", findingId);

  await recompute(dealId);
}

/** Undo a confirm or dismiss. */
export async function reopenFinding(formData: FormData) {
  const findingId = String(formData.get("finding_id"));
  const dealId = String(formData.get("deal_id"));
  const { supabase } = await requireUser();
  await supabase
    .from("findings")
    .update({ confirmed_by: null, confirmed_at: null, dismissed_by: null, dismissed_at: null, dismiss_reason: null })
    .eq("id", findingId);
  await recompute(dealId);
}

/** Re-run the scan on the current document. */
export async function recheckDeal(formData: FormData) {
  const dealId = String(formData.get("deal_id"));
  const { supabase, isActive } = await requireUser();
  if (!isActive) redirect(`/app/deals/${dealId}`);

  await supabase.from("deals").update({ status: "scanning", scan_error: null }).eq("id", dealId);
  const r = await requestScan(dealId);
  if (!r.ok) {
    await supabase.from("deals").update({ status: "needs_attention", scan_error: r.error }).eq("id", dealId);
  }
  revalidatePath(`/app/deals/${dealId}`);
  redirect(`/app/deals/${dealId}`);
}

/**
 * Record corrected files the browser has already uploaded to this deal's
 * storage folder. replace=true retires the current live files first
 * (removed from storage, stamped purged) so the re-scan reads only the
 * corrected set. Then a fresh scan is queued.
 */
export async function addDocuments(input: {
  dealId: string;
  files: { path: string; name: string; size: number }[];
  replace: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, profile, isAdmin, isActive } = await requireUser();
  if (!profile?.brokerage_id || !isActive) return { ok: false, error: "Your account is not active." };
  if (!input.files.length) return { ok: false, error: "No files were uploaded." };

  const { data: deal } = await supabase
    .from("deals")
    .select("id, agent_id, brokerage_id")
    .eq("id", input.dealId)
    .maybeSingle();
  if (!deal) return { ok: false, error: "Deal not found." };
  if (!isAdmin && deal.agent_id !== user.id) return { ok: false, error: "Only the agent or an admin can add files." };

  if (input.replace) {
    const { data: live } = await supabase
      .from("documents")
      .select("id, storage_path")
      .eq("deal_id", input.dealId)
      .is("purged_at", null);
    if (live?.length) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      await admin.storage.from("deal-documents").remove(live.map((d) => d.storage_path));
      await admin
        .from("documents")
        .update({ purged_at: new Date().toISOString() })
        .in("id", live.map((d) => d.id));
    }
  }

  const { DOCUMENT_TTL_MINUTES } = await import("@/lib/deal-types");
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

  await supabase.from("deals").update({ status: "scanning", scan_error: null }).eq("id", input.dealId);
  const r = await requestScan(input.dealId);
  if (!r.ok) {
    await supabase.from("deals").update({ status: "needs_attention", scan_error: r.error }).eq("id", input.dealId);
  }
  revalidatePath(`/app/deals/${input.dealId}`);
  revalidatePath("/app");
  return { ok: true };
}
