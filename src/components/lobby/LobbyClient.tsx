"use client";

import { DepositSheet } from "@/components/lobby/DepositSheet";
import { MatchmakingQueue } from "@/components/lobby/MatchmakingQueue";
import { StakeTiers } from "@/components/lobby/StakeTiers";
import { WalletCard } from "@/components/lobby/WalletCard";
import { Logo } from "@/components/brand/Logo";
import { ScreenState } from "@/components/brand/ScreenState";
import { useAuth } from "@/hooks/useAuth";
import { useMatchmaking } from "@/hooks/useMatchmaking";
import { useWallet } from "@/hooks/useWallet";
import { type StakeTier } from "@/lib/constants";
import { DEFAULT_TEAM_ID, teamConfig, type TeamId } from "@/lib/teams";
import { formatNaira, initials } from "@/lib/format";
import { SpotSpinner } from "@/components/brand/SpotSpinner";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TeamPicker } from "@/components/lobby/TeamPicker";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";

export function LobbyClient() {
  const router = useRouter();
  const { user, loading: authLoading, signOut, setTeam } = useAuth();
  const { wallet, deposit } = useWallet();
  const { join, cancel, pending, error, queued, bounty, shareText, waitMs } =
    useMatchmaking();
  const [tier, setTier] = useState<StakeTier | null>(1000);
  const [depositOpen, setDepositOpen] = useState(false);
  const [teamId, setTeamId] = useState<TeamId>(DEFAULT_TEAM_ID);

  useEffect(() => {
    if (user?.team_id) setTeamId(user.team_id);
  }, [user?.team_id]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return <ScreenState loading body="Opening your lobby." />;
  }

  if (!user) {
    return null;
  }

  const kit = teamConfig(teamId);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <Logo size="sm" />
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold ring-1 ring-gold/35">
            {initials(user.full_name)}
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Sign out"
            className="flex size-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10"
          >
            <LogOut className="size-4 text-muted" />
          </button>
        </div>
      </header>

      <p className="mt-6 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
        Welcome back
      </p>
      <h1 className="font-display text-[2.85rem] leading-none">{user.full_name}</h1>

      <div className="mt-5">
        <WalletCard
          balance={wallet.balance}
          ledger={wallet.ledger_balance}
          onDeposit={() => setDepositOpen(true)}
        />
      </div>

      {queued ? (
        <div className="mt-4">
          <MatchmakingQueue
            match={queued}
            bounty={bounty}
            shareText={shareText}
            waitMs={waitMs}
            onCancel={() => void cancel()}
          />
        </div>
      ) : null}

      <div className="mt-7 flex items-end justify-between">
        <h2 className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
          Elite 5
        </h2>
        <p className="text-[11px] text-silver/80">{kit.name}</p>
      </div>
      <div className="mt-3">
        <TeamPicker
          selected={teamId}
          onSelect={(next) => {
            setTeamId(next);
            void setTeam(next);
          }}
        />
      </div>

      <h2 className="mt-7 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
        Stake
      </h2>
      <div className="mt-3">
        <StakeTiers
          selected={tier}
          onSelect={setTier}
          disabled={pending || queued?.status === "waiting"}
        />
      </div>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 bg-gradient-to-t from-oled via-oled/95 to-transparent">
        <InstallAppButton className="mb-2" />
        <button
          type="button"
          disabled={!tier || pending || queued?.status === "waiting"}
          onClick={() => tier && void join(tier, teamId)}
          className="btn-primary relative flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl text-[15px] font-semibold tracking-tight disabled:opacity-40"
        >
          {pending ? (
            <SpotSpinner size="md" />
          ) : tier ? (
            `Lock ${formatNaira(tier)}`
          ) : (
            "Pick a stake"
          )}
        </button>
        <p className="mt-2 text-center text-[10px] font-medium tracking-[0.06em] text-muted">
          Human only · rival kits first · 30s flash bounty
        </p>
      </div>

      <DepositSheet
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        onConfirm={deposit}
      />
    </div>
  );
}
