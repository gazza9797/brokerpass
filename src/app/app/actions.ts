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
export async function deleteDeal(dealId: string) {
  const { supabase, user, profile, isAdmin } = await requireUser();

  const { data: deal } = await supabase
    .from("deals")
    .select("id, agent_id, brokerage_id")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return;
  if (!isAdmin && deal.agent_id !== user.id) return;
  if (deal.brokerage_id !== profile?.brokerage_id) return;

  const { data: docs } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("deal_id", dealId)
    .is("purged_at", null);

  if (docs?.length && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient();
    await admin.storage.from("deal-documents").remove(docs.map((d) => d.storage_path));
  }

  await supabase.from("deals").delete().eq("id", dealId);
  revalidatePath("/app");
}
