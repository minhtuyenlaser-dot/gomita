import { buildJsonResponse, updateOwnRuntimeAccount } from "@/lib/backend/runtimeState";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const account = await updateOwnRuntimeAccount(payload);
    return buildJsonResponse({ success: true, account });
  } catch (error) {
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : "Không cập nhật được tài khoản."
      },
      400
    );
  }
}
