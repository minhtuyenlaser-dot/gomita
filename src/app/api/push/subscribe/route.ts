import { buildJsonResponse, upsertPushSubscription } from "@/lib/backend/runtimeState";
import { isWebPushConfigured } from "@/lib/backend/webPush";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isWebPushConfigured()) {
      return buildJsonResponse({ error: "Web Push chưa được cấu hình." }, 400);
    }

    const payload = await request.json();
    const endpoint = String(payload?.subscription?.endpoint || "");
    const p256dh = String(payload?.subscription?.keys?.p256dh || "");
    const auth = String(payload?.subscription?.keys?.auth || "");
    const userId = String(payload?.userId || "");

    if (!endpoint || !p256dh || !auth || !userId) {
      return buildJsonResponse({ error: "Thiếu dữ liệu subscription." }, 400);
    }

    await upsertPushSubscription({
      userId,
      endpoint,
      keys: { p256dh, auth },
      deviceLabel: typeof payload?.deviceLabel === "string" ? payload.deviceLabel : ""
    });

    return buildJsonResponse({ success: true });
  } catch (error) {
    return buildJsonResponse(
      { error: error instanceof Error ? error.message : "Không lưu được subscription." },
      400
    );
  }
}
