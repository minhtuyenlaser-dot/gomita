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
  const [compDate, setCompDate] = useState("");
  const [compSlots, setCompSlots] = useState<Slot[]>([]);
  const [compReason, setCompReason] = useState("");

  const [username, setUsername] = useState(account.username);
  const [password, setPassword] = useState(account.password);
  const [message, setMessage] = useState("");
  const today = new Date().getDate();

  // Tính toán các mốc thiếu công thực tế của nhân viên này để tự chọn đăng ký bù
  const realMissingAttendance = useMemo(() => {
    const list: Array<{ date: string; slots: Slot[] }> = [];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const todayNum = now.getDate();

    for (let d = 1; d <= todayNum; d++) {
      const dateObj = new Date(year, month, d);
      if (dateObj.getDay() === 0) continue; // Bỏ qua Chủ Nhật
      
      const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const missingSlotsForDay: Slot[] = [];
      
      slots.forEach((slot) => {
        const key = `${account.id}-${d}-${slot}`;
        // Nếu không có bản ghi chấm công
        if (!attendance[key]) {
          const hasPendingOrApproved = compensationRequests.some(
            (req) => req.employeeId === account.id && req.date === dateString && req.slots.includes(slot)
          );
          if (!hasPendingOrApproved) {
            missingSlotsForDay.push(slot);
          }
        }
      });
      
      if (missingSlotsForDay.length > 0) {
        list.push({
          date: dateString,
          slots: missingSlotsForDay
        });
      }
    }
    return list;
  }, [account.id, attendance, compensationRequests]);

  const compSelectedMissingItem = realMissingAttendance.find((item) => item.date === compDate);
  const compAvailableSlots = compSelectedMissingItem?.slots ?? [];

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
                  if (realMissingAttendance.length > 0) {
                    setCompDate(realMissingAttendance[0].date);
                  }
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
          <section className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl text-slate-900">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Đăng ký chấm công bù</h2>
              <button 
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100" 
                onClick={() => {
                  setCompModalOpen(false);
                  setCompDate("");
                  setCompSlots([]);
                  setCompReason("");
                }} 
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {realMissingAttendance.length === 0 ? (
              <div className="text-center p-6 bg-slate-50 rounded-lg border border-slate-150">
                <p className="font-bold text-green-600 text-base">Tuyệt vời! 🎉</p>
                <p className="mt-2 text-sm text-slate-500">Bạn đã chấm công đầy đủ, không thiếu mốc nào trong tháng này.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                <label className="grid gap-1 text-sm font-bold">
                  Chọn ngày thiếu công
                  <select 
                    className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500 font-normal bg-white" 
                    value={compDate} 
                    onChange={(e) => {
                      setCompDate(e.target.value);
                      setCompSlots([]);
                    }}
                  >
                    {realMissingAttendance.map((item) => {
                      const dateParts = item.date.split("-");
                      const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
                      return (
                        <option key={item.date} value={item.date}>
                          Ngày {formattedDate} (Thiếu {item.slots.length} mốc)
                        </option>
                      );
                    })}
                  </select>
                </label>

                {compDate && (
                  <div className="grid gap-2">
                    <span className="text-sm font-bold">Chọn mốc giờ cần chấm công bù</span>
                    <div className="flex flex-wrap gap-2">
                      {compAvailableSlots.map((slot) => {
                        const isSelected = compSlots.includes(slot);
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setCompSlots(compSlots.filter((s) => s !== slot));
                              } else {
                                setCompSlots([...compSlots, slot]);
                              }
                            }}
                            className={`flex min-h-10 items-center gap-2 px-3 rounded-lg border text-sm font-bold transition ${
                              isSelected
                                ? "border-blue-600 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <label className="grid gap-1 text-sm font-bold">
                  Lý do xin bù công
                  <textarea 
                    className="min-h-24 rounded-lg border border-slate-200 p-3 font-normal outline-none focus:border-blue-500" 
                    value={compReason} 
                    onChange={(event) => setCompReason(event.target.value)} 
                    placeholder="Ví dụ: Quên điện thoại ở nhà, đi gặp khách hàng..." 
                  />
                </label>

                <button 
                  className={`min-h-12 rounded-lg font-black text-white transition ${
                    compSlots.length > 0 && compReason.trim()
                      ? "bg-blue-600 hover:bg-blue-700 shadow-md"
                      : "bg-slate-350 cursor-not-allowed"
                  }`} 
                  onClick={() => {
                    if (compSlots.length > 0 && compReason.trim()) {
                      // Xử lý tạo và đăng ký
                      const monthPrefix = compDate.slice(0, 7);
                      const prevCount = compensationRequests.filter(
                        (req) => req.employeeId === account.id && req.date.slice(0, 7) === monthPrefix
                      ).length;
                      const monthCount = prevCount + compSlots.length;
                      const level = account.positionIds.includes("hr") ? "department_head" : (position.level || "staff");

                      const nextRequest = {
                        id: `comp-${Date.now()}`,
                        employeeId: account.id,
                        employeeName: account.displayName,
                        employeePositionLevel: level,
                        date: compDate,
                        slots: compSlots,
                        reason: compReason.trim(),
                        missingCountInMonth: monthCount,
                        requiredApprovals: getRequiredApprovals(level, monthCount),
                        approvals: [],
                        status: "pending",
                        createdAt: new Date().toISOString()
                      };

                      if (onCompensationRequestsChange) {
                        onCompensationRequestsChange([nextRequest, ...compensationRequests]);
                      }
                      setCompModalOpen(false);
                      setCompDate("");
                      setCompSlots([]);
                      setCompReason("");
                      setMessage("Đã gửi yêu cầu chấm công bù thành công! Đang chờ duyệt.");
                    }
                  }} 
                  disabled={compSlots.length === 0 || !compReason.trim()}
                  type="button"
                >
                  Gửi yêu cầu bù công
                </button>
              </div>
            )}
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
