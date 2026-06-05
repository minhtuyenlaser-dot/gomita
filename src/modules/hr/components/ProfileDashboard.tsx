"use client";

import { BriefcaseBusiness, Camera, Clock3, Download, FileText, IdCard, Lock, UserRound, Image, CheckSquare, Square, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState, useEffect } from "react";
import type { UserAccount } from "../accounts";
import type { LeaveRequest, LeaveType } from "../leave";
import { leaveStatusLabels, leaveTypeLabels } from "../leave";
import { canUseOvertime, type Position } from "../roles";
import type { Order } from "@/modules/orders/orderFlow";
import type { WarrantyTask } from "@/lib/backend/types";
import { getRequiredApprovals } from "@/modules/attendance/compensationRules";

type Slot = "07:30" | "11:30" | "13:30" | "17:30";
const slots: Slot[] = ["07:30", "11:30", "13:30", "17:30"];

const defaultAllowanceRates = {
  lunchDailyRate: 30000,
  siteFuelDailyRate: 40000,
  siteWaterDailyRate: 10000,
  siteLunchDailyRate: 40000,
  otherAllowance: 0
};

const siteWorkSteps = ["Lắp đặt", "Nghiệm thu", "Bảo hành"] as const;

function toMonthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function toPreviousMonthKey(monthKey: string) {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
  return toMonthKey(new Date(year, month - 2, 1));
}

