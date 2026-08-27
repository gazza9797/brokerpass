import { AppShell } from "@/components/app-shell";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/current-user";
import { DEAL_TYPES, DOCUMENT_TTL_MINUTES } from "@/lib/deal-types";
import { createDeal } from "./actions";

export const dynamic = "force-dynamic";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { supabase, user, profile, brokerageName, isAdmin, isActive } = await requireUser();

  // Admins can submit on behalf of any active agent in the brokerage.
  const { data: agents } = isAdmin
    ? await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("status", "active")
        .order("full_name")
    : { data: null };

  return (
    <AppShell profile={profile} brokerageName={brokerageName}>
      <h1 className="text-2xl font-semibold text-ink">Upload a deal</h1>
      <p className="mt-1 text-sm text-ink-muted">
        One package per deal, as a single PDF. Files are checked, then
        deleted from our servers {DOCUMENT_TTL_MINUTES} minutes after upload.
      </p>

      {!isActive ? (
        <p className="mt-6 rounded-md bg-warn-soft p-4 text-sm text-warn">
          Uploads are off until your Broker of Record activates your account.
        </p>
      ) : (
        <form
          action={createDeal}
          className="mt-8 max-w-xl space-y-5 rounded-lg border border-line bg-surface p-6"
        >
          <Field label="Deal type">
            <select
              name="deal_type"
              required
              defaultValue=""
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-ink"
            >
              <option value="" disabled>
                Choose one
              </option>
              {DEAL_TYPES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Property address">
            <input
              name="property_address"
              placeholder="123 Main St, Newmarket"
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-ink"
            />
          </Field>

          {isAdmin && agents && (
            <Field label="Submitting for">
              <select
                name="agent_id"
                defaultValue={user.id}
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-ink"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name || a.email}
                    {a.id === user.id ? " (me)" : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-muted">
                The deal is filed under the agent and logged as submitted by you.
              </p>
            </Field>
          )}

          <Field label="Deal package (PDF, max 25 MB)">
            <input
              type="file"
              name="file"
              accept="application/pdf"
              required
              className="mt-1 block w-full text-sm text-ink-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-ink"
            />
          </Field>

          {error && (
            <p className="rounded-md bg-critical-soft p-3 text-sm text-critical">{error}</p>
          )}

          <SubmitButton
            pendingText="Uploading…"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90"
          >
            Upload and check
          </SubmitButton>
          <p className="text-xs text-ink-muted">
            One click is enough. Large PDFs can take a few seconds.
          </p>
        </form>
      )}
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      {children}
    </label>
  );
}
