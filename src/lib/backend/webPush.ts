import * as webpush from "web-push";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function getWebPushEnv() {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_SUBJECT?.trim();

  if (!publicKey || !privateKey || !subject) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

let configured = false;

function configureWebPush() {
  if (configured) return getWebPushEnv();
  const env = getWebPushEnv();
  if (!env) return null;
  webpush.setVapidDetails(env.subject, env.publicKey, env.privateKey);
  configured = true;
  return env;
}

export function getWebPushPublicKey() {
  return getWebPushEnv()?.publicKey ?? null;
}

export function isWebPushConfigured() {
  return Boolean(getWebPushEnv());
}

export async function sendWebPushNotification(
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  },
  payload: PushPayload
) {
  if (!configureWebPush()) {
    throw new Error("Web Push chưa được cấu hình.");
  }

  return await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: subscription.keys
    },
    JSON.stringify(payload)
  );
}
