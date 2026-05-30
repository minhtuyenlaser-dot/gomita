"use client";

import { Database, Download, Upload, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useState } from "react";

export function BackupRestoreDashboard({
  onDataRestored
}: {
  onDataRestored: (data: any) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Tải bản sao lưu .json từ Server
  async function handleDownloadBackup() {
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");
    try {
      const res = await fetch("https://gomita.onrender.com/api/data");
      const dbData = await res.json();
      
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(dbData, null, 2)
      )}`;
      
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      
      const now = new Date();
      const dateStr = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}`;
      downloadAnchor.setAttribute("download", `gomita_backup_${dateStr}.json`);
      
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      
      setSuccessMessage("Đã tải tệp sao lưu (.json) về thiết bị của bạn thành công! Hãy lưu trữ tệp này cẩn thận.");
    } catch (err) {
      console.error(err);
      setErrorMessage("Không thể kết nối đến máy chủ GOMITA để tải dữ liệu sao lưu!");
    } finally {
      setLoading(false);
    }
  }

  // Đọc và khôi phục dữ liệu từ tệp tin tải lên
  function handleUploadBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const rawText = e.target?.result as string;
        const backupData = JSON.parse(rawText);

        // Kiểm tra tính hợp lệ cơ bản của cấu trúc dữ liệu GOMITA
        if (!backupData.accounts || !backupData.orders || !backupData.attendance) {
          throw new Error("Tệp tin JSON không đúng định dạng cấu trúc dữ liệu GOMITA!");
        }

        // Đồng bộ dữ liệu mới lên Render Server
        const res = await fetch("https://gomita.onrender.com/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(backupData)
        });

        const resJson = await res.json();
        if (resJson.success) {
          // Cập nhật state ở Page cha để giao diện cập nhật ngay lập tức
          onDataRestored(backupData);
          setSuccessMessage("Khôi phục dữ liệu thành công! Toàn bộ danh sách nhân sự, đơn hàng và bảng công đã được khôi phục đồng bộ lên máy chủ.");
        } else {
          setErrorMessage("Máy chủ từ chối ghi nhận tệp sao lưu này.");
        }
      } catch (err: any) {
        console.error(err);
        setErrorMessage(err.message || "Tệp tin tải lên không phải JSON hợp lệ hoặc cấu trúc bị lỗi.");
      } finally {
        setLoading(false);
        // Reset input file
        event.target.value = "";
      }
    };

    reader.onerror = () => {
      setErrorMessage("Lỗi trong quá trình đọc tệp tin sao lưu.");
      setLoading(false);
    };

    reader.readAsText(file);
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
        <Database className="h-7 w-7 text-orange-500" />
        <div>
          <h2 className="text-xl font-black text-slate-800">Bảng Sao lưu & Phục hồi Dữ liệu</h2>
          <p className="text-sm text-slate-500">
            Dành riêng cho Giám đốc để đề phòng mất mát dữ liệu nhân sự, đơn hàng khi máy chủ Render reset trạng thái.
          </p>
        </div>
      </div>

      {/* Thông báo trạng thái */}
      {successMessage && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 mt-0.5" />
          <div>{successMessage}</div>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tải dữ liệu về (Download Backup) */}
        <div className="rounded-xl border border-slate-150 bg-slate-50/50 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Download className="h-5 w-5 text-orange-500" />
              1. Tải về và Sao lưu Dữ liệu
            </h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Nhấp vào nút bên dưới để trích xuất toàn bộ cơ sở dữ liệu hiện tại (bao gồm danh sách tài khoản, đơn hàng, tăng ca và tất cả ảnh chấm công của thợ) thành một tệp dữ liệu dạng `.json` để lưu trữ ngoại tuyến trên máy tính của bạn.
            </p>
            <div className="mt-4 rounded-lg bg-orange-50 border border-orange-100 p-3 text-[11px] font-bold text-orange-700 flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600 mt-0.5" />
              <div>
                <strong>Khuyên dùng:</strong> Hãy thực hiện tải về sao lưu đều đặn mỗi ngày sau ca làm việc hoặc trước khi thực hiện cập nhật nâng cấp hệ thống.
              </div>
            </div>
          </div>

          <button
            className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 font-black text-white hover:bg-orange-600 transition shadow-md shadow-orange-500/10 disabled:opacity-50"
            onClick={handleDownloadBackup}
            disabled={loading}
            type="button"
          >
            {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            TẢI DỮ LIỆU JSON SAO LƯU
          </button>
        </div>

        {/* Khôi phục dữ liệu lên (Upload Restore) */}
        <div className="rounded-xl border border-slate-150 bg-slate-50/50 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Upload className="h-5 w-5 text-green-600" />
              2. Phục hồi Dữ liệu từ File Sao lưu
            </h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Chọn tệp sao lưu `.json` đã tải về từ trước trên máy tính của bạn để ghi đè và đồng bộ lại 100% dữ liệu. Hệ thống sẽ tự động khôi phục toàn bộ trạng thái nhân sự và ngày công tức thì mà không cần khai báo lại.
            </p>
            <div className="mt-4 rounded-lg bg-red-50 border border-red-100 p-3 text-[11px] font-bold text-red-700 flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div>
                <strong>Cảnh báo:</strong> Việc phục hồi dữ liệu sẽ ghi đè hoàn toàn cơ sở dữ liệu hiện tại trên máy chủ. Hãy chắc chắn tệp sao lưu của bạn là phiên bản mới nhất và đúng định dạng.
              </div>
            </div>
          </div>

          <label className="mt-6 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-green-600 px-5 font-black text-white hover:bg-green-700 transition shadow-md shadow-green-600/10 text-center">
            <Upload className="h-5 w-5" />
            CHỌN FILE (.JSON) ĐỂ PHỤC HỒI
            <input
              type="file"
              accept=".json"
              className="sr-only"
              disabled={loading}
              onChange={handleUploadBackup}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
