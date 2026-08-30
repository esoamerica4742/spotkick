import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { getUserBySession, readSessionId, requireUser } from "@/lib/cf/session";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return api(async () => {
    const env = await cfEnv();
    const user = await getUserBySession(env.DB, readSessionId(request));
    return Response.json({ user });
  });
}

export function PATCH(request: Request) {
  return api(async () => {
    const env = await cfEnv();
    const user = await requireUser(env.DB, request);
    const body = (await request.json().catch(() => ({}))) as { fullName?: string };
    const fullName = (body.fullName ?? "").trim().replace(/\s+/g, " ");
    if (fullName.length < 2 || fullName.length > 24) {
      return Response.json({ error: "Name must be 2–24 characters" }, { status: 400 });
    }
    await env.DB.prepare(`UPDATE users SET full_name = ? WHERE id = ?`)
      .bind(fullName, user.id)
      .run();
    return Response.json({ user: { ...user, full_name: fullName } });
  });
}
