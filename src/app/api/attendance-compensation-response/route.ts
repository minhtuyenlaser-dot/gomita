import { applyAttendanceCompensationResponse, buildJsonResponse } from "@/lib/backend/runtimeState";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await applyAttendanceCompensationResponse(payload);
    return buildJsonResponse({ success: true, locked: result.locked, state: result.state.attendanceCompensationState });
  } catch (error) {
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : "Không xử lý được quyết định bù công."
      },
      400
    );
  }
}
