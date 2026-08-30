import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function cf() {
  return getCloudflareContext({ async: true });
}

export async function cfEnv() {
  const { env } = await cf();
  if (!env.DB || !env.MATCH || !env.MATCHMAKER) {
    throw new Error("Cloudflare bindings are not available");
  }
  return env;
}
