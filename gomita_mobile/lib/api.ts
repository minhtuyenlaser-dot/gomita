export const defaultServerHost = process.env.EXPO_PUBLIC_GOMITA_API_HOST?.trim() || "gomita.onrender.com";

export function getApiUrl(serverHost: string, path: string) {
  const host = serverHost.trim();
  if (host.startsWith("http://") || host.startsWith("https://")) {
    return `${host}${path}`;
  }

  const protocol = host.includes("render.com") || host.includes("gomita") || !/^[0-9.:]+$/.test(host) ? "https" : "http";
  return `${protocol}://${host}${path}`;
}
