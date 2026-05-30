"use client";

import { BriefcaseBusiness, Camera, Clock3, Download, FileText, IdCard, Lock, UserRound, Image, CheckSquare, Square, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { UserAccount } from "../accounts";
import type { Position } from "../roles";
import { getRequiredApprovals } from "@/modules/attendance/compensationRules";

type Slot = "07:30" | "11:30" | "13:30" | "17:30";
const slots: Slot[] = ["07:30", "11:30", "13:30", "17:30"];

export function ProfileDashboard({ 
  account, 
  position, 
  overtimeRequests = [],
  attendance = {},
  compensationRequests = [],
  onCompensationRequestsChange
}: { 
  account: UserAccount; 
  accounts?: UserAccount[]; 
  position: Position; 
  overtimeRequests?: any[]; 
  attendance?: Record<string, string>;
  compensationRequests?: any[];
  onCompensationRequestsChange?: (requests: any[]) => void;
}) {
  const monthDays = useMemo(() => getCurrentMonthDays(), []);
  const [accountOpen, setAccountOpen] = useState(false);
  const [compModalOpen, setCompModalOpen] = useState(false);
  const [compSelectedItems, setCompSelectedItems] = useState<string[]>([]);
  const [compReason, setCompReason] = useState("");

  const [username, setUsername] = useState(account.username);
  const [password, setPassword] = useState(account.password);
  const [message, setMessage] = useState("");
  const today = new Date().getDate();

  // Tính ngày mốc bù công gần nhất của nhân viên này trong tháng
  const latestCompDay = useMemo(() => {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const userReqs = compensationRequests.filter(
      req => req.employeeId === account.id && req.date.startsWith(currentMonthStr)
    );
    if (userReqs.length === 0) return 0;
    
    let maxDay = 0;
    userReqs.forEach(req => {
      const parts = req.date.split("-");
      if (parts.length === 3) {
        const d = Number(parts[2]);
        if (d > maxDay) maxDay = d;
      }
    });
    return maxDay;
  }, [compensationRequests, account.id]);

  // Số ngày công tối đa trong tháng (Loại trừ Chủ Nhật)
  const maxWorkDays = useMemo(() => {
    return monthDays.filter((day) => day.getDay() !== 0).length;
  }, [monthDays]);

  // Số ngày cần làm việc đến hôm nay (Loại trừ Chủ Nhật)
  const expectedDays = useMemo(() => {
    return monthDays.filter((day) => day.getDay() !== 0 && day.getDate() <= today).length;
  }, [monthDays, today]);

  // Đếm ngày công thực tế từ Database chấm công thật (4 mốc = 1.0 công, 2-3 mốc = 0.5 công, 0-1 mốc = 0 công)
  const workDays = useMemo(() => {
    let total = 0;
    monthDays.forEach((day) => {
      if (day.getDay() === 0 || day.getDate() > today) return;
      const dayNum = day.getDate();
      let checkedCount = 0;
      slots.forEach((slot) => {
        const key = `${account.id}-${dayNum}-${slot}`;
        if (attendance[key] === "normal" || attendance[key] === "compensated") {
          checkedCount++;
        }
      });
      if (checkedCount === 4) total += 1.0;
      else if (checkedCount >= 2) total += 0.5;
    });
    return total;
  }, [monthDays, attendance, account.id, today]);

  const totalHours = workDays * 8;
  
  // Tính tổng giờ tăng ca thực tế đã duyệt của tháng này từ Database
  const overtime = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return overtimeRequests
      .filter((req) => {
        if (req.userId !== account.id) return false;
        if (req.status !== "approved") return false;
        const reqDate = new Date(req.createdAt || req.id.replace("ot-", ""));
        return reqDate.getMonth() === currentMonth && reqDate.getFullYear() === currentYear;
      })
      .reduce((sum, req) => sum + (Number(req.hours) || 0), 0);
  }, [overtimeRequests, account.id]);

  const salaryType = account.salaryType ?? "daily";
  const salaryValue = account.salaryValue ?? (position.id === "hr" ? 420000 : position.id === "accountant" ? 400000 : 350000);

  // Thu nhập tạm tính động:
  // - Lương tháng: Lương tháng / (Số ngày công tối đa) * Số ngày công đã chấm
  // - Lương ngày: Số ngày công * Lương ngày + Giờ tăng ca * 1.5 * (Lương ngày / 8)
  const estimatedIncome = useMemo(() => {
    if (salaryType === "monthly") {
      return maxWorkDays ? (salaryValue / maxWorkDays) * workDays : 0;
    }
    const base = workDays * salaryValue;
    const otPay = overtime * 1.5 * (salaryValue / 8);
    return base + otPay;
  }, [salaryType, salaryValue, workDays, overtime, maxWorkDays]);

  const workRate = expectedDays ? Math.round((workDays / expectedDays) * 100) : 0;

  function downloadAttendanceAsImage() {
    const canvas = document.createElement("canvas");
    canvas.width = 1350;
    canvas.height = 450;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    // 2. Title & Header
    ctx.fillStyle = "#071a38"; // Dark Navy GOMITA
    ctx.fillRect(5, 5, canvas.width - 10, 80);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial, sans-serif";
    const currentMonthText = `BANG CHAM CONG THANG ${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
    ctx.fillText(currentMonthText, 30, 48);

    ctx.font = "bold 14px Arial, sans-serif";
    ctx.fillText(`Nhan vien: ${account.displayName.toUpperCase()}   |   Bo phan: ${account.department || "Xuong"}   |   Vi tri: ${position.name.toUpperCase()}`, 30, 70);

    // 3. Grid Drawing
    const startX = 130;
    const startY = 150;
    const colWidth = 38;
    const rowHeight = 50;

    // Draw Column Headers (Days)
    ctx.fillStyle = "#475569";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.fillText("Moc gio", 30, startY - 15);

    monthDays.forEach((day, index) => {
      const x = startX + index * colWidth;
      ctx.fillStyle = day.getDay() === 0 ? "#ef4444" : "#475569"; // Red for Sunday
      ctx.fillText(String(day.getDate()), x + 10, startY - 15);
    });

    // Draw Grid Lines & Data
    slots.forEach((slot, rowIndex) => {
      const y = startY + rowIndex * rowHeight;
      
      // Row Name
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 13px Arial, sans-serif";
      ctx.fillText(slot, 30, y + 6);

      // Horizontal line
      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(15, y + 18);
      ctx.lineTo(canvas.width - 15, y + 18);
      ctx.stroke();

      monthDays.forEach((day, colIndex) => {
        const x = startX + colIndex * colWidth;
        const key = `${account.id}-${day.getDate()}-${slot}`;
        const kind = attendance[key];

        // Draw Circle
        ctx.beginPath();
        ctx.arc(x + 15, y, 7, 0, 2 * Math.PI);
        if (kind === "normal") {
          ctx.fillStyle = "#22c55e"; // Green
        } else if (kind === "compensated") {
          ctx.fillStyle = "#3b82f6"; // Blue
        } else {
          ctx.fillStyle = "#cbd5e1"; // Gray
        }
        ctx.fill();
      });
    });

    // 4. Legend at bottom
    const legendY = 380;
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.fillText("Chu thich:", 30, legendY);

    // Green Dot
    ctx.beginPath();
    ctx.arc(130, legendY - 4, 6, 0, 2 * Math.PI);
    ctx.fillStyle = "#22c55e";
    ctx.fill();
    ctx.fillStyle = "#475569";
    ctx.fillText("Da cham cong", 145, legendY);

    // Blue Dot
    ctx.beginPath();
    ctx.arc(280, legendY - 4, 6, 0, 2 * Math.PI);
    ctx.fillStyle = "#3b82f6";
    ctx.fill();
    ctx.fillStyle = "#475569";
    ctx.fillText("Cham cong bu", 295, legendY);

    // Gray Dot
    ctx.beginPath();
    ctx.arc(430, legendY - 4, 6, 0, 2 * Math.PI);
    ctx.fillStyle = "#cbd5e1";
    ctx.fill();
    ctx.fillStyle = "#475569";
    ctx.fillText("Thieu cong", 445, legendY);

    // Brand mark
    ctx.fillStyle = "#94a3b8";
    ctx.font = "italic 11px Arial, sans-serif";
    ctx.fillText("He thong quan tri doanh nghiep GOMITA - Tu dong dong bo online", canvas.width - 380, legendY);

    // Trigger download
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `Bang-cong-${account.displayName}-${new Date().getMonth() + 1}.png`;
    a.click();
  }

  return (
    <section className="grid gap-5">
      {message ? <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700">{message}</div> : null}

      <div>
        <h2 className="text-2xl font-black">Xin chào, {account.displayName}</h2>
        <p className="mt-1 text-sm text-slate-500">Chúc bạn một ngày làm việc hiệu quả.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,1.2fr)_repeat(4,minmax(150px,1fr))]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full bg-slate-100">
              <UserRound className="h-14 w-14 text-slate-500" />
              <span className="absolute bottom-1 right-1 grid h-8 w-8 place-items-center rounded-full bg-orange-500 text-white"><Camera className="h-4 w-4" /></span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-black">{account.displayName}</h3>
                <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-black text-orange-600">{position.name}</span>
              </div>
              <InfoLine icon={<BriefcaseBusiness className="h-4 w-4" />} text="Nhân viên chính thức" />
              <InfoLine icon={<IdCard className="h-4 w-4" />} text="CCCD: 0310 1234 5678" />
              <InfoLine icon={<FileText className="h-4 w-4" />} text="HĐLĐ: 12 tháng, hiệu lực 01/01/2026" />
            </div>
          </div>
          <button className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 font-black" onClick={() => setAccountOpen(true)} type="button">
            <Lock className="h-4 w-4" />
            Quản lý tài khoản
          </button>
        </div>

        <Metric title="Tổng công trong tháng" value={`${workDays} / ${expectedDays}`} sub={`${workRate}%`} tone="green" />
        <Metric title="Số giờ làm việc" value={totalHours.toString()} sub="giờ" tone="violet" />
        <Metric title="Tăng ca (OT)" value={overtime.toString()} sub="giờ" tone="orange" />
        <Metric title="Thu nhập tạm tính" value={`${Math.round(estimatedIncome).toLocaleString("vi-VN")} đ`} sub={salaryType === "monthly" ? "Tạm tính (Lương tháng / ngày công)" : "Tạm tính (Lương ngày + Tăng ca)"} tone="green" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-black">Bảng chấm công tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}</h2>
            <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
              <Legend color="bg-green-500" label="Đã chấm thành công" />
              <Legend color="bg-blue-500" label="Chấm công bù" />
              <Legend color="bg-slate-300" label="Chưa chấm / Thiếu công" />
            </div>
            <div className="mt-1.5 text-xs text-orange-500 font-bold block md:hidden">
              💡 Vuốt ngang bảng bên dưới để xem chi tiết tất cả các ngày trong tháng.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {onCompensationRequestsChange && (
              <button 
                className="flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 text-sm font-black text-white transition shadow-sm" 
                onClick={() => {
                  setCompModalOpen(true);
                  setCompSelectedItems([]);
                }}
                type="button"
              >
                <Clock3 className="h-4 w-4" />
                Đăng ký chấm công bù
              </button>
            )}
            <button 
              className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-black bg-white hover:bg-slate-50 text-slate-700 transition" 
              onClick={downloadAttendanceAsImage}
              type="button"
            >
              <Image className="h-4 w-4" />
              Tải ảnh bảng công
            </button>
          </div>
        </div>
        <AttendanceGrid monthDays={monthDays} attendance={attendance} accountId={account.id} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
          <Metric title="Ngày làm việc" value={`${workDays}`} sub="ngày" tone="green" compact />
          <Metric title="Ngày thiếu" value={`${Math.max(0, expectedDays - workDays)}`} sub="ngày" tone="orange" compact />
          <Metric title="Tổng giờ làm" value={`${totalHours}`} sub="giờ" tone="violet" compact />
          <Metric title="Tổng tăng ca" value={`${overtime}`} sub="giờ" tone="blue" compact />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-center shadow-sm">
          <div className="mx-auto grid h-28 w-28 place-items-center rounded-full border-[14px] border-green-500 text-xl font-black">{workRate}%</div>
          <div className="mt-3 text-sm font-bold text-slate-600">Tỷ lệ chấm công</div>
        </div>
      </div>

      {accountOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <section className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h2 className="text-xl font-black">Quản lý tài khoản</h2>
            <div className="mt-4 grid gap-3">
              <TextInput label="Tên đăng nhập" value={username} onChange={setUsername} />
              <TextInput label="Mật khẩu" value={password} onChange={setPassword} type="password" />
              <button className="min-h-12 rounded-lg bg-orange-500 font-black text-white" onClick={() => {
                account.username = username.trim();
                account.password = password.trim();
                setAccountOpen(false);
                setMessage("Đã cập nhật tên đăng nhập và mật khẩu trong phiên hiện tại.");
              }} type="button">Lưu thay đổi</button>
              <button className="min-h-11 rounded-lg border border-slate-200 font-bold" onClick={() => setAccountOpen(false)} type="button">Đóng</button>
            </div>
          </section>
        </div>
      ) : null}

      {compModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <section className="w-full max-w-4xl rounded-xl bg-white p-5 shadow-2xl text-slate-900">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Bảng Đăng Ký Chấm Công Bù Trực Quan</h2>
                <p className="text-xs text-slate-500 mt-1">💡 Tích chọn trực tiếp vào các ô thiếu công dưới đây. Bạn có thể chọn nhiều mốc, nhiều ngày cùng lúc.</p>
              </div>
              <button 
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100" 
                onClick={() => {
                  setCompModalOpen(false);
                  setCompSelectedItems([]);
                  setCompReason("");
                }} 
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Chú thích */}
            <div className="mb-4 flex flex-wrap gap-4 rounded-lg bg-slate-50 p-3 text-xs font-bold text-slate-600 border border-slate-200">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-green-500" /> Đã chấm</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-blue-500" /> Đã bù công</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-500" /> Đang chờ duyệt</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-dashed border-slate-400 bg-white" /> Thiếu công (Bấm chọn)</span>
              <span className="flex items-center gap-1.5">🔒 Đã khóa kì công</span>
            </div>

            {/* Bảng lưới */}
            <div className="overflow-x-auto select-none rounded-lg border border-slate-200" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="min-w-[1140px] px-2 py-3 bg-white">
                <div className="grid border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600" style={{ gridTemplateColumns: `100px repeat(${monthDays.length}, 32px)` }}>
                  <div>Mốc giờ</div>
                  {monthDays.map((day) => <div key={day.toISOString()} className="text-center">{day.getDate()}</div>)}
                </div>
                {slots.map((slot) => (
                  <div key={slot} className="grid items-center border-b border-slate-100 px-3 py-2.5 text-xs" style={{ gridTemplateColumns: `100px repeat(${monthDays.length}, 32px)` }}>
                    <div className="font-black text-slate-700">{slot}</div>
                    {monthDays.map((day) => {
                      const dayNum = day.getDate();
                      const dateParts = [
                        day.getFullYear(),
                        String(day.getMonth() + 1).padStart(2, "0"),
                        String(dayNum).padStart(2, "0")
                      ];
                      const dateString = dateParts.join("-");
                      const key = `${account.id}-${dayNum}-${slot}`;
                      const kind = attendance[key];
                      
                      // 1. Kiểm tra xem có yêu cầu đang chờ duyệt không
                      const isPending = compensationRequests.some(
                        (req) => req.employeeId === account.id && req.date === dateString && req.slots.includes(slot) && req.status === "pending"
                      );

                      // 2. Kiểm tra xem ngày có bị khóa không (trước hoặc bằng ngày bù gần nhất)
                      const isLocked = dayNum <= latestCompDay;

                      // 3. Kiểm tra xem có phải Chủ Nhật không
                      const isSunday = day.getDay() === 0;

                      // 4. Kiểm tra xem ô này đã được chọn trong lượt này chưa
                      const itemKey = `${dayNum}-${slot}`;
                      const isSelected = compSelectedItems.includes(itemKey);

                      if (isSunday) {
                        return (
                          <div key={day.toISOString()} className="text-center font-bold text-slate-300 select-none">
                            CN
                          </div>
                        );
                      }

                      if (kind === "normal") {
                        return (
                          <div key={day.toISOString()} className="grid place-items-center">
                            <span className="h-3.5 w-3.5 rounded-full bg-green-500" title="Đã chấm thành công" />
                          </div>
                        );
                      }

                      if (kind === "compensated") {
                        return (
                          <div key={day.toISOString()} className="grid place-items-center">
                            <span className="h-3.5 w-3.5 rounded-full bg-blue-500" title="Đã được bù công" />
                          </div>
                        );
                      }

                      if (isPending) {
                        return (
                          <div key={day.toISOString()} className="grid place-items-center">
                            <span className="h-3.5 w-3.5 rounded-full bg-amber-500" title="Đang chờ duyệt" />
                          </div>
                        );
                      }

                      if (isLocked) {
                        return (
                          <div key={day.toISOString()} className="grid place-items-center text-[10px] text-slate-400 select-none" title="Kì công trước ngày bù gần nhất đã khóa">
                            🔒
                          </div>
                        );
                      }

                      // Nếu là mốc thiếu công và chưa bị khóa
                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setCompSelectedItems(compSelectedItems.filter((i) => i !== itemKey));
                            } else {
                              setCompSelectedItems([...compSelectedItems, itemKey]);
                            }
                          }}
                          className={`grid h-6 w-6 place-items-center rounded-full border transition ${
                            isSelected
                              ? "bg-blue-600 border-blue-700 text-white font-black scale-110 shadow-sm animate-pulse"
                              : "border-slate-300 border-dashed bg-white hover:bg-slate-50 text-slate-400"
                          }`}
                        >
                          {isSelected ? "✓" : "+"}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Lý do & Nút Gửi */}
            <div className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm font-bold">
                Lý do xin bù công *
                <textarea 
                  className="min-h-20 rounded-lg border border-slate-200 p-3 font-normal outline-none focus:border-blue-500 text-sm" 
                  value={compReason} 
                  onChange={(event) => setCompReason(event.target.value)} 
                  placeholder="Ví dụ: Quên điện thoại ở nhà, đi gặp khách hàng..." 
                />
              </label>

              <div className="flex items-center justify-between gap-3 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                <span className="text-xs font-bold text-blue-700">
                  Đã chọn: <strong className="text-sm font-black text-blue-900">{compSelectedItems.length} mốc</strong> thiếu công
                </span>
                <span className="text-[11px] text-slate-400 italic">
                  Ngày bù gần nhất đã khóa: {latestCompDay > 0 ? `Ngày ${latestCompDay}` : "Chưa có"}
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCompModalOpen(false);
                    setCompSelectedItems([]);
                    setCompReason("");
                  }}
                  className="flex-1 min-h-11 rounded-lg border border-slate-200 font-bold hover:bg-slate-50 transition"
                >
                  Hủy bỏ
                </button>
                <button 
                  className={`flex-[2] min-h-11 rounded-lg font-black text-white transition ${
                    compSelectedItems.length > 0 && compReason.trim()
                      ? "bg-blue-600 hover:bg-blue-700 shadow-md"
                      : "bg-slate-300 cursor-not-allowed text-slate-450"
                  }`} 
                  onClick={() => {
                    if (compSelectedItems.length > 0 && compReason.trim()) {
                      const now = new Date();
                      const grouped: Record<number, Slot[]> = {};
                      compSelectedItems.forEach(item => {
                        const [dayStr, slotStr] = item.split("-");
                        const dayNum = Number(dayStr);
                        const slotVal = slotStr as Slot;
                        if (!grouped[dayNum]) {
                          grouped[dayNum] = [];
                        }
                        grouped[dayNum].push(slotVal);
                      });

                      const groupId = `comp-group-${Date.now()}`;
                      let batchSlotsCount = 0;
                      Object.values(grouped).forEach(daySlots => {
                        batchSlotsCount += daySlots.length;
                      });

                      const newRequests = Object.keys(grouped).map(dayStr => {
                        const dayNum = Number(dayStr);
                        const daySlots = grouped[dayNum];
                        const dateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                        
                        const level = account.positionIds.includes("hr") ? "department_head" : (position.level || "staff");

                        return {
                          id: `comp-${Date.now()}-${dayNum}`,
                          employeeId: account.id,
                          employeeName: account.displayName,
                          employeePositionLevel: level,
                          date: dateString,
                          slots: daySlots,
                          reason: compReason.trim(),
                          missingCountInMonth: batchSlotsCount,
                          requiredApprovals: getRequiredApprovals(level, batchSlotsCount),
                          approvals: [],
                          status: "pending",
                          createdAt: new Date().toISOString(),
                          groupId
                        };
                      });

                      if (onCompensationRequestsChange) {
                        onCompensationRequestsChange([...newRequests, ...compensationRequests]);
                      }
                      setCompModalOpen(false);
                      setCompSelectedItems([]);
                      setCompReason("");
                      setMessage(`Đã gửi thành công ${newRequests.length} yêu cầu chấm công bù lên cấp trên chờ duyệt!`);
                    }
                  }} 
                  disabled={compSelectedItems.length === 0 || !compReason.trim()}
                  type="button"
                >
                  Gửi yêu cầu bù công
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export function CompanyPayrollDashboard({ 
  accounts, 
  overtimeRequests = [],
  attendance = {}
}: { 
  accounts: UserAccount[]; 
  overtimeRequests?: any[]; 
  attendance?: Record<string, string>;
}) {
  const monthDays = useMemo(() => getCurrentMonthDays(), []);
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Tổng số ngày công tối đa trong tháng (Loại trừ Chủ Nhật)
  const maxWorkDays = useMemo(() => {
    return monthDays.filter((day) => day.getDay() !== 0).length;
  }, [monthDays]);

  const rows = accounts.filter((account) => account.status === "active" && !account.positionIds.includes("director")).map((account) => {
    // Đọc công thật 100% từ database, loại bỏ hoàn toàn dấu công fake của bản cũ
    const marks = monthDays.map((day) => {
      if (day.getDay() === 0) return ""; // Chủ Nhật không tính
      
      const dayNum = day.getDate();
      let checkedCount = 0;
      slots.forEach(slot => {
        const key = `${account.id}-${dayNum}-${slot}`;
        if (attendance[key] === "normal" || attendance[key] === "compensated") {
          checkedCount++;
        }
      });

      if (checkedCount === 4) return "X";  // Đủ 4 mốc = 1 công
      if (checkedCount >= 2) return "/";   // Chấm 2 hoặc 3 mốc = 0.5 công
      return "";                           // Thiếu mốc = 0 công
    });

    const work = marks.reduce((total, mark) => total + (mark === "X" ? 1 : mark === "/" ? 0.5 : 0), 0);
    
    // Giờ tăng ca (OT) trong tháng hiện tại
    const otHours = overtimeRequests
      .filter((req) => {
        if (req.userId !== account.id) return false;
        if (req.status !== "approved") return false;
        const reqDate = new Date(req.createdAt || req.id.replace("ot-", ""));
        return reqDate.getMonth() === currentMonth && reqDate.getFullYear() === currentYear;
      })
      .reduce((sum, req) => sum + (Number(req.hours) || 0), 0);

    const salaryType = account.salaryType ?? "daily";
    const salaryValue = account.salaryValue ?? (account.positionIds.includes("hr") ? 420000 : account.positionIds.includes("accountant") ? 400000 : 350000);
    
    // Thu nhập tạm tính động:
    // - Lương tháng: Lương tháng / (Số ngày công tối đa) * Số ngày công đã chấm
    // - Lương ngày: Số ngày công * Lương ngày + Giờ tăng ca * 1.5 * (Lương ngày / 8)
    let totalIncome = 0;
    if (salaryType === "monthly") {
      totalIncome = maxWorkDays ? (salaryValue / maxWorkDays) * work : 0;
    } else {
      totalIncome = (work * salaryValue) + (otHours * 1.5 * (salaryValue / 8));
    }

    return { account, marks, work, otHours, salaryType, salaryValue, totalIncome };
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-xl font-black">Bảng lương công ty</h2>
        <p className="text-sm text-slate-500">Tính toán động từ mốc chấm công thật: Đủ 4 mốc = 1.0 công (X); 2 hoặc 3 mốc = 0.5 công (/); Dưới 2 mốc = 0.0 công.</p>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[1980px]">
          <div className="grid bg-slate-50 px-4 py-3 text-sm font-black text-slate-600" style={{ gridTemplateColumns: `180px 140px repeat(${monthDays.length}, 38px) 60px 70px 100px 110px 140px` }}>
            <div>Nhân sự</div>
            <div>Bộ phận</div>
            {monthDays.map((day) => <div key={day.toISOString()} className="text-center">{day.getDate()}</div>)}
            <div className="text-center">Công</div>
            <div className="text-center">Tăng ca</div>
            <div>Hình thức</div>
            <div className="text-right">Mức lương</div>
            <div className="text-right text-orange-600">Tổng thu nhập</div>
          </div>
          {rows.map((row) => {
            const displayType = row.salaryType === "monthly" ? "Tháng" : "Ngày";
            return (
              <div key={row.account.id} className="grid items-center border-t border-slate-200 px-4 py-3 text-sm hover:bg-slate-50 transition" style={{ gridTemplateColumns: `180px 140px repeat(${monthDays.length}, 38px) 60px 70px 100px 110px 140px` }}>
                <div className="font-black">{row.account.displayName}</div>
                <div className="text-slate-500">{row.account.department}</div>
                {row.marks.map((mark, index) => <div key={`${row.account.id}-${index}`} className="text-center font-black">{mark}</div>)}
                <div className="text-center font-bold text-slate-700">{row.work}</div>
                <div className="text-center font-bold text-orange-600">{row.otHours}h</div>
                <div className="font-bold text-slate-600">{displayType}</div>
                <div className="text-right font-bold">{row.salaryValue.toLocaleString("vi-VN")} đ</div>
                <div className="text-right font-black text-green-600">{Math.round(row.totalIncome).toLocaleString("vi-VN")} đ</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AttendanceGrid({ 
  monthDays, 
  attendance, 
  accountId 
}: { 
  monthDays: Date[]; 
  attendance: Record<string, string>; 
  accountId: string;
}) {
  return (
    <div className="overflow-x-auto select-none" style={{ WebkitOverflowScrolling: "touch" }}>
      <div className="min-w-[1240px] px-4 pb-2">
        <div className="grid border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-600" style={{ gridTemplateColumns: `110px repeat(${monthDays.length}, 36px)` }}>
          <div>Mốc giờ</div>
          {monthDays.map((day) => <div key={day.toISOString()} className="text-center">{day.getDate()}</div>)}
        </div>
        {slots.map((slot) => (
          <div key={slot} className="grid items-center border-b border-slate-100 px-4 py-3 text-sm" style={{ gridTemplateColumns: `110px repeat(${monthDays.length}, 36px)` }}>
            <div className="font-black">{slot}</div>
            {monthDays.map((day) => {
              const key = `${accountId}-${day.getDate()}-${slot}`;
              const kind = attendance[key];
              return (
                <div key={`${day.toISOString()}-${slot}`} className="grid place-items-center">
                  <span className={`h-3 w-3 rounded-full ${kind === "normal" ? "bg-green-500" : kind === "compensated" ? "bg-blue-500" : "bg-slate-300"}`} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function getCurrentMonthDays() {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => new Date(now.getFullYear(), now.getMonth(), index + 1));
}

function InfoLine({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">{icon}{text}</div>;
}

function Metric({ title, value, sub, tone, compact = false }: { title: string; value: string; sub: string; tone: "green" | "violet" | "orange" | "blue"; compact?: boolean }) {
  const colors = { green: "text-green-600 bg-green-50", violet: "text-violet-600 bg-violet-50", orange: "text-orange-600 bg-orange-50", blue: "text-blue-600 bg-blue-50" };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-4 grid h-10 w-10 place-items-center rounded-full ${colors[tone]}`}><Clock3 className="h-5 w-5" /></div>
      <div className="text-sm font-bold text-slate-500">{title}</div>
      <div className={`${compact ? "text-2xl" : "text-3xl"} mt-2 font-black`}>{value}</div>
      <div className="mt-1 text-sm font-bold text-slate-500">{sub}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span>;
}

function TextInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="grid gap-1 text-sm font-bold">{label}<input className="h-11 rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-orange-400" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
