import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Removes every document whose expires_at has passed: deletes the file from
 * storage, then stamps purged_at on the row. The row stays as the audit
 * record ("a file was uploaded at X and destroyed at Y"); the bytes are gone.
 *
 * Idempotent and cheap, so it is safe to call on every deal-desk load as
 * well as from the cron route.
 */
export async function purgeExpiredDocuments(): Promise<{ purged: number }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { purged: 0 };

  const admin = createAdminClient();
  const { data: expired, error } = await admin
    .from("documents")
    .select("id, storage_path")
    .is("purged_at", null)
    .lt("expires_at", new Date().toISOString())
    .limit(200);

  if (error || !expired?.length) return { purged: 0 };

  const paths = expired.map((d) => d.storage_path);
  const { error: rmError } = await admin.storage
    .from("deal-documents")
    .remove(paths);
  if (rmError) {
    console.error("purge: storage remove failed", rmError.message);
    return { purged: 0 };
  }

  const now = new Date().toISOString();
  await admin
    .from("documents")
    .update({ purged_at: now })
    .in(
      "id",
      expired.map((d) => d.id),
    );

  return { purged: expired.length };
}
