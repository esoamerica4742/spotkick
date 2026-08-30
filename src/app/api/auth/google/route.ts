import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import {
  createSession,
  createUserWithWallet,
  getUserBySession,
  readSessionId,
  sessionCookieHeader,
} from "@/lib/cf/session";
import { DEFAULT_TEAM_ID } from "@/lib/teams";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return api(async () => {
    const env = await cfEnv();
    const existing = await getUserBySession(env.DB, readSessionId(request));
    if (existing) {
      return Response.json({ user: existing });
    }
    const user = await createUserWithWallet(env.DB, {
      fullName: "Spotkicka Player",
      teamId: DEFAULT_TEAM_ID,
    });
    const sessionId = await createSession(env.DB, user.id);
    return Response.json(
      { user },
      { headers: { "set-cookie": sessionCookieHeader(sessionId) } },
    );
  });
}
