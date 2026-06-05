import { buildJsonResponse, createWarrantyTask } from "@/lib/backend/runtimeState";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await createWarrantyTask(payload);
    return buildJsonResponse({ success: true, task: result.task });
  } catch (error) {
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : "Không tạo được công việc bảo hành."
      },
      400
    );
  }
}
