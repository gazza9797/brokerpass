"use client";

import { useEffect, useState } from "react";

/** Live "deleted in 43 min" countdown for a document's expires_at. */
export function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) {
    return <span className="text-ink-muted">Deleting…</span>;
  }
  const mins = Math.ceil(ms / 60_000);
  return (
    <span className={mins <= 10 ? "text-warn" : "text-ink-muted"}>
      Auto-deletes in {mins} min
    </span>
  );
}
