import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFile = path.join(rootDir, "src", "gomita_db.json");
const envFile = path.join(rootDir, ".env.local");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(envFile);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.");
}

const snapshot = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const payload = {
  singleton_key: "primary",
  state: {
    ...snapshot,
    schemaVersion: 1
  },
  schema_version: 1,
  updated_at: new Date().toISOString()
};

const { error } = await supabase.from("app_runtime_state").upsert(payload, {
  onConflict: "singleton_key"
});

if (error) {
  throw new Error(`Không import được app_runtime_state: ${error.message}`);
}

console.log("Da import gomita_db.json vao app_runtime_state tren Supabase.");
