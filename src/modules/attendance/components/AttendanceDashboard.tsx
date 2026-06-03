"use client";

import { CalendarDays, CheckCircle2, Clock, Send, UserCheck, AlertCircle, MapPin, Camera, Image, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { positions as roleDefinitions, type Position } from "@/modules/hr/roles";
import type { ApprovalRole, AttendanceSlot, CompensationRequest } from "../types";
import { approveCompensation, getRequiredApprovals, attendanceSlots } from "../compensationRules";

const approvalNames: Record<ApprovalRole, string> = {
  hr: "Nhân sự",
  department_manager: "Quản lý bộ phận",
  director: "Giám đốc"
};

const approverByPosition: Record<string, ApprovalRole | null> = {
  hr: "hr",
  hr_manager: "department_manager",
  sale_manager: "department_manager",
  design_manager: "department_manager",
  workshop_manager: "department_manager",
  supervisor_lead: "department_manager",
  accountant_manager: "department_manager",
  director: "director",
  admin: "director"
};

export function AttendanceDashboard({
  position,
  accounts,
  compensationRequests = [],
  onCompensationRequestsChange,
  attendance = {},
  onAttendanceChange,
  attendanceDetails = {}
}: {
  position: Position;
  accounts: any[];
  compensationRequests: any[];
  onCompensationRequestsChange: (reqs: any[]) => void;
  attendance: Record<string, string>;
  onAttendanceChange: (att: Record<string, string>) => void;
  attendanceDetails?: Record<string, { photo: string; gps: string; time: string }>;
}) {
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<AttendanceSlot[]>([]);
  const [reason, setReason] = useState("");
  const [activeTab, setActiveTab] = useState<"requests" | "selfies">("requests");

  const filteredSelfies = useMemo(() => {
    const list: Array<{
      key: string;
      userId: string;
      employeeName: string;
      department: string;
      day: string;
      slot: string;
      photo: string;
      gps: string;
      time: string;
    }> = [];

    const isHrOrDirectorOrAdmin = ["hr", "hr_manager", "director", "admin"].includes(position.id);
    const userDept = position.department;

    Object.entries(attendanceDetails).forEach(([key, details]: [string, any]) => {
      const parts = key.split("-");
      if (parts.length < 3) return;
      
      const slot = parts[parts.length - 1];
      const day = parts[parts.length - 2];
      const userId = parts.slice(0, parts.length - 2).join("-");

      const employee = accounts.find((acc) => acc.id === userId);
      if (!employee) return;

      // Director, HR, Admin sees everything. Department managers see only their department.
      const isVisible = isHrOrDirectorOrAdmin || (employee.department === userDept);
      if (!isVisible) return;

      list.push({
        key,
        userId,
        employeeName: employee.displayName,
        department: employee.department,
        day,
        slot,
        photo: details.photo || "",
        gps: details.gps || "",
        time: details.time || ""
      });
    });

    // Sort by day descending, then slot descending
    return list.sort((a, b) => {
      const dayDiff = Number(b.day) - Number(a.day);
      if (dayDiff !== 0) return dayDiff;
      return b.slot.localeCompare(a.slot);
    });
  }, [attendanceDetails, accounts, position]);

  const currentApprovalRole = approverByPosition[position.id] ?? null;
  const isHrOrDirector = position.id === "hr" || position.id === "hr_manager" || position.id === "director";

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
        const attendanceKind = attendance[key];
        const hasPendingOrApproved = compensationRequests.some(
          (req) => req.employeeId === selectedWorkerId && req.date === dateString && req.slots.includes(slot)
        );
        const canHrOverrideLocked = isHrOrDirector && attendanceKind === "leave_locked";
        if (attendanceKind === "normal" || attendanceKind === "compensated" || hasPendingOrApproved) return;
        if (!attendanceKind || canHrOverrideLocked) {
          missingSlotsForDay.push(slot);
          // Kiểm tra xem đã có yêu cầu công bù nào cho mốc này chưa
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
  }, [selectedWorkerId, attendance, compensationRequests, isHrOrDirector]);

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
    const level = roleDefinitions.find((item) => item.id === workerPosition)?.level ?? "staff";

    const createdAt = new Date().toISOString();
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
      approvals: isHrOrDirector
        ? [{ role: currentApprovalRole ?? "hr", approverName: position.name, approvedAt: createdAt }]
        : [],
      status: isHrOrDirector ? "approved" : "pending",
      createdAt
    };

    if (isHrOrDirector) {
      const dayNumber = Number(selectedDate.split("-")[2]);
      const nextAttendance = { ...attendance };
      selectedSlots.forEach((slot) => {
        const key = `${selectedWorkerId}-${dayNumber}-${slot}`;
        nextAttendance[key] = "compensated";
      });
      onAttendanceChange(nextAttendance);
    }

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
      {/* Tab Selector */}
      <div className="flex border-b border-slate-200 bg-slate-100 p-1.5 rounded-xl">
        <button
          className={`flex-1 py-3 text-sm font-black rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
            activeTab === "requests"
              ? "bg-white text-orange-600 shadow-md border border-slate-100 scale-[1.01]"
              : "text-slate-600 hover:bg-slate-200"
          }`}
          onClick={() => setActiveTab("requests")}
          type="button"
        >
          <CalendarDays className="h-4.5 w-4.5" />
          Duyệt công bù
        </button>
        <button
          className={`flex-1 py-3 text-sm font-black rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
            activeTab === "selfies"
              ? "bg-white text-orange-600 shadow-md border border-slate-100 scale-[1.01]"
              : "text-slate-600 hover:bg-slate-200"
          }`}
          onClick={() => setActiveTab("selfies")}
          type="button"
        >
          <Camera className="h-4.5 w-4.5" />
          Nhật ký ảnh chấm công
        </button>
      </div>

      {activeTab === "requests" ? (
        <>
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
                  const hasApprovedThisRole = repRequest.approvals.some((app: any) => app.role === currentApprovalRole);
                  const canApprove = Boolean(currentApprovalRole && repRequest.requiredApprovals.includes(currentApprovalRole) && !hasApprovedThisRole);
                  
                  // Lấy danh sách các cấp chưa duyệt để hiển thị trạng thái
                  const remainingRoles = (repRequest.requiredApprovals as ApprovalRole[]).filter(
                    (role: ApprovalRole) => !repRequest.approvals.some((app: any) => app.role === role)
                  );

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
                            Chờ {remainingRoles.map(r => approvalNames[r]).join(", ")}
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
                            {currentApprovalRole ? (
                              repRequest.requiredApprovals.includes(currentApprovalRole) ? (
                                hasApprovedThisRole ? (
                                  <span className="text-green-600">✓ Bạn đã phê duyệt. Đang chờ cấp khác.</span>
                                ) : (
                                  "Đang chờ duyệt..."
                                )
                              ) : (
                                "Tài khoản của bạn không có thẩm quyền duyệt"
                              )
                            ) : (
                              "Tài khoản của bạn không có thẩm quyền duyệt"
                            )}
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
        </>
      ) : (
        /* NHẬT KÝ ẢNH CHẤM CÔNG (Selfie Photo Log) */
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Camera className="h-6 w-6 text-orange-500" />
              <div>
                <h2 className="text-lg font-black text-slate-800">Nhật ký Ảnh chụp chấm công</h2>
                <p className="text-sm text-slate-500">
                  {["hr", "hr_manager", "director", "admin"].includes(position.id)
                    ? "Danh sách ảnh chụp và GPS lúc chấm công của toàn bộ nhân viên."
                    : `Danh sách ảnh chụp và GPS lúc chấm công của nhân viên thuộc bộ phận: ${position.department}.`}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">
              {filteredSelfies.length} lượt chấm
            </span>
          </div>

          {filteredSelfies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-slate-400 font-bold flex flex-col items-center justify-center gap-3">
              <Image className="h-16 w-16 text-slate-300" />
              Chưa có dữ liệu ảnh chấm công nào được gửi lên.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredSelfies.map((selfie) => {
                const coordsMatch = selfie.gps.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
                const mapsUrl = coordsMatch ? `https://www.google.com/maps/search/?api=1&query=${coordsMatch[1]},${coordsMatch[2]}` : null;
                
                return (
                  <article key={selfie.key} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm hover:shadow-md hover:border-slate-200 transition duration-200 flex flex-col justify-between">
                    <div>
                      {/* Photo Section */}
                      <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-200 flex items-center justify-center mb-3">
                        {selfie.photo ? (
                          <img src={selfie.photo} alt={`Selfie ${selfie.employeeName}`} className="w-full h-full object-cover scale-x-[-1]" />
                        ) : (
                          <div className="text-center p-4">
                            <Camera className="mx-auto h-10 w-10 text-slate-400" />
                            <div className="mt-1.5 text-xs text-slate-500 font-bold">Không có ảnh</div>
                          </div>
                        )}
                        <span className="absolute bottom-2 right-2 bg-slate-900/75 text-[10px] font-black text-white px-2 py-0.5 rounded backdrop-blur-sm">
                          Ca {selfie.slot}
                        </span>
                      </div>

                      {/* Info Section */}
                      <div className="grid gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-black text-slate-900 truncate">{selfie.employeeName}</h4>
                          <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 shrink-0">
                            {selfie.department}
                          </span>
                        </div>
                        <div className="text-slate-500 text-xs font-semibold flex items-center gap-1.5 mt-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          Ghi nhận: <span className="text-slate-700 font-bold">{selfie.time || "N/A"}</span>
                        </div>
                        <div className="text-slate-500 text-xs font-semibold flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                          Ngày: <span className="text-slate-700 font-bold">Ngày {selfie.day} Thg {new Date().getMonth() + 1}</span>
                        </div>
                      </div>
                    </div>

                    {/* GPS Section */}
                    {selfie.gps && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
                        <div className="flex items-start gap-1.5 text-[11px] text-slate-600 font-medium leading-relaxed">
                          <MapPin className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          <span className="truncate" title={selfie.gps}>{selfie.gps}</span>
                        </div>
                        {mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg bg-orange-50 border border-orange-200 text-[10px] font-black text-orange-600 hover:bg-orange-100 transition"
                          >
                            <ExternalLink className="h-3 w-3" />
                            ĐỐI CHIẾU GPS MAPS
                          </a>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
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
