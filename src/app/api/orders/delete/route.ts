import { buildJsonResponse, deleteRuntimeOrder } from "@/lib/backend/runtimeState";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await deleteRuntimeOrder(payload);
    return buildJsonResponse({ success: true, db: result.state, deletedOrder: result.deletedOrder });
  } catch (error) {
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : "Không xóa được đơn hàng."
      },
      400
    );
  }
}
