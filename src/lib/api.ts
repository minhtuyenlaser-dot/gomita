const defaultApiBaseUrl = "";

export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_GOMITA_API_BASE_URL?.trim();
  if (configured && configured.length > 0) {
    return configured.replace(/\/+$/, "");
  }
  return defaultApiBaseUrl;
}

export function getApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
