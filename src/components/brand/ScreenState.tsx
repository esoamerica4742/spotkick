import { Logo } from "@/components/brand/Logo";
import { SpotSpinner } from "@/components/brand/SpotSpinner";
import Link from "next/link";
import type { ReactNode } from "react";

export function ScreenState({
  title,
  body,
  loading,
  actionHref = "/home",
  actionLabel = "Back to home",
  action,
}: {
  title?: string;
  body?: ReactNode;
  loading?: boolean;
  actionHref?: string;
  actionLabel?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex h-full min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center in-[data-chrome]:min-h-0">
      <span className="in-[data-chrome]:hidden">
        <Logo size="sm" />
      </span>
      {title ? (
        <h1 className="font-display mt-10 text-6xl leading-none text-silver">
          {title}
        </h1>
      ) : null}
      {loading ? (
        <SpotSpinner
          size="lg"
          className={title ? "mt-6" : "mt-10 in-[data-chrome]:mt-0"}
        />
      ) : null}
      {body ? (
        <p className="mt-3 max-w-[30ch] text-sm leading-relaxed text-muted">
          {body}
        </p>
      ) : null}
      {action ??
        (!loading ? (
          <Link
            href={actionHref}
            className="btn-primary mt-8 inline-flex h-12 items-center rounded-2xl px-8 text-sm font-bold"
          >
            {actionLabel}
          </Link>
        ) : null)}
    </div>
  );
}
