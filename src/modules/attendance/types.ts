import type { PositionLevel } from "@/modules/hr/roles";

export type AttendanceSlot = "07:30" | "11:30" | "13:30" | "17:30";
export type ApprovalRole = "hr" | "department_manager" | "director";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export type MissingAttendanceItem = {
  date: string;
  slots: AttendanceSlot[];
};

export type CompensationRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePositionLevel: PositionLevel;
  date: string;
  slots: AttendanceSlot[];
  reason: string;
  missingCountInMonth: number;
  requiredApprovals: ApprovalRole[];
  approvals: Array<{
    role: ApprovalRole;
    approverName: string;
    approvedAt: string;
  }>;
  status: ApprovalStatus;
  createdAt: string;
};
