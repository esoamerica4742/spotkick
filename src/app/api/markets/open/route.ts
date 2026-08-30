import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import {
  listOpenMarketRooms,
  type MarketSort,
} from "@/lib/cf/open-markets";
import { requireUser } from "@/lib/cf/session";

export const dynamic = "force-dynamic";

function parseLimit(raw: string | null): number {
  const n = Number(raw ?? 4);
  if (!Number.isInteger(n)) return 4;
  return Math.min(12, Math.max(1, n));
}

function parseSort(raw: string | null): MarketSort {
  return raw === "newest" ? "newest" : "highest";
}

export function GET(request: Request) {
  return api(async () => {
    const env = await cfEnv();
    const user = await requireUser(env.DB, request);
    const url = new URL(request.url);
    const rooms = await listOpenMarketRooms(env, user.id, {
      limit: parseLimit(url.searchParams.get("limit")),
      sort: parseSort(url.searchParams.get("sort")),
    });
    return Response.json({ rooms });
  });
}
