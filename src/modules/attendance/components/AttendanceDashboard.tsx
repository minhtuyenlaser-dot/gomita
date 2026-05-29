"use client";

import { Camera, CalendarDays, CheckCircle2, Clock, Send } from "lucide-react";
import { useMemo, useState } from "react";
import type { Position } from "@/modules/hr/roles";
import { demoOrders } from "@/modules/orders/orderFlow";
import type { ApprovalRole, AttendanceSlot, CompensationRequest } from "../types";
import { approveCompensation, attendanceSlots, createCompensationRequest, getDemoMissingAttendance, getSlotWindow, isSlotOpen } from "../compensationRules";

const approvalNames: Record<ApprovalRole, string> = {
  hr: "Nhân sự",
  department_manager: "Quản lý bộ phận",
  director: "Giám đốc"
};

const approverByPosition: Record<string, ApprovalRole | null> = {
  hr: "hr",
  sale_manager: "department_manager",
  workshop_manager: "department_manager",
  supervisor_lead: "department_manager",
  director: "director",
  admin: "director"
};

export function AttendanceDashboard({ position }: { position: Position }) {
  const [mode, setMode] = useState<"clock" | "compensation">("clock");
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<AttendanceSlot[]>([]);
  const [reason, setReason] = useState("");
  const [requests, setRequests] = useState<CompensationRequest[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Array<{ slot: AttendanceSlot; checkedAt: string; orderAnswers: Record<string, boolean> }>>([]);
  const [clockFlow, setClockFlow] = useState<{ slot: AttendanceSlot; orderIndex: number; answers: Record<string, boolean> } | null>(null);

  const missingAttendance = useMemo(() => getDemoMissingAttendance(visibleMonth.getFullYear(), visibleMonth.getMonth()), [visibleMonth]);
  const pendingRequests = requests.filter((request) => request.status === "pending");
  const approvedRequests = requests.filter((request) => request.status === "approved");
  const currentApprovalRole = approverByPosition[position.id] ?? null;
  const workerOrders = demoOrders.filter((order) => ["Sản xuất", "Lắp đặt"].includes(order.step));

  const availableDates = missingAttendance.filter((item) => {
    return item.slots.some((slot) => !requests.some((request) => request.date === item.date && request.slots.includes(slot)));
  });

  const selectedMissingItem = missingAttendance.find((item) => item.date === selectedDate);
  const availableSlots = selectedMissingItem?.slots.filter((slot) => {
    return !requests.some((request) => request.date === selectedDate && request.slots.includes(slot));
  }) ?? [];

  function submitCompensation() {
    if (!selectedDate || selectedSlots.length === 0 || !reason.trim()) return;

    const monthCount = requests.filter((request) => request.date.slice(0, 7) === selectedDate.slice(0, 7)).length + selectedSlots.length;
    const nextRequest = createCompensationRequest({
      employeeName: "Người lao động GOMITA",
      employeePositionLevel: position.level,
      date: selectedDate,
      slots: selectedSlots,
      reason: reason.trim(),
      missingCountInMonth: monthCount
    });

    setRequests((current) => [nextRequest, ...current]);
    setSelectedDate("");
    setSelectedSlots([]);
    setReason("");
  }

  function approveRequest(requestId: string) {
    if (!currentApprovalRole) return;
    setRequests((current) => current.map((request) => (request.id === requestId ? approveCompensation(request, currentApprovalRole, position.name) : request)));
  }

  function startClockFlow(slot: AttendanceSlot) {
    if (attendanceRecords.some((record) => record.slot === slot) || !isSlotOpen(slot)) return;
    setClockFlow({ slot, orderIndex: 0, answers: {} });
  }

  function answerOrder(done: boolean) {
    if (!clockFlow) return;
    const order = workerOrders[clockFlow.orderIndex];
    const answers = { ...clockFlow.answers, [order.code]: done };
    const nextIndex = clockFlow.orderIndex + 1;

    if (nextIndex < workerOrders.length) {
      setClockFlow({ ...clockFlow, orderIndex: nextIndex, answers });
      return;
    }

    setAttendanceRecords((current) => [...current, { slot: clockFlow.slot, checkedAt: new Date().toISOString(), orderAnswers: answers }]);
    setClockFlow(null);
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2">
        <button
          className={`flex min-h-24 items-center gap-4 rounded-lg border p-4 text-left ${mode === "clock" ? "border-gomita-green bg-emerald-50 text-gomita-green" : "border-gomita-line bg-white text-gomita-ink"}`}
          onClick={() => setMode("clock")}
          type="button"
        >
          <span className="grid h-14 w-14 place-items-center rounded-lg bg-gomita-green text-white">
            <Camera className="h-7 w-7" />
          </span>
          <span>
            <span className="block text-xl font-black">Chấm công ngay</span>
            <span className="mt-1 block text-sm text-gomita-muted">Hỏi tình trạng từng đơn trước, sau đó mới mở camera.</span>
          </span>
        </button>

        <button
          className={`flex min-h-24 items-center gap-4 rounded-lg border p-4 text-left ${mode === "compensation" ? "border-gomita-orange bg-orange-50 text-gomita-orange" : "border-gomita-line bg-white text-gomita-ink"}`}
          onClick={() => setMode("compensation")}
          type="button"
        >
          <span className="grid h-14 w-14 place-items-center rounded-lg bg-gomita-orange text-white">
            <CalendarDays className="h-7 w-7" />
          </span>
          <span>
            <span className="block text-xl font-black">Chấm công bù</span>
            <span className="mt-1 block text-sm text-gomita-muted">Không cần ảnh, chọn ngày thiếu công và nhập lý do.</span>
          </span>
        </button>
      </section>

      {mode === "clock" ? (
        <section className="grid gap-4 rounded-lg border border-gomita-line bg-white p-4">
          <div>
            <h2 className="text-xl font-black">Chấm công hôm nay</h2>
            <p className="mt-1 text-sm text-gomita-muted">Mỗi mốc mở trước 15 phút và đóng sau 1 tiếng. Ảnh sẽ lưu kèm GPS, thời gian và dấu ngày giờ khi nối Supabase Storage.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {attendanceSlots.map((slot) => {
              const record = attendanceRecords.find((item) => item.slot === slot);
              const open = isSlotOpen(slot);
              const window = getSlotWindow(slot);
              return (
                <button
                  key={slot}
                  className={`min-h-32 rounded-lg border p-4 text-left ${record ? "border-emerald-300 bg-emerald-50" : open ? "border-gomita-green bg-white" : "border-gomita-line bg-slate-50 opacity-70"}`}
                  disabled={Boolean(record) || !open}
                  onClick={() => startClockFlow(slot)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-2xl font-black">{slot}</span>
                    {record ? <CheckCircle2 className="h-6 w-6 text-gomita-green" /> : <Clock className="h-6 w-6 text-gomita-muted" />}
                  </div>
                  <div className="mt-3 text-sm font-bold text-gomita-muted">
                    {record ? `Đã chấm lúc ${formatTime(record.checkedAt)}` : open ? "Bấm để trả lời đơn và chụp ảnh" : `${formatTime(window.opensAt.toISOString())} - ${formatTime(window.closesAt.toISOString())}`}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {clockFlow ? (
        <section className="rounded-lg border border-gomita-green bg-emerald-50 p-4">
          <div className="text-sm font-bold text-gomita-muted">Trước khi mở camera</div>
          <h2 className="mt-1 text-xl font-black">Bạn đã làm xong đơn {workerOrders[clockFlow.orderIndex]?.code} chưa?</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button className="min-h-12 rounded-lg bg-gomita-green px-5 font-black text-white" onClick={() => answerOrder(true)} type="button">Đã xong</button>
            <button className="min-h-12 rounded-lg border border-gomita-line bg-white px-5 font-black" onClick={() => answerOrder(false)} type="button">Chưa xong</button>
          </div>
        </section>
      ) : null}

      {mode === "compensation" ? (
        <section className="grid gap-4 rounded-lg border border-gomita-line bg-white p-4 md:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Chấm công bù</h2>
                <p className="mt-1 text-sm text-gomita-muted">Người lao động tích ngày thiếu công, chọn mốc giờ và gửi lý do. Không yêu cầu ảnh.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-gomita-green">Không cần camera</span>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2 font-bold">
                Ngày thiếu công
                <select
                  className="focus-ring rounded-lg border border-gomita-line px-3 py-3"
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setSelectedSlots([]);
                  }}
                >
                  <option value="">Chọn ngày thiếu công</option>
                  {availableDates.map((item) => (
                    <option key={item.date} value={item.date}>
                      {formatDate(item.date)} - còn {item.slots.length} mốc
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <div className="mb-2 font-bold">Mốc giờ cần bù</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {attendanceSlots.map((slot) => {
                    const disabled = !availableSlots.includes(slot);
                    const checked = selectedSlots.includes(slot);
                    return (
                      <label key={slot} className={`flex min-h-14 items-center justify-center rounded-lg border px-3 font-black ${checked ? "border-gomita-green bg-emerald-50 text-gomita-green" : "border-gomita-line bg-white"} ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}>
                        <input
                          className="sr-only"
                          checked={checked}
                          disabled={disabled}
                          type="checkbox"
                          onChange={() => {
                            setSelectedSlots((current) => (current.includes(slot) ? current.filter((item) => item !== slot) : [...current, slot]));
                          }}
                        />
                        {slot}
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="grid gap-2 font-bold">
                Lý do
                <textarea className="focus-ring min-h-28 rounded-lg border border-gomita-line px-3 py-3 font-normal" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập lý do chấm công bù" />
              </label>

              <button className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gomita-green px-5 font-black text-white disabled:opacity-40" disabled={!selectedDate || selectedSlots.length === 0 || !reason.trim()} onClick={submitCompensation} type="button">
                <Send className="h-5 w-5" />
                Gửi yêu cầu chấm công bù
              </button>
            </div>
          </div>

          <AttendanceMonth approvedRequests={approvedRequests} missingAttendance={missingAttendance} pendingRequests={pendingRequests} visibleMonth={visibleMonth} onMonthChange={setVisibleMonth} />
        </section>
      ) : null}

      <section className="grid gap-4 rounded-lg border border-gomita-line bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-black">Danh sách chờ xác nhận</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-gomita-muted">{pendingRequests.length} yêu cầu</span>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gomita-line p-6 text-center text-gomita-muted">Không có yêu cầu chờ xác nhận.</div>
        ) : (
          <div className="grid gap-3">
            {pendingRequests.map((request) => {
              const nextRole = request.requiredApprovals.find((role) => !request.approvals.some((approval) => approval.role === role));
              const canApprove = Boolean(currentApprovalRole && nextRole === currentApprovalRole);
              return (
                <article key={request.id} className="rounded-lg border border-gomita-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black">{formatDate(request.date)} · {request.slots.join(", ")}</div>
                      <div className="mt-1 text-sm text-gomita-muted">Thiếu lần {request.missingCountInMonth} trong tháng · {request.reason}</div>
                    </div>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700">Chờ {nextRole ? approvalNames[nextRole] : "duyệt"}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {request.requiredApprovals.map((role) => {
                      const done = request.approvals.some((approval) => approval.role === role);
                      return <span key={role} className={`rounded-full border px-3 py-1 text-sm font-bold ${done ? "border-emerald-300 bg-emerald-50 text-gomita-green" : "border-gomita-line text-gomita-muted"}`}>{approvalNames[role]}</span>;
                    })}
                  </div>
                  <button className="mt-4 min-h-11 w-full rounded-lg bg-gomita-green font-black text-white disabled:bg-slate-300" disabled={!canApprove} onClick={() => approveRequest(request.id)} type="button">
                    {canApprove ? "Xác nhận" : currentApprovalRole ? "Chưa đến lượt xác nhận" : "Vị trí này không có quyền xác nhận"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function AttendanceMonth({
  approvedRequests,
  missingAttendance,
  pendingRequests,
  visibleMonth,
  onMonthChange
}: {
  approvedRequests: CompensationRequest[];
  missingAttendance: Array<{ date: string; slots: AttendanceSlot[] }>;
  pendingRequests: CompensationRequest[];
  visibleMonth: Date;
  onMonthChange: (date: Date) => void;
}) {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: startOffset + daysInMonth }, (_, index) => (index < startOffset ? 0 : index - startOffset + 1));

  return (
    <div className="rounded-lg border border-gomita-line bg-slate-50 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button className="rounded-lg border border-gomita-line bg-white px-3 py-2 font-black" onClick={() => onMonthChange(new Date(year, month - 1, 1))} type="button">‹</button>
        <div className="font-black">Tháng {month + 1}/{year}</div>
        <button className="rounded-lg border border-gomita-line bg-white px-3 py-2 font-black" onClick={() => onMonthChange(new Date(year, month + 1, 1))} type="button">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-black text-gomita-muted">
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <div key={day}>{day}</div>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) return <div key={index} className="min-h-14" />;
          const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const missing = missingAttendance.find((item) => item.date === date);
          const pending = pendingRequests.some((request) => request.date === date);
          const approved = approvedRequests.some((request) => request.date === date);
          return (
            <div key={date} className={`flex min-h-14 flex-col items-center justify-center rounded-lg border text-sm ${approved ? "border-emerald-300 bg-emerald-50 text-gomita-green" : pending ? "border-amber-300 bg-amber-50 text-amber-800" : missing ? "border-orange-300 bg-orange-50 text-orange-800" : "border-gomita-line bg-white"}`}>
              <span className="font-black">{day}</span>
              {approved ? <small>Đã bù</small> : pending ? <small>Chờ duyệt</small> : missing ? <small>{missing.slots.length} mốc</small> : null}
            </div>
          );
        })}
      </div>
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
