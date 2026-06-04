export type CashTransactionType = "cash_in" | "cash_out" | "bank_in" | "bank_out" | "transfer";

export type CashTransaction = {
  id: string;
  type: CashTransactionType;
  amount: number;
  note: string;
  createdAt: string;
  createdBy: string;
  accountName: string;
  orderId?: string;
  orderCode?: string;
  customerName?: string;
  category?: string;
  paymentMethod?: string;
};

export type CustomerDebtStage = "deposit" | "stage2" | "before_production" | "before_installation" | "handover" | "completed";
export type CustomerDebtStatus = "pending" | "partial" | "paid" | "overdue";

export type CustomerDebt = {
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  stage: CustomerDebtStage;
  plannedAmount: number;
  collectedAmount: number;
  dueDate?: string;
  status: CustomerDebtStatus;
  note?: string;
};

export const customerDebtStageLabels: Record<CustomerDebtStage, string> = {
  deposit: "Đặt cọc",
  stage2: "Đợt 2",
  before_production: "Trước sản xuất",
  before_installation: "Trước lắp đặt",
  handover: "Nghiệm thu",
  completed: "Hoàn công"
};

export const customerDebtStatusLabels: Record<CustomerDebtStatus, string> = {
  pending: "Chưa thu",
  partial: "Thu một phần",
  paid: "Đã thu đủ",
  overdue: "Quá hạn"
};
