export const backupPolicy = {
  database: "Tự động hằng ngày",
  storage: "Tự động hằng ngày",
  restorePermission: "Chỉ quản trị hệ thống",
  auditLog: ["backup_created", "restore_started", "restore_completed", "restore_failed"]
};
