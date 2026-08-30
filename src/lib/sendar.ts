import "server-only";

import { cfEnv } from "@/lib/cf/context";

const SENDAR_SMS_URL = "https://api.sendar.io/v1/sms";
const DEFAULT_SENDER = "SPOTKICK";
/** Sendar's own example ID. Used until SPOTKICK is approved transactional. */
const FALLBACK_SENDER = "SENDAR";

export type SendSmsInput = {
  to: string;
  message: string;
};

type SmsBindings = {
  SENDAR_API_KEY?: string;
  SENDAR_SENDER_ID?: string;
};

type ValidationItem = {
  loc?: unknown[];
  msg?: string;
};

/** Sendar requires E.164: +234XXXXXXXXXX */
export function toSendarMsisdn(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  let local = digits;
  if (digits.startsWith("234") && digits.length >= 13) local = digits.slice(3);
  else if (digits.startsWith("0") && digits.length === 11) local = digits.slice(1);
  if (local.length !== 10 || !/^[789]/.test(local)) return "";
  return `+234${local}`;
}

function asText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function readErrorMessage(status: number, body: unknown): string {
  if (status === 401) return "Sendar rejected the API key";
  if (!body || typeof body !== "object") {
    return `Sendar SMS failed (${status})`;
  }
  const payload = body as {
    detail?: unknown;
    error?: string;
    message?: string;
    msg?: string;
    errors?: unknown;
  };
  if (Array.isArray(payload.detail)) {
    const lines = payload.detail
      .map((item) => {
        const row = item as ValidationItem;
        const field = Array.isArray(row.loc)
          ? row.loc.filter((part) => part !== "body").join(".")
          : "";
        const msg = asText(row.msg) ?? "";
        return [field, msg].filter(Boolean).join(": ");
      })
      .filter(Boolean);
    if (lines.length) return lines.join("; ");
  }
  const detail =
    asText(payload.detail) ??
    asText(payload.error) ??
    asText(payload.message) ??
    asText(payload.msg);
  if (detail) return detail;
  return `Sendar SMS failed (${status})`;
}

function publicSmsError(raw: string): string {
  const text = raw.toLowerCase();
  if (text.includes("not configured") || text.includes("api key")) {
    return "SMS is not set up. Add SENDAR_API_KEY on the Worker.";
  }
  if (
    text.includes("balance") ||
    text.includes("credit") ||
    text.includes("insufficient") ||
    text.includes("wallet")
  ) {
    return "Sendar wallet is empty. Top up, then send again.";
  }
  if (text.includes("sender")) {
    return "Sendar has no approved transactional sender yet. In Sendar: Senders → add SPOTKICK → type Transactional → upload CAC.";
  }
  const cleaned = raw.replace(/sk_(live|test)_[A-Za-z0-9]+/g, "sk_***").slice(0, 180);
  if (cleaned && !/^sendar sms failed/i.test(cleaned)) return cleaned;
  return "SMS did not go through. Check the number and try again.";
}

function isSenderRejected(status: number, message: string): boolean {
  if (status === 401 || status === 402) return false;
  return /sender/i.test(message);
}

async function postSendar(
  apiKey: string,
  senderId: string,
  to: string,
  message: string,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(SENDAR_SMS_URL, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      to,
      sender_id: senderId,
      message,
    }),
  });
  const raw = await response.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      body = { message: raw.slice(0, 240) };
    }
  }
  return { status: response.status, body };
}

async function sendarCredentials(bindings?: SmsBindings) {
  let cloud: SmsBindings | null = bindings ?? null;
  if (!cloud?.SENDAR_API_KEY) {
    try {
      cloud = (await cfEnv()) as SmsBindings;
    } catch {
      cloud = cloud ?? null;
    }
  }

  const apiKey =
    cloud?.SENDAR_API_KEY?.trim() || process.env.SENDAR_API_KEY?.trim() || "";
  const senderId = (
    cloud?.SENDAR_SENDER_ID?.trim() ||
    process.env.SENDAR_SENDER_ID?.trim() ||
    DEFAULT_SENDER
  )
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 11)
    .toUpperCase();

  return { apiKey, senderId: senderId || DEFAULT_SENDER };
}

export async function sendSms(
  { to, message }: SendSmsInput,
  bindings?: SmsBindings,
): Promise<unknown> {
  const { apiKey, senderId } = await sendarCredentials(bindings);
  if (!apiKey) {
    throw new Error(publicSmsError("SENDAR_API_KEY is not configured"));
  }

  const recipient = toSendarMsisdn(to);
  const text = message.trim();
  if (!recipient) throw new Error("Enter a valid Nigerian number");
  if (!text) throw new Error("Missing SMS message");

  const senders = [...new Set([senderId, FALLBACK_SENDER])];
  let lastStatus = 0;
  let lastBody: unknown = null;

  try {
    for (const from of senders) {
      const { status, body } = await postSendar(apiKey, from, recipient, text);
      lastStatus = status;
      lastBody = body;
      const payload =
        body && typeof body === "object"
          ? (body as { success?: boolean; status?: string; key_type?: string })
          : null;
      if (apiKey.startsWith("sk_test_") || payload?.key_type === "test") {
        throw new Error(
          "Sendar is using a test key. Put the live key (sk_live_…) on the Worker.",
        );
      }
      const accepted = status === 202 || (status >= 200 && status < 300);
      const failed =
        payload?.success === false ||
        payload?.status === "error" ||
        payload?.status === "failed";
      if (accepted && !failed) return body;
      const message = readErrorMessage(status, body);
      if (!isSenderRejected(status, message)) break;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("test key")) throw error;
    throw new Error(
      publicSmsError(
        error instanceof Error
          ? `Sendar SMS network error: ${error.message}`
          : "Sendar SMS network error",
      ),
    );
  }

  throw new Error(publicSmsError(readErrorMessage(lastStatus, lastBody)));
}
