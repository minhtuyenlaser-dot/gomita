import { buildJsonResponse, loadRuntimeState } from "@/lib/backend/runtimeState";
import { checkAndTriggerBackup } from "@/lib/backend/backupService";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Kích hoạt kiểm tra và sao lưu bù trong nền nếu bỏ lỡ mốc giờ hẹn
    void checkAndTriggerBackup();

    const state = await loadRuntimeState();
    return buildJsonResponse(state);
  } catch (error) {
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : "Không đọc được dữ liệu backend."
      },
      500
    );
  }
}
