import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS, type Profile } from "@/lib/types";
import { logout } from "@/app/login/actions";

/** Deal desk shell. Real dashboard lands here in a later step. */
export default async function AppHome() {
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

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="flex items-center justify-between border-b border-line pb-4">
        <div>
          <p className="text-sm text-ink-muted">
            {profile?.brokerages?.name ?? "No brokerage assigned yet"}
          </p>
          <h1 className="text-2xl font-semibold text-ink">Deal desk</h1>
        </div>
        <form action={logout}>
          <button className="text-sm text-ink-muted underline-offset-4 hover:underline">
            Sign out
          </button>
        </form>
      </header>

      <section className="mt-8 rounded-lg border border-line bg-surface p-6">
        <p className="text-sm text-ink-muted">Signed in as</p>
        <p className="font-medium text-ink">{user.email}</p>
        <p className="mt-2 text-sm text-ink-muted">
          Role:{" "}
          <span className="font-medium text-ink">
            {profile ? ROLE_LABELS[profile.role] : "pending setup"}
          </span>
          {profile?.status === "pending" && (
            <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">
              Awaiting Broker of Record approval
            </span>
          )}
        </p>
      </section>
    </main>
  );
}
