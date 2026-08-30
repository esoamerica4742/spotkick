"use client";

import { MiniJersey } from "@/components/brand/MiniJersey";
import { Logo } from "@/components/brand/Logo";
import { ScreenState } from "@/components/brand/ScreenState";
import { TeamPicker } from "@/components/lobby/TeamPicker";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";
import { useAuth } from "@/hooks/useAuth";
import { type FlashBounty, flashBountyClipboard } from "@/lib/bounty";
import { rakeAndPayout } from "@/lib/game/engine";
import { formatNaira } from "@/lib/format";
import { DEFAULT_TEAM_ID, teamConfig, type TeamId } from "@/lib/teams";
import { SpotSpinner } from "@/components/brand/SpotSpinner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function BountyClient({ bountyId }: { bountyId: string }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [bounty, setBounty] = useState<FlashBounty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<TeamId>(DEFAULT_TEAM_ID);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.team_id) setTeamId(user.team_id);
  }, [user?.team_id]);

  useEffect(() => {
    void fetch(`/api/bounty/${bountyId}`, { credentials: "include" })
      .then(async (response) => {
        const data = (await response.json()) as {
          bounty?: FlashBounty;
          error?: string;
        };
        if (!response.ok || !data.bounty) {
          throw new Error(data.error ?? "Bounty not found");
        }
        setBounty(data.bounty);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Bounty not found");
      });
  }, [bountyId]);

  async function claim() {
    if (!user) {
      router.push(`/?next=/bounty/${bountyId}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bounty/${bountyId}/claim`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      const data = (await response.json()) as {
        match?: { id: string };
        error?: string;
      };
      if (!response.ok || !data.match) {
        throw new Error(data.error ?? "Could not claim bounty");
      }
      router.push(`/match/${data.match.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not claim bounty");
    } finally {
      setBusy(false);
    }
  }

  if (!bounty && !error) {
    return <ScreenState loading body="Opening flash bounty." />;
  }

  if (error || !bounty) {
    return <ScreenState title="Bounty gone" body={error ?? "Bounty not found"} />;
  }

  const kit = teamConfig(bounty.team_id);
  const mine = user?.id === bounty.creator_id;
  const open = bounty.status === "open";
  const { payoutAmount } = rakeAndPayout(bounty.stake_amount);
  const share = flashBountyClipboard({
    stake: bounty.stake_amount,
    teamId: bounty.team_id,
    url: bounty.share_url,
  });

  async function copy() {
    await navigator.clipboard.writeText(share);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <Logo size="sm" />
      <p className="mt-8 text-[11px] font-semibold tracking-[0.16em] text-neon uppercase">
        Flash Bounty
      </p>
      <h1 className="font-display mt-2 text-[4.35rem] leading-[0.82]">
        FLASH
        <br />
        <span className="text-neon">BOUNTY</span>
      </h1>
      <p className="mt-3 max-w-[34ch] text-sm font-medium leading-relaxed text-muted">
        {bounty.creator_name} locked {formatNaira(bounty.stake_amount)} as{" "}
        {kit.name}. Winner takes ninety percent.
      </p>

      <div className="glass mt-6 flex items-center gap-4 rounded-[1.4rem] p-4">
        <MiniJersey teamId={bounty.team_id} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">
            Stake in escrow
          </p>
          <p className="font-display tabular text-[2.1rem] leading-none text-silver">
            {formatNaira(bounty.stake_amount)}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Win <span className="font-semibold text-gold">{formatNaira(payoutAmount)}</span>
          </p>
        </div>
      </div>

      {mine ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-silver">
            Waiting on a rival. Drop this in WhatsApp.
          </p>
          <pre className="glass whitespace-pre-wrap rounded-2xl p-4 text-xs leading-relaxed text-silver/90">
            {share}
          </pre>
          <button
            type="button"
            className="btn-primary h-12 w-full rounded-2xl font-bold"
            onClick={() => void copy()}
          >
            {copied ? "Copied" : "Copy challenge"}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {loading ? (
            <SpotSpinner size="md" />
          ) : (
            <>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
                Your kit
              </p>
              <TeamPicker selected={teamId} onSelect={setTeamId} />
              <button
                type="button"
                disabled={!open || busy}
                onClick={() => void claim()}
                className="btn-primary h-14 w-full rounded-2xl text-base font-bold disabled:opacity-40"
              >
                {busy ? (
                  <SpotSpinner className="mx-auto" size="md" />
                ) : open ? (
                  `Accept · ${formatNaira(bounty.stake_amount)}`
                ) : (
                  "Already claimed"
                )}
              </button>
            </>
          )}
        </div>
      )}
      <InstallAppButton className="mt-6" />
          <Link href="/home" className="mt-8 text-center text-sm text-muted">
        Back to home
      </Link>
    </div>
  );
}
