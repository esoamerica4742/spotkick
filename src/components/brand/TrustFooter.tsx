import { ShieldCheck, Users, Landmark } from "lucide-react";

const badges = [
  { icon: ShieldCheck, label: "Escrow locked" },
  { icon: Users, label: "Human 1v1" },
  { icon: Landmark, label: "Instant 90%" },
] as const;

export function TrustFooter() {
  return (
    <footer className="safe-bottom z-20 px-4 pb-3 pt-1">
      <ul className="mx-auto grid max-w-md grid-cols-3 gap-2">
        {badges.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="glass flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-center"
          >
            <Icon className="size-3.5 text-neon" strokeWidth={2.25} />
            <span className="text-[9px] font-semibold tracking-[0.12em] text-muted uppercase">
              {label}
            </span>
          </li>
        ))}
      </ul>
    </footer>
  );
}
