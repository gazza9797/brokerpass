import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-muted">
        BrokerPass
      </p>
      <h1 className="max-w-2xl text-4xl font-semibold text-ink sm:text-5xl">
        Upload the deal. Get the pass.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-ink-muted">
        Pre-submission compliance checks for Ontario brokerages. RECO, TRESA
        and OREA, before the file hits your compliance department.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Sign in
        </Link>
        <Link
          href="/app"
          className="rounded-md border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink hover:bg-white"
        >
          Deal desk
        </Link>
      </div>
    </main>
  );
}
