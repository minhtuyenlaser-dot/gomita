import { createClient } from "@supabase/supabase-js";
import { assertSupabaseServiceRoleKey } from "@/lib/backend/config";

export function createSupabaseAdminClient() {
  const config = assertSupabaseServiceRoleKey();

  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
