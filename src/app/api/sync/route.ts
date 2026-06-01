import { applyRuntimePatch, buildJsonResponse } from "@/lib/backend/runtimeState";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const patch = await request.json();
    const state = await applyRuntimePatch(patch);
    return buildJsonResponse({ success: true, db: state });
  } catch (error) {
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : "Dữ liệu JSON không hợp lệ."
      },
      400
    );
  }
}
