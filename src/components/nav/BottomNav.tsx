"use client";

import { House, Settings, Swords, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/home", label: "Home", icon: House },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/profile", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="relative z-50 w-full shrink-0 border-t border-white/[0.07] bg-oled">
      <ul className="grid grid-cols-4 pt-2.5 pb-[max(0.7rem,env(safe-area-inset-bottom))]">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`relative flex flex-col items-center gap-1 py-1 transition-all duration-200 active:scale-95 ${
                  active ? "text-[#e8c547]" : "text-white/38"
                }`}
              >
                {active ? (
                  <span className="absolute top-0 h-px w-8 bg-[#e8c547]" />
                ) : null}
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.7} />
                <span className="text-[11px] font-semibold tracking-[0.12em] uppercase">
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
