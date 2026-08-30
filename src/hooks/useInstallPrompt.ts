"use client";

import { useEffect, useState } from "react";

export type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listening = false;
const subscribers = new Set<() => void>();

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches
  );
}

function emit() {
  for (const notify of subscribers) notify();
}

export function captureInstallPrompt() {
  if (listening || typeof window === "undefined") return;
  listening = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit();
  });
}

export function useInstallPrompt() {
  const [, setVersion] = useState(0);

  useEffect(() => {
    captureInstallPrompt();
    const onChange = () => setVersion((value) => value + 1);
    subscribers.add(onChange);
    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener("change", onChange);
    return () => {
      subscribers.delete(onChange);
      media.removeEventListener("change", onChange);
    };
  }, []);

  const canInstall = Boolean(deferredPrompt) && !isStandalone();

  async function install() {
    const event = deferredPrompt;
    if (!event) return;
    deferredPrompt = null;
    emit();
    await event.prompt();
    await event.userChoice;
  }

  return { canInstall, install };
}
