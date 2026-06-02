"use client";

import { Edit3, Image, Lock, MapPin, Plus, Save, Trash2, UserRound, X, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { UserAccount } from "../accounts";
import { hasDuplicateUsername, suggestEmployeeCode, validateAccount } from "../accounts";
import type { LeaveRequest } from "../leave";
import { leaveStatusLabels, leaveTypeLabels } from "../leave";
import { positions } from "../roles";

type AttendanceDetail = { photo?: string; gps?: string; time?: string; gpsAddress?: string; gpsMeta?: { lat?: number; lng?: number; address?: string } };
type Slot = "07:30" | "11:30" | "13:30" | "17:30";
const attendanceSlots: Slot[] = ["07:30", "11:30", "13:30", "17:30"];

type Draft = Pick<UserAccount, "displayName" | "username" | "password" | "department" | "positionIds" | "salaryType" | "salaryValue" | "employeeCode" | "idCardNumber" | "idCardFrontImage" | "idCardBackImage" | "laborContractImage" | "laborContractNote">;

const departments = ["Giám đốc", "Phòng Sale", "Phòng Thiết kế", "Xưởng", "Giám sát", "Kế toán", "Nhân sự"];

const emptyDraft: Draft = {
  displayName: "",
  employeeCode: "",
  username: "",
  password: "",
  department: "Nhân sự",
  positionIds: [],
  salaryType: "daily",
  salaryValue: 350000,
  idCardNumber: "",
  idCardFrontImage: "",
  idCardBackImage: "",
  laborContractImage: "",
  laborContractNote: ""
};

export function AccountManagement({
  accounts,
  currentAccountId,
  currentPositionId,
  onAccountsChange,
  holidayDates,
  onHolidayDatesChange,
  leaveRequests,
  onLeaveRequestsChange,
  attendance,
  attendanceDetails
}: {
  accounts: UserAccount[];
  currentAccountId: string;
  currentPositionId: string;
  onAccountsChange: (accounts: UserAccount[]) => void;
  holidayDates: string[];
  onHolidayDatesChange: (dates: string[]) => void;
  leaveRequests: LeaveRequest[];
  onLeaveRequestsChange: (requests: LeaveRequest[]) => void;
  attendance: Record<string, string>;
  attendanceDetails: Record<string, AttendanceDetail>;
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [selectedAttendanceAccount, setSelectedAttendanceAccount] = useState<UserAccount | null>(null);
  const [selectedAttendanceKey, setSelectedAttendanceKey] = useState<string | null>(null);
  const [holidayMonth, setHolidayMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const canApprove = currentPositionId === "director";
  const canReviewLeave = currentPositionId === "director" || currentPositionId === "hr";
  const canEdit = currentPositionId === "hr" || currentPositionId === "director";
  const holidayMonthDays = useMemo(() => {
    const [yearText, monthText] = holidayMonth.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      return `${holidayMonth}-${day}`;
    });
  }, [holidayMonth]);
  const suggestedEmployeeCode = useMemo(() => suggestEmployeeCode(accounts, draft.department, draft.positionIds), [accounts, draft.department, draft.positionIds]);
  const attendanceMonthDays = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => index + 1);
  }, []);
  const selectedAttendanceDetail = selectedAttendanceKey ? attendanceDetails[selectedAttendanceKey] : null;

  function saveAccount() {
    const normalizedEmployeeCode = ((draft.employeeCode || "").trim() || suggestEmployeeCode(accounts, draft.department, draft.positionIds)).toUpperCase();
    const issues = validateAccount(draft);
    if (!normalizedEmployeeCode) {
      issues.push("Mã nhân viên là bắt buộc.");
    }
    if (hasDuplicateUsername(accounts, draft.username, editingId)) {
      issues.push("Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác.");
    }
    if (accounts.some((account) => account.id !== editingId && (account.employeeCode || "").trim().toLowerCase() === normalizedEmployeeCode.toLowerCase())) {
      issues.push("Mã nhân viên đã tồn tại.");
    }
    if (draft.salaryValue === undefined || isNaN(draft.salaryValue) || draft.salaryValue <= 0) {
      issues.push("Mức lương phải là một số lớn hơn 0.");
    }
    if (issues.length) {
      setMessage(issues.join(" "));
      return;
    }

    const normalizedDraft = {
      ...draft,
      displayName: draft.displayName.trim(),
      employeeCode: normalizedEmployeeCode,
      username: draft.username.trim().toLowerCase(),
      password: draft.password.trim(),
      salaryValue: Number(draft.salaryValue),
      idCardNumber: draft.idCardNumber?.trim(),
      laborContractNote: draft.laborContractNote?.trim()
    };

    if (editingId) {
      onAccountsChange(accounts.map((account) => account.id === editingId ? { ...account, ...normalizedDraft } : account));
      setEditingId(null);
      setMessage("Đã sửa tài khoản.");
    } else {
      const createdByDirector = currentPositionId === "director";
      onAccountsChange([
        {
          id: `u-${Date.now()}`,
          ...normalizedDraft,
          status: createdByDirector ? "active" : "pending_admin"
        },
        ...accounts
      ]);
      setMessage(createdByDirector ? "Giám đốc đã tạo tài khoản. Tài khoản được kích hoạt ngay." : "Nhân sự đã tạo tài khoản. Tài khoản đang chờ Giám đốc duyệt.");
    }

    setDraft(emptyDraft);
  }

  function startEdit(account: UserAccount) {
    setEditingId(account.id);
    setDraft({
      displayName: account.displayName,
      employeeCode: account.employeeCode || "",
      username: account.username,
      password: account.password,
      department: account.department,
      positionIds: account.positionIds,
      salaryType: account.salaryType ?? "daily",
      salaryValue: account.salaryValue ?? (account.positionIds.includes("hr") ? 420000 : account.positionIds.includes("accountant") ? 400000 : 350000),
      idCardNumber: account.idCardNumber || "",
      idCardFrontImage: account.idCardFrontImage || "",
      idCardBackImage: account.idCardBackImage || "",
      laborContractImage: account.laborContractImage || "",
      laborContractNote: account.laborContractNote || ""
    });
    setMessage(`Đang sửa tài khoản ${account.displayName}.`);
  }

  function deleteAccount(account: UserAccount) {
    if (account.positionIds.includes("director")) {
      setMessage("Không thể xóa tài khoản Giám đốc.");
      return;
    }
    if (account.id === currentAccountId) {
      setMessage("Nhân sự không được xóa tài khoản của chính mình.");
      return;
    }
    const ok = window.confirm(`Xóa tài khoản ${account.displayName}? Dữ liệu lịch sử nên được giữ ở backend khi nối Supabase.`);
    if (!ok) return;
    onAccountsChange(accounts.filter((item) => item.id !== account.id));
    setMessage(`Đã xóa tài khoản ${account.displayName}.`);
  }

  function toggleLock(accountId: string) {
    onAccountsChange(accounts.map((account) => {
      if (account.id !== accountId) return account;
      return { ...account, status: account.status === "locked" ? "active" : "locked" };
    }));
  }

  function approve(accountId: string) {
    onAccountsChange(accounts.map((account) => account.id === accountId ? { ...account, status: "active" } : account));
    setMessage("Giám đốc đã duyệt tài khoản.");
  }

  function toggleHolidayDate(date: string) {
    const nextDates = holidayDates.includes(date)
      ? holidayDates.filter((item) => item !== date)
      : [...holidayDates, date].sort();
    onHolidayDatesChange(nextDates);
    setMessage(`Đã cập nhật ngày nghỉ lễ ${date}.`);
  }

  function autofillEmployeeCode() {
    setDraft((current) => ({
      ...current,
      employeeCode: suggestEmployeeCode(accounts, current.department, current.positionIds)
    }));
    setMessage("Đã tạo mã nhân viên tự động. Nhân sự vẫn có thể sửa tay trước khi lưu.");
  }

  function updateLeaveStatus(requestId: string, status: "approved" | "rejected") {
    onLeaveRequestsChange(leaveRequests.map((request) => request.id === requestId ? {
      ...request,
      status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: currentPositionId
    } : request));
    setMessage(status === "approved" ? "Đã duyệt đơn nghỉ phép." : "Đã từ chối đơn nghỉ phép.");
  }

  function readFileAsDataUrl(file: File, onDone: (result: string) => void) {
    const reader = new FileReader();
    reader.onload = () => onDone(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  function getAttendanceStatusLabel(kind?: string) {
    if (kind === "normal") return "Đã chấm công";
    if (kind === "compensated") return "Chấm công bù";
    if (kind === "leave_locked") return "Nghỉ";
    return "Chưa chấm";
  }

  function getAttendanceGpsText(detail: AttendanceDetail | null) {
    if (!detail) return "Chưa có vị trí";
    return detail.gpsAddress || detail.gpsMeta?.address || detail.gps || "Chưa có vị trí";
  }

  function formatAttendanceTime(detail: AttendanceDetail | null, attendanceKey: string | null) {
    const rawTime = detail?.time;
    if (!rawTime) return "Chưa có thời gian lưu";
    const parsed = new Date(rawTime);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString("vi-VN");
    }
    const parts = attendanceKey?.split("-") || [];
    const dayToken = parts.length >= 3 ? Number(parts[parts.length - 2]) : NaN;
    const timeMatch = rawTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!Number.isNaN(dayToken) && timeMatch) {
      const now = new Date();
      const fallback = new Date(
        now.getFullYear(),
        now.getMonth(),
        dayToken,
        Number(timeMatch[1]),
        Number(timeMatch[2]),
        Number(timeMatch[3] || "0")
      );
      if (!Number.isNaN(fallback.getTime())) {
        return fallback.toLocaleString("vi-VN");
      }
    }
    return "Chưa có thời gian lưu";
  }

  function openAttendanceModal(account: UserAccount) {
    setSelectedAttendanceAccount(account);
    const firstKey = attendanceMonthDays
      .flatMap((day) => attendanceSlots.map((slot) => `${account.id}-${day}-${slot}`))
      .find((key) => attendance[key] || attendanceDetails[key]?.photo || attendanceDetails[key]?.time);
    setSelectedAttendanceKey(firstKey ?? `${account.id}-1-07:30`);
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <UserRound className="h-6 w-6 text-orange-500" />
          <div>
            <h2 className="text-xl font-black">Quản lý tài khoản nhân sự</h2>
            <p className="text-sm text-slate-500">Nhân sự tạo tài khoản cần Giám đốc duyệt. Giám đốc tạo tài khoản thì kích hoạt ngay.</p>
          </div>
        </div>

        {canEdit ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <input className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-400" placeholder="Tên hiển thị *" value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} />
              <div className="flex gap-2">
                <input className="h-11 flex-1 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-400 font-bold" placeholder="Mã nhân viên *" value={draft.employeeCode || ""} onChange={(event) => setDraft({ ...draft, employeeCode: event.target.value.toUpperCase() })} />
                <button className="rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700" onClick={autofillEmployeeCode} type="button">Tạo mã</button>
              </div>
              <input className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-400" placeholder="Tên đăng nhập *" value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} />
              <input className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-400" placeholder="Mật khẩu *" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} />
              <input className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-400" placeholder="Số CCCD" value={draft.idCardNumber || ""} onChange={(event) => setDraft({ ...draft, idCardNumber: event.target.value })} />
              <select className="h-11 rounded-lg border border-slate-200 px-3 bg-white" value={draft.department} onChange={(event) => setDraft({ ...draft, department: event.target.value })}>
                {departments.map((department) => <option key={department}>{department}</option>)}
              </select>
              <select className="h-11 rounded-lg border border-slate-200 px-3 bg-white font-bold text-slate-700" value={draft.salaryType || "daily"} onChange={(event) => setDraft({ ...draft, salaryType: event.target.value as "daily" | "monthly" })}>
                <option value="daily">Lương ngày</option>
                <option value="monthly">Lương tháng</option>
              </select>
              <input className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-400 font-bold" type="number" placeholder="Mức lương (VNĐ) *" value={draft.salaryValue ?? ""} onChange={(event) => setDraft({ ...draft, salaryValue: event.target.value === "" ? undefined : Number(event.target.value) })} />
              <input className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-400" placeholder="Ghi chú hợp đồng" value={draft.laborContractNote || ""} onChange={(event) => setDraft({ ...draft, laborContractNote: event.target.value })} />
              <button className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 font-black text-white" onClick={saveAccount} type="button">
                {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? "Lưu sửa" : "Tạo tài khoản"}
              </button>
            </div>

            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-black text-slate-900">Quy ước mã nhân viên</div>
              <div className="mt-2 grid gap-1 md:grid-cols-2">
                <div><span className="font-black text-orange-600">S</span> = Sale</div>
                <div><span className="font-black text-orange-600">A</span> = Accountant / Kế toán</div>
                <div><span className="font-black text-orange-600">T</span> = Technical / Kỹ thuật / Thợ</div>
                <div><span className="font-black text-orange-600">D</span> = Design / Thiết kế</div>
              </div>
              <div className="mt-2 text-xs font-bold text-slate-500">
                Số cuối là thứ tự trong nhóm. Người đầu tiên hoặc trưởng nhóm đầu tiên thường là mã số <span className="text-slate-800">1</span>.
              </div>
              <div className="mt-2 text-xs font-bold text-blue-700">
                Gợi ý theo lựa chọn hiện tại: {suggestedEmployeeCode}
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="grid gap-1 text-sm font-bold text-slate-600">
                Ảnh CCCD mặt trước
                <input className="block text-sm font-normal" type="file" accept="image/*" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  readFileAsDataUrl(file, (result) => setDraft((current) => ({ ...current, idCardFrontImage: result })));
                }} />
              </label>
              <label className="grid gap-1 text-sm font-bold text-slate-600">
                Ảnh CCCD mặt sau
                <input className="block text-sm font-normal" type="file" accept="image/*" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  readFileAsDataUrl(file, (result) => setDraft((current) => ({ ...current, idCardBackImage: result })));
                }} />
              </label>
              <label className="grid gap-1 text-sm font-bold text-slate-600">
                Hợp đồng lao động
                <input className="block text-sm font-normal" type="file" accept="image/*,.pdf" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  readFileAsDataUrl(file, (result) => setDraft((current) => ({ ...current, laborContractImage: result })));
                }} />
              </label>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
              {draft.idCardFrontImage ? <span className="rounded-full bg-green-50 px-3 py-1 text-green-700">Đã có CCCD mặt trước</span> : null}
              {draft.idCardBackImage ? <span className="rounded-full bg-green-50 px-3 py-1 text-green-700">Đã có CCCD mặt sau</span> : null}
              {draft.laborContractImage ? <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">Đã có file hợp đồng</span> : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {positions.filter((position) => position.id !== "admin").map((position) => {
                const active = draft.positionIds.includes(position.id);
                return (
                  <button key={position.id} className={`rounded-full border px-3 py-1 text-sm font-bold ${active ? "border-orange-500 bg-orange-50 text-orange-600" : "border-slate-200 text-slate-500"}`} onClick={() => {
                    setDraft((current) => ({
                      ...current,
                      positionIds: active ? current.positionIds.filter((id) => id !== position.id) : [...current.positionIds, position.id]
                    }));
                  }} type="button">
                    {position.name}
                  </button>
                );
              })}
            </div>

            {editingId ? (
              <button className="mt-3 flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 font-bold" onClick={() => {
                setEditingId(null);
                setDraft(emptyDraft);
                setMessage("");
              }} type="button">
                <X className="h-4 w-4" />
                Hủy sửa
              </button>
            ) : null}
          </>
        ) : (
          <div className="rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-600">Vị trí này chỉ được xem danh sách tài khoản.</div>
        )}

        {message ? <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700">{message}</div> : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Ngày nghỉ lễ</h2>
            <p className="text-sm text-slate-500">Nhân sự hoặc Giám đốc tích các ngày nghỉ lễ để khóa chấm công, chỉ cho phép tăng ca.</p>
          </div>
          <input
            className="h-11 rounded-lg border border-slate-200 px-3 font-bold outline-none focus:border-orange-400"
            type="month"
            value={holidayMonth}
            onChange={(event) => setHolidayMonth(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-7 gap-2">
          {holidayMonthDays.map((date) => {
            const active = holidayDates.includes(date);
            return (
              <button
                key={date}
                className={`min-h-12 rounded-lg border text-sm font-black transition ${active ? "border-orange-500 bg-orange-50 text-orange-600" : "border-slate-200 bg-white text-slate-500"}`}
                disabled={!canEdit}
                onClick={() => toggleHolidayDate(date)}
                type="button"
              >
                {date.slice(-2)}
              </button>
            );
          })}
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700">
          Đã chọn {holidayDates.filter((date) => date.startsWith(holidayMonth)).length} ngày nghỉ trong tháng {holidayMonth}.
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Đơn nghỉ phép</h2>
            <p className="text-sm text-slate-500">Nhân sự và Giám đốc duyệt phép năm, nghỉ không lương, nghỉ ốm, nghỉ nửa ngày.</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{leaveRequests.length} đơn</div>
        </div>
        <div className="grid gap-3">
          {leaveRequests.length === 0 ? <div className="rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-500">Chưa có đơn nghỉ phép nào.</div> : leaveRequests.map((request) => (
            <div key={request.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-black">{request.employeeName} <span className="text-orange-600">({request.employeeCode})</span></div>
                  <div className="text-sm text-slate-500">{request.department} • {leaveTypeLabels[request.type]} • {request.fromDate} → {request.toDate} • {request.days} ngày</div>
                  <div className="mt-2 text-sm text-slate-700">{request.reason}</div>
                </div>
                <div className="text-right">
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{leaveStatusLabels[request.status]}</div>
                  {request.reviewedAt ? <div className="mt-2 text-xs text-slate-400">Duyệt lúc {new Date(request.reviewedAt).toLocaleString("vi-VN")}</div> : null}
                </div>
              </div>
              {canReviewLeave && request.status === "pending" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="min-h-10 rounded-lg border border-green-500 px-3 font-bold text-green-600" onClick={() => updateLeaveStatus(request.id, "approved")} type="button">Duyệt</button>
                  <button className="min-h-10 rounded-lg border border-red-200 px-3 font-bold text-red-600" onClick={() => updateLeaveStatus(request.id, "rejected")} type="button">Từ chối</button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="min-w-[920px]">
        <div className="grid grid-cols-[1.3fr_1fr_0.9fr_1.1fr_1.2fr_0.8fr_1.4fr] bg-slate-50 px-4 py-3 text-sm font-black text-slate-600">
          <div>Nhân sự</div>
          <div>Mã NV / Hồ sơ</div>
          <div>Đăng nhập</div>
          <div>Lương</div>
          <div>Chức vụ</div>
          <div>Trạng thái</div>
          <div>Thao tác</div>
        </div>
        {accounts.map((account) => {
          const typeLabel = account.salaryType === "monthly" ? "Lương tháng" : "Lương ngày";
          const fallbackVal = account.salaryValue ?? (account.positionIds.includes("hr") ? 420000 : account.positionIds.includes("accountant") ? 400000 : 350000);
          return (
            <div key={account.id} className="grid grid-cols-[1.3fr_1fr_0.9fr_1.1fr_1.2fr_0.8fr_1.4fr] items-center border-t border-slate-200 px-4 py-4 text-sm">
              <div>
                <button className="font-black text-left text-slate-900 hover:text-orange-600" onClick={() => openAttendanceModal(account)} type="button">{account.displayName}</button>
                <div className="text-slate-500">{account.department}</div>
              </div>
              <div>
                <div className="font-black text-orange-600">{account.employeeCode || "Chưa có mã"}</div>
                <div className="text-xs text-slate-500">{account.idCardNumber ? `CCCD: ${account.idCardNumber}` : "Chưa có CCCD"}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-bold">
                  {account.idCardFrontImage ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-green-700">CCCD trước</span> : null}
                  {account.idCardBackImage ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-green-700">CCCD sau</span> : null}
                  {account.laborContractImage ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">Hợp đồng</span> : null}
                </div>
              </div>
              <div>
                <div>{account.username}</div>
                <div className="text-slate-500">Mật khẩu có thể đổi</div>
              </div>
              <div>
                <div className="font-bold text-slate-900">{fallbackVal.toLocaleString("vi-VN")} đ</div>
                <div className="text-xs text-slate-500 font-bold">{typeLabel}</div>
              </div>
              <div>{account.positionIds.map((id) => positions.find((position) => position.id === id)?.name ?? id).join(", ")}</div>
              <div className="font-bold">{account.status === "active" ? "Hoạt động" : account.status === "locked" ? "Đã khóa" : "Chờ Giám đốc"}</div>
              <div className="flex flex-wrap gap-2">
                {account.status === "pending_admin" && canApprove ? (
                  <button className="flex min-h-10 items-center gap-2 rounded-lg border border-green-500 px-3 font-bold text-green-600" onClick={() => approve(account.id)} type="button">
                    <Save className="h-4 w-4" />
                    Duyệt
                  </button>
                ) : null}
                {canEdit ? (
                  <>
                    <button className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 font-bold" onClick={() => startEdit(account)} type="button">
                      <Edit3 className="h-4 w-4" />
                      Sửa
                    </button>
                    <button className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 font-bold" onClick={() => toggleLock(account.id)} type="button">
                      {account.status === "locked" ? <Lock className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {account.status === "locked" ? "Mở khóa" : "Khóa"}
                    </button>
                    <button className="flex min-h-10 items-center gap-2 rounded-lg border border-red-200 px-3 font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-50" disabled={account.id === currentAccountId || account.positionIds.includes("director")} onClick={() => deleteAccount(account)} type="button">
                      <Trash2 className="h-4 w-4" />
                      Xóa
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {selectedAttendanceAccount ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-xl font-black">Bảng chấm công nhân sự</h3>
                <p className="text-sm text-slate-500">
                  {selectedAttendanceAccount.displayName} • {selectedAttendanceAccount.employeeCode || "Chưa có mã NV"}
                </p>
              </div>
              <button className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" onClick={() => setSelectedAttendanceAccount(null)} type="button">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-5 xl:grid-cols-[minmax(0,1.8fr)_340px]">
              <div className="min-h-0 overflow-auto rounded-xl border border-slate-200">
                <div className="min-w-[1240px]">
                  <div className="grid border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600" style={{ gridTemplateColumns: `110px repeat(${attendanceMonthDays.length}, 34px)` }}>
                    <div>Mốc giờ</div>
                    {attendanceMonthDays.map((day) => <div key={day} className="text-center">{day}</div>)}
                  </div>
                  {attendanceSlots.map((slot) => (
                    <div key={slot} className="grid items-center border-b border-slate-100 px-3 py-2" style={{ gridTemplateColumns: `110px repeat(${attendanceMonthDays.length}, 34px)` }}>
                      <div className="text-sm font-black text-slate-800">{slot}</div>
                      {attendanceMonthDays.map((day) => {
                        const key = `${selectedAttendanceAccount.id}-${day}-${slot}`;
                        const kind = attendance[key];
                        const detail = attendanceDetails[key];
                        const active = selectedAttendanceKey === key;
                        return (
                          <button
                            key={key}
                            className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full border transition ${active ? "border-orange-500 ring-2 ring-orange-100" : "border-transparent hover:border-slate-200"} ${kind === "normal" ? "bg-green-500" : kind === "compensated" ? "bg-blue-500" : kind === "leave_locked" ? "bg-amber-500" : detail ? "bg-violet-500" : "bg-slate-300"}`}
                            onClick={() => setSelectedAttendanceKey(key)}
                            title={`${day}/${new Date().getMonth() + 1} ${slot}`}
                            type="button"
                          >
                            <span className="sr-only">{key}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-black text-slate-900">Chi tiết mốc chấm công</div>
                {selectedAttendanceKey ? (
                  <>
                    <div className="mt-3 rounded-lg bg-white p-3 text-sm">
                      <div><span className="font-black">Mốc:</span> {selectedAttendanceKey.split("-").slice(-2).join(" • ")}</div>
                      <div className="mt-2"><span className="font-black">Trạng thái:</span> {getAttendanceStatusLabel(attendance[selectedAttendanceKey])}</div>
                      <div className="mt-2"><span className="font-black">Thời gian:</span> {formatAttendanceTime(selectedAttendanceDetail, selectedAttendanceKey)}</div>
                      <div className="mt-2 flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-orange-500" /><span><span className="font-black">GPS:</span> {getAttendanceGpsText(selectedAttendanceDetail)}</span></div>
                    </div>
                    <div className="mt-4 rounded-lg bg-white p-3">
                      <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                        <Image className="h-4 w-4 text-orange-500" />
                        Ảnh chấm công
                      </div>
                      {selectedAttendanceDetail?.photo ? (
                        <a href={selectedAttendanceDetail.photo} target="_blank" rel="noreferrer">
                          <img alt="Ảnh chấm công" className="max-h-[360px] w-full rounded-lg object-contain" src={selectedAttendanceDetail.photo} />
                        </a>
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">
                          Chưa có ảnh lưu cho mốc này.
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
