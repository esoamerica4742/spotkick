export function formatNaira(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  const digits = Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "-" : ""}₦${digits}`;
}

export function formatPhoneNg(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length >= 13) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `+234${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+234${digits}`;
  }
  return digits ? `+${digits}` : "";
}

export function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("234") ? digits.slice(3) : digits;
  if (local.length < 10) return raw;
  return `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 10)}`;
}

export function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "SK";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
