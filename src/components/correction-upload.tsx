"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addDocuments } from "@/app/app/deals/[id]/actions";
import { createClient } from "@/lib/supabase/client";

const MAX_FILES = 10;
const MAX_BYTES = 25 * 1024 * 1024;

type FileState = { file: File; status: "queued" | "uploading" | "done" | "failed" };

export function CorrectionUpload({
  dealId,
  brokerageId,
  hasLiveFiles,
}: {
  dealId: string;
  brokerageId: string;
  hasLiveFiles: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<FileState[]>([]);
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.some((x) => x.file.name === f.name && x.file.size === f.size)) continue;
      if (f.type !== "application/pdf") { setError(`${f.name}: only PDF files are accepted.`); continue; }
      if (f.size > MAX_BYTES) { setError(`${f.name} is over 25 MB.`); continue; }
      next.push({ file: f, status: "queued" });
    }
    setFiles(next.slice(0, MAX_FILES));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) return setError("Choose at least one PDF.");
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const uploaded: { path: string; name: string; size: number }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i].file;
      setFiles((s) => s.map((x, j) => (j === i ? { ...x, status: "uploading" } : x)));
      const safe = f.name.replace(/[^\w.\-]+/g, "_").slice(-120);
      const path = `${brokerageId}/${dealId}/${Date.now()}-${i}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("deal-documents")
        .upload(path, f, { contentType: "application/pdf", upsert: false });
      if (upErr) {
        setFiles((s) => s.map((x, j) => (j === i ? { ...x, status: "failed" } : x)));
        if (uploaded.length) await supabase.storage.from("deal-documents").remove(uploaded.map((u) => u.path));
        setBusy(false);
        return setError(`Upload failed for ${f.name}: ${upErr.message}`);
      }
      uploaded.push({ path, name: f.name, size: f.size });
      setFiles((s) => s.map((x, j) => (j === i ? { ...x, status: "done" } : x)));
    }
    const r = await addDocuments({ dealId, files: uploaded, replace: replace && hasLiveFiles });
    if (!r.ok) {
      setBusy(false);
      return setError(r.error ?? "Could not record the files.");
    }
    setFiles([]);
    setOpen(false);
    setBusy(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90"
      >
        Upload corrected files
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-md border border-line bg-background p-4">
      <p className="text-sm font-medium text-ink">Upload the corrected package</p>
      <label className="block text-sm text-ink">
        <span className="inline-block cursor-pointer rounded-md border border-line bg-white px-2 py-1 text-xs font-medium">
          {files.length ? "Add more files" : "Choose files"}
        </span>
        <input
          type="file"
          accept="application/pdf"
          multiple
          disabled={busy}
          onChange={(e) => { pick(e.target.files); e.target.value = ""; }}
          className="sr-only"
        />
      </label>
      {files.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line bg-white text-sm">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between px-3 py-1.5">
              <span className="truncate text-ink">{f.file.name}</span>
              <span className="ml-3 text-xs text-ink-muted">
                {f.status === "queued" && (
                  <button type="button" disabled={busy} onClick={() => setFiles((s) => s.filter((_, j) => j !== i))} className="underline">
                    remove
                  </button>
                )}
                {f.status === "uploading" && "uploading…"}
                {f.status === "done" && <span className="text-pass">uploaded</span>}
                {f.status === "failed" && <span className="text-critical">failed</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {hasLiveFiles && (
        <label className="flex items-center gap-2 text-xs text-ink">
          <input type="checkbox" checked={!replace} onChange={(e) => setReplace(!e.target.checked)} disabled={busy} />
          Add to the files already on this deal instead of replacing them
        </label>
      )}
      <p className="text-xs text-ink-muted">
        {replace && hasLiveFiles
          ? "The current files are removed and the corrected set is checked as the new package."
          : "The new files are checked together with the files already on this deal."}
      </p>
      {error && <p className="rounded-md bg-critical-soft p-2 text-xs text-critical">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Uploading…" : "Upload and re-check"}
        </button>
        <button type="button" disabled={busy} onClick={() => { setOpen(false); setFiles([]); setError(null); }} className="text-xs text-ink-muted hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
