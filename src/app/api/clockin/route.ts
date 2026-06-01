import { applyClockIn, buildJsonResponse } from "@/lib/backend/runtimeState";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const state = await applyClockIn(payload);
    return buildJsonResponse({ success: true, db: state });
  } catch (error) {
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : "Lỗi ghi nhận chấm công."
      },
      400
    );
  }
}
