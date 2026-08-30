"use client";

import { MiniJersey } from "@/components/brand/MiniJersey";
import { ELITE_TEAMS, type TeamId } from "@/lib/teams";

export function TeamPicker({
  selected,
  onSelect,
  compact = false,
}: {
  selected: TeamId;
  onSelect: (teamId: TeamId) => void;
  compact?: boolean;
}) {
  return (
    <div className={`grid grid-cols-2 ${compact ? "gap-2" : "gap-3"}`}>
      {Object.values(ELITE_TEAMS).map((team) => {
        const active = selected === team.id;
        return (
          <button
            key={team.id}
            type="button"
            onClick={() => onSelect(team.id)}
            aria-label={team.name}
            className={`min-w-0 rounded-[1.25rem] ${
              compact ? "px-2 pb-2.5 pt-2.5" : "px-3 pb-3.5 pt-3.5"
            } ${
              active
                ? "bg-[#e8c547]/12 ring-1 ring-[#e8c547]/85"
                : "bg-white/[0.04] ring-1 ring-white/10"
            }`}
          >
            <MiniJersey teamId={team.id} size={compact ? "sm" : "md"} />
            <span
              className={`mt-2 block text-center font-semibold tracking-[0.14em] uppercase ${
                compact ? "text-[10px]" : "text-[11px]"
              } ${active ? "text-[#e8c547]" : "text-white/80"}`}
            >
              {team.short}
            </span>
          </button>
        );
      })}
    </div>
  );
}
