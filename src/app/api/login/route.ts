import { authenticateRuntimeAccount, buildJsonResponse, loadRuntimeState } from "@/lib/backend/runtimeState";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const state = await loadRuntimeState();
    const account = authenticateRuntimeAccount(state, username, password);

    if (!account) {
      return buildJsonResponse({ success: false, error: "Sai tài khoản hoặc mật khẩu!" }, 401);
    }

    return buildJsonResponse({ success: true, account });
  } catch (error) {
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : "Lỗi xử lý yêu cầu."
      },
      400
    );
  }
}
