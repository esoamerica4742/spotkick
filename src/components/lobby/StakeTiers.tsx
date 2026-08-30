"use client";

import { STAKE_TIERS, type StakeTier } from "@/lib/constants";
import { formatNaira } from "@/lib/format";
import { rakeAndPayout } from "@/lib/game/engine";

export function StakeTiers({
  selected,
  onSelect,
  disabled,
}: {
  selected: StakeTier | null;
  onSelect: (tier: StakeTier) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {STAKE_TIERS.map((tier) => {
        const { payoutAmount } = rakeAndPayout(tier);
        const active = selected === tier;
        return (
          <button
            key={tier}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(tier)}
            className={`rounded-[1.15rem] p-3.5 text-left transition ${
              active
                ? "bg-neon/10 ring-2 ring-neon"
                : "glass hover:ring-1 hover:ring-white/20"
            }`}
          >
            <p className="text-[9px] font-semibold tracking-[0.12em] text-muted uppercase">
              Stake
            </p>
            <p className="font-display tabular mt-1 text-[2.05rem] leading-none text-silver">
              {formatNaira(tier)}
            </p>
            <p className="mt-2 text-[11px] text-muted">
              Win <span className="font-semibold text-neon">{formatNaira(payoutAmount)}</span>
            </p>
          </button>
        );
      })}
    </div>
  );
}
