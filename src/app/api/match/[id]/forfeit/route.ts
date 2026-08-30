import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { forfeitMatchById } from "@/lib/cf/match-api";
import { requireUser } from "@/lib/cf/session";

export const dynamic = "force-dynamic";

export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const { id } = await context.params;
    const env = await cfEnv();
    const user = await requireUser(env.DB, request);
    return forfeitMatchById(env, request, user, id);
  });
}
