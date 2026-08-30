"use client";

import { ZONE_LABELS, type Zone } from "@/lib/constants";
import { motion } from "framer-motion";

const ZONES: Zone[] = ["left", "center", "right"];

export function ZoneSelector({
  role,
  selected,
  locked,
  disabled,
  onSelect,
}: {
  role: "shooter" | "keeper";
  selected: Zone | null;
  locked: boolean;
  disabled: boolean;
  onSelect: (zone: Zone) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-neon/20 bg-[#07140d] p-3">
      <div className="pitch-grid absolute inset-0 opacity-70" />
      <div className="relative">
        <div className="mb-3 text-center text-[10px] font-semibold tracking-[0.14em] text-neon uppercase">
          {role === "shooter" ? "Pick your shot" : "Pick your dive"}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ZONES.map((zone) => {
            const active = selected === zone;
            return (
              <motion.button
                key={zone}
                type="button"
                disabled={disabled || locked}
                whileTap={disabled || locked ? undefined : { scale: 0.96 }}
                onClick={() => onSelect(zone)}
                className={`relative flex h-36 flex-col items-center justify-end rounded-2xl border pb-4 ${
                  active
                    ? "border-neon bg-neon/20 glow-neon"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <GoalNet />
                <span className="mt-2 text-xs font-semibold tracking-[0.12em] uppercase">
                  {ZONE_LABELS[zone]}
                </span>
                {active ? (
                  <span className="mt-1 text-[10px] text-neon">
                    {locked ? "Locked" : "Tap confirmed"}
                  </span>
                ) : null}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GoalNet() {
  return (
    <div className="relative h-24 w-[85%] rounded-t-md border-x-2 border-t-2 border-white/50">
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.25) 1px, transparent 1px)",
          backgroundSize: "8px 8px",
        }}
      />
    </div>
  );
}
