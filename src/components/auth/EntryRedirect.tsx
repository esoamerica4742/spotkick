"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function EntryRedirect() {
  const router = useRouter();

  useEffect(() => {
    void fetch("/api/me")
      .then((response) => response.json())
      .then((data: { user?: { id?: string } | null }) => {
        if (data.user?.id) router.replace("/home");
      })
      .catch(() => undefined);
  }, [router]);

  return null;
}
