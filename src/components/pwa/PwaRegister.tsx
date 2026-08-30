"use client";

import { captureInstallPrompt } from "@/hooks/useInstallPrompt";
import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    captureInstallPrompt();
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js");
  }, []);
  return null;
}
