import { SubmitButton } from "@/components/submit-button";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; next?: string }>;
}) {
  const { error, sent, next } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-ink">Sign in to BrokerPass</h1>
        <p className="mt-1 text-sm text-ink-muted">
          We&apos;ll email you a one-time sign-in link.
        </p>

        {sent ? (
          <p className="mt-6 rounded-md bg-pass-soft p-3 text-sm text-pass">
            Check your inbox. The link expires in 1 hour.
          </p>
        ) : (
          <form action={login} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={next ?? "/app"} />
            <label className="block text-sm font-medium text-ink">
              Work email
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-md border border-line px-3 py-2 text-ink outline-none focus:border-ink"
                placeholder="you@yourbrokerage.com"
              />
            </label>
            {error && (
              <p className="rounded-md bg-critical-soft p-3 text-sm text-critical">
                {error}
              </p>
            )}
            <SubmitButton
              pendingText="Sending…"
              className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90"
            >
              Send sign-in link
            </SubmitButton>
          </form>
        )}
      </div>
    </main>
  );
}
