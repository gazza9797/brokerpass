"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { DEAL_TYPES, DOCUMENT_TTL_MINUTES } from "@/lib/deal-types";

const MAX_BYTES = 25 * 1024 * 1024;

export async function createDeal(formData: FormData) {
  const { supabase, user, profile, isAdmin, isActive } = await requireUser();

  if (!profile?.brokerage_id || !isActive) {
    redirect("/app/deals/new?error=" + encodeURIComponent("Your account is not active yet."));
  }

  const dealType = String(formData.get("deal_type") ?? "");
  const address = String(formData.get("property_address") ?? "").trim();
  const onBehalfOf = String(formData.get("agent_id") ?? "").trim();
  const file = formData.get("file");

  if (!DEAL_TYPES.some((d) => d.id === dealType)) {
    redirect("/app/deals/new?error=" + encodeURIComponent("Pick a deal type."));
  }
  if (!(file instanceof File) || file.size === 0) {
    redirect("/app/deals/new?error=" + encodeURIComponent("Attach the deal package as a PDF."));
  }
  if (file.type !== "application/pdf") {
    redirect("/app/deals/new?error=" + encodeURIComponent("Only PDF files are accepted."));
  }
  if (file.size > MAX_BYTES) {
    redirect("/app/deals/new?error=" + encodeURIComponent("File is over 25 MB."));
  }

  // Agents can only submit for themselves. Admins may pick an agent.
  const agentId = isAdmin && onBehalfOf ? onBehalfOf : user.id;

  // Backstop against double submits: same agent + file name + address
  // inside the last two minutes is treated as the same upload.
  const twoMinutesAgo = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: recent } = await supabase
    .from("documents")
    .select("deal_id, deals!inner(agent_id, property_address)")
    .eq("file_name", file.name)
    .eq("deals.agent_id", agentId)
    .gte("uploaded_at", twoMinutesAgo)
    .limit(5);
  const dup = recent?.find((r) => {
    const d = r.deals as unknown as { property_address: string | null };
    return (d.property_address ?? "") === (address || "");
  });
  if (dup) {
    redirect(`/app/deals/${dup.deal_id}`);
  }

  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .insert({
      brokerage_id: profile.brokerage_id,
      agent_id: agentId,
      submitted_by: user.id,
      deal_type: dealType,
      property_address: address || null,
      status: "scanning",
    })
    .select("id")
    .single();

  if (dealError || !deal) {
    redirect(
      "/app/deals/new?error=" +
        encodeURIComponent(dealError?.message ?? "Could not create the deal."),
    );
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
  const storagePath = `${profile.brokerage_id}/${deal.id}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("deal-documents")
    .upload(storagePath, file, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    await supabase.from("deals").delete().eq("id", deal.id);
    redirect("/app/deals/new?error=" + encodeURIComponent("Upload failed: " + uploadError.message));
  }

  const expiresAt = new Date(Date.now() + DOCUMENT_TTL_MINUTES * 60_000).toISOString();
  const { error: docError } = await supabase.from("documents").insert({
    deal_id: deal.id,
    brokerage_id: profile.brokerage_id,
    uploaded_by: user.id,
    storage_path: storagePath,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type,
    expires_at: expiresAt,
  });

  if (docError) {
    redirect("/app/deals/new?error=" + encodeURIComponent(docError.message));
  }

  redirect(`/app/deals/${deal.id}`);
}
