import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ApproveControl, InviteForm, MemberControls } from "@/components/team-controls";
import { requireUser } from "@/lib/current-user";
import { ROLE_LABELS, type UserRole, type UserStatus } from "@/lib/types";

interface Member {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  invited_at: string | null;
  approved_at: string | null;
}

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { supabase, user, profile, brokerageName, isAdmin, isActive } = await requireUser();
  if (!isAdmin || !isActive) redirect("/app");

  const canManage = profile!.role === "broker_of_record" || profile!.role === "alternate_bor";
  const canAssignBor = profile!.role === "broker_of_record";

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, created_at, invited_at, approved_at")
    .order("created_at")
    .returns<Member[]>();

  const all = members ?? [];
  const pending = all.filter((m) => m.status === "pending");
  const active = all.filter((m) => m.status === "active");
  const deactivated = all.filter((m) => m.status === "deactivated");

  return (
    <AppShell profile={profile} brokerageName={brokerageName}>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Team &amp; roles</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {canManage
              ? "Approve sign-ups, set roles, and invite people to the brokerage."
              : "Who has access to the deal desk. Only the Broker of Record or Alternate can make changes."}
          </p>
        </div>
      </div>

      {canManage && (
        <section className="mt-6 rounded-lg border border-line bg-surface p-5">
          <h2 className="text-base font-semibold text-ink">Invite someone</h2>
          <p className="mb-3 mt-1 text-xs text-ink-muted">
            They get an email from hello@brokerpass.ca and land in the deal desk already approved with this role.
          </p>
          <InviteForm canAssignBor={canAssignBor} />
        </section>
      )}

      {pending.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-heading text-base font-bold text-warn">
            Waiting for approval <span className="ml-1 rounded-full bg-warn-soft px-2 py-0.5 text-xs">{pending.length}</span>
          </h2>
          <div className="divide-y divide-line rounded-lg border border-line bg-surface">
            {pending.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-ink">{m.full_name || m.email}</p>
                  <p className="text-xs text-ink-muted">
                    {m.email} · signed up {new Date(m.created_at).toLocaleDateString("en-CA", { timeZone: "America/Toronto" })}
                  </p>
                </div>
                {canManage ? <ApproveControl id={m.id} canAssignBor={canAssignBor} /> : <span className="text-xs text-ink-muted">Pending</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 font-heading text-base font-bold text-ink">
          Active <span className="ml-1 rounded-full bg-line px-2 py-0.5 text-xs">{active.length}</span>
        </h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {active.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">
                    {m.full_name || <span className="text-ink-muted">No name yet</span>}
                    {m.id === user.id && <span className="ml-2 text-xs text-ink-muted">(you)</span>}
                  </td>
                  <td className="max-w-[14rem] truncate px-4 py-3 text-ink-muted" title={m.email}>{m.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {canManage ? (
                      <MemberControls id={m.id} role={m.role} status="active" isSelf={m.id === user.id} canAssignBor={canAssignBor} />
                    ) : (
                      ROLE_LABELS[m.role]
                    )}
                  </td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {deactivated.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-heading text-base font-bold text-ink-muted">
            Deactivated <span className="ml-1 rounded-full bg-line px-2 py-0.5 text-xs">{deactivated.length}</span>
          </h2>
          <p className="mb-2 text-xs text-ink-muted">Their deals stay in the compliance record. They cannot sign in.</p>
          <div className="divide-y divide-line rounded-lg border border-line bg-surface">
            {deactivated.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-ink">{m.full_name || m.email}</p>
                  <p className="text-xs text-ink-muted">{m.email} · {ROLE_LABELS[m.role]}</p>
                </div>
                {canManage && <MemberControls id={m.id} role={m.role} status="deactivated" isSelf={false} canAssignBor={canAssignBor} />}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 rounded-lg border border-line bg-surface p-4 text-xs text-ink-muted">
        <p className="font-semibold text-ink">Who can do what</p>
        <p className="mt-1">Broker of Record: everything, including billing and assigning another Broker of Record. Alternate BOR: review, clear, attest, manage users. Compliance Officer: review, clear, send back; no user management, no attestation. Agent: own deals only.</p>
      </div>
    </AppShell>
  );
}
