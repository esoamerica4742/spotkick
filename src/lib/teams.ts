export const ELITE_TEAMS = {
  home: {
    id: "home",
    name: "Home",
    short: "Home",
    primary: "#C8102E",
    secondary: "#111111",
  },
  away: {
    id: "away",
    name: "Away",
    short: "Away",
    primary: "#034694",
    secondary: "#FFFFFF",
  },
} as const;

export type TeamId = keyof typeof ELITE_TEAMS;
export type TeamConfig = (typeof ELITE_TEAMS)[TeamId];

export const TEAM_IDS = Object.keys(ELITE_TEAMS) as TeamId[];
export const DEFAULT_TEAM_ID: TeamId = "home";

const LEGACY_TEAMS: Record<string, TeamId> = {
  arsenal: "home",
  manutd: "home",
  barcelona: "home",
  chelsea: "away",
  realmadrid: "away",
};

export function isTeamId(value: string | null | undefined): value is TeamId {
  return value === "home" || value === "away";
}

export function coerceTeamId(value: string | null | undefined): TeamId {
  if (isTeamId(value)) return value;
  if (value && value in LEGACY_TEAMS) return LEGACY_TEAMS[value]!;
  return DEFAULT_TEAM_ID;
}

export function teamConfig(teamId: string | null | undefined): TeamConfig {
  return ELITE_TEAMS[coerceTeamId(teamId)];
}

/** Distinct GK palettes so the keeper never wears the same shirt as the striker. */
export const KEEPER_KITS: Record<TeamId, { primary: string; secondary: string }> = {
  home: { primary: "#7CFF3A", secondary: "#10240C" },
  away: { primary: "#FF4D00", secondary: "#1A0A00" },
};

export function keeperKit(teamId: string | null | undefined): {
  primary: string;
  secondary: string;
} {
  return KEEPER_KITS[coerceTeamId(teamId)];
}

export const STRIKER_BOOTS: Record<
  TeamId,
  { body: string; sole: string; accent: string }
> = {
  home: { body: "#1A0505", sole: "#C8102E", accent: "#FFD36A" },
  away: { body: "#F7FBFF", sole: "#0B1C3A", accent: "#034694" },
};

export const KEEPER_BOOTS = {
  body: "#0C0C0E",
  sole: "#1A1A1E",
  accent: "#C9A227",
} as const;

export function strikerBoots(teamId: string | null | undefined) {
  return STRIKER_BOOTS[coerceTeamId(teamId)];
}

export const RIVAL_TEAMS: Record<TeamId, readonly TeamId[]> = {
  home: ["away"],
  away: ["home"],
};

export function isRivalTeam(a: TeamId, b: TeamId): boolean {
  return a !== b && RIVAL_TEAMS[a].includes(b);
}

export function matchPriority(self: TeamId, other: TeamId): number {
  if (isRivalTeam(self, other)) return 0;
  if (self !== other) return 1;
  return 2;
}
