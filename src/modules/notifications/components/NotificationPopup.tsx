"use client";

import { X } from "lucide-react";
import { useState } from "react";

export function NotificationPopup() {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[calc(100%-32px)] max-w-sm rounded-lg border border-gomita-line bg-white p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-black">Thông báo bắt buộc đọc</div>
          <p className="mt-1 text-sm text-gomita-muted">Có 2 yêu cầu chấm công bù đang chờ xác nhận và 1 đơn quá hạn tiếp nhận.</p>
        </div>
        <button className="rounded-lg p-1 hover:bg-slate-100" onClick={() => setOpen(false)} type="button" aria-label="Đóng thông báo">
          <X className="h-5 w-5" />
        </button>
      </div>
      <button className="mt-3 min-h-11 w-full rounded-lg bg-gomita-green font-black text-white" onClick={() => setOpen(false)} type="button">
        Đã đọc
      </button>
    </div>
  );
}
