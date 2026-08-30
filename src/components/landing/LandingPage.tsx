"use client";

import { GoogleButton } from "@/components/auth/GoogleButton";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
import { LandingMark } from "@/components/brand/LandingMark";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const SPECS = [
  { lead: "Place", rest: "the point" },
  { lead: "Time", rest: "the freeze" },
  { lead: "Dive", rest: "the strike" },
] as const;

export function LandingPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    const play = () => {
      void video.play().catch(() => undefined);
    };
    play();
    video.addEventListener("canplay", play);
    window.addEventListener("pointerdown", play, { once: true });
    return () => {
      video.removeEventListener("canplay", play);
      window.removeEventListener("pointerdown", play);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-10 h-[100dvh] min-h-[100svh] w-screen overflow-hidden bg-oled">
      <video
        ref={videoRef}
        className="absolute left-1/2 top-1/2 h-[112%] w-[112%] max-w-none -translate-x-1/2 -translate-y-[46%] object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/landing/hero-poster.jpg"
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback"
        aria-hidden
      >
        <source src="/landing/hero-loop.mp4" type="video/mp4" />
      </video>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-[24%] bg-gradient-to-b from-black/65 via-black/22 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-black/90 via-black/42 to-transparent" />

      <header className="absolute inset-x-0 top-0 z-20 pt-[max(1.35rem,calc(env(safe-area-inset-top)+0.5rem))]">
        <div className="mx-auto flex w-full max-w-md items-center justify-center px-6">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <LandingMark />
          </motion.div>
        </div>
      </header>

      <div className="absolute inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-md flex-col px-6 pb-[max(2.25rem,calc(env(safe-area-inset-bottom)+1.35rem))]">
        <motion.h1
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: reduceMotion ? 0 : 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-center font-display text-[2.15rem] leading-[0.95] tracking-[-0.035em] text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.85)]"
        >
          From the <span className="text-[#e8c547]">spot</span>.
        </motion.h1>
        <p className="mt-3 text-center text-[13px] font-medium tracking-[0.04em] text-white/70 [text-shadow:0_2px_14px_rgba(0,0,0,0.85)]">
          You hit what you timed. They dive what they see.
        </p>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 grid grid-cols-3"
        >
          {SPECS.map((spec, index) => (
            <div
              key={spec.lead}
              className={`px-2 text-center ${
                index === 1 ? "border-x border-white/18" : ""
              }`}
            >
              <p className="text-[10px] font-semibold tracking-[0.16em] text-[#e8c547] uppercase">
                {spec.lead}
              </p>
              <p className="mt-1 text-[13px] font-medium leading-none tracking-[-0.02em] text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.8)]">
                {spec.rest}
              </p>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: reduceMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 space-y-3"
        >
          {phoneOpen ? null : <GoogleButton />}
          <PhoneOtpForm variant="flush" onOpenChange={setPhoneOpen} />
        </motion.div>

        <p className="mt-4 text-center text-[11px] font-medium tracking-[0.16em] text-white/50 uppercase [text-shadow:0_2px_10px_rgba(0,0,0,0.9)]">
          18+
        </p>
      </div>
    </div>
  );
}
