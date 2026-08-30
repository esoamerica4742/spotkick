import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { jsonError, requireUser } from "@/lib/cf/session";
import { ZONES, type Zone } from "@/lib/constants";
import { milliFromZone, type AimPoint } from "@/lib/game/engine";
import type { MatchView } from "@/lib/game/types";

type MatchStub = {
  submitAim(
    userId: string,
    aim: AimPoint,
    accuracyScore?: number,
    clientTs?: number,
    timeElapsed?: number,
    executionScore?: number,
  ): Promise<void>;
  getView(userId: string): Promise<MatchView | null>;
};

export const dynamic = "force-dynamic";

export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const { id } = await context.params;
    const env = await cfEnv();
    const user = await requireUser(env.DB, request);
    const body = (await request.json()) as {
      zone?: string;
      x?: number;
      y?: number;
      accuracyScore?: number;
      accuracy?: number;
      clientTs?: number;
      timeElapsed?: number;
      executionScore?: number;
    };
    const aim =
      typeof body.x === "number" &&
      Number.isFinite(body.x) &&
      typeof body.y === "number" &&
      Number.isFinite(body.y)
        ? { x: body.x, y: body.y }
        : ZONES.includes(body.zone as Zone)
          ? milliFromZone(body.zone as Zone)
          : null;
    if (!aim) return jsonError("Aim point required");
    const stub = env.MATCH.getByName(id) as unknown as MatchStub;
    await stub.submitAim(
      user.id,
      aim,
      body.executionScore ?? body.accuracyScore ?? body.accuracy,
      body.clientTs,
      body.timeElapsed,
      body.executionScore,
    );
    const view = await stub.getView(user.id);
    return Response.json({ view });
  });
}
