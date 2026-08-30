import { jsonError } from "@/lib/cf/session";

export async function api(handler: () => Promise<Response>) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError(
      error instanceof Error ? error.message : "Server error",
      500,
    );
  }
}
