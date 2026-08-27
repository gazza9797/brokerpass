import Link from "next/link";
import { logout } from "@/app/login/actions";
import { ROLE_LABELS, type Profile } from "@/lib/types";

function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 34 34" fill="none" aria-hidden>
      <rect width="34" height="34" rx="9" fill="#F7F6F2" />
      <path
        d="M11 12.5h8a3.6 3.6 0 0 1 0 7.2h-4v4.3"
        stroke="#0F1B2D"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M13.4 17.1l2.4 2.4 4.8-5.1"
        stroke="#12B76A"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AppShell({
  profile,
  brokerageName,
  children,
}: {
  profile: Profile | null;
  brokerageName: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-ink text-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/app" className="flex items-center gap-2.5 font-heading text-lg font-bold tracking-tight">
              <Mark />
              BrokerPass
            </Link>
            <nav className="flex gap-5 text-sm text-[#9fb0c6]">
              <Link href="/app" className="hover:text-white">
                Deal desk
              </Link>
              <Link href="/app/deals/new" className="hover:text-white">
                New deal
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-5 text-sm">
            <div className="text-right">
              <p className="font-semibold">{brokerageName ?? "No brokerage"}</p>
              <p className="text-xs text-[#9fb0c6]">
                {profile ? ROLE_LABELS[profile.role] : "Pending"}
              </p>
            </div>
            <form action={logout}>
              <button className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
