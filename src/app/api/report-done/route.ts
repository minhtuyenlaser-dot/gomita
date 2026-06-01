import { applyReportDone, buildJsonResponse } from "@/lib/backend/runtimeState";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const state = await applyReportDone(payload);
    return buildJsonResponse({ success: true, db: state });
  } catch (error) {
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : "Lỗi ghi nhận hoàn thành công việc."
      },
      400
    );
  }
}
