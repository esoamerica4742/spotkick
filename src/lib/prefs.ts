export type AppPrefs = {
  music: boolean;
  sfx: boolean;
  haptic: boolean;
};

const KEY = "spotkick-prefs-v1";
const DEFAULTS: AppPrefs = { music: false, sfx: true, haptic: true };

function parse(raw: string | null): AppPrefs {
  if (!raw) return { ...DEFAULTS };
  try {
    const data = JSON.parse(raw) as Partial<AppPrefs>;
    return {
      music: Boolean(data.music),
      sfx: data.sfx !== false,
      haptic: data.haptic !== false,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function readPrefs(): AppPrefs {
  if (typeof window === "undefined") return { ...DEFAULTS };
  return parse(window.localStorage.getItem(KEY));
}

export function writePrefs(next: Partial<AppPrefs>): AppPrefs {
  const merged = { ...readPrefs(), ...next };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(merged));
    window.dispatchEvent(new Event("spotkick-prefs"));
  }
  return merged;
}

export function sfxEnabled(): boolean {
  return readPrefs().sfx;
}

export function hapticEnabled(): boolean {
  return readPrefs().haptic;
}
