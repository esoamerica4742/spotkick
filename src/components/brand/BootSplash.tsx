"use client";

import { useEffect, useState } from "react";

const BOOT_MS = 2050;

export function BootSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.classList.add("sk-booted");
      setVisible(false);
      return;
    }

    const boot = document.getElementById("sk-boot");
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      root.classList.add("sk-booted");
      window.setTimeout(() => setVisible(false), 480);
    };

    const id = window.setTimeout(done, BOOT_MS);
    const onEnd = (event: AnimationEvent) => {
      if (event.animationName === "sk-boot-veil") done();
    };
    boot?.addEventListener("animationend", onEnd);

    return () => {
      window.clearTimeout(id);
      boot?.removeEventListener("animationend", onEnd);
    };
  }, []);

  if (!visible) return null;

  return (
    <div id="sk-boot" className="sk-boot" role="img" aria-label="Spotkicka">
      <div className="sk-boot-glow" />
      <div className="sk-boot-stage">
        <p className="sk-boot-mark">
          SPOT<span>KICKA</span>
        </p>
        <span className="sk-boot-rule" />
        <span className="sk-boot-rise" />
        <span className="sk-boot-spot" />
      </div>
    </div>
  );
}
