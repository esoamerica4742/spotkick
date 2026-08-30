"use client";

import { useAuth } from "@/hooks/useAuth";
import { SpotSpinner } from "@/components/brand/SpotSpinner";
import { useState } from "react";

export function GoogleButton({ className = "" }: { className?: string }) {
  const { signInWithGoogle } = useAuth();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await signInWithGoogle();
        } finally {
          setPending(false);
        }
      }}
      className={`flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white text-[16px] font-semibold tracking-[-0.02em] text-black transition active:scale-[0.98] disabled:opacity-70 ${className}`}
    >
      {pending ? (
        <SpotSpinner size="md" />
      ) : (
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path
            fill="#4285F4"
            d="M23.49 12.27c0-.82-.07-1.64-.22-2.43H12v4.6h6.46a5.52 5.52 0 0 1-2.4 3.63v3h3.88c2.27-2.1 3.55-5.2 3.55-8.8z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.97-1.07 7.96-2.93l-3.88-3c-1.08.74-2.47 1.18-4.08 1.18-3.14 0-5.8-2.12-6.76-4.96H1.24v3.1A12 12 0 0 0 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.24 14.29A7.2 7.2 0 0 1 4.86 12c0-.8.14-1.57.38-2.29V6.61H1.24A12 12 0 0 0 0 12c0 1.94.46 3.77 1.24 5.39l4-3.1z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.45-3.45C17.96 1.14 15.24 0 12 0 7.31 0 3.26 2.69 1.24 6.61l4 3.1C6.2 6.87 8.86 4.75 12 4.75z"
          />
        </svg>
      )}
      Continue with Google
    </button>
  );
}
