import { SESSION_COOKIE } from "../constants";
import { DEFAULT_TEAM_ID, coerceTeamId, type TeamId } from "../teams";
import type { Profile } from "../game/types";

export type SessionUser = Profile;

const SESSION_DAYS = 30;

export function sessionCookieHeader(sessionId: string, maxAgeSec = SESSION_DAYS * 86400) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

export function clearSessionCookieHeader() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function readSessionId(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function hashOtp(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getUserBySession(
  db: D1Database,
  sessionId: string | null,
): Promise<SessionUser | null> {
  if (!sessionId) return null;
  const row = await db
    .prepare(
      `SELECT u.id, u.phone_number, u.full_name, u.avatar_url, u.team_id, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > datetime('now')`,
    )
    .bind(sessionId)
    .first<{
      id: string;
      phone_number: string | null;
      full_name: string;
      avatar_url: string | null;
      team_id: string;
      created_at: string;
    }>();
  if (!row) return null;
  return {
    id: row.id,
    phone_number: row.phone_number,
    full_name: row.full_name,
    avatar_url: row.avatar_url,
    team_id: coerceTeamId(row.team_id),
    created_at: row.created_at,
  };
}

export async function requireUser(
  db: D1Database,
  request: Request,
): Promise<SessionUser> {
  const user = await getUserBySession(db, readSessionId(request));
  if (!user) {
    throw new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return user;
}

export async function createUserWithWallet(
  db: D1Database,
  input: {
    fullName: string;
    phone?: string | null;
    teamId?: TeamId;
    startingBalance?: number;
  },
): Promise<SessionUser> {
  const id = crypto.randomUUID();
  const teamId = input.teamId ?? DEFAULT_TEAM_ID;
  const balance = input.startingBalance ?? 10_000;
  await db.batch([
    db
      .prepare(
        `INSERT INTO users (id, phone_number, full_name, team_id)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(id, input.phone ?? null, input.fullName, teamId),
    db
      .prepare(
        `INSERT INTO wallets (user_id, balance, ledger_balance)
         VALUES (?, ?, 0)`,
      )
      .bind(id, balance),
  ]);
  return {
    id,
    phone_number: input.phone ?? null,
    full_name: input.fullName,
    avatar_url: null,
    team_id: teamId,
    created_at: new Date().toISOString(),
  };
}

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const id = crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  await db
    .prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(id, userId, expires)
    .run();
  return id;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
