import { isValidStake, type Zone, ZONES } from "@/lib/constants";

const KEY = "sk_lock_intent";

export type LockIntent = {
  amount: number;
  direction: Zone;
};

export function saveLockIntent(intent: LockIntent) {
  sessionStorage.setItem(KEY, JSON.stringify(intent));
}

export function readLockIntent(): LockIntent | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LockIntent>;
    const amount = Number(parsed.amount);
    const direction = parsed.direction;
    if (!isValidStake(amount)) return null;
    if (!direction || !ZONES.includes(direction)) return null;
    return { amount, direction };
  } catch {
    return null;
  }
}

export function clearLockIntent() {
  sessionStorage.removeItem(KEY);
}
