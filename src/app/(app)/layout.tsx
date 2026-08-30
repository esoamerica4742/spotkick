import { MatchmakingProvider } from "@/hooks/MatchmakingProvider";
import { AppChrome } from "@/components/nav/AppChrome";
import type { ReactNode } from "react";

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <MatchmakingProvider>
      <AppChrome>{children}</AppChrome>
    </MatchmakingProvider>
  );
}
