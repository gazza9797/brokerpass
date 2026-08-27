import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ExpiryCountdown } from "@/components/expiry-countdown";
import { StatusPill } from "@/components/status-pill";
import { requireUser } from "@/lib/current-user";
import { dealTypeLabel } from "@/lib/deal-types";
import { purgeExpiredDocuments } from "@/lib/purge";
import type { DealStatus } from "@/lib/types";

interface DealDetail {
  id: string;
  deal_type: string;
  property_address: string | null;
  status: DealStatus;
  created_at: string;
  agent_name: string | null;
  agent_email: string | null;
  submitted_by_name: string | null;
}

interface Doc {
  id: string;
  file_name: string;
  file_size: number;
  storage_path: string;
  uploaded_at: string;
  expires_at: string;
  purged_at: string | null;
}

interface Scan {
  id: string;
  ruleset_version: string;
  rules_run: number;
  passed: number;
  warnings: number;
  critical: number;
  confirms: number;
  created_at: string;
}

export const dynamic = "force-dynamic";

export default async function DealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile, brokerageName } = await requireUser();

  await purgeExpiredDocuments();

  const { data: deal } = await supabase
    .from("deal_overview")
    .select("*")
    .eq("id", id)
    .maybeSingle<DealDetail>();
  if (!deal) notFound();

  const [{ data: docs }, { data: scans }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, file_name, file_size, storage_path, uploaded_at, expires_at, purged_at")
      .eq("deal_id", id)
      .order("uploaded_at", { ascending: false })
      .returns<Doc[]>(),
    supabase
      .from("scans")
      .select("*")
      .eq("deal_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<Scan[]>(),
  ]);

  // Short-lived signed URLs so the BOR can open the file while it exists.
  const liveDocs = (docs ?? []).filter((d) => !d.purged_at);
  const signed = await Promise.all(
    liveDocs.map(async (d) => {
      const { data } = await supabase.storage
        .from("deal-documents")
        .createSignedUrl(d.storage_path, 300);
      return [d.id, data?.signedUrl ?? null] as const;
    }),
  );
  const urlById = Object.fromEntries(signed);
  const scan = scans?.[0] ?? null;

  return (
    <AppShell profile={profile} brokerageName={brokerageName}>
      <Link href="/app" className="text-sm text-ink-muted hover:text-ink">
        ← Deal desk
      </Link>

      <div className="mt-3 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {deal.property_address ?? "No address"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {dealTypeLabel(deal.deal_type)} · {deal.agent_name || deal.agent_email}
            {deal.submitted_by_name && deal.submitted_by_name !== deal.agent_name
              ? ` · submitted by ${deal.submitted_by_name}`
              : ""}
          </p>
        </div>
        <StatusPill status={deal.status} />
      </div>

      <section className="mt-8 rounded-lg border border-line bg-surface p-6">
        <h2 className="text-base font-semibold text-ink">Compliance check</h2>
        {scan ? (
          <p className="mt-2 text-sm text-ink-muted">
            {scan.rules_run} rules run · {scan.passed} passed · {scan.warnings} warnings ·{" "}
            {scan.critical} critical · {scan.confirms} require confirmation
          </p>
        ) : (
          <div className="mt-3 rounded-md bg-background p-4 text-sm text-ink-muted">
            <p className="font-medium text-ink">Rule engine not connected yet.</p>
            <p className="mt-1">
              The package is stored and queued. When the ruleset ships (step 3),
              this panel shows every rule that ran, what passed, and what needs
              fixing, with a fix-it action on each flag.
            </p>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-line bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Documents</h2>
          <p className="text-xs text-ink-muted">
            Files are deleted from our servers 60 minutes after upload.
          </p>
        </div>
        <ul className="mt-3 divide-y divide-line">
          {(docs ?? []).map((d) => (
            <li key={d.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium text-ink">{d.file_name}</p>
                <p className="text-xs text-ink-muted">
                  {(d.file_size / 1024 / 1024).toFixed(1)} MB · uploaded{" "}
                  {new Date(d.uploaded_at).toLocaleTimeString("en-CA", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                {d.purged_at ? (
                  <span className="rounded-full bg-pass-soft px-2.5 py-0.5 font-medium text-pass">
                    Deleted{" "}
                    {new Date(d.purged_at).toLocaleTimeString("en-CA", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                ) : (
                  <>
                    <ExpiryCountdown expiresAt={d.expires_at} />
                    {urlById[d.id] && (
                      <a
                        href={urlById[d.id]!}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-line px-3 py-1 font-medium text-ink hover:bg-background"
                      >
                        Open PDF
                      </a>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
          {!docs?.length && (
            <li className="py-3 text-sm text-ink-muted">No documents on this deal.</li>
          )}
        </ul>
      </section>
    </AppShell>
  );
}
