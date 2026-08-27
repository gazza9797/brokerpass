"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Delete a deal, its report, and any files still in storage.
 * Admins may delete any deal in the brokerage; agents only their own.
 * RLS enforces who; this action also removes the storage objects, which
 * RLS alone cannot do from the browser.
 */
export async function deleteDeal(dealId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, profile, isAdmin } = await requireUser();

  const { data: deal } = await supabase
    .from("deals")
    .select("id, agent_id, brokerage_id")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return { ok: false, error: "Deal not found." };
  if (!isAdmin && deal.agent_id !== user.id) return { ok: false, error: "Only the agent or an admin can delete this deal." };
  if (deal.brokerage_id !== profile?.brokerage_id) return { ok: false, error: "Not your brokerage." };

  const { data: docs } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("deal_id", dealId)
    .is("purged_at", null);

  if (docs?.length && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient();
    await admin.storage.from("deal-documents").remove(docs.map((d) => d.storage_path));
  }

  const { error, count } = await supabase.from("deals").delete({ count: "exact" }).eq("id", dealId);
  if (error) return { ok: false, error: error.message };
  if (!count) {
    return {
      ok: false,
      error: "The database refused the delete. Run migration 0004_delete_deals.sql in Supabase.",
    };
  }
  revalidatePath("/app");
  return { ok: true };
}
