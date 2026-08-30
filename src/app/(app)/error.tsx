"use client";

import { ScreenState } from "@/components/brand/ScreenState";
import { useEffect } from "react";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ScreenState
      title="Glitch"
      body="This screen hit a snag. Try again."
      action={
        <button
          type="button"
          onClick={() => retry()}
          className="btn-primary mt-8 inline-flex h-12 items-center rounded-2xl px-8 text-sm font-bold"
        >
          Try again
        </button>
      }
    />
  );
}
