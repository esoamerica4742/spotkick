import { teamConfig, type TeamId } from "@/lib/teams";

export function MiniJersey({
  teamId,
  size = "md",
  showNumber = true,
  className,
}: {
  teamId: TeamId;
  size?: "xs" | "sm" | "md" | "lg";
  showNumber?: boolean;
  className?: string;
}) {
  const team = teamConfig(teamId);
  const body = `linear-gradient(180deg, ${team.primary} 0 64%, ${team.secondary} 64%)`;
  const dim =
    size === "xs"
      ? "h-7 w-[1.35rem]"
      : size === "sm"
        ? "h-10 w-[2.05rem]"
        : size === "lg"
          ? "h-[4.4rem] w-[3.5rem]"
          : "h-[3.35rem] w-[2.7rem]";

  return (
    <span className={`relative block ${dim} ${className ?? "mx-auto"}`} aria-hidden>
      <span
        className="absolute top-[22%] -left-[18%] h-[38%] w-[28%] rounded-l-[4px]"
        style={{ background: team.primary }}
      />
      <span
        className="absolute top-[22%] -right-[18%] h-[38%] w-[28%] rounded-r-[4px]"
        style={{ background: team.primary }}
      />
      <span
        className="relative z-[1] block h-full w-full overflow-hidden rounded-[7px] shadow-[0_8px_18px_rgba(0,0,0,0.45)] ring-1 ring-black/40"
        style={{ background: body }}
      >
        <span
          className="absolute inset-x-[22%] top-0 h-[14%] rounded-b-[3px]"
          style={{ background: team.secondary }}
        />
        {showNumber ? (
          <span
            className={`absolute inset-x-0 top-[42%] text-center font-black leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)] ${
              size === "lg" ? "text-[13px]" : size === "xs" ? "text-[7px]" : "text-[9px]"
            }`}
            style={{ color: "#fff" }}
          >
            9
          </span>
        ) : null}
      </span>
    </span>
  );
}
