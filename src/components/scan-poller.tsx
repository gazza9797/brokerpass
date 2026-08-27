"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** While a deal is scanning, refresh the page every few seconds. */
export function ScanPoller({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}
