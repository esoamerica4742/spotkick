"use client";

import { MiniJersey } from "@/components/brand/MiniJersey";
import { formatNaira, initials } from "@/lib/format";
import { teamConfig, type TeamId } from "@/lib/teams";
import type { MarketRoom } from "@/lib/market";
import { SpotSpinner } from "@/components/brand/SpotSpinner";

function remain(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function MarketCard({
  room,
  busyId,
  onJoin,
}: {
  room: MarketRoom;
  busyId: string | null;
  onJoin: (room: MarketRoom) => void;
}) {
  const kit = teamConfig(room.team_id as TeamId);
  const joining = busyId === room.id;

  return (
    <article className="rounded-[1.45rem] border border-white/10 bg-white/[0.035] px-4 py-3.5">
      <div className="flex items-center gap-3">
        <MiniJersey teamId={room.team_id} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-white">
            {room.creator_name}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-white/45">{kit.short}</p>
        </div>
        {room.creator_avatar ? (
          // External Google avatars sit beside the kit, not as the row identity.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={room.creator_avatar}
            alt=""
            className="size-8 rounded-full object-cover ring-1 ring-white/15"
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-white/70 ring-1 ring-white/10">
            {initials(room.creator_name)}
          </div>
        )}
      </div>

      <div className="mt-3.5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-[#e8c547]/80 uppercase">
            Stake
          </p>
          <p className="mt-1 font-display tabular text-[1.55rem] leading-none text-white">
            {formatNaira(room.stake_amount)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-white/35 uppercase">
            {remain(room.remaining_ms)}
          </p>
          <p className="mt-1 text-[12px] text-white/50">
            Win{" "}
            <span className="font-semibold text-[#e8c547]">
              {formatNaira(room.payout_amount)}
            </span>
          </p>
        </div>
      </div>

      {room.mine ? (
        <p className="mt-3 text-center text-[10px] font-semibold tracking-[0.16em] text-[#e8c547] uppercase">
          Your challenge
        </p>
      ) : (
        <button
          type="button"
          disabled={joining}
          onClick={() => onJoin(room)}
          className="mt-3.5 flex h-12 w-full items-center justify-center rounded-full bg-white text-[15px] font-semibold tracking-[-0.02em] text-black disabled:opacity-40"
        >
          {joining ? <SpotSpinner size="sm" /> : "Join"}
        </button>
      )}
    </article>
  );
}
