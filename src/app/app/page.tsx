import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { requireUser } from "@/lib/current-user";
import { dealTypeLabel } from "@/lib/deal-types";
import { purgeExpiredDocuments } from "@/lib/purge";
import type { DealStatus } from "@/lib/types";

interface DealRow {
  id: string;
  deal_type: string;
  property_address: string | null;
  status: DealStatus;
  created_at: string;
  agent_name: string | null;
  agent_email: string | null;
  submitted_by_name: string | null;
  live_documents: number;
  next_expiry: string | null;
}

export const dynamic = "force-dynamic";

export default async function DealDesk() {
  const { supabase, profile, brokerageName, isAdmin, isActive } = await requireUser();

  // Lazy purge: keeps the 60-minute promise honest even without a scheduler.
  await purgeExpiredDocuments();

  const { data: deals } = await supabase
    .from("deal_overview")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<DealRow[]>();

  const counts = {
    total: deals?.length ?? 0,
    attention: deals?.filter((d) => d.status === "needs_attention").length ?? 0,
    cleared: deals?.filter((d) => d.status === "cleared").length ?? 0,
  };

  return (
    <AppShell profile={profile} brokerageName={brokerageName}>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Deal desk</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {isAdmin ? "Every deal in the brokerage." : "Your deals."}
          </p>
        </div>
        {isActive && (
          <Link
            href="/app/deals/new"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90"
          >
            Upload a deal
          </Link>
        )}
      </div>

      {!isActive && (
        <p className="mt-6 rounded-md bg-warn-soft p-4 text-sm text-warn">
          Your account is waiting for Broker of Record approval. You can look
          around, but uploads are off until you are activated.
        </p>
      )}

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Kpi label="Open deals" value={counts.total} />
        <Kpi label="Needs attention" value={counts.attention} tone="warn" />
        <Kpi label="Cleared" value={counts.cleared} tone="pass" />
      </div>

      <div className="mt-8 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Deal type</th>
              {isAdmin && <th className="px-4 py-3">Agent</th>}
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Files</th>
              <th className="px-4 py-3">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {deals?.length ? (
              deals.map((d) => (
                <tr key={d.id} className="border-b border-line last:border-0 hover:bg-background">
                  <td className="px-4 py-3">
                    <Link href={`/app/deals/${d.id}`} className="font-medium text-ink hover:underline">
                      {d.property_address ?? "No address"}
                    </Link>
                    {d.submitted_by_name && d.submitted_by_name !== d.agent_name && (
                      <p className="text-xs text-ink-muted">
                        Submitted by {d.submitted_by_name}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{dealTypeLabel(d.deal_type)}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-ink-muted">
                      {d.agent_name || d.agent_email}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <StatusPill status={d.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {d.live_documents > 0 ? `${d.live_documents} on file` : "Purged"}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {new Date(d.created_at).toLocaleDateString("en-CA")}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-muted">
                  No deals yet. Upload the first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn" | "pass";
}) {
  const color =
    tone === "warn" ? "text-warn" : tone === "pass" ? "text-pass" : "text-ink";
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1 font-heading text-4xl font-bold tracking-tight ${color}`}>{value}</p>
    </div>
  );
}
