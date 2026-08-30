"use client";

import { MiniJersey } from "@/components/brand/MiniJersey";
import { ScreenState } from "@/components/brand/ScreenState";
import { TeamPicker } from "@/components/lobby/TeamPicker";
import { useAuth } from "@/hooks/useAuth";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { formatPhoneDisplay, initials } from "@/lib/format";
import { readPrefs, writePrefs, type AppPrefs } from "@/lib/prefs";
import { playTick, triggerHaptic, unlockAudio } from "@/lib/soundManager";
import { DEFAULT_TEAM_ID, teamConfig, type TeamId } from "@/lib/teams";
import {
  ChevronRight,
  Download,
  Info,
  LogOut,
  Megaphone,
  MessageCircle,
  Music2,
  Pencil,
  Scale,
  Smartphone,
  Volume2,
  Waypoints,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useState,
} from "react";

const APP_VERSION = "0.1.0";

export function ProfileClient() {
  const router = useRouter();
  const { user, loading: authLoading, signOut, setTeam, setName } = useAuth();
  const { canInstall, install } = useInstallPrompt();
  const [teamId, setTeamId] = useState<TeamId>(DEFAULT_TEAM_ID);
  const [stats, setStats] = useState({ played: 0, won: 0, lost: 0 });
  const [prefs, setPrefs] = useState<AppPrefs>(() => readPrefs());
  const [sheet, setSheet] = useState<
    null | "edit" | "team" | "support" | "tutorial" | "about" | "legal"
  >(null);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameBusy, setNameBusy] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  useEffect(() => {
    if (user?.team_id) setTeamId(user.team_id);
  }, [user?.team_id]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    void fetch("/api/stats", { credentials: "include" })
      .then((response) => response.json())
      .then((data: { stats?: { played: number; won: number; lost: number } }) => {
        if (data.stats) setStats(data.stats);
      })
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    const sync = () => setPrefs(readPrefs());
    window.addEventListener("spotkick-prefs", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("spotkick-prefs", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (authLoading) return <ScreenState loading body="Opening settings." />;
  if (!user) return null;

  const displayName =
    user.full_name === "SpotKick Player" || user.full_name === "Spotkicka Player"
      ? "Player"
      : user.full_name;
  const kit = teamConfig(teamId);
  const phone = formatPhoneDisplay(user.phone_number);

  function patchPrefs(next: Partial<AppPrefs>) {
    unlockAudio();
    const merged = writePrefs(next);
    setPrefs(merged);
    if (next.sfx === true) playTick();
    if (next.haptic === true) triggerHaptic("light");
  }

  async function saveName() {
    setNameError(null);
    setNameBusy(true);
    try {
      await setName(nameDraft);
      setSheet(null);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setNameBusy(false);
    }
  }

  async function shareApp() {
    const url =
      typeof window !== "undefined" ? window.location.origin : "https://spotkick.app";
    const payload = {
      title: "Spotkicka",
      text: "Winner takes 90%. Real opponents. Instant payout.",
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
      await navigator.clipboard.writeText(`${payload.text} ${url}`);
      setShareNote("Link copied");
      window.setTimeout(() => setShareNote(null), 1600);
    } catch {
      setShareNote(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto px-5 pb-6 pt-1">
      <h1 className="text-center text-[1.45rem] font-semibold tracking-[-0.04em] text-white">
        Settings
      </h1>

      <section className="mt-5 flex items-center gap-3.5">
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar_url}
            alt=""
            className="size-16 rounded-full object-cover ring-2 ring-[#e8c547]/35"
          />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-full bg-white/[0.07] text-[17px] font-semibold text-white ring-2 ring-[#e8c547]/35">
            {initials(displayName)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.28rem] font-semibold leading-none tracking-[-0.03em] text-white">
            {displayName}
          </p>
          <p className="mt-1.5 truncate text-[13px] text-white/42">
            {phone || "No phone linked"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNameDraft(displayName === "Player" ? "" : displayName);
            setNameError(null);
            setSheet("edit");
          }}
          className="inline-flex shrink-0 items-center gap-1.5 text-[14px] font-semibold text-[#e8c547]"
        >
          <Pencil className="size-3.5" />
          Edit
        </button>
      </section>

      <section className="mt-5 grid grid-cols-3 rounded-[1.45rem] border border-white/10 bg-white/[0.035] py-3.5">
        {[
          { label: "Played", value: stats.played },
          { label: "Won", value: stats.won },
          { label: "Lost", value: stats.lost },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="font-display tabular text-[1.2rem] leading-none text-white">
              {stat.value}
            </p>
            <p className="mt-1 text-[9px] font-semibold tracking-[0.14em] text-white/35 uppercase">
              {stat.label}
            </p>
          </div>
        ))}
      </section>

      <p className="mt-6 px-1 text-[11px] font-medium text-white/38">General</p>
      <section className="mt-2 overflow-hidden rounded-[1.45rem] border border-white/10 bg-white/[0.035]">
        <Row
          icon={<MiniJersey teamId={teamId} size="sm" showNumber={false} />}
          label="Team"
          hint={kit.short}
          onClick={() => setSheet("team")}
        />
        <Row
          icon={<MessageCircle className="size-5" />}
          label="Chat support"
          onClick={() => setSheet("support")}
        />
        <Row
          icon={<Megaphone className="size-5" />}
          label="Join our socials"
          hint={shareNote ?? undefined}
          onClick={() => void shareApp()}
        />
        <Row
          icon={<Waypoints className="size-5" />}
          label="Game tutorial"
          onClick={() => setSheet("tutorial")}
        />
        <Row
          icon={<Info className="size-5" />}
          label="About us"
          onClick={() => setSheet("about")}
        />
        <Row
          icon={<Scale className="size-5" />}
          label="Legal"
          last={!canInstall}
          onClick={() => setSheet("legal")}
        />
        {canInstall ? (
          <Row
            icon={<Download className="size-5" />}
            label="Install app"
            last
            onClick={() => void install()}
          />
        ) : null}
      </section>

      <p className="mt-6 px-1 text-[11px] font-medium text-white/38">Effects</p>
      <section className="mt-2 overflow-hidden rounded-[1.45rem] border border-white/10 bg-white/[0.035]">
        <ToggleRow
          icon={<Music2 className="size-5" />}
          label="Music"
          on={prefs.music}
          onChange={(on) => patchPrefs({ music: on })}
        />
        <ToggleRow
          icon={<Volume2 className="size-5" />}
          label="Game sound"
          on={prefs.sfx}
          onChange={(on) => patchPrefs({ sfx: on })}
        />
        <ToggleRow
          icon={<Smartphone className="size-5" />}
          label="Vibration"
          on={prefs.haptic}
          last
          onChange={(on) => patchPrefs({ haptic: on })}
        />
      </section>

      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full border border-[#e8c547]/55 bg-[#e8c547]/[0.08] text-[15px] font-semibold tracking-[-0.02em] text-[#e8c547]"
      >
        <LogOut className="size-4" />
        Log Out
      </button>
      <p className="mt-4 text-center text-[12px] text-white/30">
        Version {APP_VERSION} · 18+
      </p>

      {sheet === "edit" ? (
        <Sheet title="Edit profile" kicker="Account" onClose={() => setSheet(null)}>
          <label className="text-[10px] font-semibold tracking-[0.18em] text-[#e8c547]/80 uppercase">
            Name
          </label>
          <input
            value={nameDraft}
            maxLength={24}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="Your name"
            className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-[15px] text-white outline-none placeholder:text-white/30"
          />
          <p className="mt-2 text-[12px] text-white/40">
            {phone ? `Phone ${phone}` : "Phone is linked at sign-in."}
          </p>
          {nameError ? (
            <p className="mt-2 text-[12px] font-semibold text-danger">{nameError}</p>
          ) : null}
          <button
            type="button"
            disabled={nameBusy || nameDraft.trim().length < 2}
            onClick={() => void saveName()}
            className="mt-4 flex h-14 w-full items-center justify-center rounded-full bg-white text-[16px] font-semibold text-black disabled:opacity-40"
          >
            {nameBusy ? "Saving…" : "Save"}
          </button>
        </Sheet>
      ) : null}

      {sheet === "team" ? (
        <Sheet title="Team" kicker="Play" onClose={() => setSheet(null)}>
          <p className="mb-3 text-[13px] text-white/50">{kit.name}</p>
          <TeamPicker
            compact
            selected={teamId}
            onSelect={(next) => {
              setTeamId(next);
              void setTeam(next);
            }}
          />
        </Sheet>
      ) : null}

      {sheet === "support" ? (
        <Sheet title="Chat support" kicker="Help" onClose={() => setSheet(null)}>
          <CopyBlock
            lines={[
              "Cancel an open challenge from Market for an instant escrow refund.",
              "Ghost rooms expire in 3 minutes and return your stake.",
              "Live cashout rails are not on yet. Deposits are test credit.",
            ]}
          />
        </Sheet>
      ) : null}

      {sheet === "tutorial" ? (
        <Sheet title="How to play" kicker="Tutorial" onClose={() => setSheet(null)}>
          <CopyBlock
            lines={[
              "Pick your team and a stake from ₦500–₦50,000.",
              "Open the market or join a live room. Escrow locks both sides.",
              "Three rounds. Timed kick, 10 seconds. Winner takes 90%.",
            ]}
          />
        </Sheet>
      ) : null}

      {sheet === "about" ? (
        <Sheet title="About Spotkicka" kicker="House" onClose={() => setSheet(null)}>
          <CopyBlock
            lines={[
              "P2P penalty shootouts. Real opponents. Instant payout.",
              "Winner takes 90%. The house takes 10%.",
              "Built for Nigeria. 18+ only. Play responsibly.",
            ]}
          />
        </Sheet>
      ) : null}

      {sheet === "legal" ? (
        <Sheet title="Legal" kicker="18+" onClose={() => setSheet(null)}>
          <CopyBlock
            lines={[
              "You must be 18 or older to play.",
              "Stakes are entertainment. Play within your means.",
              "Spotkicka is not affiliated with FIFA, clubs, or leagues named as kits.",
            ]}
          />
        </Sheet>
      ) : null}
    </div>
  );
}

function Row({
  icon,
  label,
  hint,
  last,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  last?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${
        last ? "" : "border-b border-white/[0.06]"
      }`}
    >
      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden text-white/75">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-[15px] font-medium tracking-[-0.02em] text-white">
        {label}
      </span>
      {hint ? (
        <span className="shrink-0 text-[13px] text-white/38">{hint}</span>
      ) : null}
      <ChevronRight className="size-4 shrink-0 text-white/22" />
    </button>
  );
}

function ToggleRow({
  icon,
  label,
  on,
  last,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  on: boolean;
  last?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 ${
        last ? "" : "border-b border-white/[0.06]"
      }`}
    >
      <span className="flex size-9 shrink-0 items-center justify-center text-white/75">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-[15px] font-medium tracking-[-0.02em] text-white">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`relative h-[1.72rem] w-[2.85rem] shrink-0 rounded-full transition-colors ${
          on ? "bg-[#e8c547]" : "bg-white/16"
        }`}
      >
        <span
          className={`absolute top-[0.13rem] size-[1.46rem] rounded-full bg-white shadow-sm transition-[left] duration-200 ${
            on ? "left-[1.22rem]" : "left-[0.13rem]"
          }`}
        />
      </button>
    </div>
  );
}

function Sheet({
  title,
  kicker,
  onClose,
  children,
}: {
  title: string;
  kicker: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/72 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-[1.55rem] border border-white/10 bg-[#0b0d14] px-4 pb-5 pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] text-[#e8c547]/80 uppercase">
              {kicker}
            </p>
            <h2 className="mt-1 text-[1.35rem] font-semibold leading-none tracking-[-0.04em] text-white">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.06]"
          >
            <X className="size-4 text-white/70" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function CopyBlock({ lines }: { lines: string[] }) {
  return (
    <ul className="space-y-3">
      {lines.map((line) => (
        <li key={line} className="text-[14px] leading-relaxed text-white/65">
          {line}
        </li>
      ))}
    </ul>
  );
}
