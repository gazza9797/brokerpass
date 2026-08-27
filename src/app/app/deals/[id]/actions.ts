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
