import { buildJsonResponse, buildMobileBootstrap } from "@/lib/backend/runtimeState";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId")?.trim();

    if (!userId) {
      return buildJsonResponse({ error: "Thiếu mã nhân sự." }, 400);
    }

    const payload = await buildMobileBootstrap(userId);
    return buildJsonResponse({ success: true, ...payload });
  } catch (error) {
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : "Không tải được dữ liệu di động."
      },
      500
    );
  }
}
