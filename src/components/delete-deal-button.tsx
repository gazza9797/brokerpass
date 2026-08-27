"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteDeal } from "@/app/app/actions";

export function DeleteDealButton({ dealId, name }: { dealId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    start(async () => {
      const r = await deleteDeal(dealId);
      if (!r.ok) {
        setError(r.error ?? "Could not delete.");
        return;
      }
      router.refresh();
    });
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-xs text-ink-muted underline-offset-2 hover:text-critical hover:underline"
      >
        Delete
      </button>
    );
  }
  return (
    <span className="inline-flex flex-col items-end gap-1 text-xs" title={`Delete "${name}"`}>
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className="rounded-md bg-critical px-2 py-1 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button type="button" onClick={() => setArmed(false)} className="text-ink-muted hover:underline">
        Cancel
      </button>
      {error && <span className="max-w-[14rem] text-right text-critical">{error}</span>}
    </span>
  );
}
