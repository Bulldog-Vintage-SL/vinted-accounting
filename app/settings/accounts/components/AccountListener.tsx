"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AccountsListener(): null {
  const router = useRouter();

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "ACCOUNT_SYNCED") {
        router.refresh();
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [router]);

  return null;
}
