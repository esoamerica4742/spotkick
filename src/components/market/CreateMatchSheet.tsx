"use client";

import { TeamPicker } from "@/components/lobby/TeamPicker";
import { isValidStake, STAKE_TIERS } from "@/lib/constants";
import { rakeAndPayout } from "@/lib/game/engine";
import { formatNaira } from "@/lib/format";
import { type TeamId } from "@/lib/teams";
import { SpotSpinner } from "@/components/brand/SpotSpinner";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function CreateMatchSheet({
  open,
  teamId,
  balance,
  pending,
  error,
  initialStake = 1000,
  onTeam,
  onClose,
  onCreate,
}: {
  open: boolean;
  teamId: TeamId;
  balance: number;
  pending: boolean;
  error: string | null;
  initialStake?: number;
  onTeam: (teamId: TeamId) => void;
  onClose: () => void;
  onCreate: (stake: number) => Promise<void>;
}) {
  const [stake, setStake] = useState(initialStake);
  const [custom, setCustom] = useState("");

  useEffect(() => {
    if (!open) return;
    setStake(initialStake);
    setCustom("");
  }, [open, initialStake]);
  const parsedCustom = Number(custom.replace(/\D/g, ""));
  const amount = custom.trim() ? parsedCustom : stake;
  const { payoutAmount } = useMemo(() => rakeAndPayout(amount || 0), [amount]);
  const canCreate = isValidStake(amount) && amount <= balance;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/72 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-[1.55rem] border border-white/10 bg-[#0b0d14] px-4 pb-5 pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] text-[#e8c547]/80 uppercase">
              New
            </p>
            <h2 className="mt-1 text-[1.45rem] font-semibold leading-none tracking-[-0.04em] text-white">
              Create match
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.06]"
          >
            <X className="size-4 text-white/70" />
          </button>
        </div>

        <p className="mt-5 text-[10px] font-semibold tracking-[0.18em] text-[#e8c547]/80 uppercase">
          Team
        </p>
        <div className="mt-2.5">
          <TeamPicker compact selected={teamId} onSelect={onTeam} />
        </div>

        <div className="mt-5 flex items-end justify-between">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-[#e8c547]/80 uppercase">
            Stake
          </p>
          <p className="text-[12px] text-white/45">₦500–50k</p>
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {STAKE_TIERS.map((tier) => {
            const active = !custom && stake === tier;
            return (
              <button
                key={tier}
                type="button"
                onClick={() => {
                  setStake(tier);
                  setCustom("");
                }}
                className={`h-11 rounded-xl text-[11px] font-semibold ${
                  active
                    ? "bg-[#e8c547]/15 text-white ring-1 ring-[#e8c547]/80"
                    : "bg-white/[0.04] text-white/80 ring-1 ring-white/10"
                }`}
              >
                {formatNaira(tier)}
              </button>
            );
          })}
        </div>
        <input
          inputMode="numeric"
          placeholder="Custom amount"
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))}
          className="mt-2.5 h-11 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-[15px] text-white outline-none placeholder:text-white/30"
        />
        <p className="mt-2 text-[12px] text-white/50">
          {isValidStake(amount) ? (
            <>
              Win{" "}
              <span className="font-semibold text-[#e8c547]">
                {formatNaira(payoutAmount)}
              </span>
              {amount > balance ? " · not enough balance" : ""}
            </>
          ) : (
            "₦500–₦50,000 in ₦100 steps"
          )}
        </p>

        {error ? (
          <p className="mt-2 text-[12px] font-semibold text-danger">{error}</p>
        ) : null}

        <button
          type="button"
          disabled={pending || !canCreate}
          onClick={() => void onCreate(amount)}
          className="sk-pill mt-4"
        >
          {pending ? <SpotSpinner size="md" /> : "Post challenge"}
        </button>
      </div>
    </div>
  );
}
