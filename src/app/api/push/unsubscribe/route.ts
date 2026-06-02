import { buildJsonResponse, removePushSubscription } from "@/lib/backend/runtimeState";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const endpoint = String(payload?.endpoint || "");
    if (!endpoint) {
      return buildJsonResponse({ error: "Thiếu endpoint." }, 400);
    }

    await removePushSubscription(endpoint);
    return buildJsonResponse({ success: true });
  } catch (error) {
    return buildJsonResponse(
      { error: error instanceof Error ? error.message : "Không hủy được subscription." },
      400
    );
  }
}
