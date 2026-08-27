import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ExpiryCountdown } from "@/components/expiry-countdown";
import { FindingsReport, type Finding, type ScanSummary } from "@/components/findings-report";
import { PassCard, type Pass } from "@/components/pass-card";
import { ScanPoller } from "@/components/scan-poller";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/current-user";
import { dealTypeLabel } from "@/lib/deal-types";
import { purgeExpiredDocuments } from "@/lib/purge";
import type { DealStatus } from "@/lib/types";
import { recheckDeal } from "./actions";

interface DealDetail {
  id: string;
  deal_type: string;
  property_address: string | null;
  status: DealStatus;
  created_at: string;
  agent_id: string;
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

export const dynamic = "force-dynamic";

export default async function DealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user, profile, brokerageName, isAdmin, isActive } = await requireUser();

  await purgeExpiredDocuments();

  const { data: deal } = await supabase
    .from("deal_overview")
    .select("*")
    .eq("id", id)
    .maybeSingle<DealDetail>();
  if (!deal) notFound();

  const { data: dealMeta } = await supabase
    .from("deals")
    .select("scan_error, last_scanned_at")
    .eq("id", id)
    .maybeSingle<{ scan_error: string | null; last_scanned_at: string | null }>();

  const [{ data: docs }, { data: scans }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, file_name, file_size, storage_path, uploaded_at, expires_at, purged_at")
      .eq("deal_id", id)
      .order("uploaded_at", { ascending: false })
      .returns<Doc[]>(),
    supabase
      .from("scans")
      .select("id, rules_run, passed, warnings, critical, confirms, summary, created_at, ruleset_version")
      .eq("deal_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<(ScanSummary & { id: string })[]>(),
  ]);

  const scan = scans?.[0] ?? null;
  const { data: pass } = await supabase
    .from("passes")
    .select("ref, issued_at, scan_id, rules_run")
    .eq("deal_id", id)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle<Pass>();
  const { data: findings } = scan
    ? await supabase
        .from("findings")
        .select(
          "id, rule_id, rule_version, rule_name, severity, outcome, finding_text, evidence, page, confidence, fix_guidance, confirm_text, confirmed_at, dismissed_at, dismiss_reason",
        )
        .eq("scan_id", scan.id)
        .order("created_at")
        .returns<Finding[]>()
    : { data: [] as Finding[] };

  const liveDocs = (docs ?? []).filter((d) => !d.purged_at);
  const signed = await Promise.all(
    liveDocs.map(async (d) => {
      const { data } = await supabase.storage.from("deal-documents").createSignedUrl(d.storage_path, 300);
      return [d.id, data?.signedUrl ?? null] as const;
    }),
  );
  const urlById = Object.fromEntries(signed);

  const scanning = deal.status === "scanning";
  const canResolve = isActive && (isAdmin || deal.agent_id === user.id);

  return (
    <AppShell profile={profile} brokerageName={brokerageName}>
      <ScanPoller active={scanning} />

      <Link href="/app" className="text-sm text-ink-muted hover:text-ink">
        ← Deal desk
      </Link>

      <div className="mt-3 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{deal.property_address ?? "No address"}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {dealTypeLabel(deal.deal_type)} · {deal.agent_name || deal.agent_email}
            {deal.submitted_by_name && deal.submitted_by_name !== deal.agent_name
              ? ` · submitted by ${deal.submitted_by_name}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isActive && liveDocs.length > 0 && !scanning && (
            <form action={recheckDeal}>
              <input type="hidden" name="deal_id" value={deal.id} />
              <SubmitButton pendingText="Queued…" className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold text-ink hover:bg-white">
                Re-check deal
              </SubmitButton>
            </form>
          )}
          <StatusPill status={deal.status} />
        </div>
      </div>

      {error && <p className="mt-4 rounded-md bg-critical-soft p-3 text-sm text-critical">{error}</p>}

      <section className="mt-8">
        {scanning ? (
          <div className="rounded-lg border border-line bg-surface p-6">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 animate-pulse rounded-full bg-accent" />
              <p className="font-heading text-lg font-bold text-ink">Checking every page…</p>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              Reading the package against {`RECO, TRESA and OREA rules`} plus dates, initials and signatures.
              Usually under a minute. This page refreshes itself.
            </p>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full w-1/3 animate-[scan_1.6s_ease-in-out_infinite] rounded-full bg-accent" />
            </div>
          </div>
        ) : dealMeta?.scan_error ? (
          <div className="rounded-lg border border-line bg-surface p-6">
            <p className="font-heading text-lg font-bold text-critical">The check didn&apos;t complete</p>
            <p className="mt-2 text-sm text-ink">{dealMeta.scan_error}</p>
            {liveDocs.length > 0 && (
              <p className="mt-1 text-sm text-ink-muted">Use Re-check deal to try again.</p>
            )}
          </div>
        ) : scan ? (
          <>
            {pass && deal.status === "cleared" && (
              <PassCard
                pass={pass}
                dealId={deal.id}
                dealName={deal.property_address ?? "Deal"}
                brokerage={brokerageName ?? ""}
                superseded={pass.scan_id !== scan.id}
              />
            )}
            <div className={pass && deal.status === "cleared" ? "mt-6" : ""}>
              <FindingsReport scan={scan} findings={findings ?? []} dealId={deal.id} canResolve={canResolve} />
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-line bg-surface p-6 text-sm text-ink-muted">
            No check has run on this deal yet.
          </div>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-line bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Documents</h2>
          <p className="text-xs text-ink-muted">Files are deleted from our servers 60 minutes after upload. The report stays.</p>
        </div>
        <ul className="mt-3 divide-y divide-line">
          {(docs ?? []).map((d) => (
            <li key={d.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium text-ink">{d.file_name}</p>
                <p className="text-xs text-ink-muted">
                  {(d.file_size / 1024 / 1024).toFixed(1)} MB · uploaded{" "}
                  {new Date(d.uploaded_at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                {d.purged_at ? (
                  <span className="rounded-full bg-pass-soft px-2.5 py-0.5 font-medium text-pass">
                    Deleted {new Date(d.purged_at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
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
          {!docs?.length && <li className="py-3 text-sm text-ink-muted">No documents on this deal.</li>}
        </ul>
      </section>
    </AppShell>
  );
}
