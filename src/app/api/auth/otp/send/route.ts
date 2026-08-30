import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { hashOtp, jsonError } from "@/lib/cf/session";
import { sendSms } from "@/lib/sendar";

export const dynamic = "force-dynamic";

const OTP_RESEND_MS = 45_000;
const OTP_TTL_MS = 10 * 60_000;

function sixDigitOtp() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0]! % 900_000));
}

function sqlNow(msFromNow = 0) {
  return new Date(Date.now() + msFromNow)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
}

export function POST(request: Request) {
  return api(async () => {
    const body = (await request.json()) as { phone?: string };
    const phone = body.phone?.trim();
    if (!phone?.startsWith("+234") || phone.length < 14) {
      return jsonError("Enter a valid Nigerian number");
    }
    const env = await cfEnv();
    const existing = await env.DB.prepare(
      `SELECT expires_at FROM otp_challenges WHERE phone_number = ?`,
    )
      .bind(phone)
      .first<{ expires_at: string }>();
    if (existing?.expires_at) {
      const expires = Date.parse(
        existing.expires_at.includes("T")
          ? existing.expires_at
          : `${existing.expires_at.replace(" ", "T")}Z`,
      );
      const remaining = expires - Date.now();
      if (Number.isFinite(expires) && remaining > OTP_TTL_MS - OTP_RESEND_MS) {
        return jsonError("Wait a few seconds before another code", 429);
      }
    }

    const code = sixDigitOtp();
    try {
      await sendSms(
        {
          to: phone,
          message: `Spotkicka code ${code}. Valid 10 minutes. Do not share. 18+ only.`,
        },
        env,
      );
    } catch (error) {
      return jsonError(
        error instanceof Error ? error.message : "Could not send SMS",
        502,
      );
    }

    const codeHash = await hashOtp(code);
    const expires = sqlNow(OTP_TTL_MS);
    await env.DB.prepare(
      `INSERT INTO otp_challenges (phone_number, code_hash, expires_at)
       VALUES (?, ?, ?)
       ON CONFLICT(phone_number) DO UPDATE SET
         code_hash = excluded.code_hash,
         expires_at = excluded.expires_at`,
    )
      .bind(phone, codeHash, expires)
      .run();

    return Response.json({
      ok: true,
      delivered: true,
      retryAfterSec: Math.ceil(OTP_RESEND_MS / 1000),
    });
  });
}
