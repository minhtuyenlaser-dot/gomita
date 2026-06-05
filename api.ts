const defaultApiBaseUrl = "https://gomita.onrender.com";

export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_GOMITA_API_BASE_URL?.trim();
  return configured && configured.length > 0 ? configured.replace(/\/+$/, "") : defaultApiBaseUrl;
}

export function getApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
