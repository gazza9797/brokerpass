"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { inviteMember, setMemberRole, setMemberStatus, setMyName } from "@/app/app/team/actions";
import { ROLE_LABELS, type UserRole } from "@/lib/types";

const ROLE_OPTIONS: UserRole[] = ["agent", "compliance_officer", "alternate_bor", "broker_of_record"];

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong.");
      else {
        after?.();
        router.refresh();
      }
    });
  return { pending, error, run };
}

/** Approve a pending member with a role. */
export function ApproveControl({ id, canAssignBor }: { id: string; canAssignBor: boolean }) {
  const [role, setRole] = useState<UserRole>("agent");
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as UserRole)}
        disabled={pending}
        className="rounded-md border border-line bg-white px-2 py-1 text-xs text-ink"
      >
        {ROLE_OPTIONS.filter((r) => canAssignBor || r !== "broker_of_record").map((r) => (
          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const fd = new FormData();
          fd.set("id", id);
          fd.set("role", role);
          run(() => setMemberRole(fd));
        }}
        className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-ink disabled:opacity-60"
      >
        {pending ? "Saving…" : "Approve"}
      </button>
      {error && <span className="text-xs text-critical">{error}</span>}
    </div>
  );
}

/** Change role / deactivate / reactivate an existing member. */
export function MemberControls({
  id,
  role,
  status,
  isSelf,
  canAssignBor,
}: {
  id: string;
  role: UserRole;
  status: "active" | "deactivated";
  isSelf: boolean;
  canAssignBor: boolean;
}) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        value={role}
        disabled={pending || status !== "active"}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("id", id);
          fd.set("role", e.target.value);
          run(() => setMemberRole(fd));
        }}
        className="rounded-md border border-line bg-white px-2 py-1 text-xs text-ink disabled:opacity-60"
      >
        {ROLE_OPTIONS.filter((r) => canAssignBor || r !== "broker_of_record" || r === role).map((r) => (
          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
        ))}
      </select>
      {!isSelf && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const fd = new FormData();
            fd.set("id", id);
            fd.set("status", status === "active" ? "deactivated" : "active");
            run(() => setMemberStatus(fd));
          }}
          className={`rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-60 ${
            status === "active" ? "border-line text-ink-muted hover:text-critical" : "border-line text-pass"
          }`}
        >
          {status === "active" ? "Deactivate" : "Reactivate"}
        </button>
      )}
      {error && <span className="basis-full text-right text-xs text-critical">{error}</span>}
    </div>
  );
}

export function InviteForm({ canAssignBor }: { canAssignBor: boolean }) {
  const { pending, error, run } = useAction();
  const [done, setDone] = useState<string | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const email = String(fd.get("email"));
        run(() => inviteMember(fd), () => {
          setDone(`Invitation sent to ${email}.`);
          form.reset();
        });
      }}
      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]"
    >
      <input name="full_name" placeholder="Full name" className="rounded-md border border-line px-3 py-2 text-sm text-ink" />
      <input name="email" type="email" required placeholder="name@yourbrokerage.com" className="rounded-md border border-line px-3 py-2 text-sm text-ink" />
      <select name="role" defaultValue="agent" className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink">
        {ROLE_OPTIONS.filter((r) => canAssignBor || r !== "broker_of_record").map((r) => (
          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send invite"}
      </button>
      {error && <p className="sm:col-span-4 text-xs text-critical">{error}</p>}
      {done && !error && <p className="sm:col-span-4 text-xs text-pass">{done}</p>}
    </form>
  );
}

/** Small inline prompt for people who have no name on file yet. */
export function NamePrompt() {
  const { pending, error, run } = useAction();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => setMyName(new FormData(e.currentTarget)));
      }}
      className="mt-6 flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface p-4"
    >
      <span className="text-sm text-ink">Add your name so your brokerage knows who you are:</span>
      <input name="full_name" required placeholder="Your full name" className="rounded-md border border-line px-3 py-1.5 text-sm text-ink" />
      <button type="submit" disabled={pending} className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
        {pending ? "Saving…" : "Save"}
      </button>
      {error && <span className="text-xs text-critical">{error}</span>}
    </form>
  );
}
