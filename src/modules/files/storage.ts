export const storageBuckets = {
  attendancePhotos: "attendance-photos",
  orderImages: "order-images",
  completionFiles: "completion-files",
  backups: "backups"
} as const;

export function buildStoragePath(moduleName: string, ownerId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${moduleName}/${ownerId}/${Date.now()}-${safeName}`;
}
