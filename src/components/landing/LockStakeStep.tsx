"use client";

import { GoogleButton } from "@/components/auth/GoogleButton";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
import { Logo } from "@/components/brand/Logo";
import { isValidStake, type Zone } from "@/lib/constants";
import { rakeAndPayout } from "@/lib/game/engine";
import { formatNaira } from "@/lib/format";
import { saveLockIntent } from "@/lib/lock-intent";
import Image from "next/image";
import { useMemo, useState } from "react";

const PRESETS = [500, 1_000, 5_000] as const;
const DIRECTIONS: { id: Zone; label: string }[] = [
  { id: "left", label: "LEFT" },
  { id: "center", label: "CENTER" },
  { id: "right", label: "RIGHT" },
];

export function LockStakeStep() {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]>(1_000);
  const [custom, setCustom] = useState("");
  const [direction, setDirection] = useState<Zone | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const amount = custom.trim() ? Number(custom.replace(/\D/g, "")) : preset;
  const { payoutAmount } = useMemo(() => rakeAndPayout(amount || 0), [amount]);
  const ready = isValidStake(amount) && direction !== null;

  function confirm() {
    if (!ready || !direction) return;
    saveLockIntent({ amount, direction });
    setAuthOpen(true);
  }

  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-[#0d1117]">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="/spot-lock.jpg"
          alt="Penalty spot facing a blurred keeper in a floodlit stadium"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d1117]/70 via-[#0d1117]/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-[#0d1117] via-[#0d1117]/85 to-transparent" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between px-5 pt-[max(0.9rem,env(safe-area-inset-top))]">
        <Logo size="sm" />
        <span className="rounded-full border border-white/20 bg-black/45 px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-white/80 uppercase backdrop-blur-md">
          18+
        </span>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-6 pb-36">
        <h1 className="font-display text-[1.85rem] leading-[0.95] text-[#00FF66] drop-shadow-[0_0_24px_rgba(0,255,102,0.45)]">
          STEP 1: LOCK IN YOUR STAKE
        </h1>
        <p className="mt-3 max-w-[34ch] text-[14px] font-medium leading-relaxed text-white">
          Choose your amount and pick your shot direction (Left, Center, Right).
          The suspense builds. Will you go for a 90% payout?
        </p>

        <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-[#0d1117]/70 p-4 backdrop-blur-md">
          <label
            htmlFor="stake-amount"
            className="text-[10px] font-semibold tracking-[0.16em] text-white/55 uppercase"
          >
            Choose your amount
          </label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {PRESETS.map((tier) => {
              const active = !custom && preset === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => {
                    setPreset(tier);
                    setCustom("");
                  }}
                  className={`h-11 rounded-xl text-[12px] font-semibold transition ${
                    active
                      ? "bg-[#00FF66] text-[#0d1117]"
                      : "border border-white/12 bg-black/40 text-white hover:border-white/30"
                  }`}
                >
                  {formatNaira(tier)}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex h-12 items-center rounded-xl border border-white/12 bg-black/50 px-3">
            <span className="text-sm font-semibold text-white/50">₦</span>
            <input
              id="stake-amount"
              inputMode="numeric"
              placeholder="Custom amount"
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))}
              className="h-full w-full bg-transparent px-2 text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>
          <p className="mt-2 text-[11px] text-white/50">
            Winner takes{" "}
            <span className="font-semibold text-[#00FF66]">
              {formatNaira(payoutAmount)}
            </span>
            {" · "}
            10% rake
          </p>

          <p className="mt-4 text-[10px] font-semibold tracking-[0.16em] text-white/55 uppercase">
            Pick direction
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {DIRECTIONS.map((item) => {
              const active = direction === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDirection(item.id)}
                  className={`h-12 rounded-full text-[11px] font-semibold tracking-[0.14em] transition active:scale-95 ${
                    active
                      ? "bg-[#00FF66] text-[#0d1117] shadow-[0_0_18px_rgba(0,255,102,0.35)]"
                      : "border border-white/15 bg-black/40 text-white hover:border-[#00FF66]/50"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/90 to-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-md space-y-2.5">
          {authOpen ? (
            <>
              <p className="text-center text-[12px] text-white/70">
                Sign in to lock {formatNaira(amount)}
                {direction ? ` · ${direction}` : ""}
              </p>
              <GoogleButton />
              <PhoneOtpForm />
              <button
                type="button"
                onClick={() => setAuthOpen(false)}
                className="w-full text-center text-[11px] font-semibold tracking-[0.12em] text-white/45 uppercase"
              >
                Back
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={!ready}
              onClick={confirm}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#00FF66] text-[14px] font-semibold tracking-[0.08em] text-[#0d1117] shadow-[0_0_28px_rgba(0,255,102,0.35)] transition active:scale-[0.985] disabled:opacity-35"
            >
              CONFIRM STAKE & LOCK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
