export interface Pass {
  ref: string;
  issued_at: string;
  scan_id: string;
  rules_run: number;
}

export function PassCard({
  pass,
  dealId,
  dealName,
  brokerage,
  superseded,
}: {
  pass: Pass;
  dealId: string;
  dealName: string;
  brokerage: string;
  superseded: boolean;
}) {
  const when = new Date(pass.issued_at).toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    dateStyle: "long",
    timeStyle: "short",
  });
  return (
    <section className="mt-6 grid gap-6 rounded-lg border border-line bg-surface p-6 md:grid-cols-[1fr_320px]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-pass">The pass</p>
        <h2 className="mt-1 font-heading text-xl font-bold text-ink">Proof the file was checked.</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Timestamped, tied to the exact package that was scanned, with a reference number for your records.
          Attach it to the deal file when you submit.
        </p>
        {superseded && (
          <p className="mt-3 rounded-md bg-warn-soft p-3 text-xs text-warn">
            This pass was issued for an earlier scan. The latest check has open items, so it no longer
            reflects the current package.
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <a
            href={`/app/deals/${dealId}/pass`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90"
          >
            Download pass (PDF)
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-7 text-center shadow-[0_20px_50px_-20px_rgba(15,27,45,.35)]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-pass-soft">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7" stroke="#12B76A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="mt-4 font-heading text-xl font-bold text-ink">Deal Cleared</p>
        <p className="mt-1 text-sm font-semibold text-ink">{dealName}</p>
        <p className="text-xs text-ink-muted">Checked against RECO · TRESA · OREA</p>
        <div className="my-4 h-px bg-line" />
        <p className="text-xs text-ink-muted">Cleared {when}</p>
        <p className="mt-1 text-[11px] tracking-wide text-ink-muted">
          REF {pass.ref} · {brokerage}
        </p>
      </div>
    </section>
  );
}
