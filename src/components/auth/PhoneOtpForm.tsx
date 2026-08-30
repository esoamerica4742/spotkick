"use client";

import { useAuth } from "@/hooks/useAuth";
import { formatPhoneDisplay, formatPhoneNg } from "@/lib/format";
import { SpotSpinner } from "@/components/brand/SpotSpinner";
import { useEffect, useRef, useState } from "react";

const RESEND_SEC = 45;

export function PhoneOtpForm({
  variant = "card",
  onOpenChange,
}: {
  variant?: "card" | "flush";
  onOpenChange?: (open: boolean) => void;
}) {
  const { sendPhoneOtp, verifyPhoneOtp } = useAuth();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const otpField = useRef<HTMLInputElement>(null);
  const flush = variant === "flush";

  function setFormOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
    if (!next) {
      setStep("phone");
      setError(null);
      setOtp("");
      setWait(0);
    }
  }

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  useEffect(() => {
    if (step === "otp") otpField.current?.focus();
  }, [step]);

  async function onSend(resend = false) {
    setError(null);
    setPending(true);
    try {
      const e164 = formatPhoneNg(phone);
      if (!e164.startsWith("+234") || e164.length < 14) {
        throw new Error("Enter a valid Nigerian number");
      }
      const result = await sendPhoneOtp(e164);
      setStep("otp");
      setWait(result.retryAfterSec ?? RESEND_SEC);
      if (!resend) setOtp("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setPending(false);
    }
  }

  async function onVerify(code = otp) {
    const token = code.trim();
    if (token.length < 6 || pending) return;
    setError(null);
    setPending(true);
    try {
      await verifyPhoneOtp(formatPhoneNg(phone), token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
      setOtp("");
      otpField.current?.focus();
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setFormOpen(true)}
        className="flex h-14 w-full items-center justify-center rounded-full border-[1.5px] border-white/70 bg-transparent text-[16px] font-semibold tracking-[-0.02em] text-white transition active:scale-[0.98] hover:bg-white/8"
      >
        Continue with phone
      </button>
    );
  }

  const e164 = formatPhoneNg(phone);

  return (
    <div className={flush ? "space-y-3" : "rounded-[1.5rem] border border-white/14 bg-black/70 p-4 backdrop-blur-xl"}>
      <button
        type="button"
        onClick={() => (step === "otp" ? setStep("phone") : setFormOpen(false))}
        className="block w-full text-center text-[11px] font-medium tracking-[0.16em] text-white/45 uppercase"
      >
        {step === "otp" ? "Change number" : "Back"}
      </button>
      {step === "phone" ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void onSend();
          }}
        >
          <label className="text-[11px] font-semibold tracking-[0.14em] text-white/45 uppercase">
            Nigerian mobile
          </label>
          <div
            className={
              flush
                ? "flex items-center border-b border-white/25 focus-within:border-[#e8c547]"
                : "flex overflow-hidden rounded-xl border border-line bg-oled"
            }
          >
            <span className="flex items-center px-1 pr-3 text-sm font-semibold text-white/40">
              +234
            </span>
            <input
              inputMode="numeric"
              autoComplete="tel"
              placeholder="801 234 5678"
              value={phone}
              autoFocus
              onChange={(e) => setPhone(e.target.value)}
              className="h-12 w-full bg-transparent px-1 text-base text-white outline-none placeholder:text-white/25"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className={
              flush
                ? "flex h-12 w-full items-center justify-center rounded-full bg-[#e8c547] font-semibold text-black"
                : "flex h-12 w-full items-center justify-center rounded-full btn-primary font-semibold"
            }
          >
            {pending ? (
              <SpotSpinner size="md" className={flush ? "sk-spin-ink" : ""} />
            ) : (
              "Send code"
            )}
          </button>
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void onVerify();
          }}
        >
          <label className="text-[11px] font-semibold tracking-[0.14em] text-white/45 uppercase">
            SMS from Sendar
          </label>
          <p className="text-center text-[12px] text-white/55">
            Code sent to {formatPhoneDisplay(e164)}. Look for Spotkicka in Messages, not WhatsApp.
          </p>
          <input
            ref={otpField}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(event) => {
              const next = event.target.value.replace(/\D/g, "").slice(0, 6);
              setOtp(next);
              if (next.length === 6) void onVerify(next);
            }}
            className={
              flush
                ? "h-14 w-full border-b border-white/25 bg-transparent text-center font-display text-3xl tabular text-white outline-none focus:border-[#e8c547]"
                : "h-12 w-full rounded-xl border border-line bg-oled px-4 text-center font-display text-3xl tabular outline-none"
            }
          />
          <button
            type="submit"
            disabled={pending || otp.length < 6}
            className={
              flush
                ? "flex h-12 w-full items-center justify-center rounded-full bg-[#e8c547] font-semibold text-black disabled:opacity-50"
                : "flex h-12 w-full items-center justify-center rounded-full btn-primary font-semibold disabled:opacity-50"
            }
          >
            {pending ? (
              <SpotSpinner size="md" className={flush ? "sk-spin-ink" : ""} />
            ) : (
              "Verify & Play"
            )}
          </button>
          <button
            type="button"
            disabled={pending || wait > 0}
            onClick={() => void onSend(true)}
            className="block w-full text-center text-[11px] font-semibold tracking-[0.12em] text-white/45 uppercase disabled:opacity-40"
          >
            {wait > 0 ? `Resend in ${wait}s` : "Resend SMS"}
          </button>
        </form>
      )}
      {error ? (
        <p className="text-center text-xs text-danger">{error}</p>
      ) : null}
    </div>
  );
}
