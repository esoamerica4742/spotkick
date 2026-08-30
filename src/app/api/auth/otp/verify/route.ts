import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import {
  createSession,
  createUserWithWallet,
  hashOtp,
  jsonError,
  sessionCookieHeader,
} from "@/lib/cf/session";
import { DEFAULT_TEAM_ID } from "@/lib/teams";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return api(async () => {
    const body = (await request.json()) as { phone?: string; token?: string };
    const phone = body.phone?.trim();
    const token = body.token?.trim();
    if (!phone || !token || token.length < 6) {
      return jsonError("Invalid code");
    }
    const env = await cfEnv();
    const challenge = await env.DB.prepare(
      `SELECT code_hash, expires_at FROM otp_challenges WHERE phone_number = ?`,
    )
      .bind(phone)
      .first<{ code_hash: string; expires_at: string }>();
    if (!challenge) return jsonError("Code expired. Send a new OTP.");
    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      return jsonError("Code expired. Send a new OTP.");
    }
    const incoming = await hashOtp(token);
    if (incoming !== challenge.code_hash) {
      return jsonError("Invalid code");
    }
    await env.DB.prepare(`DELETE FROM otp_challenges WHERE phone_number = ?`)
      .bind(phone)
      .run();

    const existing = await env.DB.prepare(
      `SELECT id FROM users WHERE phone_number = ?`,
    )
      .bind(phone)
      .first<{ id: string }>();
    const userId =
      existing?.id ??
      (
        await createUserWithWallet(env.DB, {
          fullName: "Spotkicka Player",
          phone,
          teamId: DEFAULT_TEAM_ID,
        })
      ).id;
    if (existing) {
      await env.DB.prepare(
        `UPDATE users SET phone_number = ? WHERE id = ?`,
      )
        .bind(phone, existing.id)
        .run();
    }
    const sessionId = await createSession(env.DB, userId);
    const user = await env.DB.prepare(
      `SELECT id, phone_number, full_name, avatar_url, team_id, created_at
       FROM users WHERE id = ?`,
    )
      .bind(userId)
      .first();
    return Response.json(
      { user },
      { headers: { "set-cookie": sessionCookieHeader(sessionId) } },
    );
  });
}
