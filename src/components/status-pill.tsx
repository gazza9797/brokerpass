import type { DealStatus } from "@/lib/types";

const STYLES: Record<DealStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-line text-ink-muted" },
  scanning: { label: "Scanning", cls: "bg-line text-ink" },
  needs_attention: { label: "Needs attention", cls: "bg-critical-soft text-critical" },
  cleared: { label: "Cleared", cls: "bg-pass-soft text-pass" },
  submitted: { label: "Submitted", cls: "bg-pass-soft text-pass" },
};

export function StatusPill({ status }: { status: DealStatus }) {
  const s = STYLES[status] ?? STYLES.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
