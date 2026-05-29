import type { ApprovalRole, AttendanceSlot, CompensationRequest, MissingAttendanceItem } from "./types";
import type { PositionLevel } from "@/modules/hr/roles";

export const attendanceSlots: AttendanceSlot[] = ["07:30", "11:30", "13:30", "17:30"];

export function getRequiredApprovals(level: PositionLevel, missingCountInMonth: number): ApprovalRole[] {
  if (level === "director" || missingCountInMonth > 8) {
    return ["hr", "department_manager", "director"];
  }

  if (level === "team_lead" || level === "department_head" || missingCountInMonth >= 4) {
    return ["hr", "department_manager"];
  }

  return ["hr"];
}

export function getSlotWindow(slot: AttendanceSlot, baseDate = new Date()) {
  const [hour, minute] = slot.split(":").map(Number);
  const slotTime = new Date(baseDate);
  slotTime.setHours(hour, minute, 0, 0);

  const opensAt = new Date(slotTime);
  opensAt.setMinutes(opensAt.getMinutes() - 15);

  const closesAt = new Date(slotTime);
  closesAt.setHours(closesAt.getHours() + 1);

  return { opensAt, closesAt };
}

export function isSlotOpen(slot: AttendanceSlot, now = new Date()) {
  const { opensAt, closesAt } = getSlotWindow(slot, now);
  return now >= opensAt && now <= closesAt;
}

export function canApproveCompensation(request: CompensationRequest, role: ApprovalRole) {
  if (request.status !== "pending") return false;
  if (!request.requiredApprovals.includes(role)) return false;
  if (request.approvals.some((approval) => approval.role === role)) return false;

  const roleIndex = request.requiredApprovals.indexOf(role);
  const previousRoles = request.requiredApprovals.slice(0, roleIndex);
  return previousRoles.every((previousRole) => request.approvals.some((approval) => approval.role === previousRole));
}

export function approveCompensation(request: CompensationRequest, role: ApprovalRole, approverName: string): CompensationRequest {
  if (!canApproveCompensation(request, role)) return request;

  const nextRequest: CompensationRequest = {
    ...request,
    approvals: [
      ...request.approvals,
      {
        role,
        approverName,
        approvedAt: new Date().toISOString()
      }
    ]
  };

  const fullyApproved = nextRequest.requiredApprovals.every((requiredRole) => {
    return nextRequest.approvals.some((approval) => approval.role === requiredRole);
  });

  return {
    ...nextRequest,
    status: fullyApproved ? "approved" : "pending"
  };
}

export function createCompensationRequest(input: {
  employeeId: string;
  employeeName: string;
  employeePositionLevel: PositionLevel;
  date: string;
  slots: AttendanceSlot[];
  reason: string;
  missingCountInMonth: number;
}): CompensationRequest {
  return {
    id: crypto.randomUUID(),
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    employeePositionLevel: input.employeePositionLevel,
    date: input.date,
    slots: input.slots,
    reason: input.reason,
    missingCountInMonth: input.missingCountInMonth,
    requiredApprovals: getRequiredApprovals(input.employeePositionLevel, input.missingCountInMonth),
    approvals: [],
    status: "pending",
    createdAt: new Date().toISOString()
  };
}

export function getDemoMissingAttendance(year: number, month: number): MissingAttendanceItem[] {
  const monthText = String(month + 1).padStart(2, "0");
  const yearText = String(year);

  return [
    { date: `${yearText}-${monthText}-03`, slots: ["07:30", "11:30"] },
    { date: `${yearText}-${monthText}-08`, slots: ["13:30"] },
    { date: `${yearText}-${monthText}-14`, slots: ["07:30", "17:30"] },
    { date: `${yearText}-${monthText}-21`, slots: ["11:30"] },
    { date: `${yearText}-${monthText}-27`, slots: ["13:30", "17:30"] }
  ];
}
