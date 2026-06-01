import { buildJsonResponse, loadRuntimeState } from "@/lib/backend/runtimeState";

export const runtime = "nodejs";

export async function GET() {
  try {
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
