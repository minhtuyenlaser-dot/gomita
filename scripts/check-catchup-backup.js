const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const LOCAL_BACKUP_DIR = "E:\\Product\\7. Go CNC\\PM\\ok\\gomita_backups";
const STATUS_FILE = path.join(LOCAL_BACKUP_DIR, "last_backup_status.json");
const BACKUP_SCRIPT = path.join(__dirname, "gdrive-backup.js");

function readLastBackupTime() {
  try {
    if (!fs.existsSync(STATUS_FILE)) return null;
    const raw = fs.readFileSync(STATUS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed?.lastBackupTime) return null;
    const date = new Date(parsed.lastBackupTime);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch (_) {
    return null;
  }
}

function getLatestScheduledTime(now) {
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  const yesterdayNoon = new Date(todayMidnight.getTime() - 12 * 60 * 60 * 1000);

  if (now.getTime() >= todayNoon.getTime()) return todayNoon;
  if (now.getTime() >= todayMidnight.getTime()) return todayMidnight;
  return yesterdayNoon;
}

function shouldRunCatchup() {
  const now = new Date();
  const lastBackupTime = readLastBackupTime();
  const latestScheduledTime = getLatestScheduledTime(now);
  if (!lastBackupTime) return true;
  return lastBackupTime.getTime() < latestScheduledTime.getTime();
}

function runBackupScript() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BACKUP_SCRIPT], {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Backup script exited with code ${code}`));
    });
  });
}

async function main() {
  if (!shouldRunCatchup()) {
    console.log("[Backup] Khong can chay backup bu. Moc backup gan nhat da duoc thuc hien.");
    return;
  }

  console.log("[Backup] Phat hien bo lo moc backup. Dang chay backup bu...");
  await runBackupScript();
}

main().catch((error) => {
  console.error("[Backup] Loi backup bu:", error?.message || error);
  process.exit(1);
});
