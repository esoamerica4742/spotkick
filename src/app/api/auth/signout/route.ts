import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { clearSessionCookieHeader, readSessionId } from "@/lib/cf/session";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return api(async () => {
    const env = await cfEnv();
    const sessionId = readSessionId(request);
    if (sessionId) {
      await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`)
        .bind(sessionId)
        .run();
    }
    return new Response(null, {
      status: 204,
      headers: { "set-cookie": clearSessionCookieHeader() },
    });
  });
}
