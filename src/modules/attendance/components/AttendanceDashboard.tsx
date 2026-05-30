"use client";

import { CalendarDays, CheckCircle2, Clock, Send, UserCheck, AlertCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { Position } from "@/modules/hr/roles";
import type { ApprovalRole, AttendanceSlot, CompensationRequest } from "../types";
import { approveCompensation, getRequiredApprovals, attendanceSlots } from "../compensationRules";

const approvalNames: Record<ApprovalRole, string> = {
  hr: "Nhân sự",
  department_manager: "Quản lý bộ phận",
  director: "Giám đốc"
};

const approverByPosition: Record<string, ApprovalRole | null> = {
  hr: "hr",
  sale_manager: "department_manager",
  design_manager: "department_manager",
  workshop_manager: "department_manager",
  supervisor_lead: "department_manager",
  director: "director",
  admin: "director"
};

export function AttendanceDashboard({
  position,
  accounts,
  compensationRequests = [],
  onCompensationRequestsChange,
  attendance = {},
  onAttendanceChange
}: {
  position: Position;
  accounts: any[];
  compensationRequests: any[];
  onCompensationRequestsChange: (reqs: any[]) => void;
  attendance: Record<string, string>;
  onAttendanceChange: (att: Record<string, string>) => void;
}) {
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<AttendanceSlot[]>([]);
  const [reason, setReason] = useState("");

  const currentApprovalRole = approverByPosition[position.id] ?? null;
  const isHrOrDirector = position.id === "hr" || position.id === "director";

  // Lọc danh sách thợ và nhân viên cần chấm công (không tính Giám đốc)
  const workers = useMemo(() => {
    return accounts.filter((acc) => acc.status === "active" && !acc.positionIds.includes("director"));
  }, [accounts]);

  // Tính toán các mốc thiếu công thực tế của thợ được chọn
  const realMissingAttendance = useMemo(() => {
    if (!selectedWorkerId) return [];
    const list: Array<{ date: string; slots: AttendanceSlot[] }> = [];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();

    for (let d = 1; d <= today; d++) {
      const dateObj = new Date(year, month, d);
      if (dateObj.getDay() === 0) continue; // Bỏ qua Chủ Nhật
      
      const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const missingSlotsForDay: AttendanceSlot[] = [];
      
      attendanceSlots.forEach((slot) => {
        const key = `${selectedWorkerId}-${d}-${slot}`;
        // Nếu không có bản ghi chấm công (chưa chấm)
        if (!attendance[key]) {
          // Kiểm tra xem đã có yêu cầu công bù nào cho mốc này chưa
          const hasPendingOrApproved = compensationRequests.some(
            (req) => req.employeeId === selectedWorkerId && req.date === dateString && req.slots.includes(slot)
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
  }, [selectedWorkerId, attendance, compensationRequests]);

  const availableDates = realMissingAttendance;
  const selectedMissingItem = realMissingAttendance.find((item) => item.date === selectedDate);
  const availableSlots = selectedMissingItem?.slots ?? [];

  const pendingRequests = useMemo(() => {
    return compensationRequests.filter((req) => req.status === "pending");
  }, [compensationRequests]);

  // Gom nhóm các yêu cầu bù công chờ duyệt theo groupId hoặc id
  const groupedPendingRequests = useMemo(() => {
    const groups: Record<string, any[]> = {};
    compensationRequests.filter((req) => req.status === "pending").forEach((req) => {
      const key = req.groupId || req.id;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(req);
    });
    return Object.values(groups);
  }, [compensationRequests]);

  const approvedRequests = useMemo(() => {
    return compensationRequests.filter((req) => req.status === "approved");
  }, [compensationRequests]);

  // Đăng ký công bù trên giao diện Admin
  function submitCompensation() {
    if (!selectedWorkerId || !selectedDate || selectedSlots.length === 0 || !reason.trim()) return;

    const worker = accounts.find((acc) => acc.id === selectedWorkerId);
    if (!worker) return;

    // Tính số lần bù trong tháng hiện tại của thợ này
    const monthPrefix = selectedDate.slice(0, 7);
    const prevCount = compensationRequests.filter(
      (req) => req.employeeId === selectedWorkerId && req.date.slice(0, 7) === monthPrefix
    ).length;
    const monthCount = prevCount + selectedSlots.length;

    // Xác định PositionLevel của thợ
    const workerPosition = worker.positionIds[0] ?? "production_worker";
    const level = worker.positionIds.includes("hr") ? "department_head" : "staff";

    const nextRequest: CompensationRequest = {
      id: `comp-${Date.now()}`,
      employeeId: selectedWorkerId,
      employeeName: worker.displayName,
      employeePositionLevel: level,
      date: selectedDate,
      slots: selectedSlots,
      reason: reason.trim(),
      missingCountInMonth: monthCount,
      requiredApprovals: getRequiredApprovals(level, monthCount),
      approvals: [],
      status: "pending",
      createdAt: new Date().toISOString()
    };

    onCompensationRequestsChange([nextRequest, ...compensationRequests]);
    setSelectedDate("");
    setSelectedSlots([]);
    setReason("");
  }

  // Duyệt và ghi nhận công bù theo đợt gửi
  function handleApproveGroup(group: any[]) {
    if (!currentApprovalRole) return;
    
    const requestIds = group.map((req) => req.id);
    let nextAttendance = { ...attendance };
    let attendanceChanged = false;

    const updatedRequests = compensationRequests.map((request) => {
      if (!requestIds.includes(request.id)) return request;
      
      const nextRequest = approveCompensation(request, currentApprovalRole, position.name);
      
      // Nếu đã được duyệt hoàn toàn (hoàn thành tất cả các mốc phê duyệt)
      if (nextRequest.status === "approved") {
        const dayNumber = Number(nextRequest.date.split("-")[2]); // Lấy ngày dạng số
        nextRequest.slots.forEach((slot: string) => {
          const key = `${nextRequest.employeeId}-${dayNumber}-${slot}`;
          nextAttendance[key] = "compensated"; // Ghi nhận "Chấm công bù" (blue dot)
        });
        attendanceChanged = true;
      }
      return nextRequest;
    });

    if (attendanceChanged) {
      onAttendanceChange(nextAttendance);
    }
    onCompensationRequestsChange(updatedRequests);
  }

  return (
    <div className="grid gap-6">
      {/* GIAO DIỆN TẠO YÊU CẦU CÔNG BÙ (Chỉ HR hoặc Giám đốc được thao tác) */}
      {isHrOrDirector && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <CalendarDays className="h-6 w-6 text-orange-500" />
            <div>
              <h2 className="text-lg font-black text-slate-800">Đăng ký Chấm công bù cho Thợ/Nhân viên</h2>
              <p className="text-sm text-slate-500">HR thực hiện đăng ký khi thợ quên chấm công. Yêu cầu sẽ được chuyển đến đúng cấp duyệt quy định.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-black text-slate-700">
                1. Chọn nhân viên cần bù công *
                <select
                  className="h-11 rounded-lg border border-slate-200 px-3 bg-white"
                  value={selectedWorkerId}
                  onChange={(e) => {
                    setSelectedWorkerId(e.target.value);
                    setSelectedDate("");
                    setSelectedSlots([]);
                  }}
                >
                  <option value="">-- Chọn thợ / nhân sự --</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.displayName} ({w.department} - {w.username})
                    </option>
                  ))}
                </select>
              </label>

              {selectedWorkerId && (
                <label className="grid gap-1.5 text-sm font-black text-slate-700">
                  2. Chọn ngày thiếu công trong tháng *
                  <select
                    className="h-11 rounded-lg border border-slate-200 px-3 bg-white"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedSlots([]);
                    }}
                  >
                    <option value="">-- Chọn ngày thiếu công --</option>
                    {availableDates.map((item) => (
                      <option key={item.date} value={item.date}>
                        Ngày {formatDate(item.date)} (Thiếu {item.slots.length} mốc)
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {selectedDate && availableSlots.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-black text-slate-700">3. Chọn các mốc giờ cần bù *</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {attendanceSlots.map((slot) => {
                      const isMissing = availableSlots.includes(slot);
                      const checked = selectedSlots.includes(slot);
                      return (
                        <label
                          key={slot}
                          className={`flex min-h-11 items-center justify-center rounded-lg border px-3 text-xs font-black transition ${
                            checked 
                              ? "border-green-500 bg-green-50 text-green-700" 
                              : isMissing 
                                ? "border-slate-200 bg-white text-slate-700 hover:border-orange-300 cursor-pointer" 
                                : "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed opacity-50"
                          }`}
                        >
                          <input
                            className="sr-only"
                            type="checkbox"
                            disabled={!isMissing}
                            checked={checked}
                            onChange={() => {
                              setSelectedSlots((current) =>
                                current.includes(slot) ? current.filter((item) => item !== slot) : [...current, slot]
                              );
                            }}
                          />
                          {slot}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-black text-slate-700">
                4. Lý do bù công *
                <textarea
                  className="min-h-[110px] rounded-lg border border-slate-200 p-3 font-normal outline-none focus:border-orange-400"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Nhập lý do thợ bị thiếu công (Ví dụ: Thiết bị lỗi, làm ngoài công trình không mạng...)"
                />
              </label>

              <button
                className="mt-auto flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 font-black text-white hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition"
                disabled={!selectedWorkerId || !selectedDate || selectedSlots.length === 0 || !reason.trim()}
                onClick={submitCompensation}
                type="button"
              >
                <Send className="h-4 w-4" />
                GỬI YÊU CẦU CHẤM CÔNG BÙ
              </button>
            </div>
          </div>
        </section>
      )}

      {/* DANH SÁCH CHỜ DUYỆT (Tất cả HR, Quản lý, Giám đốc đều xem được) */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-amber-500" />
            <div>
              <h2 className="text-lg font-black text-slate-800">Danh sách Yêu cầu công bù chờ Duyệt</h2>
              <p className="text-sm text-slate-500">Các yêu cầu đang chờ phê duyệt từ bộ phận Nhân sự, Quản lý và Giám đốc.</p>
            </div>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">
            {pendingRequests.length} Đang chờ
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 font-bold">
            Hiện tại không có yêu cầu bù công nào đang chờ duyệt. 🎉
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groupedPendingRequests.map((group) => {
              const repRequest = group[0]; // Bản ghi đại diện cho cả đợt
              
              // Tìm cấp duyệt tiếp theo
              const nextRole = (repRequest.requiredApprovals as ApprovalRole[]).find(
                (role: ApprovalRole) => !repRequest.approvals.some((app: any) => app.role === role)
              );
              const canApprove = Boolean(currentApprovalRole && nextRole === currentApprovalRole);

              return (
                <article key={repRequest.groupId || repRequest.id} className="rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-black text-base text-slate-900">{repRequest.employeeName}</h4>
                        <div className="text-xs text-orange-500 font-bold mt-1.5 flex flex-col gap-1.5">
                          {group.map((req) => (
                            <div key={req.id} className="bg-orange-50/50 px-2 py-1 rounded border border-orange-100/50">
                              • Ngày {formatDate(req.date)} · Mốc: {req.slots.join(", ")}
                            </div>
                          ))}
                        </div>
                      </div>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-600 shrink-0">
                        Chờ {nextRole ? approvalNames[nextRole as ApprovalRole] : "Duyệt"}
                      </span>
                    </div>

                    <p className="mt-3 text-xs text-slate-600 font-semibold bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <strong>Lý do:</strong> {repRequest.reason} (Đăng ký bù: {repRequest.missingCountInMonth} mốc giờ)
                    </p>

                    {/* Tiến độ các cấp duyệt */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-bold mr-1">Các cấp duyệt:</span>
                      {(repRequest.requiredApprovals as ApprovalRole[]).map((role: ApprovalRole) => {
                        const approval = repRequest.approvals.find((app: any) => app.role === role);
                        return (
                          <span
                            key={role}
                            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black transition ${
                              approval 
                                ? "border-green-300 bg-green-50 text-green-700" 
                                : "border-slate-200 text-slate-400 bg-white"
                            }`}
                          >
                            {approvalNames[role as ApprovalRole]} {approval ? "✓" : ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4 flex gap-2">
                    {canApprove ? (
                      <button
                        className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 text-xs font-black text-white hover:bg-green-700 shadow-md shadow-green-600/10 transition"
                        onClick={() => handleApproveGroup(group)}
                        type="button"
                      >
                        <UserCheck className="h-4 w-4" />
                        XÁC NHẬN DUYỆT CÔNG BÙ CẢ ĐỢT ({group.length} ngày)
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold bg-slate-50 border border-slate-100 rounded-lg p-2.5 w-full justify-center">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {currentApprovalRole 
                          ? `Cần cấp ${nextRole ? approvalNames[nextRole as ApprovalRole] : "khác"} duyệt trước` 
                          : "Tài khoản của bạn không có thẩm quyền duyệt"}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* DANH SÁCH LỊCH SỬ ĐÃ DUYỆT */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <div>
            <h2 className="text-lg font-black text-slate-800">Lịch sử Chấm công bù đã Duyệt</h2>
            <p className="text-sm text-slate-500">Các yêu cầu công bù đã được duyệt thành công 100% và ghi nhận xanh vào bảng công.</p>
          </div>
        </div>

        {approvedRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 font-bold">
            Chưa có yêu cầu nào được duyệt trong tháng này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-black border-b border-slate-200">
                  <th className="p-3">Nhân viên</th>
                  <th className="p-3">Ngày bù công</th>
                  <th className="p-3">Mốc giờ</th>
                  <th className="p-3">Lý do</th>
                  <th className="p-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {approvedRequests.map((req) => (
                  <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50 transition font-bold">
                    <td className="p-3 text-slate-900">{req.employeeName}</td>
                    <td className="p-3 text-orange-500">{formatDate(req.date)}</td>
                    <td className="p-3 text-slate-700">{req.slots.join(", ")}</td>
                    <td className="p-3 text-slate-500 font-normal">{req.reason}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 text-xs font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                        Đã duyệt thành công
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
