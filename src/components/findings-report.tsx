import { confirmFinding, dismissFinding, reopenFinding } from "@/app/app/deals/[id]/actions";
import { SubmitButton } from "@/components/submit-button";
import { getRule } from "@/lib/rules";

export interface Finding {
  id: string;
  rule_id: string;
  rule_version: string | number;
  rule_name: string;
  severity: "critical" | "warning" | "confirm";
  outcome: "passed" | "warning" | "critical" | "confirm";
  finding_text: string | null;
  evidence: string | null;
  page: number | null;
  confidence: string | null;
  fix_guidance: string | null;
  confirm_text: string | null;
  confirmed_at: string | null;
  dismissed_at: string | null;
  dismiss_reason: string | null;
}

export interface ScanSummary {
  rules_run: number;
  passed: number;
  warnings: number;
  critical: number;
  confirms: number;
  summary: string | null;
  created_at: string;
  ruleset_version: string;
}

export function FindingsReport({
  scan,
  findings,
  dealId,
  canResolve,
}: {
  scan: ScanSummary;
  findings: Finding[];
  dealId: string;
  canResolve: boolean;
}) {
  const critical = findings.filter((f) => f.outcome === "critical");
  const warnings = findings.filter((f) => f.outcome === "warning");
  const confirms = findings.filter((f) => f.outcome === "confirm");
  const openConfirms = confirms.filter((f) => !f.confirmed_at && !f.dismissed_at);
  const passed = findings.filter((f) => f.outcome === "passed");
  const cleared = critical.length === 0 && warnings.length === 0 && openConfirms.length === 0;

  return (
    <div>
      {/* Header strip */}
      <div className={`rounded-lg p-5 ${cleared ? "bg-pass-soft" : "bg-ink text-white"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${cleared ? "text-pass" : "text-[#9fb0c6]"}`}>
              Compliance report
            </p>
            <p className={`mt-1 font-heading text-xl font-bold ${cleared ? "text-pass" : ""}`}>
              {cleared
                ? "Deal cleared. Ready to submit."
                : `${critical.length + warnings.length + openConfirms.length} item${critical.length + warnings.length + openConfirms.length === 1 ? "" : "s"} before clear`}
            </p>
          </div>
          <Badge cleared={cleared} critical={critical.length} warnings={warnings.length} confirms={openConfirms.length} />
        </div>
        <p className={`mt-3 text-sm ${cleared ? "text-ink" : "text-[#c9d3e0]"}`}>
          {scan.rules_run} rules run · {scan.passed} passed · {scan.warnings} warnings · {scan.critical} critical ·{" "}
          {scan.confirms} require confirmation
        </p>
        {scan.summary && (
          <p className={`mt-2 text-sm ${cleared ? "text-ink-muted" : "text-[#c9d3e0]"}`}>{scan.summary}</p>
        )}
      </div>

      {critical.length > 0 && (
        <Group title="Critical" subtitle="Stop. Fix these before submitting." tone="critical">
          {critical.map((f) => <FindingRow key={f.id} f={f} tone="critical" />)}
        </Group>
      )}

      {warnings.length > 0 && (
        <Group title="Needs attention" subtitle="Fix, or your compliance department will send it back." tone="attention">
          {warnings.map((f) => <FindingRow key={f.id} f={f} tone="attention" />)}
        </Group>
      )}

      {confirms.length > 0 && (
        <Group
          title="Confirm"
          subtitle="These can't be read from the documents. Attest to each, or dismiss with a reason. Every action is logged."
          tone="warn"
        >
          {confirms.map((f) => (
            <ConfirmRow key={f.id} f={f} dealId={dealId} canResolve={canResolve} />
          ))}
        </Group>
      )}

      {passed.length > 0 && (
        <details className="mt-6 rounded-lg border border-line bg-surface">
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-ink">
            {passed.length} checks passed
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {passed.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-ink">✓</span>
                <span className="text-ink">{f.rule_name}</span>
                <span className="ml-auto font-mono text-xs text-ink-muted">{f.rule_id}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-4 text-xs text-ink-muted">
        Ruleset {scan.ruleset_version} · scanned{" "}
        {new Date(scan.created_at).toLocaleString("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" })} · BrokerPass
        is a compliance aid, not legal advice. Your Broker of Record makes the call.
      </p>
    </div>
  );
}

function Badge({ cleared, critical, warnings, confirms }: { cleared: boolean; critical: number; warnings: number; confirms: number }) {
  if (cleared) {
    return (
      <span className="rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-accent-ink">✓ Cleared</span>
    );
  }
  const bits = [
    critical && `${critical} critical`,
    warnings && `${warnings} warning${warnings === 1 ? "" : "s"}`,
    confirms && `${confirms} to confirm`,
  ].filter(Boolean);
  return (
    <span className={`rounded-full px-4 py-1.5 text-sm font-bold ${critical || warnings ? "bg-[#c43d3d] text-white" : "bg-[#F5A623] text-[#3d2a05]"}`}>
      {bits.join(" · ")}
    </span>
  );
}

function Group({ title, subtitle, tone, children }: { title: string; subtitle: string; tone: "critical" | "attention" | "warn"; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline gap-3">
        <h3 className={`font-heading text-base font-bold ${tone === "warn" ? "text-warn" : "text-critical"}`}>{title}</h3>
        <p className="text-xs text-ink-muted">{subtitle}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function FindingRow({ f, tone }: { f: Finding; tone: "critical" | "attention" }) {
  const rule = getRule(f.rule_id);
  return (
    <article className={`rounded-xl p-4 ${tone === "critical" ? "border-2 border-critical bg-critical-soft" : "bg-critical-soft"}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-critical text-xs font-bold text-white">
          !
        </span>
        <div className="flex-1">
          <p className="font-semibold text-ink">{f.rule_name}</p>
          {f.finding_text && <p className="mt-1 text-sm text-ink">{f.finding_text}</p>}
          {f.evidence && (
            <p className="mt-1 text-sm italic text-ink-muted">
              {f.page ? `Page ${f.page}: ` : ""}
              {f.evidence}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-line bg-surface px-2 py-1 font-mono text-[11px] font-semibold text-ink">{f.rule_id}</span>
            {rule?.category_name && (
              <span className="rounded-md border border-line bg-surface px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink">
                {rule.category_name}
              </span>
            )}
            {f.confidence && <span className="text-[11px] font-medium text-ink-muted">{f.confidence} confidence</span>}
            <Explain f={f} />
          </div>
        </div>
      </div>
    </article>
  );
}

function ConfirmRow({ f, dealId, canResolve }: { f: Finding; dealId: string; canResolve: boolean }) {
  const resolved = !!(f.confirmed_at || f.dismissed_at);
  return (
    <article className={`rounded-xl p-4 ${resolved ? "bg-surface border border-line" : "bg-warn-soft"}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full text-xs font-bold ${resolved ? "bg-accent text-accent-ink" : "border-2 border-[#F5A623] bg-surface"}`}>
          {resolved ? "✓" : ""}
        </span>
        <div className="flex-1">
          <p className="font-semibold text-ink">{f.rule_name}</p>
          <p className="mt-1 text-sm text-ink">{f.confirm_text}</p>
          {f.evidence && <p className="mt-1 text-sm italic text-ink-muted">{f.evidence}</p>}

          {resolved ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
              {f.confirmed_at
                ? `Confirmed ${new Date(f.confirmed_at).toLocaleString("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" })}`
                : `Dismissed: "${f.dismiss_reason}"`}
              {canResolve && (
                <form action={reopenFinding}>
                  <input type="hidden" name="finding_id" value={f.id} />
                  <input type="hidden" name="deal_id" value={dealId} />
                  <button className="underline underline-offset-2 hover:text-ink">Undo</button>
                </form>
              )}
            </div>
          ) : canResolve ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <form action={confirmFinding}>
                <input type="hidden" name="finding_id" value={f.id} />
                <input type="hidden" name="deal_id" value={dealId} />
                <SubmitButton pendingText="Saving…" className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                  I confirm
                </SubmitButton>
              </form>
              <details className="group">
                <summary className="cursor-pointer rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink">
                  Doesn&apos;t apply
                </summary>
                <form action={dismissFinding} className="mt-2 flex gap-2">
                  <input type="hidden" name="finding_id" value={f.id} />
                  <input type="hidden" name="deal_id" value={dealId} />
                  <input
                    name="reason"
                    required
                    minLength={5}
                    placeholder="Why it doesn't apply (logged)"
                    className="w-72 rounded-md border border-line px-2 py-1.5 text-xs text-ink"
                  />
                  <SubmitButton pendingText="…" className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink">
                    Dismiss
                  </SubmitButton>
                </form>
              </details>
              <Explain f={f} />
            </div>
          ) : (
            <p className="mt-3 text-xs text-ink-muted">Waiting for the agent to confirm.</p>
          )}
        </div>
      </div>
    </article>
  );
}

function Explain({ f }: { f: Finding }) {
  const rule = getRule(f.rule_id);
  if (!rule) return null;
  return (
    <details className="w-full">
      <summary className="cursor-pointer text-xs font-semibold text-ink underline-offset-2 hover:underline">
        Explain this finding
      </summary>
      <div className="mt-2 space-y-2 rounded-md border border-line bg-surface p-3 text-xs text-ink">
        <p>
          <span className="font-semibold">The rule: </span>
          {rule.requirement}
        </p>
        {rule.fix_guidance && (
          <p>
            <span className="font-semibold">How to fix: </span>
            {rule.fix_guidance}
          </p>
        )}
        <p className="text-ink-muted">
          <span className="font-semibold">Source: </span>
          {rule.source}
          {rule.pinpoint && rule.pinpoint !== "n/a" ? ` · ${rule.pinpoint}` : ""}
        </p>
      </div>
    </details>
  );
}
