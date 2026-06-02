import { buildJsonResponse } from "@/lib/backend/runtimeState";
import { getWebPushPublicKey, isWebPushConfigured } from "@/lib/backend/webPush";

export const runtime = "nodejs";

export async function GET() {
  return buildJsonResponse({
    configured: isWebPushConfigured(),
    publicKey: getWebPushPublicKey()
  });
}
