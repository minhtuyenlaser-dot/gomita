const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const rootDir = path.resolve(__dirname, "..");
const envFile = path.join(rootDir, ".env.local");

const LOCAL_BACKUP_DIR = "E:\\Product\\7. Go CNC\\PM\\ok\\gomita_backups";
const GDRIVE_BACKUP_DIR = "G:\\My Drive\\Gomita_Backups";
const STATUS_FILE = path.join(LOCAL_BACKUP_DIR, "last_backup_status.json");
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày

// Hàm tải tệp .env.local
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

// Hàm dọn dẹp các tệp cũ hơn 30 ngày
function cleanOldBackups(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return;
    const files = fs.readdirSync(dirPath);
    const now = Date.now();

    for (const file of files) {
      if (file.startsWith("gomita_backup_") && file.endsWith(".json")) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtime.getTime() > THIRTY_DAYS_MS) {
          fs.unlinkSync(filePath);
          console.log(`[Backup] Đã xóa tệp cũ hơn 30 ngày: ${file}`);
        }
      }
    }
  } catch (err) {
    console.error(`[Backup] Lỗi dọn dẹp thư mục ${dirPath}:`, err);
  }
}

// Hàm dọn dẹp ảnh chấm công cũ hơn 60 ngày trên Supabase Storage
async function cleanOldSupabasePhotos(supabase) {
  try {
    console.log("[Backup] Đang kiểm tra dọn dẹp ảnh cũ trên Supabase Storage...");
    const { data: folders, error: folderError } = await supabase.storage
      .from("attendance-photos")
      .list();

    if (folderError) {
      console.error("[Backup] Không liệt kê được thư mục ảnh gốc:", folderError.message);
      return;
    }

    if (!folders || folders.length === 0) return;

    const now = Date.now();
    const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000; // 60 ngày
    const pathsToRemove = [];

    for (const folder of folders) {
      // Bỏ qua nếu không phải là thư mục (không có metadata.id)
      if (folder.metadata && !folder.id) continue;

      const { data: files, error: fileError } = await supabase.storage
        .from("attendance-photos")
        .list(folder.name);

      if (fileError) {
        console.error(`[Backup] Không liệt kê được ảnh trong thư mục ${folder.name}:`, fileError.message);
        continue;
      }

      if (!files) continue;

      for (const file of files) {
        const datePart = file.name.substring(0, 10).replace(/_/g, "-");
        const fileDate = new Date(datePart);
        if (!isNaN(fileDate.getTime())) {
          if (now - fileDate.getTime() > SIXTY_DAYS_MS) {
            pathsToRemove.push(`${folder.name}/${file.name}`);
          }
        }
      }
    }

    if (pathsToRemove.length > 0) {
      console.log(`[Backup] Phát hiện ${pathsToRemove.length} ảnh cũ hơn 2 tháng trên Supabase. Đang xóa...`);
      const batchSize = 100;
      for (let i = 0; i < pathsToRemove.length; i += batchSize) {
        const batch = pathsToRemove.slice(i, i + batchSize);
        const { error: removeError } = await supabase.storage
          .from("attendance-photos")
          .remove(batch);
        if (removeError) {
          console.error("[Backup] Lỗi khi xóa ảnh cũ từ Supabase:", removeError.message);
        } else {
          console.log(`[Backup] Đã xóa thành công ${batch.length} ảnh cũ.`);
        }
      }
    } else {
      console.log("[Backup] Không có ảnh cũ nào cần dọn dẹp trên Supabase.");
    }
  } catch (err) {
    console.error("[Backup] Lỗi dọn dẹp ảnh Supabase:", err.message || err);
  }
}

async function run() {
  console.log("[Backup] Đang kiểm tra và chuẩn bị sao lưu...");
  loadEnvFile(envFile);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[Backup] [LỖI] Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong env.");
    process.exit(1);
  }

  try {
    // 1. Tạo các thư mục nếu chưa có
    if (!fs.existsSync(LOCAL_BACKUP_DIR)) {
      fs.mkdirSync(LOCAL_BACKUP_DIR, { recursive: true });
    }

    let gDriveAvailable = false;
    try {
      if (!fs.existsSync(GDRIVE_BACKUP_DIR)) {
        fs.mkdirSync(GDRIVE_BACKUP_DIR, { recursive: true });
      }
      gDriveAvailable = true;
    } catch (err) {
      console.warn("[Backup] Không truy cập được ổ G: (Google Drive có thể chưa chạy hoặc chưa đăng nhập):", err.message);
    }

    // 2. Kết nối và tải dữ liệu từ Supabase
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data, error } = await supabase
      .from("app_runtime_state")
      .select("state")
      .eq("singleton_key", "primary")
      .single();

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    const stateData = data?.state;
    if (!stateData) {
      throw new Error("Không có dữ liệu trong app_runtime_state.");
    }

    // 3. Định dạng tên tệp
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}_${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(now.getSeconds())}`;
    const fileName = `gomita_backup_${dateStr}.json`;

    const fileContent = JSON.stringify(stateData, null, 2);

    // 4. Lưu vào ổ E: cục bộ
    const localFilePath = path.join(LOCAL_BACKUP_DIR, fileName);
    fs.writeFileSync(localFilePath, fileContent, "utf8");
    console.log(`[Backup] Đã sao lưu cục bộ ổ E: ${localFilePath}`);

    // 5. Lưu vào ổ G: Google Drive
    if (gDriveAvailable) {
      const gDriveFilePath = path.join(GDRIVE_BACKUP_DIR, fileName);
      fs.writeFileSync(gDriveFilePath, fileContent, "utf8");
      console.log(`[Backup] Đã sao lưu đồng bộ lên Google Drive (ổ G:): ${gDriveFilePath}`);
    } else {
      console.warn("[Backup] [CẢNH BÁO] Không thể lưu lên Google Drive (ổ G:). Chỉ lưu cục bộ ở ổ E:.");
    }

    // 6. Dọn dẹp bản sao lưu cũ
    cleanOldBackups(LOCAL_BACKUP_DIR);
    if (gDriveAvailable) {
      cleanOldBackups(GDRIVE_BACKUP_DIR);
    }

    // Dọn dẹp ảnh chấm công cũ hơn 2 tháng trên Supabase Storage
    await cleanOldSupabasePhotos(supabase);

    // 7. Ghi nhận trạng thái thành công
    const status = {
      lastBackupTime: now.toISOString(),
      status: "success"
    };
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), "utf8");
    console.log("[Backup] Đã hoàn thành tiến trình sao lưu thành công.");

  } catch (err) {
    console.error("[Backup] [LỖI] Tiến trình sao lưu thất bại:", err.message || err);
    try {
      const status = {
        lastBackupTime: fs.existsSync(STATUS_FILE)
          ? JSON.parse(fs.readFileSync(STATUS_FILE, "utf8")).lastBackupTime
          : null,
        status: "failed",
        error: err.message || String(err)
      };
      fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), "utf8");
    } catch (_) {}
    process.exit(1);
  }
}

run();