function toNumericOrUndefined(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function resolveAllowanceConfig(userId: string, monthKey: string, workerAllowances: Record<string, any>) {
  let cursor = monthKey;
  for (let index = 0; index < 24; index += 1) {
    const entry = workerAllowances[`${userId}-${cursor}`];
    if (entry) {
      return {
        sourceMonth: cursor,
        lunchDailyRate: toNumericOrUndefined(entry.lunchDailyRate) ?? defaultAllowanceRates.lunchDailyRate,
        siteFuelDailyRate: toNumericOrUndefined(entry.siteFuelDailyRate) ?? defaultAllowanceRates.siteFuelDailyRate,
        siteWaterDailyRate: toNumericOrUndefined(entry.siteWaterDailyRate) ?? defaultAllowanceRates.siteWaterDailyRate,
        siteLunchDailyRate: toNumericOrUndefined(entry.siteLunchDailyRate) ?? defaultAllowanceRates.siteLunchDailyRate,
        otherAllowance: toNumericOrUndefined(entry.otherAllowance) ?? toNumericOrUndefined(entry.responsibilityAllowanceOverride) ?? defaultAllowanceRates.otherAllowance
      };
    }
    cursor = toPreviousMonthKey(cursor);
  }

  return {
    sourceMonth: null as string | null,
    ...defaultAllowanceRates
  };
}

function getOrderAssigneesForStep(order: Order, step: string) {
  if (["Lắp đặt", "Nghiệm thu", "Bảo hành"].includes(step)) {
    return ((order.installerNames?.length ? order.installerNames : [order.installerName]) as string[]).filter(Boolean);
  }
  if (step === "Sản xuất") {
    return ((order.productionWorkerNames?.length ? order.productionWorkerNames : [order.productionWorkerName]) as string[]).filter(Boolean);
  }
  if (step === "Ra file") {
    return ((order.fileOperatorNames?.length ? order.fileOperatorNames : [order.fileOperatorName]) as string[]).filter(Boolean);
  }
  if (step === "Thiết kế") {
    return ((order.designerNames?.length ? order.designerNames : [order.designerName]) as string[]).filter(Boolean);
  }
  return (order.saleName || "").split(",").map((item) => item.trim()).filter(Boolean);
}

export function calculateUserAllowances(
  userId: string,
  displayName: string,
  monthDays: Date[],
  attendance: Record<string, string>,
  orders: Order[],
  warrantyTasks: WarrantyTask[],
  workerAllowances: Record<string, any>,
  isWorker: boolean
) {
  const currentMonthStr = toMonthKey(monthDays[0] ?? new Date());
  let calcFullDays = 0;

  if (isWorker) {
    monthDays.forEach((day) => {
      const dayNum = day.getDate();
      let morningChecked = false;
      let afternoonChecked = false;
      slots.forEach((slot) => {
        const key = `${userId}-${dayNum}-${slot}`;
        if (attendance[key] === "normal" || attendance[key] === "compensated") {
          if (slot === "07:30" || slot === "11:30") morningChecked = true;
          if (slot === "13:30" || slot === "17:30") afternoonChecked = true;
        }
      });
      if (morningChecked && afternoonChecked) {
        calcFullDays += 1;
      }
    });
  }

  let calcSiteDays = 0;
  let calcSiteFullDays = 0;
  const siteDayDetails: Array<{
    date: string;
    label: string;
    workedSlots: number;
    isFullDay: boolean;
    isSiteFullDay: boolean;
    orders: string[];
    steps: string[];
  }> = [];

  if (isWorker) {
    monthDays.forEach((day) => {
      const dayNum = day.getDate();
      const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      let checkedCount = 0;
      let morningChecked = false;
      let afternoonChecked = false;

      slots.forEach((slot) => {
        const key = `${userId}-${dayNum}-${slot}`;
        if (attendance[key] === "normal" || attendance[key] === "compensated") {
          checkedCount += 1;
          if (slot === "07:30" || slot === "11:30") morningChecked = true;
          if (slot === "13:30" || slot === "17:30") afternoonChecked = true;
        }
      });

      if (checkedCount === 0) return;

      const matchedAssignments = orders.reduce<Array<{ code: string; step: string }>>((list, order) => {
        const currentStepIsSiteWork = siteWorkSteps.includes(order.step as (typeof siteWorkSteps)[number]) || !!order.isFieldWork;
        if (currentStepIsSiteWork) {
          const currentAssignees = getOrderAssigneesForStep(order, order.step);
          const assignedDate = order.assignedInstallerDate || order.deploymentStartTime?.slice(0, 10);
          if (currentAssignees.includes(displayName) && assignedDate === dateStr) {
            list.push({ code: order.code, step: order.step });
          }
        }

        (order.historyLogs || []).forEach((log: any) => {
          const logIsSiteWork = siteWorkSteps.includes(log.step as (typeof siteWorkSteps)[number]) || !!order.isFieldWork;
          if (!logIsSiteWork) return;
          const assignees = getOrderAssigneesForStep(order, log.step);
          const finalAssignees = assignees.length ? assignees : [log.assignee].filter(Boolean);
          if (!finalAssignees.includes(displayName)) return;
          const start = log.acceptedAt || log.startedAt;
          if (!start) return;
          const startDateText = start.substring(0, 10);
          const endDateText = log.completedAt ? log.completedAt.substring(0, 10) : startDateText;
          if (dateStr >= startDateText && dateStr <= endDateText) {
            list.push({ code: order.code, step: log.step });
          }
        });

        return list;
      }, []);

      const matchedWarrantyTasks = warrantyTasks.filter((task) => {
        if (task.assigneeId !== userId && task.assigneeName !== displayName) return false;
        return (task.startAt || "").slice(0, 10) === dateStr;
      });

      if (matchedAssignments.length === 0 && matchedWarrantyTasks.length === 0) return;

      const isSiteFullDay = morningChecked && afternoonChecked;
      calcSiteDays += 1;
      if (isSiteFullDay) {
        calcSiteFullDays += 1;
      }
      siteDayDetails.push({
        date: dateStr,
        label: `Ngày ${dayNum}/${day.getMonth() + 1}`,
        workedSlots: checkedCount,
        isFullDay: morningChecked && afternoonChecked,
        isSiteFullDay,
        orders: Array.from(new Set([
          ...matchedAssignments.map((item) => item.code),
          ...matchedWarrantyTasks.map((item) => item.code)
        ])),
        steps: Array.from(new Set([
          ...matchedAssignments.map((item) => item.step),
          ...matchedWarrantyTasks.map(() => "Bảo hành")
        ]))
      });
    });
  }

  const key = `${userId}-${currentMonthStr}`;
  const overrides = workerAllowances[key] || {};
  const resolvedConfig = resolveAllowanceConfig(userId, currentMonthStr, workerAllowances);
  const lunchDailyRate = toNumericOrUndefined(overrides.lunchDailyRate) ?? resolvedConfig.lunchDailyRate;
  const siteFuelDailyRate = toNumericOrUndefined(overrides.siteFuelDailyRate) ?? resolvedConfig.siteFuelDailyRate;
  const siteWaterDailyRate = toNumericOrUndefined(overrides.siteWaterDailyRate) ?? resolvedConfig.siteWaterDailyRate;
  const siteLunchDailyRate = toNumericOrUndefined(overrides.siteLunchDailyRate) ?? resolvedConfig.siteLunchDailyRate;
  const otherAllowance = toNumericOrUndefined(overrides.otherAllowance)
    ?? toNumericOrUndefined(overrides.responsibilityAllowanceOverride)
    ?? resolvedConfig.otherAllowance;

  const calcMealAllowance = ((calcFullDays - calcSiteFullDays) * lunchDailyRate) + (calcSiteFullDays * siteLunchDailyRate);
  const siteFuelAllowance = calcSiteDays * siteFuelDailyRate;
  const siteWaterAllowance = calcSiteDays * siteWaterDailyRate;
  const mealAllowance = overrides.mealAllowanceOverride !== undefined ? Number(overrides.mealAllowanceOverride) : calcMealAllowance;
  const siteAllowance = overrides.siteAllowanceOverride !== undefined ? Number(overrides.siteAllowanceOverride) : (siteFuelAllowance + siteWaterAllowance);
  const totalAllowance = mealAllowance + siteAllowance + otherAllowance;

  return {
    calcFullDays,
    calcSiteDays,
    calcSiteFullDays,
    calcSiteHalfDays: Math.max(0, calcSiteDays - calcSiteFullDays),
    fullDays: calcFullDays,
    siteDays: calcSiteDays,
    siteFullDays: calcSiteFullDays,
    siteHalfDays: Math.max(0, calcSiteDays - calcSiteFullDays),
    siteDayDetails,
    lunchDailyRate,
    siteFuelDailyRate,
    siteWaterDailyRate,
    siteLunchDailyRate,
    mealAllowance,
    siteFuelAllowance,
    siteWaterAllowance,
    siteAllowance,
    otherAllowance,
    responsibilityAllowance: otherAllowance,
    totalAllowance,
    isMealOverridden: overrides.mealAllowanceOverride !== undefined,
    isSiteOverridden: overrides.siteAllowanceOverride !== undefined,
    isResponsibilityOverridden: overrides.responsibilityAllowanceOverride !== undefined || overrides.otherAllowance !== undefined,
    configSourceMonth: resolvedConfig.sourceMonth
  };
}

export function ProfileDashboard({ 
  account, 
  position, 
  overtimeRequests = [],
  attendance = {},
  compensationRequests = [],
  onCompensationRequestsChange,
  leaveRequests = [],
  onLeaveRequestsChange,
  orders = [],
  warrantyTasks = [],
  workerAllowances = {}
}: { 
  account: UserAccount; 
  accounts?: UserAccount[]; 
  position: Position; 
  overtimeRequests?: any[]; 
  attendance?: Record<string, string>;
  compensationRequests?: any[];
  onCompensationRequestsChange?: (requests: any[]) => void;
  leaveRequests?: LeaveRequest[];
  onLeaveRequestsChange?: (requests: LeaveRequest[]) => void;
  orders?: Order[];
  warrantyTasks?: WarrantyTask[];
  workerAllowances?: Record<string, any>;
}) {
  const monthDays = useMemo(() => getCurrentMonthDays(), []);
  const [accountOpen, setAccountOpen] = useState(false);
  const [compModalOpen, setCompModalOpen] = useState(false);
  const [compSelectedItems, setCompSelectedItems] = useState<string[]>([]);
  const [compReason, setCompReason] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [leaveFromDate, setLeaveFromDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveToDate, setLeaveToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState("");

  const [username, setUsername] = useState(account.username);
  const [password, setPassword] = useState(account.password);
  const [message, setMessage] = useState("");
  const today = new Date().getDate();

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

  const maxWorkDays = useMemo(() => {
    return monthDays.filter((day) => day.getDay() !== 0).length;
  }, [monthDays]);

  const expectedDays = useMemo(() => {
    return monthDays.filter((day) => day.getDay() !== 0 && day.getDate() <= today).length;
  }, [monthDays, today]);

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
  
  const overtime = useMemo(() => {
    if (!canUseOvertime(position.id)) return 0;
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
  }, [account.id, overtimeRequests, position.id]);

  const salaryType = account.salaryType ?? "daily";
  const salaryValue = account.salaryValue ?? (position.id === "hr" ? 420000 : position.id === "accountant" ? 400000 : 350000);

  const isWorker = ["production_worker", "installer"].includes(position.id);

  const allowances = useMemo(() => {
    return calculateUserAllowances(account.id, account.displayName, monthDays, attendance, orders, warrantyTasks, workerAllowances, isWorker);
  }, [isWorker, account.id, account.displayName, monthDays, attendance, orders, warrantyTasks, workerAllowances]);

  const basePay = useMemo(() => {
    if (salaryType === "monthly") {
      return maxWorkDays ? (salaryValue / maxWorkDays) * workDays : 0;
    }
    return workDays * salaryValue;
  }, [salaryType, salaryValue, workDays, maxWorkDays]);

  const hourlySalaryRate = useMemo(() => {
    if (salaryType === "monthly") {
      return maxWorkDays ? salaryValue / maxWorkDays / 8 : 0;
    }
    return salaryValue / 8;
  }, [maxWorkDays, salaryType, salaryValue]);

  const otPay = useMemo(() => {
    return overtime * 1.5 * hourlySalaryRate;
  }, [hourlySalaryRate, overtime]);

  const estimatedIncome = useMemo(() => {
    return basePay + otPay + allowances.totalAllowance;
  }, [basePay, otPay, allowances]);

  const workRate = expectedDays ? Math.round((workDays / expectedDays) * 100) : 0;
  const myLeaveRequests = useMemo(() => leaveRequests.filter((request) => request.employeeId === account.id), [leaveRequests, account.id]);

  function submitLeaveRequest() {
    if (!onLeaveRequestsChange || !leaveReason.trim()) {
      setMessage("Vui lòng nhập lý do nghỉ phép.");
      return;
    }
    const from = new Date(`${leaveFromDate}T00:00:00`);
    const to = new Date(`${leaveToDate}T00:00:00`);
    if (to < from) {
      setMessage("Ngày kết thúc nghỉ phép phải lớn hơn hoặc bằng ngày bắt đầu.");
      return;
    }
    const daySpan = leaveType === "half_day" ? 0.5 : Math.max(1, Math.floor((to.getTime() - from.getTime()) / 86400000) + 1);
    const newRequest: LeaveRequest = {
      id: `leave-${Date.now()}`,
      employeeId: account.id,
      employeeCode: account.employeeCode || account.id,
      employeeName: account.displayName,
      department: account.department,
      type: leaveType,
      fromDate: leaveFromDate,
      toDate: leaveToDate,
      days: daySpan,
      reason: leaveReason.trim(),
      status: "pending",
      createdAt: new Date().toISOString()
    };
    onLeaveRequestsChange([newRequest, ...leaveRequests]);
    setLeaveReason("");
    setMessage("Đã gửi đơn nghỉ phép lên Nhân sự/Giám đốc.");
  }

  function downloadAttendanceAsImage() {
    const canvas = document.createElement("canvas");
    canvas.width = 1350;
    canvas.height = 450;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    ctx.fillStyle = "#071a38";
    ctx.fillRect(5, 5, canvas.width - 10, 80);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial, sans-serif";
    const currentMonthText = `BANG CHAM CONG THANG ${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
    ctx.fillText(currentMonthText, 30, 48);

    ctx.font = "bold 14px Arial, sans-serif";
    ctx.fillText(`Nhan vien: ${account.displayName.toUpperCase()}   |   Bo phan: ${account.department || "Xuong"}   |   Vi tri: ${position.name.toUpperCase()}`, 30, 70);

    const startX = 130;
    const startY = 150;
    const colWidth = 38;
    const rowHeight = 50;

    ctx.fillStyle = "#475569";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.fillText("Moc gio", 30, startY - 15);

    monthDays.forEach((day, index) => {
      const x = startX + index * colWidth;
      ctx.fillStyle = day.getDay() === 0 ? "#ef4444" : "#475569";
      ctx.fillText(String(day.getDate()), x + 10, startY - 15);
    });

    slots.forEach((slot, rowIndex) => {
      const y = startY + rowIndex * rowHeight;
      
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 13px Arial, sans-serif";
      ctx.fillText(slot, 30, y + 6);

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

        ctx.beginPath();
        ctx.arc(x + 15, y, 7, 0, 2 * Math.PI);
        if (kind === "normal") {
          ctx.fillStyle = "#22c55e";
        } else if (kind === "compensated") {
          ctx.fillStyle = "#3b82f6";
        } else {
          ctx.fillStyle = "#cbd5e1";
        }
        ctx.fill();
      });
    });

    const legendY = 380;
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.fillText("Chu thich:", 30, legendY);

    ctx.beginPath();
    ctx.arc(130, legendY - 4, 6, 0, 2 * Math.PI);
    ctx.fillStyle = "#22c55e";
    ctx.fill();
    ctx.fillStyle = "#475569";
    ctx.fillText("Da cham cong", 145, legendY);

    ctx.beginPath();
    ctx.arc(280, legendY - 4, 6, 0, 2 * Math.PI);
    ctx.fillStyle = "#3b82f6";
    ctx.fill();
    ctx.fillStyle = "#475569";
    ctx.fillText("Cham cong bu", 295, legendY);

    ctx.beginPath();
    ctx.arc(430, legendY - 4, 6, 0, 2 * Math.PI);
    ctx.fillStyle = "#cbd5e1";
    ctx.fill();
    ctx.fillStyle = "#475569";
    ctx.fillText("Thieu cong", 445, legendY);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "italic 11px Arial, sans-serif";
    ctx.fillText("He thong quan tri doanh nghiep GOMITA - Tu dong dong bo online", canvas.width - 380, legendY);

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
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{account.employeeCode || "Chưa có mã NV"}</span>
              </div>
              <InfoLine icon={<BriefcaseBusiness className="h-4 w-4" />} text="Nhân viên chính thức" />
              <InfoLine icon={<IdCard className="h-4 w-4" />} text={`CCCD: ${account.idCardNumber || "Chưa cập nhật"}`} />
              <InfoLine icon={<FileText className="h-4 w-4" />} text={`HĐLĐ: ${account.laborContractNote || "Chưa cập nhật"}`} />
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
        <Metric 
          title="Thu nhập tạm tính" 
          value={`${Math.round(estimatedIncome).toLocaleString("vi-VN")} đ`} 
          sub={
            (() => {
              const parts = [
                `Lương chính: ${Math.round(basePay).toLocaleString("vi-VN")}đ`
              ];
              if (otPay > 0) {
                parts.push(`Tăng ca: ${Math.round(otPay).toLocaleString("vi-VN")}đ`);
              }
              if (allowances.mealAllowance > 0) {
                parts.push(`Ăn trưa (${allowances.fullDays}n): ${Math.round(allowances.mealAllowance).toLocaleString("vi-VN")}đ`);
              }
              if (allowances.siteFuelAllowance > 0) {
                parts.push(`Xăng xe (${allowances.siteDays}n): ${Math.round(allowances.siteFuelAllowance).toLocaleString("vi-VN")}đ`);
              }
              if (allowances.siteWaterAllowance > 0) {
                parts.push(`Nước uống (${allowances.siteDays}n): ${Math.round(allowances.siteWaterAllowance).toLocaleString("vi-VN")}đ`);
              }
              if (allowances.otherAllowance > 0) {
                parts.push(`Phụ cấp khác: ${Math.round(allowances.otherAllowance).toLocaleString("vi-VN")}đ`);
              }
              return parts.join(" • ");
            })()
          } 
          tone="green" 
        />
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
            {onCompensationRequestsChange ? (
              <div className="flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-700">
                <Clock3 className="h-4 w-4" />
                Chấm công bù chỉ thực hiện trên điện thoại sau khi chấm công thành công.
              </div>
            ) : null}
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Đơn nghỉ phép của tôi</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold">Loại nghỉ
              <select className="h-11 rounded-lg border border-slate-200 px-3 font-normal" value={leaveType} onChange={(event) => setLeaveType(event.target.value as LeaveType)}>
                {Object.entries(leaveTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold">Từ ngày<input className="h-11 rounded-lg border border-slate-200 px-3 font-normal" type="date" value={leaveFromDate} onChange={(event) => setLeaveFromDate(event.target.value)} /></label>
            <label className="grid gap-1 text-sm font-bold">Đến ngày<input className="h-11 rounded-lg border border-slate-200 px-3 font-normal" type="date" value={leaveToDate} onChange={(event) => setLeaveToDate(event.target.value)} /></label>
            <label className="grid gap-1 text-sm font-bold md:col-span-2">Lý do<textarea className="min-h-24 rounded-lg border border-slate-200 p-3 font-normal" value={leaveReason} onChange={(event) => setLeaveReason(event.target.value)} /></label>
          </div>
          <button className="mt-4 min-h-11 rounded-lg bg-orange-500 px-4 font-black text-white" onClick={submitLeaveRequest} type="button">Gửi đơn nghỉ phép</button>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Hồ sơ cá nhân</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3"><span className="font-black">Mã nhân viên:</span> {account.employeeCode || "Chưa cập nhật"}</div>
            <div className="rounded-lg bg-slate-50 p-3"><span className="font-black">Số CCCD:</span> {account.idCardNumber || "Chưa cập nhật"}</div>
            <div className="flex flex-wrap gap-2">
              {account.idCardFrontImage ? <a className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-blue-600" href={account.idCardFrontImage} target="_blank" rel="noreferrer">Xem CCCD mặt trước</a> : null}
              {account.idCardBackImage ? <a className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-blue-600" href={account.idCardBackImage} target="_blank" rel="noreferrer">Xem CCCD mặt sau</a> : null}
              {account.laborContractImage ? <a className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-blue-600" href={account.laborContractImage} target="_blank" rel="noreferrer">Xem hợp đồng</a> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Lịch sử đơn nghỉ phép</h2>
        <div className="mt-4 grid gap-3">
          {myLeaveRequests.length === 0 ? <div className="rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-500">Chưa có đơn nghỉ phép nào.</div> : myLeaveRequests.map((request) => (
            <div key={request.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-black">{leaveTypeLabels[request.type]} • {request.fromDate} → {request.toDate}</div>
                  <div className="mt-1 text-sm text-slate-500">{request.days} ngày • {request.reason}</div>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{leaveStatusLabels[request.status]}</div>
              </div>
            </div>
          ))}
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

            <div className="mb-4 flex flex-wrap gap-4 rounded-lg bg-slate-50 p-3 text-xs font-bold text-slate-600 border border-slate-200">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-green-500" /> Đã chấm</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-blue-500" /> Đã bù công</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-500" /> Đang chờ duyệt</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-dashed border-slate-400 bg-white" /> Thiếu công (Bấm chọn)</span>
              <span className="flex items-center gap-1.5">🔒 Đã khóa kì công</span>
            </div>

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
                      
                      const isPending = compensationRequests.some(
                        (req) => req.employeeId === account.id && req.date === dateString && req.slots.includes(slot) && req.status === "pending"
                      );

                      const isLocked = dayNum <= latestCompDay;

                      const isSunday = day.getDay() === 0;

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
  attendance = {},
  orders = [],
  warrantyTasks = [],
  workerAllowances = {},
  onWorkerAllowancesChange
}: { 
  accounts: UserAccount[]; 
  overtimeRequests?: any[]; 
  attendance?: Record<string, string>;
  orders?: Order[];
  warrantyTasks?: WarrantyTask[];
  workerAllowances?: Record<string, any>;
  onWorkerAllowancesChange?: (allowances: Record<string, any>) => void;
}) {
  const monthDays = useMemo(() => getCurrentMonthDays(), []);
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const [editingItem, setEditingItem] = useState<{
    userId: string;
    displayName: string;
    calcFullDays: number;
    calcSiteDays: number;
    calcSiteFullDays: number;
    calcSiteHalfDays: number;
    mealAllowance: number;
    siteAllowance: number;
    otherAllowance: number;
    lunchDailyRate: number;
    siteFuelDailyRate: number;
    siteWaterDailyRate: number;
    siteLunchDailyRate: number;
    configSourceMonth: string | null;
  } | null>(null);

  const [lunchDailyRateVal, setLunchDailyRateVal] = useState<number | "">("");
  const [siteFuelDailyRateVal, setSiteFuelDailyRateVal] = useState<number | "">("");
  const [siteWaterDailyRateVal, setSiteWaterDailyRateVal] = useState<number | "">("");
  const [siteLunchDailyRateVal, setSiteLunchDailyRateVal] = useState<number | "">("");
  const [otherAllowanceVal, setOtherAllowanceVal] = useState<number | "">("");

  useEffect(() => {
    if (editingItem) {
      setLunchDailyRateVal(editingItem.lunchDailyRate);
      setSiteFuelDailyRateVal(editingItem.siteFuelDailyRate);
      setSiteWaterDailyRateVal(editingItem.siteWaterDailyRate);
      setSiteLunchDailyRateVal(editingItem.siteLunchDailyRate);
      setOtherAllowanceVal(editingItem.otherAllowance);
    } else {
      setLunchDailyRateVal("");
      setSiteFuelDailyRateVal("");
      setSiteWaterDailyRateVal("");
      setSiteLunchDailyRateVal("");
      setOtherAllowanceVal("");
    }
  }, [editingItem]);

  const maxWorkDays = useMemo(() => {
    return monthDays.filter((day) => day.getDay() !== 0).length;
  }, [monthDays]);

  const rows = accounts.filter((account) => account.status === "active" && !account.positionIds.includes("director")).map((account) => {
    const marks = monthDays.map((day) => {
      if (day.getDay() === 0) return "";
      
      const dayNum = day.getDate();
      let checkedCount = 0;
      slots.forEach(slot => {
        const key = `${account.id}-${dayNum}-${slot}`;
        if (attendance[key] === "normal" || attendance[key] === "compensated") {
          checkedCount++;
        }
      });

      if (checkedCount === 4) return "X";
      if (checkedCount >= 2) return "/";
      return "";
    });

    const work = marks.reduce((total, mark) => total + (mark === "X" ? 1 : mark === "/" ? 0.5 : 0), 0);
    
    const primaryPositionId = account.positionIds[0] || "";
    const otHours = canUseOvertime(primaryPositionId)
      ? overtimeRequests
      .filter((req) => {
        if (req.userId !== account.id) return false;
        if (req.status !== "approved") return false;
        const reqDate = new Date(req.createdAt || req.id.replace("ot-", ""));
        return reqDate.getMonth() === currentMonth && reqDate.getFullYear() === currentYear;
      })
      .reduce((sum, req) => sum + (Number(req.hours) || 0), 0)
      : 0;

    const salaryType = account.salaryType ?? "daily";
    const salaryValue = account.salaryValue ?? (account.positionIds.includes("hr") ? 420000 : account.positionIds.includes("accountant") ? 400000 : 350000);
    
    const isWorker = account.positionIds.some((id) => ["production_worker", "installer"].includes(id));
    const allowances = calculateUserAllowances(account.id, account.displayName, monthDays, attendance, orders, warrantyTasks, workerAllowances, isWorker);
    
    const basePay = salaryType === "monthly"
      ? (maxWorkDays ? (salaryValue / maxWorkDays) * work : 0)
      : (work * salaryValue);

    const hourlySalaryRate = salaryType === "monthly"
      ? (maxWorkDays ? salaryValue / maxWorkDays / 8 : 0)
      : (salaryValue / 8);
    const otPay = otHours * 1.5 * hourlySalaryRate;

    const totalIncome = basePay + otPay + allowances.totalAllowance;

    return { 
      account, 
      marks, 
      work, 
      otHours, 
      salaryType, 
      salaryValue, 
      totalIncome,
      isWorker,
      basePay,
      otPay,
      allowances
    };
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm text-slate-900">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-xl font-black">Bảng lương công ty</h2>
        <p className="text-sm text-slate-500">Tính toán động từ mốc chấm công thật: Đủ 4 mốc = 1.0 công (X); 2 hoặc 3 mốc = 0.5 công (/); Dưới 2 mốc = 0.0 công.</p>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[2080px]">
          <div className="grid bg-slate-50 px-4 py-3 text-sm font-black text-slate-600" style={{ gridTemplateColumns: `180px 110px 140px repeat(${monthDays.length}, 38px) 60px 70px 100px 110px 150px 100px` }}>
            <div>Nhân sự</div>
            <div>Mã NV</div>
            <div>Bộ phận</div>
            {monthDays.map((day) => <div key={day.toISOString()} className="text-center">{day.getDate()}</div>)}
            <div className="text-center">Công</div>
            <div className="text-center">Tăng ca</div>
            <div>Hình thức</div>
            <div className="text-right">Mức lương</div>
            <div className="text-right text-orange-600">Tổng thu nhập</div>
            <div className="text-center">Thao tác</div>
          </div>
                              {rows.map((row) => {
            const displayType = row.salaryType === "monthly" ? "Tháng" : "Ngày";
            return (
              <div key={row.account.id} className="grid items-center border-t border-slate-200 px-4 py-3 text-sm hover:bg-slate-50 transition" style={{ gridTemplateColumns: `180px 110px 140px repeat(${monthDays.length}, 38px) 60px 70px 100px 110px 150px 100px` }}>
                <div className="font-black">{row.account.displayName}</div>
                <div className="font-bold text-orange-600">{row.account.employeeCode || "Chưa có"}</div>
                <div className="text-slate-500">{row.account.department}</div>
                {row.marks.map((mark, index) => <div key={`${row.account.id}-${index}`} className="text-center font-black">{mark}</div>)}
                <div className="text-center font-bold text-slate-700">{row.work}</div>
                <div className="text-center font-bold text-orange-600">{row.otHours}h</div>
                <div className="font-bold text-slate-600">{displayType}</div>
                <div className="text-right font-bold">{row.salaryValue.toLocaleString("vi-VN")} đ</div>
                <div className="text-right font-black text-green-600">
                  <div>{Math.round(row.totalIncome).toLocaleString("vi-VN")} đ</div>
                  <div className="text-[10px] text-slate-400 font-normal leading-tight">
                    Lương chính: {Math.round(row.basePay).toLocaleString("vi-VN")} đ
                    {row.allowances.mealAllowance > 0 && (
                      <>
                        <br />Ăn trưa ({row.allowances.fullDays}n): {Math.round(row.allowances.mealAllowance).toLocaleString("vi-VN")} đ
                      </>
                    )}
                    {row.allowances.siteFuelAllowance > 0 && (
                      <>
                        <br />Xăng xe ({row.allowances.siteDays}n): {Math.round(row.allowances.siteFuelAllowance).toLocaleString("vi-VN")} đ
                      </>
                    )}
                    {row.allowances.siteWaterAllowance > 0 && (
                      <>
                        <br />Nước uống ({row.allowances.siteDays}n): {Math.round(row.allowances.siteWaterAllowance).toLocaleString("vi-VN")} đ
                      </>
                    )}
                    {row.allowances.otherAllowance > 0 && (
                      <>
                        <br />Phụ cấp khác: {Math.round(row.allowances.otherAllowance).toLocaleString("vi-VN")} đ
                      </>
                    )}
                    {row.otPay > 0 && (
                      <>
                        <br />Tăng ca: {Math.round(row.otPay).toLocaleString("vi-VN")} đ
                      </>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <button
                    onClick={() => setEditingItem({
                      userId: row.account.id,
                      displayName: row.account.displayName,
                      calcFullDays: row.allowances.calcFullDays,
                      calcSiteDays: row.allowances.calcSiteDays,
                      calcSiteFullDays: row.allowances.calcSiteFullDays,
                      calcSiteHalfDays: row.allowances.calcSiteHalfDays,
                      mealAllowance: row.allowances.mealAllowance,
                      siteAllowance: row.allowances.siteAllowance,
                      otherAllowance: row.allowances.otherAllowance,
                      lunchDailyRate: row.allowances.lunchDailyRate,
                      siteFuelDailyRate: row.allowances.siteFuelDailyRate,
                      siteWaterDailyRate: row.allowances.siteWaterDailyRate,
                      siteLunchDailyRate: row.allowances.siteLunchDailyRate,
                      configSourceMonth: row.allowances.configSourceMonth,
                    })}
                    className="rounded border border-orange-500 bg-orange-50 px-2 py-1 text-xs font-bold text-orange-600 hover:bg-orange-100 transition animate-pulse"
                  >
                    Phụ cấp
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl text-slate-900 border border-slate-200">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-black text-slate-800">Điều chỉnh phụ cấp: {editingItem.displayName}</h3>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 text-sm">
              <div>
                <span className="text-xs font-bold text-slate-500 block mb-1">MỐC TỰ ĐỘNG (DỰA TRÊN CHẤM CÔNG & LOGS)</span>
                <div className="rounded bg-slate-50 p-2 text-xs text-slate-600 leading-relaxed">
                  • Ngày làm đủ công: {editingItem.calcFullDays} ngày<br />
                  • Đi công trình cả ngày: {editingItem.calcSiteFullDays} ngày<br />
                  • Đi công trình nửa ngày: {editingItem.calcSiteHalfDays} ngày
                </div>
              </div>

              <div className="grid gap-1">
                <span className="font-bold text-slate-700">Suất ăn trưa mặc định / ngày (VNĐ)</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={lunchDailyRateVal}
                  onChange={(e) => setLunchDailyRateVal(e.target.value === "" ? "" : Number(e.target.value))}
                  className="rounded border border-slate-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                  placeholder="30.000"
                />
              </div>

              <div className="grid gap-1">
                <span className="font-bold text-slate-700">Xăng xe công trình / ngày (VNĐ)</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={siteFuelDailyRateVal}
                  onChange={(e) => setSiteFuelDailyRateVal(e.target.value === "" ? "" : Number(e.target.value))}
                  className="rounded border border-slate-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                  placeholder="40.000"
                />
              </div>

              <div className="grid gap-1">
                <span className="font-bold text-slate-700">Nước uống công trình / ngày (VNĐ)</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={siteWaterDailyRateVal}
                  onChange={(e) => setSiteWaterDailyRateVal(e.target.value === "" ? "" : Number(e.target.value))}
                  className="rounded border border-slate-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                  placeholder="10.000"
                />
              </div>

              <div className="grid gap-1">
                <span className="font-bold text-slate-700">Suất ăn công trình cả ngày (VNĐ)</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={siteLunchDailyRateVal}
                  onChange={(e) => setSiteLunchDailyRateVal(e.target.value === "" ? "" : Number(e.target.value))}
                  className="rounded border border-slate-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                  placeholder="40.000"
                />
              </div>

              <div className="grid gap-1">
                <span className="font-bold text-slate-700">Phụ cấp khác (VNĐ)</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={otherAllowanceVal}
                  onChange={(e) => setOtherAllowanceVal(e.target.value === "" ? "" : Number(e.target.value))}
                  className="rounded border border-slate-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                  placeholder="0"
                />
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 leading-relaxed">
                <div>• Suất ăn tự tính tháng này: {Math.round(editingItem.mealAllowance).toLocaleString("vi-VN")} đ</div>
                <div>• Xăng xe công trình: {Math.round(editingItem.calcSiteDays * (typeof siteFuelDailyRateVal === "number" ? siteFuelDailyRateVal : 0)).toLocaleString("vi-VN")} đ</div>
                <div>• Nước uống công trình: {Math.round(editingItem.calcSiteDays * (typeof siteWaterDailyRateVal === "number" ? siteWaterDailyRateVal : 0)).toLocaleString("vi-VN")} đ</div>
                {editingItem.configSourceMonth ? (
                  <div>• Nếu tháng này không sửa, hệ thống kế thừa mức từ tháng {editingItem.configSourceMonth}.</div>
                ) : (
                  <div>• Nếu chưa có tháng trước, hệ thống dùng mức mặc định.</div>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => {
                  setLunchDailyRateVal(defaultAllowanceRates.lunchDailyRate);
                  setSiteFuelDailyRateVal(defaultAllowanceRates.siteFuelDailyRate);
                  setSiteWaterDailyRateVal(defaultAllowanceRates.siteWaterDailyRate);
                  setSiteLunchDailyRateVal(defaultAllowanceRates.siteLunchDailyRate);
                  setOtherAllowanceVal(defaultAllowanceRates.otherAllowance);
                }}
                className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Về mức mặc định
              </button>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="rounded border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                    const targetKey = `${editingItem.userId}-${currentMonthStr}`;
                    
                    const nextAllowances = {
                      ...workerAllowances,
                      [targetKey]: {
                        ...workerAllowances[targetKey],
                        lunchDailyRate: lunchDailyRateVal !== "" ? Number(lunchDailyRateVal) : defaultAllowanceRates.lunchDailyRate,
                        siteFuelDailyRate: siteFuelDailyRateVal !== "" ? Number(siteFuelDailyRateVal) : defaultAllowanceRates.siteFuelDailyRate,
                        siteWaterDailyRate: siteWaterDailyRateVal !== "" ? Number(siteWaterDailyRateVal) : defaultAllowanceRates.siteWaterDailyRate,
                        siteLunchDailyRate: siteLunchDailyRateVal !== "" ? Number(siteLunchDailyRateVal) : defaultAllowanceRates.siteLunchDailyRate,
                        otherAllowance: otherAllowanceVal !== "" ? Number(otherAllowanceVal) : 0,
                        mealAllowanceOverride: undefined,
                        siteAllowanceOverride: undefined,
                        responsibilityAllowanceOverride: undefined,
                      }
                    };
                    onWorkerAllowancesChange?.(nextAllowances);
                    setEditingItem(null);
                  }}
                  className="rounded bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 transition"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AttendanceGrid
({ 
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
