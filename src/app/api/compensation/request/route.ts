import { buildJsonResponse, createCompensationBatch } from "@/lib/backend/runtimeState";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const requests = await createCompensationBatch(payload);
    return buildJsonResponse({ success: true, requests });
  } catch (error) {
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : "Không tạo được yêu cầu chấm công bù."
      },
      400
    );
  }
}
