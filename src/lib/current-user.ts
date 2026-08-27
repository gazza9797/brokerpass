import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLES, type Profile } from "@/lib/types";

/** Loads the signed-in user's profile + brokerage name, or bounces to /login. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, brokerages(name)")
    .eq("id", user.id)
    .maybeSingle<Profile & { brokerages: { name: string } | null }>();

  const isAdmin = !!profile && ADMIN_ROLES.includes(profile.role);
  const isActive = profile?.status === "active";

  return {
    supabase,
    user,
    profile: profile ?? null,
    brokerageName: profile?.brokerages?.name ?? null,
    isAdmin,
    isActive,
  };
}
