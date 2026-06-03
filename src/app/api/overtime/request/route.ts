import { buildJsonResponse, createOvertimeRequest } from "@/lib/backend/runtimeState";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const requestItem = await createOvertimeRequest(payload);
    return buildJsonResponse({ success: true, request: requestItem });
  } catch (error) {
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : "Không tạo được đăng ký tăng ca."
      },
      400
    );
  }
}
