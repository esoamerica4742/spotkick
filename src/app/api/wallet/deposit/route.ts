import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { depositWallet } from "@/lib/cf/db";
import { jsonError, requireUser } from "@/lib/cf/session";
import { DEPOSIT_PRESETS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return api(async () => {
    const env = await cfEnv();
    const user = await requireUser(env.DB, request);
    const body = (await request.json()) as { amount?: number };
    const amount = Number(body.amount);
    if (!DEPOSIT_PRESETS.includes(amount as (typeof DEPOSIT_PRESETS)[number])) {
      return jsonError("Invalid deposit amount");
    }
    const wallet = await depositWallet(env.DB, user.id, amount);
    return Response.json({ wallet });
  });
}
