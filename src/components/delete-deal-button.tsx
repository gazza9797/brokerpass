"use client";

import { useState, useTransition } from "react";
import { deleteDeal } from "@/app/app/actions";

export function DeleteDealButton({ dealId, name }: { dealId: string; name: string }) {
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);

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
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="text-ink-muted">Delete &ldquo;{name}&rdquo;?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => deleteDeal(dealId))}
        className="rounded-md bg-critical px-2 py-1 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "…" : "Yes, delete"}
      </button>
      <button type="button" onClick={() => setArmed(false)} className="text-ink-muted hover:underline">
        Cancel
      </button>
    </span>
  );
}
