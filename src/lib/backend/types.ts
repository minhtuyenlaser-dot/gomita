import type { CashTransaction, CustomerDebt } from "@/modules/finance/types";
import type { LeaveRequest } from "@/modules/hr/leave";
import type { UserAccount } from "@/modules/hr/accounts";
import type { Order } from "@/modules/orders/orderFlow";

export type LegacyAttendanceDetail = {
  photo: string;
  gps: string;
  gpsAddress?: string;
  gpsMeta?: unknown;
  time: string;
};

export type FeedbackEntry = {
  id: string;
  senderId: string;
  senderName: string;
  senderPosition: string;
  content: string;
  createdAt: string;
};

export type LegacyJsonSnapshot = {
  accounts: UserAccount[];
  orders: Order[];
  overtimeRequests: any[];
  compensationRequests: any[];
  leaveRequests: LeaveRequest[];
  cashTransactions: CashTransaction[];
  customerDebts: CustomerDebt[];
  holidayDates: string[];
  attendance: Record<string, string>;
  attendanceDetails: Record<string, LegacyAttendanceDetail>;
  attendanceCompensationState?: Record<string, unknown>;
  feedbackEntries?: FeedbackEntry[];
};

export type LegacyExportRow = Record<string, unknown>;

export type SupabaseSeedPayload = {
  metadata: {
    generatedAt: string;
    sourceFile: string;
    warnings: string[];
    counts: Record<string, number>;
  };
  departments: LegacyExportRow[];
  positions: LegacyExportRow[];
  profiles: LegacyExportRow[];
  profile_positions: LegacyExportRow[];
  employee_documents: LegacyExportRow[];
  orders: LegacyExportRow[];
  order_assignments: LegacyExportRow[];
  order_budgets: LegacyExportRow[];
  leave_requests: LegacyExportRow[];
  cash_accounts: LegacyExportRow[];
  cash_transactions: LegacyExportRow[];
  order_payment_schedules: LegacyExportRow[];
  customer_payments: LegacyExportRow[];
  unresolved_attendance: LegacyExportRow[];
};
