export type LeaveType = "annual" | "unpaid" | "sick" | "half_day";
export type LeaveStatus = "pending" | "approved" | "rejected";

export type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  type: LeaveType;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  note?: string;
};

export const leaveTypeLabels: Record<LeaveType, string> = {
  annual: "Phép năm",
  unpaid: "Nghỉ không lương",
  sick: "Nghỉ ốm",
  half_day: "Nghỉ nửa ngày"
};

export const leaveStatusLabels: Record<LeaveStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối"
};
