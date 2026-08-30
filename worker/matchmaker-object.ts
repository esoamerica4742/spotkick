import { DurableObject } from "cloudflare:workers";

/** Kept so the v1 Durable Object migration remains valid after MatchmakingPool replaced it. */
export class MatchmakerDurableObject extends DurableObject<CloudflareEnv> {}
