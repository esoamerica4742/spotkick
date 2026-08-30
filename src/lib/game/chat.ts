export const CHAT_MAX_CHARS = 80;
export const CHAT_KEEP = 40;
export const CHAT_GAP_MS = 800;

/** Block links, wallets, and phone drops. This is a pitch line, not WhatsApp. */
export function cleanMatchChat(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length < 1) return null;
  const clipped = text.slice(0, CHAT_MAX_CHARS);
  if (/https?:\/\//i.test(clipped)) return null;
  if (/(?:wa\.me|t\.me|bit\.ly|opay|palmpay)/i.test(clipped)) return null;
  const digits = clipped.replace(/\D/g, "");
  if (digits.length >= 10) return null;
  return clipped;
}
