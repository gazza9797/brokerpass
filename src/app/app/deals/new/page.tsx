import { AppShell } from "@/components/app-shell";
import { UploadForm } from "@/components/upload-form";
import { requireUser } from "@/lib/current-user";
import { DOCUMENT_TTL_MINUTES } from "@/lib/deal-types";

export const dynamic = "force-dynamic";

export default async function NewDealPage() {
  const { supabase, user, profile, brokerageName, isAdmin, isActive } = await requireUser();

  // Admins can submit on behalf of any active agent in the brokerage.
  const { data: agents } = isAdmin
    ? await supabase.from("profiles").select("id, full_name, email").eq("status", "active").order("full_name")
    : { data: null };

  return (
    <AppShell profile={profile} brokerageName={brokerageName}>
      <h1 className="text-2xl font-semibold text-ink">Upload a deal</h1>
      <p className="mt-1 text-sm text-ink-muted">
        One deal per upload; add every PDF that belongs to it. Files are checked, then deleted from our
        servers {DOCUMENT_TTL_MINUTES} minutes after upload.
      </p>

      {!isActive ? (
        <p className="mt-6 rounded-md bg-warn-soft p-4 text-sm text-warn">
          Uploads are off until your Broker of Record activates your account.
        </p>
      ) : (
        <UploadForm agents={agents} currentUserId={user.id} />
      )}
    </AppShell>
  );
}
