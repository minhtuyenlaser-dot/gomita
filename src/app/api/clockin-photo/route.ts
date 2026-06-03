import { attachAttendancePhoto, buildJsonResponse } from "@/lib/backend/runtimeState";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const attendanceDetail = await attachAttendancePhoto(payload);
    return buildJsonResponse({ success: true, attendanceDetail });
  } catch (error) {
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : "Không tải được ảnh chấm công."
      },
      400
    );
  }
}
