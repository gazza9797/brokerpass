"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { abandonDeal, finishDeal, startDeal } from "@/app/app/deals/new/actions";
import { createClient } from "@/lib/supabase/client";

const MAX_FILES = 10;
const MAX_BYTES = 25 * 1024 * 1024;

type FileState = { file: File; status: "queued" | "uploading" | "done" | "failed"; error?: string };

export function UploadForm({
  agents,
  currentUserId,
}: {
  agents: { id: string; full_name: string; email: string }[] | null;
  currentUserId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState(currentUserId);
  const [files, setFiles] = useState<FileState[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next: FileState[] = [...files];
    for (const f of Array.from(list)) {
      if (next.some((x) => x.file.name === f.name && x.file.size === f.size)) continue;
      if (f.type !== "application/pdf") {
        setError(`${f.name}: only PDF files are accepted.`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        setError(`${f.name} is over 25 MB.`);
        continue;
      }
      next.push({ file: f, status: "queued" });
    }
    setFiles(next.slice(0, MAX_FILES));
    if (next.length > MAX_FILES) setError(`Up to ${MAX_FILES} files per deal.`);
  }

  function remove(i: number) {
    setFiles((s) => s.filter((_, j) => j !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Give the deal a name (the address, any way you like).");
    if (!files.length) return setError("Attach at least one PDF.");
    setBusy(true);

    const started = await startDeal({ name, agentId });
    if (!started.ok) {
      setBusy(false);
      return setError(started.error);
    }

    const supabase = createClient();
    const uploaded: { path: string; name: string; size: number }[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i].file;
      setFiles((s) => s.map((x, j) => (j === i ? { ...x, status: "uploading" } : x)));
      const safe = f.name.replace(/[^\w.\-]+/g, "_").slice(-120);
      const path = `${started.brokerageId}/${started.dealId}/${Date.now()}-${i}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("deal-documents")
        .upload(path, f, { contentType: "application/pdf", upsert: false });
      if (upErr) {
        setFiles((s) => s.map((x, j) => (j === i ? { ...x, status: "failed", error: upErr.message } : x)));
        if (uploaded.length) await supabase.storage.from("deal-documents").remove(uploaded.map((u) => u.path));
        await abandonDeal(started.dealId);
        setBusy(false);
        return setError(`Upload failed for ${f.name}: ${upErr.message}`);
      }
      uploaded.push({ path, name: f.name, size: f.size });
      setFiles((s) => s.map((x, j) => (j === i ? { ...x, status: "done" } : x)));
    }

    const finished = await finishDeal({ dealId: started.dealId, files: uploaded });
    if (!finished.ok) {
      setBusy(false);
      return setError(finished.error);
    }
    router.push(`/app/deals/${started.dealId}`);
  }

  return (
    <form onSubmit={submit} className="mt-8 max-w-xl space-y-5 rounded-lg border border-line bg-surface p-6">
      <label className="block text-sm font-medium text-ink">
        Deal name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={busy}
          placeholder="e.g. 123 Main St, or 'Maytree waiver'"
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-ink"
        />
        <p className="mt-1 text-xs text-ink-muted">
          Just a label for your deal desk. BrokerPass reads the forms to work out what the package is.
        </p>
      </label>

      {agents && (
        <label className="block text-sm font-medium text-ink">
          Submitting for
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            disabled={busy}
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-ink"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name || a.email}
                {a.id === currentUserId ? " (me)" : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-muted">The deal is filed under the agent and logged as submitted by you.</p>
        </label>
      )}

      <label className="block text-sm font-medium text-ink">
        Deal package (PDFs, up to {MAX_FILES} files, 25 MB each)
        <span className="ml-2 inline-block rounded-md border border-line bg-white px-2 py-1 text-xs font-medium text-ink">
          {files.length ? "Add more files" : "Choose files"}
        </span>
        <input
          type="file"
          accept="application/pdf"
          multiple
          disabled={busy}
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
          className="sr-only"
        />
        <p className="mt-1 text-xs text-ink-muted">
          Add every PDF for this deal (APS, schedules, Form 320, deposit receipt…). Pick several at once with Cmd-click, or add them one at a time. They are checked as one package.
        </p>
      </label>

      {files.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line text-sm">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between px-3 py-2">
              <span className="truncate text-ink">{f.file.name}</span>
              <span className="ml-3 flex flex-none items-center gap-3 text-xs text-ink-muted">
                {(f.file.size / 1024 / 1024).toFixed(1)} MB ·{" "}
                {f.status === "queued" && (
                  <button type="button" onClick={() => remove(i)} disabled={busy} className="underline underline-offset-2 hover:text-ink">
                    remove
                  </button>
                )}
                {f.status === "uploading" && <span className="text-ink">uploading…</span>}
                {f.status === "done" && <span className="text-pass">uploaded</span>}
                {f.status === "failed" && <span className="text-critical">failed</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="rounded-md bg-critical-soft p-3 text-sm text-critical">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Uploading…" : "Upload and check"}
      </button>
      <p className="text-xs text-ink-muted">One click is enough. Large PDFs can take a few seconds.</p>
    </form>
  );
}
