import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { joinMatch } from "@/lib/cf/match-api";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return api(async () => {
    const env = await cfEnv();
    return joinMatch(request, env);
  });
}
