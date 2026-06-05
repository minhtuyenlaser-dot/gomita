import fs from "fs";
import path from "path";
import { createSupabaseAdminClient } from "./supabaseAdmin";

const LOCAL_BACKUP_DIR = "E:\\Product\\7. Go CNC\\PM\\ok\\gomita_backups";
const GDRIVE_BACKUP_DIR = "G:\\My Drive\\Gomita_Backups";
const STATUS_FILE = path.join(LOCAL_BACKUP_DIR, "last_backup_status.json");
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày

interface BackupStatus {
  lastBackupTime: string | null;
  status: "success" | "failed";
  error?: string;
}

// Hàm dọn dẹp các tệp cũ hơn 30 ngày
function cleanOldBackups(dirPath: string) {
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
          console.log(`[Backup] Đã xóa tệp sao lưu cũ hơn 30 ngày: ${file}`);
        }
      }
    }
  } catch (err) {
    console.error(`[Backup] Lỗi dọn dẹp thư mục ${dirPath}:`, err);
  }
}

// Hàm dọn dẹp ảnh chấm công cũ hơn 60 ngày trên Supabase Storage
async function cleanOldSupabasePhotos(supabase: any) {
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
    const pathsToRemove: string[] = [];

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
        // Tên file có dạng YYYY_MM_DD_slot.jpg hoặc YYYY-MM-DD...
        // Định dạng chuẩn: YYYY-MM-DD
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
    console.error("[Backup] Lỗi dọn dẹp ảnh Supabase:", err);
  }
}

// Thực hiện sao lưu dữ liệu
export async function runBackup(): Promise<boolean> {
  console.log("[Backup] Đang bắt đầu tiến trình sao lưu dữ liệu...");
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
      console.warn("[Backup] Không truy cập được ổ G: (Google Drive có thể chưa chạy hoặc chưa đăng nhập):", err);
    }

    // 2. Tải dữ liệu từ Supabase
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("app_runtime_state")
      .select("state")
      .eq("singleton_key", "primary")
      .single();

    if (error) {
      throw new Error(`Lỗi đọc Supabase: ${error.message}`);
    }

    const stateData = data?.state;
    if (!stateData) {
      throw new Error("Dữ liệu trống trong app_runtime_state.");
    }

    // 3. Định dạng tên file theo thời gian hiện tại
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}_${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(now.getSeconds())}`;
    const fileName = `gomita_backup_${dateStr}.json`;

    const fileContent = JSON.stringify(stateData, null, 2);

    // 4. Lưu cục bộ ở ổ E:
    const localFilePath = path.join(LOCAL_BACKUP_DIR, fileName);
    fs.writeFileSync(localFilePath, fileContent, "utf8");
    console.log(`[Backup] Đã sao lưu cục bộ thành công: ${localFilePath}`);

    // 5. Lưu ở ổ đĩa ảo G: (Google Drive)
    if (gDriveAvailable) {
      const gDriveFilePath = path.join(GDRIVE_BACKUP_DIR, fileName);
      fs.writeFileSync(gDriveFilePath, fileContent, "utf8");
      console.log(`[Backup] Đã sao lưu lên Google Drive thành công: ${gDriveFilePath}`);
    }

    // 6. Dọn dẹp các bản sao lưu cũ
    cleanOldBackups(LOCAL_BACKUP_DIR);
    if (gDriveAvailable) {
      cleanOldBackups(GDRIVE_BACKUP_DIR);
    }

    // Dọn dẹp ảnh cũ trên Supabase Storage (cũ hơn 2 tháng)
    await cleanOldSupabasePhotos(supabase);

    // 7. Cập nhật trạng thái
    const status: BackupStatus = {
      lastBackupTime: now.toISOString(),
      status: "success"
    };
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), "utf8");
    return true;

  } catch (err: any) {
    console.error("[Backup] Lỗi trong tiến trình sao lưu:", err);
    try {
      const status: BackupStatus = {
        lastBackupTime: fs.existsSync(STATUS_FILE)
          ? JSON.parse(fs.readFileSync(STATUS_FILE, "utf8")).lastBackupTime
          : null,
        status: "failed",
        error: err.message || String(err)
      };
      fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), "utf8");
    } catch (_) {}
    return false;
  }
}

// Kiểm tra xem có bỏ lỡ mốc giờ hẹn nào không để chạy bù
export async function checkAndTriggerBackup() {
  try {
    if (!fs.existsSync(LOCAL_BACKUP_DIR)) {
      fs.mkdirSync(LOCAL_BACKUP_DIR, { recursive: true });
    }

    let lastBackupTimeStr: string | null = null;
    if (fs.existsSync(STATUS_FILE)) {
      try {
        const status = JSON.parse(fs.readFileSync(STATUS_FILE, "utf8")) as BackupStatus;
        lastBackupTimeStr = status.lastBackupTime;
      } catch (_) {}
    }

    const now = new Date();

    // Tính toán mốc giờ hẹn đã qua gần nhất (12:00 trưa hoặc 00:00 đêm)
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
    const yesterdayNoon = new Date(todayMidnight.getTime() - 12 * 60 * 60 * 1000);

    let lastScheduledTime: Date;
    if (now.getTime() >= todayNoon.getTime()) {
      lastScheduledTime = todayNoon;
    } else if (now.getTime() >= todayMidnight.getTime()) {
      lastScheduledTime = todayMidnight;
    } else {
      lastScheduledTime = yesterdayNoon;
    }

    // Nếu chưa từng backup hoặc lần backup cuối cùng trước mốc giờ hẹn gần nhất
    const shouldBackup = !lastBackupTimeStr || new Date(lastBackupTimeStr).getTime() < lastScheduledTime.getTime();

    if (shouldBackup) {
      console.log(`[Backup] Phát hiện bỏ lỡ mốc sao lưu gần nhất (${lastScheduledTime.toLocaleString("vi-VN")}). Đang tiến hành sao lưu bù...`);
      // Chạy bất đồng bộ để không chặn tiến trình tải trang chính
      void runBackup();
    }
  } catch (err) {
    console.error("[Backup] Lỗi kiểm tra lịch sao lưu bù:", err);
  }
}
