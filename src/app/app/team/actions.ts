"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["broker_of_record", "alternate_bor", "compliance_officer", "agent"];
type Result = { ok: boolean; error?: string };

async function requireManager() {
  const ctx = await requireUser();
  const { profile, isActive } = ctx;
  const canManage =
    isActive && !!profile && (profile.role === "broker_of_record" || profile.role === "alternate_bor");
  return { ...ctx, canManage };
}

/** Approve a pending member with a role (or change an existing member's role). */
export async function setMemberRole(formData: FormData): Promise<Result> {
  const id = String(formData.get("id"));
  const role = String(formData.get("role")) as UserRole;
  const { supabase, user, canManage } = await requireManager();
  if (!canManage) return { ok: false, error: "Not allowed." };
  if (!ROLES.includes(role)) return { ok: false, error: "Unknown role." };

  const { error } = await supabase
    .from("profiles")
    .update({ role, status: "active", approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/app/team");
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setMemberStatus(formData: FormData): Promise<Result> {
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as "active" | "deactivated";
  const { supabase, user, canManage } = await requireManager();
  if (!canManage) return { ok: false, error: "Not allowed." };
  if (id === user.id && status === "deactivated") return { ok: false, error: "You cannot deactivate yourself." };

  const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
  revalidatePath("/app/team");
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Invite by email: creates the auth user, sends the Supabase invite email, pre-approves the profile. */
export async function inviteMember(formData: FormData): Promise<Result> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "agent") as UserRole;
  const { user, profile, canManage } = await requireManager();
  if (!canManage || !profile?.brokerage_id) return { ok: false, error: "Not allowed." };
  if (!email.includes("@")) return { ok: false, error: "Enter a valid email." };
  if (!ROLES.includes(role)) return { ok: false, error: "Unknown role." };
  if (role === "broker_of_record" && profile.role !== "broker_of_record") {
    return { ok: false, error: "Only the Broker of Record can invite another Broker of Record." };
  }

  const admin = createAdminClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/app`;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });
  if (error) return { ok: false, error: error.message };

  // The signup trigger created the profile as pending; pre-approve it.
  const { error: pErr } = await admin
    .from("profiles")
    .update({
      brokerage_id: profile.brokerage_id,
      role,
      status: "active",
      full_name: fullName,
      invited_by: user.id,
      invited_at: new Date().toISOString(),
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", data.user.id);
  if (pErr) return { ok: false, error: pErr.message };

  revalidatePath("/app/team");
  return { ok: true };
}

/** Anyone can set their own display name. */
export async function setMyName(formData: FormData): Promise<Result> {
  const name = String(formData.get("full_name") ?? "").trim();
  const { supabase, user } = await requireUser();
  if (name.length < 2) return { ok: false, error: "Enter your name." };
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
  revalidatePath("/app");
  revalidatePath("/app/team");
  return error ? { ok: false, error: error.message } : { ok: true };
}
