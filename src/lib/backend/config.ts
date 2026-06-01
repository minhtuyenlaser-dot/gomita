export type PersistentBackendProvider = "supabase";

export type PersistentBackendConfig = {
  provider: PersistentBackendProvider;
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey?: string;
};

function normalizeEnv(value?: string) {
  return value?.trim() ? value.trim() : "";
}

export function getPersistentBackendConfig(): PersistentBackendConfig {
  return {
    provider: "supabase",
    apiBaseUrl: normalizeEnv(process.env.NEXT_PUBLIC_GOMITA_API_BASE_URL),
    supabaseUrl: normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRoleKey: normalizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || undefined
  };
}

export function hasPersistentBackendConfig() {
  const config = getPersistentBackendConfig();
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

export function assertPersistentBackendConfig() {
  const config = getPersistentBackendConfig();
  if (!config.supabaseUrl) {
    throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL.");
  }
  if (!config.supabaseAnonKey) {
    throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return config;
}

export function assertSupabaseServiceRoleKey() {
  const config = assertPersistentBackendConfig();
  if (!config.supabaseServiceRoleKey) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY.");
  }
  return {
    ...config,
    supabaseServiceRoleKey: config.supabaseServiceRoleKey
  };
}
