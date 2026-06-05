"use client";

import type { Order, OrderStep } from "@/modules/orders/orderFlow";
import { exportOrderToExcel } from "@/modules/orders/excelExport";
import type { UserAccount } from "@/modules/hr/accounts";
import { positions, type Position } from "@/modules/hr/roles";
import type { CashTransaction, CashTransactionType, CustomerDebt, CustomerDebtStage, CustomerDebtStatus } from "@/modules/finance/types";
import { customerDebtStageLabels, customerDebtStatusLabels } from "@/modules/finance/types";
import { useState, useMemo, Fragment } from "react";
import { Plus, Trash2, CalendarCheck, BriefcaseBusiness, ReceiptText, ShieldCheck, Download, Pencil, Save, X } from "lucide-react";

export function FinanceDashboard({ 
  orders, 
  setOrders, 
  overtimeRequests = [], 
  accounts = [],
  attendance = {},
  attendanceDetails = {},
  currentPosition,
  cashTransactions = [],
  onCashTransactionsChange,
  customerDebts = [],
  onCustomerDebtsChange
}: { 
  orders: Order[]; 
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>; 
  overtimeRequests: any[];
  accounts: UserAccount[];
  attendance?: Record<string, string>;
  attendanceDetails?: Record<string, { photo: string; gps: string; time: string }>;
  currentPosition?: Position;
  cashTransactions?: CashTransaction[];
  onCashTransactionsChange?: React.Dispatch<React.SetStateAction<CashTransaction[]>>;
  customerDebts?: CustomerDebt[];
  onCustomerDebtsChange?: React.Dispatch<React.SetStateAction<CustomerDebt[]>>;
}) {
  const canExportFinance = ["accountant", "accountant_manager", "director", "admin"].includes(currentPosition?.id || "");
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? "");
  const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId) ?? orders[0], [orders, selectedOrderId]);
  const [mainTab, setMainTab] = useState<"overview" | "efficiency" | "profit">("overview");
  const [detailTab, setDetailTab] = useState<"overview" | "income" | "expense" | "debt" | "profit">("overview");
  const [cashType, setCashType] = useState<CashTransactionType>("cash_in");
  const [cashAmount, setCashAmount] = useState(0);
  const [cashNote, setCashNote] = useState("");
  const [incomeAmount, setIncomeAmount] = useState(0);
  const [incomeNote, setIncomeNote] = useState("");
  const [incomeCategory, setIncomeCategory] = useState("Cọc lần 1");
  const [incomePaymentMethod, setIncomePaymentMethod] = useState("Tiền mặt");
  const [expenseAmount, setExpenseAmount] = useState(0);
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Vật tư");
  const [expensePaymentMethod, setExpensePaymentMethod] = useState("Tiền mặt");
  const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [debtStage, setDebtStage] = useState<CustomerDebtStage>("deposit");
  const [debtPlannedAmount, setDebtPlannedAmount] = useState(0);
  const [debtCollectedAmount, setDebtCollectedAmount] = useState(0);
  const [debtDueDate, setDebtDueDate] = useState("");
  const [debtStatus, setDebtStatus] = useState<CustomerDebtStatus>("pending");
  const [debtNote, setDebtNote] = useState("");
  const [cashExportMonth, setCashExportMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [efficiencyEmployeeFilter, setEfficiencyEmployeeFilter] = useState("all");
  const [efficiencyDepartmentFilter, setEfficiencyDepartmentFilter] = useState("all");
  const [efficiencyOrderFilter, setEfficiencyOrderFilter] = useState("all");
  const [editingCashId, setEditingCashId] = useState<string | null>(null);
  const [editingCashAmount, setEditingCashAmount] = useState(0);
  const [editingCashNote, setEditingCashNote] = useState("");
  const [editingCashCategory, setEditingCashCategory] = useState("");
  const [editingCashPaymentMethod, setEditingCashPaymentMethod] = useState("");
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editingDebtPlannedAmount, setEditingDebtPlannedAmount] = useState(0);
  const [editingDebtCollectedAmount, setEditingDebtCollectedAmount] = useState(0);
  const [editingDebtDueDate, setEditingDebtDueDate] = useState("");
  const [editingDebtStatus, setEditingDebtStatus] = useState<CustomerDebtStatus>("pending");
  const [editingDebtNote, setEditingDebtNote] = useState("");
  const [showLaborDetails, setShowLaborDetails] = useState(false);
  const [showLaborBreakdown, setShowLaborBreakdown] = useState(false);

  // Form thêm phát sinh mới
  const [incurredNote, setIncurredNote] = useState("");
  const [incurredAmount, setIncurredAmount] = useState(0);

  // Thêm phát sinh mới vào đơn hàng
  function addIncurredCost() {
    if (!selectedOrder || !incurredNote.trim() || incurredAmount === 0) return;
    const updatedIncurred = [...(selectedOrder.incurredCosts || []), { note: incurredNote.trim(), amount: incurredAmount }];
    setOrders(current => current.map(o => o.id === selectedOrder.id ? { ...o, incurredCosts: updatedIncurred } : o));
    setIncurredNote("");
    setIncurredAmount(0);
  }

  // Xóa phát sinh
  function deleteIncurredCost(index: number) {
    if (!selectedOrder || !selectedOrder.incurredCosts) return;
    const updatedIncurred = selectedOrder.incurredCosts.filter((_, idx) => idx !== index);
    setOrders(current => current.map(o => o.id === selectedOrder.id ? { ...o, incurredCosts: updatedIncurred } : o));
  }

  const financeLedger = useMemo(() => {
    return cashTransactions.reduce((summary, item) => {
      if (item.type === "cash_in") summary.cashBalance += item.amount;
      if (item.type === "cash_out") summary.cashBalance -= item.amount;
      if (item.type === "bank_in") summary.bankBalance += item.amount;
      if (item.type === "bank_out") summary.bankBalance -= item.amount;
      if (item.type === "transfer") {
        summary.cashBalance -= item.amount;
        summary.bankBalance += item.amount;
      }
      return summary;
    }, { cashBalance: 0, bankBalance: 0 });
  }, [cashTransactions]);

  const debtStats = useMemo(() => {
    return customerDebts.reduce((summary, item) => {
      summary.planned += item.plannedAmount;
      summary.collected += item.collectedAmount;
      summary.remaining += Math.max(0, item.plannedAmount - item.collectedAmount);
      if (item.status === "overdue") summary.overdue += Math.max(0, item.plannedAmount - item.collectedAmount);
      return summary;
    }, { planned: 0, collected: 0, remaining: 0, overdue: 0 });
  }, [customerDebts]);

  function formatCurrency(value: number) {
    return `${value.toLocaleString("vi-VN")} đ`;
  }

  function toCsvValue(value: string | number) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
    const content = rows.map((row) => row.map(toCsvValue).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function normalizeMonth(value?: string) {
    return (value || "").slice(0, 7);
  }

  function isWarrantyOrder(order?: Order) {
    return !!order?.isWarranty;
  }

  function getOrderMonth(order: Order): string {
    const tiepNhanLog = (order.historyLogs || []).find(log => log.step === "Tiếp nhận");
    if (tiepNhanLog?.startedAt) {
      return tiepNhanLog.startedAt.slice(0, 7);
    }
    return new Date().toISOString().slice(0, 7);
  }

  function extractLocalDateText(value?: string) {
    const match = (value || "").match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : "";
  }

  function getPositionById(positionId?: string) {
    return positions.find((item) => item.id === positionId);
  }

  function getPrimaryPosition(account?: UserAccount) {
    if (!account) return undefined;
    return getPositionById(account.positionIds?.[0]);
  }

  function getDepartmentLabel(account?: UserAccount) {
    return getPrimaryPosition(account)?.department || "Chưa phân bộ phận";
  }

  function getDebtStageLabel(stage: CustomerDebtStage) {
    if (stage === "deposit") return "Cọc lần 1";
    if (stage === "stage2") return "Cọc lần 2";
    return customerDebtStageLabels[stage];
  }

  // Tính giờ làm việc hành chính (bỏ qua nghỉ trưa 11h30-13h30, tối/đêm, Chủ Nhật)
  function calculateWorkingHours(startStr?: string, endStr?: string): number {
    if (!startStr) return 0;
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : new Date();
    if (end < start) return 0;
    
    let totalHours = 0;
    let d = new Date(start);
    const stepMinutes = 15;
    
    while (d < end) {
      const day = d.getDay();
      if (day !== 0) { // Bỏ qua Chủ Nhật
        const hours = d.getHours();
        const minutes = d.getMinutes();
        const timeInMinutes = hours * 60 + minutes;
        
        // Mốc hành chính Sáng: 7:30 (450p) -> 11:30 (690p)
        // Mốc hành chính Chiều: 13:30 (810p) -> 17:30 (1050p)
        const isMorning = timeInMinutes >= 450 && timeInMinutes < 690;
        const isAfternoon = timeInMinutes >= 810 && timeInMinutes < 1050;
        
        if (isMorning || isAfternoon) {
          totalHours += stepMinutes / 60;
        }
      }
      d.setMinutes(d.getMinutes() + stepMinutes);
    }
    return parseFloat(totalHours.toFixed(1));
  }

  function isFutureFieldWorkCurrentStep(order: Order, step: string) {
    if (order.step !== step || !order.deploymentStartTime) return false;
    if (!["Lắp đặt", "Nghiệm thu", "Bảo hành"].includes(step)) return false;
    const scheduledAt = new Date(order.deploymentStartTime);
    return !Number.isNaN(scheduledAt.getTime()) && scheduledAt.getTime() > new Date().getTime();
  }


  function addCashTransaction() {
    if (!onCashTransactionsChange || cashAmount <= 0) return;
    const normalizedType =
      detailTab === "income"
        ? (cashType.includes("bank") ? "bank_in" : "cash_in")
        : detailTab === "expense"
          ? (cashType.includes("bank") ? "bank_out" : "cash_out")
          : cashType;
    const newTransaction: CashTransaction = {
      id: `cash-${Date.now()}`,
      type: normalizedType,
      amount: cashAmount,
      note: cashNote.trim() || "Không ghi chú",
      createdAt: new Date().toISOString(),
      createdBy: currentPosition?.name || "Kế toán",
      accountName: normalizedType.includes("bank") ? "Tài khoản ngân hàng" : "Quỹ tiền mặt",
      orderId: selectedOrder?.id,
      orderCode: selectedOrder?.code,
      customerName: selectedOrder?.customerName,
      category:
        normalizedType === "cash_in" || normalizedType === "bank_in"
          ? "Khoản thu"
          : "Chi phí khác",
      paymentMethod: normalizedType.includes("bank") ? "Chuyển khoản" : "Tiền mặt"
    };
    onCashTransactionsChange((current) => [newTransaction, ...current]);
    setCashAmount(0);
    setCashNote("");
  }

  function addCustomerDebt() {
    if (!selectedOrder || !onCustomerDebtsChange || debtPlannedAmount <= 0) return;
    const newDebt: CustomerDebt = {
      id: `debt-${Date.now()}`,
      orderId: selectedOrder.id,
      orderCode: selectedOrder.code,
      customerName: selectedOrder.customerName,
      stage: debtStage,
      plannedAmount: debtPlannedAmount,
      collectedAmount: debtCollectedAmount,
      dueDate: debtDueDate || undefined,
      status: debtStatus,
      note: debtNote.trim() || undefined
    };
    onCustomerDebtsChange((current) => [newDebt, ...current]);
    setDebtPlannedAmount(0);
    setDebtCollectedAmount(0);
    setDebtDueDate("");
    setDebtNote("");
  }

  function addOrderIncome() {
    if (!onCashTransactionsChange || !selectedOrder || incomeAmount <= 0) return;
    const paymentMethod = incomePaymentMethod;
    const newTransaction: CashTransaction = {
      id: `cash-${Date.now()}`,
      type: paymentMethod === "Chuyển khoản" ? "bank_in" : "cash_in",
      amount: incomeAmount,
      note: incomeNote.trim() || "Không ghi chú",
      createdAt: new Date().toISOString(),
      createdBy: currentPosition?.name || "Kế toán",
      accountName: paymentMethod === "Chuyển khoản" ? "Tài khoản ngân hàng" : "Quỹ tiền mặt",
      orderId: selectedOrder.id,
      orderCode: selectedOrder.code,
      customerName: selectedOrder.customerName,
      category: incomeCategory,
      paymentMethod
    };
    onCashTransactionsChange((current) => [newTransaction, ...current]);
    setIncomeAmount(0);
    setIncomeNote("");
  }

  function addOrderExpense() {
    if (!onCashTransactionsChange || !selectedOrder || expenseAmount <= 0) return;
    const paymentMethod = expensePaymentMethod;
    const newTransaction: CashTransaction = {
      id: `cash-${Date.now()}`,
      type: paymentMethod === "Chuyển khoản" ? "bank_out" : "cash_out",
      amount: expenseAmount,
      note: expenseNote.trim() || "Không ghi chú",
      createdAt: new Date().toISOString(),
      createdBy: currentPosition?.name || "Kế toán",
      accountName: paymentMethod === "Chuyển khoản" ? "Tài khoản ngân hàng" : "Quỹ tiền mặt",
      orderId: selectedOrder.id,
      orderCode: selectedOrder.code,
      customerName: selectedOrder.customerName,
      category: expenseCategory,
      paymentMethod
    };
    onCashTransactionsChange((current) => [newTransaction, ...current]);
    setExpenseAmount(0);
    setExpenseNote("");
  }

  function beginCashEdit(item: CashTransaction) {
    setEditingCashId(item.id);
    setEditingCashAmount(item.amount);
    setEditingCashNote(item.note);
    setEditingCashCategory(item.category || "");
    setEditingCashPaymentMethod(item.paymentMethod || item.accountName || "Tiền mặt");
  }

  function saveCashEdit() {
    if (!editingCashId || editingCashAmount <= 0) return;
    
    // Nếu là dòng tổng nhân công ảo, ta ghi nhận số tiền tự chỉnh sửa này vào customLaborCost của đơn hàng
    if (selectedOrder && editingCashId === `auto-labor-total-${selectedOrder.id}`) {
      setOrders((current) =>
        current.map((o) =>
          o.id === selectedOrder.id ? { ...o, customLaborCost: editingCashAmount } : o
        )
      );
      setEditingCashId(null);
      return;
    }

    if (!onCashTransactionsChange) return;
    onCashTransactionsChange((current) =>
      current.map((item) =>
        item.id === editingCashId
          ? {
              ...item,
              amount: editingCashAmount,
              note: editingCashNote.trim() || item.note,
              category: editingCashCategory.trim() || item.category,
              paymentMethod: editingCashPaymentMethod.trim() || item.paymentMethod,
              accountName: editingCashPaymentMethod === "Chuyển khoản" ? "Tài khoản ngân hàng" : "Quỹ tiền mặt",
              type:
                item.type === "cash_in" || item.type === "bank_in"
                  ? (editingCashPaymentMethod === "Chuyển khoản" ? "bank_in" : "cash_in")
                  : (editingCashPaymentMethod === "Chuyển khoản" ? "bank_out" : "cash_out")
            }
          : item
      )
    );
    setEditingCashId(null);
  }

  function cancelCashEdit() {
    setEditingCashId(null);
  }

  function beginDebtEdit(item: CustomerDebt) {
    setEditingDebtId(item.id);
    setEditingDebtPlannedAmount(item.plannedAmount);
    setEditingDebtCollectedAmount(item.collectedAmount);
    setEditingDebtDueDate(item.dueDate || "");
    setEditingDebtStatus(item.status);
    setEditingDebtNote(item.note || "");
  }

  function saveDebtEdit() {
    if (!onCustomerDebtsChange || !editingDebtId || editingDebtPlannedAmount <= 0) return;
    onCustomerDebtsChange((current) =>
      current.map((item) =>
        item.id === editingDebtId
          ? {
              ...item,
              plannedAmount: editingDebtPlannedAmount,
              collectedAmount: editingDebtCollectedAmount,
              dueDate: editingDebtDueDate || undefined,
              status: editingDebtStatus,
              note: editingDebtNote.trim() || undefined
            }
          : item
      )
    );
    setEditingDebtId(null);
  }

  function cancelDebtEdit() {
    setEditingDebtId(null);
  }

  function getMaxWorkDaysForDate(dateLike?: string) {
    const baseDate = dateLike ? new Date(dateLike) : new Date();
    if (Number.isNaN(baseDate.getTime())) return 26;
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let total = 0;
    for (let day = 1; day <= daysInMonth; day += 1) {
      if (new Date(year, month, day).getDay() !== 0) total += 1;
    }
    return total;
  }

  const workedDatesByUserMonth = useMemo(() => {
    const map = new Map<string, Set<string>>();
    Object.entries(attendance || {}).forEach(([key, kind]) => {
      if (kind !== "normal" && kind !== "compensated") return;
      const match = key.match(/^(.*)-(\d+)-(\d{2}:\d{2})$/);
      if (!match) return;
      const userId = match[1];
      const details = attendanceDetails[key];
      const dateText = extractLocalDateText(details?.time);
      if (!dateText) return;
      const monthKey = normalizeMonth(dateText);
      if (!monthKey) return;
      const mapKey = `${userId}:${monthKey}`;
      if (!map.has(mapKey)) map.set(mapKey, new Set<string>());
      map.get(mapKey)?.add(dateText);
    });
    return map;
  }, [attendance, attendanceDetails]);

  function getActualWorkedDaysForUser(userId?: string, monthKey?: string) {
    if (!userId || !monthKey) return 0;
    return workedDatesByUserMonth.get(`${userId}:${monthKey}`)?.size ?? 0;
  }

  function getHourlyRateForAssignee(displayName?: string, dateLike?: string) {
    if (!displayName) return 0;
    const account = accounts.find((item) => item.status === "active" && item.displayName === displayName);
    if (!account || !account.salaryValue) return 0;
    if ((account.salaryType ?? "daily") === "monthly") {
      const monthKey = normalizeMonth(dateLike) || reportMonth;
      const actualWorkDays = getActualWorkedDaysForUser(account.id, monthKey);
      return actualWorkDays > 0 ? account.salaryValue / actualWorkDays / 8 : 0;
    }
    return account.salaryValue / 8;
  }

  function getAssigneeListForStep(order: Order, step: string): string[] {
    switch (step) {
      case "Tiếp nhận":
      case "Báo giá":
        return order.saleName ? order.saleName.split(",").map((s) => s.trim()).filter(Boolean) : [];
      case "Thiết kế":
        return ((order.designerNames?.length ? order.designerNames : [order.designerName]) as string[]).filter(Boolean);
      case "Ra file":
        return ((order.fileOperatorNames?.length ? order.fileOperatorNames : [order.fileOperatorName]) as string[]).filter(Boolean);
      case "Sản xuất":
        return ((order.productionWorkerNames?.length ? order.productionWorkerNames : [order.productionWorkerName]) as string[]).filter(Boolean);
      case "Lắp đặt":
        return ((order.installerNames?.length ? order.installerNames : [order.installerName]) as string[]).filter(Boolean);
      case "Nghiệm thu":
      case "Hoàn công":
        return ((order.supervisorNames?.length ? order.supervisorNames : [order.supervisorName]) as string[]).filter(Boolean);
      default:
        return [];
    }
  }

  function getAdjustedHours(
    workerName: string,
    targetOrderId: string,
    targetStep: string,
    allOrders: Order[]
  ): number {
    const intervals: Array<{ orderId: string; step: string; start: Date; end: Date }> = [];
    const allowedSteps = ["Thiết kế", "Ra file", "Sản xuất", "Lắp đặt"];

    for (const order of allOrders) {
      const logs = order.historyLogs || [];
      for (const log of logs) {
        if (!allowedSteps.includes(log.step)) continue;
        if (isFutureFieldWorkCurrentStep(order, log.step)) {
          continue;
        }
        
        const assigneeList = getAssigneeListForStep(order, log.step);
        const finalAssignees = assigneeList.length > 0 ? assigneeList : [log.assignee].filter(Boolean);
        if (!finalAssignees.includes(workerName)) continue;

        let startStr = log.startedAt;
        if (["Thiết kế", "Ra file"].includes(log.step)) {
          startStr = log.acceptedAt;
        }
        if (!startStr) continue;

        const start = new Date(startStr);
        const end = log.completedAt ? new Date(log.completedAt) : new Date();
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) continue;

        intervals.push({ orderId: order.id, step: log.step, start, end });
      }
    }

    if (intervals.length === 0) return 0;

    const timestampsSet = new Set<number>();
    for (const iv of intervals) {
      timestampsSet.add(iv.start.getTime());
      timestampsSet.add(iv.end.getTime());
    }
    const sortedTimes = Array.from(timestampsSet).sort((a, b) => a - b);

    let totalAdjustedHours = 0;

    for (let i = 0; i < sortedTimes.length - 1; i++) {
      const tStart = sortedTimes[i];
      const tEnd = sortedTimes[i + 1];
      const tMid = (tStart + tEnd) / 2;

      const active = intervals.filter(iv => iv.start.getTime() <= tMid && iv.end.getTime() >= tMid);
      if (active.length === 0) continue;

      const targetActive = active.filter(iv => iv.orderId === targetOrderId && iv.step === targetStep);
      if (targetActive.length === 0) continue;

      const subHours = calculateWorkingHours(new Date(tStart).toISOString(), new Date(tEnd).toISOString());
      if (subHours <= 0) continue;

      const uniqueOrderIds = new Set(active.map(iv => iv.orderId));
      const concurrency = uniqueOrderIds.size;
      totalAdjustedHours += subHours / concurrency;
    }

    return parseFloat(totalAdjustedHours.toFixed(2));
  }

  function buildOrderCostSnapshot(order?: Order) {
    if (!order) {
      return {
        laborCost: 0,
        materialCost: 0,
        accessorySales: 0,
        accessoryCost: 0,
        transportCost: 0,
        loaderCost: 0,
        quoteValue: 0,
        estimateValue: 0,
        directSpent: 0,
        profit: 0
      };
    }

    const allowedSteps = ["Thiết kế", "Ra file", "Sản xuất", "Lắp đặt"];
    const filteredLogs = (order.historyLogs || []).filter((log) => allowedSteps.includes(log.step));
    const effectiveLogs = filteredLogs.filter((log) => {
      if (isFutureFieldWorkCurrentStep(order, log.step)) {
        return false;
      }
      return true;
    });
    
    const warrantyOrder = isWarrantyOrder(order);
    let laborCost = 0;
    if (order.customLaborCost !== undefined) {
      laborCost = order.customLaborCost;
    } else {
      effectiveLogs.forEach((log) => {
        const assignees = getAssigneeListForStep(order, log.step);
        const finalAssignees = assignees.length > 0 ? assignees : [log.assignee].filter(Boolean);
        
        finalAssignees.forEach((name) => {
          const personOT = overtimeRequests
            .filter((req) => req.orderCode === order.code && req.userDisplayName === name && req.status === "approved")
            .reduce((sum, req) => sum + (req.hours || 0), 0);
          const adjustedWorkingHours = getAdjustedHours(name, order.id, log.step, orders);
          const hourlyRate = getHourlyRateForAssignee(name, log.completedAt || log.startedAt);
          const cost = (adjustedWorkingHours * hourlyRate) + (personOT * hourlyRate * 1.5);
          laborCost += cost;
        });
      });
    }

    const materialCost = (order.materialsList || []).reduce((sum, mat) => sum + mat.price, 0);
    let accessorySales = 0;
    let accessoryCost = 0;
    (order.externalAccessories || []).forEach((acc) => {
      if (!acc.name.trim()) return;
      accessorySales += acc.sellPrice || 0;
      accessoryCost += acc.actualCost || acc.costPrice || 0;
    });

    const transportCost = cashTransactions
      .filter((item) => item.orderId === order.id && item.category === "Vận chuyển" && (item.type === "cash_out" || item.type === "bank_out"))
      .reduce((sum, item) => sum + item.amount, 0);

    const loaderCost = cashTransactions
      .filter((item) => item.orderId === order.id && item.category === "Bốc vác" && (item.type === "cash_out" || item.type === "bank_out"))
      .reduce((sum, item) => sum + item.amount, 0);

    const quoteValue = order.quotation?.quoteValue || 0;
    const estimateValue = order.quotation?.estimateValue || 0;
    const manualSpent = cashTransactions
      .filter((item) => item.orderId === order.id && (item.type === "cash_out" || item.type === "bank_out" || item.type === "transfer"))
      .reduce((sum, item) => sum + item.amount, 0);
    const directSpent = laborCost + manualSpent;
    const profit = warrantyOrder ? 0 : (quoteValue + accessorySales - directSpent);

    return {
      laborCost,
      materialCost,
      accessorySales,
      accessoryCost,
      transportCost,
      loaderCost,
      quoteValue,
      estimateValue,
      directSpent,
      profit
    };
  }

  function calculateLaborCostForStep(order: Order, step: string) {
    if (!order) return 0;
    const allowedSteps = ["Thiết kế", "Ra file", "Sản xuất", "Lắp đặt"];
    if (!allowedSteps.includes(step)) return 0;
    const logs = (order.historyLogs || []).filter((log) => {
      if (log.step !== step) return false;
      if (isFutureFieldWorkCurrentStep(order, log.step)) {
        return false;
      }
      return true;
    });
    
    let laborCost = 0;
    logs.forEach((log) => {
      const assignees = getAssigneeListForStep(order, log.step);
      const finalAssignees = assignees.length > 0 ? assignees : [log.assignee].filter(Boolean);
      
      finalAssignees.forEach((name) => {
        const personOT = overtimeRequests
          .filter((req) => req.orderCode === order.code && req.userDisplayName === name && req.status === "approved")
          .reduce((sum, req) => sum + (req.hours || 0), 0);
        const adjustedWorkingHours = getAdjustedHours(name, order.id, log.step, orders);
        const hourlyRate = getHourlyRateForAssignee(name, log.completedAt || log.startedAt);
        const cost = (adjustedWorkingHours * hourlyRate) + (personOT * hourlyRate * 1.5);
        laborCost += cost;
      });
    });
    return laborCost;
  }

  const getBudgetAlertTone = (order?: Order) => {
    const snapshot = buildOrderCostSnapshot(order);
    if (!snapshot.estimateValue) return "normal" as const;
    const ratio = snapshot.directSpent / snapshot.estimateValue;
    if (ratio > 0.95) return "purple" as const;
    if (ratio > 0.75) return "red" as const;
    return "normal" as const;
  };

  // Tính toán số liệu tài chính cho đơn hàng được chọn
  const financeStats = useMemo(() => {
    if (!selectedOrder) return { laborCost: 0, materialCost: 0, accessorySales: 0, accessoryCost: 0, profit: 0, totalWorkdays: 0, logsWithTime: [] };

    // 1. Tính công thợ & tiền công thợ dựa trên log lịch sử các công đoạn và tăng ca
    const warrantyOrder = isWarrantyOrder(selectedOrder);
    let totalWorkdays = 0;
    let laborCost = 0;
    
    const allowedSteps = ["Thiết kế", "Ra file", "Sản xuất", "Lắp đặt"];
    const filteredLogs = (selectedOrder.historyLogs || []).filter((log) => {
      if (!allowedSteps.includes(log.step)) return false;
      if (isFutureFieldWorkCurrentStep(selectedOrder, log.step)) {
        return false;
      }
      return true;
    });
    
    const logsWithTime = filteredLogs.map((log) => {
      const assignees = getAssigneeListForStep(selectedOrder, log.step);
      const finalAssignees = assignees.length > 0 ? assignees : [log.assignee].filter(Boolean);

      const assigneeDetails = finalAssignees.map((name) => {
        const personOT = overtimeRequests
          .filter((req) => req.orderCode === selectedOrder.code && req.userDisplayName === name && req.status === "approved")
          .reduce((sum, req) => sum + (req.hours || 0), 0);
        const adjustedWorkingHours = getAdjustedHours(name, selectedOrder.id, log.step, orders);
        const totalHours = adjustedWorkingHours + personOT;
        const workdays = parseFloat((totalHours / 8).toFixed(2));
        const hourlyRate = getHourlyRateForAssignee(name, log.completedAt || log.startedAt);
        const cost = (adjustedWorkingHours * hourlyRate) + (personOT * hourlyRate * 1.5);
        
        return {
          name,
          workingHours: adjustedWorkingHours,
          overtimeHours: personOT,
          workdays,
          cost,
          hourlyRate
        };
      });

      const stepCost = assigneeDetails.reduce((sum, item) => sum + item.cost, 0);
      const stepWorkdays = assigneeDetails.reduce((sum, item) => sum + item.workdays, 0);
      const totalAdjustedStepHours = assigneeDetails.reduce((sum, item) => sum + item.workingHours, 0);
      
      laborCost += warrantyOrder ? 0 : stepCost;
      totalWorkdays += stepWorkdays;

      return {
        step: log.step,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        workingHours: parseFloat((totalAdjustedStepHours / (assigneeDetails.length || 1)).toFixed(2)),
        workerCount: finalAssignees.length,
        assigneeDetails,
          cost: warrantyOrder ? 0 : stepCost,
          workdays: parseFloat(stepWorkdays.toFixed(2))
      };
    });

    // 2. Chi phí vật tư
    const materialCost = (selectedOrder.materialsList || []).reduce((sum, mat) => sum + mat.price, 0);

    // 3. Phụ kiện ngoài
    let accessorySales = 0;
    let accessoryCost = 0;
    (selectedOrder.externalAccessories || []).forEach((acc) => {
      if (acc.name.trim()) {
        accessorySales += acc.sellPrice || 0;
        accessoryCost += acc.actualCost || acc.costPrice || 0;
      }
    });

    // 4. Chi phí lắp đặt khác (vận chuyển, bốc vác) từ cashTransactions thực tế
    const transport = warrantyOrder ? 0 : cashTransactions
      .filter((item) => item.orderId === selectedOrder.id && item.category === "Vận chuyển" && (item.type === "cash_out" || item.type === "bank_out"))
      .reduce((sum, item) => sum + item.amount, 0);

    const loader = warrantyOrder ? 0 : cashTransactions
      .filter((item) => item.orderId === selectedOrder.id && item.category === "Bốc vác" && (item.type === "cash_out" || item.type === "bank_out"))
      .reduce((sum, item) => sum + item.amount, 0);

    // 5. Lợi nhuận
    const revenue = (selectedOrder.quotation?.quoteValue || 0) + accessorySales;
    const totalExpenses = laborCost + materialCost + accessoryCost + transport + loader;
    const profit = revenue - totalExpenses;

    return {
      laborCost,
      materialCost,
      accessorySales,
      accessoryCost,
      profit,
      totalWorkdays: parseFloat(totalWorkdays.toFixed(2)),
      logsWithTime
    };
  }, [selectedOrder, overtimeRequests, accounts, cashTransactions]);

  const selectedOrderSnapshot = useMemo(
    () => buildOrderCostSnapshot(selectedOrder),
    [selectedOrder, overtimeRequests, accounts, cashTransactions]
  );

  function exportOrdersData() {
    const rows: Array<Array<string | number>> = [
      ["Mã đơn", "Khách hàng", "Sale quản lý", "Giá dự toán", "Giá báo khách", "Chi trực tiếp hiện tại", "Tỷ lệ chi/dự toán", "Bước hiện tại"]
    ];
    orders.forEach((order) => {
      const snapshot = buildOrderCostSnapshot(order);
      const ratio = snapshot.estimateValue > 0 ? `${((snapshot.directSpent / snapshot.estimateValue) * 100).toFixed(1)}%` : "";
      rows.push([
        order.code,
        order.customerName,
        order.saleName || "",
        snapshot.estimateValue,
        snapshot.quoteValue,
        snapshot.directSpent,
        ratio,
        order.step
      ]);
    });
    downloadCsv(`du-lieu-don-hang-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  function exportMonthlyCashflow() {
    const rows: Array<Array<string | number>> = [["Ngày", "Loại", "Nội dung", "Số tiền", "Tài khoản", "Người nhập"]];
    cashTransactions
      .filter((item) => item.createdAt.slice(0, 7) === cashExportMonth)
      .forEach((item) => {
        rows.push([
          item.createdAt.slice(0, 10),
          item.type,
          item.note,
          item.amount,
          item.accountName,
          item.createdBy
        ]);
      });
    downloadCsv(`thu-chi-${cashExportMonth}.csv`, rows);
  }

  function getMonthlySalary(account: UserAccount, actualWorkDays: number) {
    if (!account.salaryValue) return 0;
    if ((account.salaryType ?? "daily") === "monthly") return account.salaryValue;
    return account.salaryValue * actualWorkDays;
  }

  const orderFinancialRows = useMemo(() => {
    return orders.map((order) => {
      const snapshot = buildOrderCostSnapshot(order);
      const orderIncomes = cashTransactions.filter(
        (item) => item.orderId === order.id && (item.type === "cash_in" || item.type === "bank_in")
      );
      const collected = orderIncomes.reduce((sum, item) => sum + item.amount, 0);
      const incurred = (order.incurredCosts || []).reduce((sum, item) => sum + (item.amount || 0), 0);
      const totalValue = (order.quotation?.quoteValue || 0) + (snapshot.accessorySales || 0);
      const remaining = Math.max(0, totalValue + incurred - collected);
      
      const nghiemThuLog = (order.historyLogs || []).find(
        (log) => log.step === "Nghiệm thu" && log.completedAt
      );
      const isNghiemThuPassed = nghiemThuLog || order.step === "Hoàn công";
      let isOverdue = false;
      if (isNghiemThuPassed && remaining > 0) {
        const completionTime = nghiemThuLog?.completedAt 
          ? new Date(nghiemThuLog.completedAt).getTime()
          : Date.now();
        const diffTime = Date.now() - completionTime;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        if (diffDays > 7) {
          isOverdue = true;
        }
      }
      
      const debtStatus = isOverdue
        ? "overdue"
        : remaining > 0
          ? "pending"
          : "paid";
      const margin = snapshot.quoteValue > 0 ? (snapshot.profit / snapshot.quoteValue) * 100 : 0;
      return {
        order,
        snapshot,
        collected,
        remaining,
        debtStatus,
        margin
      };
    });
  }, [orders, cashTransactions, overtimeRequests, accounts]);

  const monthlyOverview = useMemo(() => {
    const monthTransactions = cashTransactions.filter((item) => normalizeMonth(item.createdAt) === reportMonth);
    const collectedThisMonth = monthTransactions
      .filter((item) => item.type === "cash_in" || item.type === "bank_in")
      .reduce((sum, item) => sum + item.amount, 0);

    const monthlyOrders = orderFinancialRows.filter(row => getOrderMonth(row.order) === reportMonth);
    const normalOrders = monthlyOrders.filter(row => !row.order.isWarranty);
    const warrantyOrders = monthlyOrders.filter(row => row.order.isWarranty);

    const directMaterial = normalOrders.reduce((sum, item) => sum + item.snapshot.materialCost + item.snapshot.accessoryCost + item.snapshot.transportCost + item.snapshot.loaderCost, 0);
    const directLabor = normalOrders.reduce((sum, item) => sum + item.snapshot.laborCost, 0);
    const totalRevenue = normalOrders.reduce((sum, item) => sum + item.snapshot.quoteValue + item.snapshot.accessorySales, 0);
    const totalProfit = normalOrders.reduce((sum, item) => sum + item.snapshot.profit, 0);

    const workshopWarrantyCost = warrantyOrders.reduce((sum, item) => {
      const incurred = (item.order.incurredCosts || []).reduce((s, c) => s + (c.amount || 0), 0);
      const cost = item.snapshot.laborCost + item.snapshot.materialCost + item.snapshot.accessoryCost + item.snapshot.transportCost + item.snapshot.loaderCost + incurred;
      return sum + cost;
    }, 0);

    const remainingReceivable = orderFinancialRows.reduce((sum, item) => sum + item.remaining, 0);
    const overdueReceivable = orderFinancialRows
      .filter((item) => item.debtStatus === "overdue")
      .reduce((sum, item) => sum + item.remaining, 0);
    return {
      collectedThisMonth,
      remainingReceivable,
      overdueReceivable,
      directMaterial,
      directLabor,
      totalRevenue,
      totalProfit,
      workshopWarrantyCost
    };
  }, [cashTransactions, reportMonth, orderFinancialRows]);

  const efficiencyRows = useMemo(() => {
    const activeAccounts = accounts.filter((item) => item.status === "active" && item.salaryValue);
    return activeAccounts.map((account) => {
      const actualWorkDays = getActualWorkedDaysForUser(account.id, reportMonth);
      const monthlySalary = getMonthlySalary(account, actualWorkDays);
      const availableHours = actualWorkDays * 8;
      const hourlyRate = availableHours > 0 ? monthlySalary / availableHours : 0;
      let assignedHours = 0;

      orders.forEach((order) => {
        (order.historyLogs || []).forEach((log) => {
          if (log.assignee !== account.displayName) return;
          const monthSource = log.completedAt || log.startedAt;
          if (normalizeMonth(monthSource) !== reportMonth) return;
          const adjustedHours = getAdjustedHours(account.displayName, order.id, log.step, orders);
          assignedHours += adjustedHours;
        });
      });

      const overtimeHours = overtimeRequests
        .filter((item) => item.status === "approved" && item.userId === account.id && normalizeMonth(item.createdAt) === reportMonth)
        .reduce((sum, item) => sum + (item.hours || 0), 0);

      assignedHours += overtimeHours;
      const idleHours = Math.max(0, availableHours - assignedHours);
      const allocatedCost = assignedHours * hourlyRate;
      const idleCost = idleHours * hourlyRate;
      const utilizationRatio = availableHours > 0 ? (assignedHours / availableHours) * 100 : 0;

      return {
        account,
        department: getDepartmentLabel(account),
        monthlySalary,
        actualWorkDays,
        availableHours,
        assignedHours,
        idleHours,
        allocatedCost,
        idleCost,
        utilizationRatio
      };
    });
  }, [accounts, orders, overtimeRequests, reportMonth, workedDatesByUserMonth]);

  const filteredEfficiencyRows = useMemo(() => {
    return efficiencyRows.filter((row) => {
      if (efficiencyEmployeeFilter !== "all" && row.account.id !== efficiencyEmployeeFilter) return false;
      if (efficiencyDepartmentFilter !== "all" && row.department !== efficiencyDepartmentFilter) return false;
      if (efficiencyOrderFilter !== "all") {
        const targetOrder = orders.find((item) => item.id === efficiencyOrderFilter);
        if (!targetOrder) return false;
        const touchedOrder = (targetOrder.historyLogs || []).some((log) => log.assignee === row.account.displayName);
        if (!touchedOrder) return false;
      }
      return true;
    });
  }, [efficiencyRows, efficiencyEmployeeFilter, efficiencyDepartmentFilter, efficiencyOrderFilter, orders]);

  const efficiencySummary = useMemo(() => {
    return filteredEfficiencyRows.reduce(
      (summary, row) => {
        summary.monthlySalary += row.monthlySalary;
        summary.availableHours += row.availableHours;
        summary.assignedHours += row.assignedHours;
        summary.idleHours += row.idleHours;
        summary.allocatedCost += row.allocatedCost;
        summary.idleCost += row.idleCost;
        return summary;
      },
      { monthlySalary: 0, availableHours: 0, assignedHours: 0, idleHours: 0, allocatedCost: 0, idleCost: 0 }
    );
  }, [filteredEfficiencyRows]);

  const efficiencyUtilization = efficiencySummary.availableHours > 0 ? (efficiencySummary.assignedHours / efficiencySummary.availableHours) * 100 : 0;

  const selectedOrderIncomeRows = useMemo(() => {
    if (!selectedOrder) return [];
    return cashTransactions.filter((item) => item.orderId === selectedOrder.id && (item.type === "cash_in" || item.type === "bank_in"));
  }, [cashTransactions, selectedOrder]);

  const selectedOrderExpenseRows = useMemo(() => {
    if (!selectedOrder) return [];
    return cashTransactions.filter((item) => item.orderId === selectedOrder.id && (item.type === "cash_out" || item.type === "bank_out" || item.type === "transfer"));
  }, [cashTransactions, selectedOrder]);

  const autoLaborRows = useMemo(() => {
    if (!selectedOrder) return [];
    
    const getLatestDateForStep = (step: string) => {
      const logs = (selectedOrder.historyLogs || []).filter((log) => log.step === step);
      if (logs.length === 0) return new Date().toISOString().slice(0, 10);
      const latest = logs.reduce((latestLog, currentLog) => {
        const latestTime = new Date(latestLog.completedAt || latestLog.startedAt || 0).getTime();
        const currentTime = new Date(currentLog.completedAt || currentLog.startedAt || 0).getTime();
        return currentTime > latestTime ? currentLog : latestLog;
      });
      return (latest.completedAt || latest.startedAt || new Date().toISOString()).slice(0, 10);
    };

    return [
      {
        id: `auto-labor-design-${selectedOrder.id}`,
        type: "cash_out",
        accountName: "Quỹ tiền mặt",
        note: "Nhân công Thiết kế",
        createdAt: getLatestDateForStep("Thiết kế"),
        amount: calculateLaborCostForStep(selectedOrder, "Thiết kế"),
        category: "Nhân công trực tiếp",
        createdBy: "",
        isAuto: true
      },
      {
        id: `auto-labor-file-${selectedOrder.id}`,
        type: "cash_out",
        accountName: "Quỹ tiền mặt",
        note: "Nhân công Ra file",
        createdAt: getLatestDateForStep("Ra file"),
        amount: calculateLaborCostForStep(selectedOrder, "Ra file"),
        category: "Nhân công trực tiếp",
        createdBy: "",
        isAuto: true
      },
      {
        id: `auto-labor-production-${selectedOrder.id}`,
        type: "cash_out",
        accountName: "Quỹ tiền mặt",
        note: "Nhân công Sản xuất",
        createdAt: getLatestDateForStep("Sản xuất"),
        amount: calculateLaborCostForStep(selectedOrder, "Sản xuất"),
        category: "Nhân công trực tiếp",
        createdBy: "",
        isAuto: true
      },
      {
        id: `auto-labor-installation-${selectedOrder.id}`,
        type: "cash_out",
        accountName: "Quỹ tiền mặt",
        note: "Nhân công Lắp đặt",
        createdAt: getLatestDateForStep("Lắp đặt"),
        amount: calculateLaborCostForStep(selectedOrder, "Lắp đặt"),
        category: "Nhân công trực tiếp",
        createdBy: "",
        isAuto: true
      }
    ] as CashTransaction[];
  }, [selectedOrder, overtimeRequests]);

  const displayedOrderExpenseRows = useMemo(() => {
    if (!selectedOrder) return [];
    
    const manualExpenses = cashTransactions.filter(
      (item) => item.orderId === selectedOrder.id && (item.type === "cash_out" || item.type === "bank_out" || item.type === "transfer")
    );

    const totalLaborCalculated = autoLaborRows.reduce((sum, item) => sum + item.amount, 0);
    const laborAmount = selectedOrder.customLaborCost !== undefined ? selectedOrder.customLaborCost : totalLaborCalculated;

    const laborRow: CashTransaction = {
      id: `auto-labor-total-${selectedOrder.id}`,
      type: "cash_out",
      accountName: "Quỹ tiền mặt",
      note: "Nhân công",
      createdAt: new Date().toISOString(),
      amount: laborAmount,
      category: "Nhân công trực tiếp",
      createdBy: "",
      isAuto: true
    };

    return [laborRow, ...manualExpenses];
  }, [selectedOrder, cashTransactions, autoLaborRows]);

  const totalIncurred = useMemo(() => {
    if (!selectedOrder || !selectedOrder.incurredCosts) return 0;
    return selectedOrder.incurredCosts.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [selectedOrder]);

  const remainingDebt = useMemo(() => {
    if (!selectedOrder) return 0;
    const totalCollected = selectedOrderIncomeRows.reduce((sum, item) => sum + item.amount, 0);
    const revenue = (selectedOrder.quotation?.quoteValue || 0) + (selectedOrderSnapshot?.accessorySales || 0);
    return Math.max(0, revenue + totalIncurred - totalCollected);
  }, [selectedOrder, selectedOrderIncomeRows, selectedOrderSnapshot, totalIncurred]);

  const debtColorClass = useMemo(() => {
    if (!selectedOrder) return "text-orange-600";
    const nghiemThuLog = (selectedOrder.historyLogs || []).find(
      (log) => log.step === "Nghiệm thu" && log.completedAt
    );
    const isNghiemThuPassed = nghiemThuLog || selectedOrder.step === "Hoàn công";
    if (isNghiemThuPassed) {
      if (remainingDebt <= 0) {
        return "text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded";
      }
      const completionTime = nghiemThuLog?.completedAt 
        ? new Date(nghiemThuLog.completedAt).getTime()
        : Date.now();
      const diffTime = Date.now() - completionTime;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (diffDays > 7) {
        return "text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200";
      } else {
        return "text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded";
      }
    }
    return "text-orange-600";
  }, [selectedOrder, remainingDebt]);

  return (
    <section className="grid gap-6 text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900">Kế toán theo đơn hàng</h2>
          <p className="text-sm text-slate-500">GOMITA quản lý tài chính theo từng đơn, đồng thời tách riêng chi phí nhàn rỗi của bộ máy.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={reportMonth}
            onChange={(event) => setReportMonth(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none focus:border-orange-400"
          />
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {[
              { id: "overview", label: "Tổng quan" },
              { id: "efficiency", label: "Hiệu suất nhân sự" },
              { id: "profit", label: "Lãi lỗ đơn hàng" }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMainTab(item.id as typeof mainTab)}
                className={`rounded-md px-3 py-2 text-xs font-black transition ${mainTab === item.id ? "bg-orange-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 1. Thanh Tổng hợp */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-slate-500">Đã thu tháng này</div>
          <div className="mt-2 text-2xl font-black text-blue-600">
            {formatCurrency(monthlyOverview.collectedThisMonth)}
          </div>
          <div className="mt-1 text-xs text-slate-400">Tổng tiền thu ghi nhận trong tháng</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-slate-500">Còn phải thu</div>
          <div className="mt-2 text-2xl font-black text-orange-600">
            {formatCurrency(monthlyOverview.remainingReceivable)}
          </div>
          <div className="mt-1 text-xs text-slate-400">Công nợ còn lại của toàn bộ đơn đang theo dõi</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-slate-500">Công nợ quá hạn</div>
          <div className="mt-2 text-2xl font-black text-amber-600">
            {formatCurrency(monthlyOverview.overdueReceivable)}
          </div>
          <div className="mt-1 text-xs text-slate-400">Các khoản phải thu đã quá hạn thanh toán</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-slate-500">Chi phí vật tư</div>
          <div className="mt-2 text-2xl font-black text-indigo-600">
            {formatCurrency(monthlyOverview.directMaterial)}
          </div>
          <div className="mt-1 text-xs text-slate-400">Vật tư, phụ kiện, vận chuyển và bốc vác</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-slate-500">Chi phí nhân công trực tiếp</div>
          <div className="mt-2 text-2xl font-black text-fuchsia-600">
            {formatCurrency(monthlyOverview.directLabor)}
          </div>
          <div className="mt-1 text-xs text-slate-400">Tính từ giờ thực tế trên các công đoạn đơn hàng</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-slate-500">Chi phí nhân sự nhàn rỗi</div>
          <div className="mt-2 text-2xl font-black text-violet-600">
            {formatCurrency(efficiencySummary.idleCost)}
          </div>
          <div className="mt-1 text-xs text-slate-400">Phần lương chưa phân bổ được vào đơn hàng trong tháng</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-slate-500">Chi phí vận hành bảo hành</div>
          <div className="mt-2 text-2xl font-black text-rose-600">
            {formatCurrency(monthlyOverview.workshopWarrantyCost)}
          </div>
          <div className="mt-1 text-xs text-slate-400">Chi phí phát sinh từ các đơn bảo hành trong tháng</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-slate-500">Lợi nhuận tạm tính</div>
          <div className={`mt-2 text-2xl font-black ${monthlyOverview.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(monthlyOverview.totalProfit)}
          </div>
          <div className="mt-1 text-xs text-slate-400">Lãi gộp từ các đơn hàng đang theo dõi</div>
        </div>
      </div>

      {canExportFinance ? (
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-800">Xuất dữ liệu kế toán</h3>
            <p className="mt-1 text-xs text-slate-500">Tải dữ liệu đơn hàng và dữ liệu thu chi theo tháng để đối chiếu.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportOrdersData}
              className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Tải dữ liệu đơn hàng
            </button>
            <input
              type="month"
              value={cashExportMonth}
              onChange={(event) => setCashExportMonth(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none focus:border-orange-400"
            />
            <button
              type="button"
              onClick={exportMonthlyCashflow}
              className="flex min-h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
            >
              <Download className="h-4 w-4" />
              Tải dữ liệu thu chi tháng
            </button>
          </div>
        </div>
      </section>
      ) : null}

      {mainTab === "efficiency" && (
        <section className="grid gap-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <h3 className="text-lg font-black text-slate-800">Hiệu suất nhân sự theo tháng</h3>
              <p className="text-sm text-slate-500">Theo dõi lương đã trả, giờ làm đơn hàng, giờ nhàn rỗi và phần chi phí chưa phân bổ.</p>
            </div>
            <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold" value={efficiencyEmployeeFilter} onChange={(event) => setEfficiencyEmployeeFilter(event.target.value)}>
              <option value="all">Tất cả nhân sự</option>
              {efficiencyRows.map((row) => (
                <option key={row.account.id} value={row.account.id}>{row.account.displayName}</option>
              ))}
            </select>
            <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold" value={efficiencyDepartmentFilter} onChange={(event) => setEfficiencyDepartmentFilter(event.target.value)}>
              <option value="all">Tất cả bộ phận</option>
              {[...new Set(efficiencyRows.map((row) => row.department))].map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
            <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold" value={efficiencyOrderFilter} onChange={(event) => setEfficiencyOrderFilter(event.target.value)}>
              <option value="all">Tất cả đơn hàng</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>{order.code}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Tổng lương phải trả</div><div className="mt-1 text-xl font-black text-slate-900">{formatCurrency(efficiencySummary.monthlySalary)}</div></div>
            <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Tổng giờ khả dụng</div><div className="mt-1 text-xl font-black text-slate-900">{efficiencySummary.availableHours.toFixed(2)} giờ</div></div>
            <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Giờ đã làm đơn hàng</div><div className="mt-1 text-xl font-black text-emerald-600">{efficiencySummary.assignedHours.toFixed(2)} giờ</div></div>
            <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Giờ nhàn rỗi</div><div className="mt-1 text-xl font-black text-orange-600">{efficiencySummary.idleHours.toFixed(2)} giờ</div></div>
            <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Chi phí đã phân bổ</div><div className="mt-1 text-xl font-black text-blue-600">{formatCurrency(efficiencySummary.allocatedCost)}</div></div>
            <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Chi phí nhàn rỗi</div><div className="mt-1 text-xl font-black text-violet-600">{formatCurrency(efficiencySummary.idleCost)}</div></div>
            <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Tỷ lệ sử dụng</div><div className="mt-1 text-xl font-black text-green-600">{efficiencyUtilization.toFixed(1)}%</div></div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-3">Nhân sự</th>
                  <th>Bộ phận</th>
                  <th>Lương tháng</th>
                  <th>Giờ khả dụng</th>
                  <th>Giờ làm đơn</th>
                  <th>Giờ nhàn rỗi</th>
                  <th>Chi phí phân bổ</th>
                  <th>Chi phí nhàn rỗi</th>
                  <th>Tỷ lệ sử dụng</th>
                </tr>
              </thead>
              <tbody>
                {filteredEfficiencyRows.map((row) => (
                  <tr key={row.account.id} className="border-b border-slate-100 text-slate-700">
                    <td className="py-3 font-black text-slate-900">{row.account.displayName}</td>
                    <td>{row.department}</td>
                    <td>{formatCurrency(row.monthlySalary)}</td>
                    <td>{row.availableHours.toFixed(2)}</td>
                    <td>{row.assignedHours.toFixed(2)}</td>
                    <td>{row.idleHours.toFixed(2)}</td>
                    <td>{formatCurrency(row.allocatedCost)}</td>
                    <td>{formatCurrency(row.idleCost)}</td>
                    <td className="font-black">{row.utilizationRatio.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {mainTab === "profit" && (
        <section className="grid gap-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-lg font-black text-slate-800">Lãi lỗ đơn hàng</h3>
            <p className="text-sm text-slate-500">Tách rõ doanh thu, đã thu, còn phải thu và toàn bộ chi phí trực tiếp của từng đơn.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-3">Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Doanh thu</th>
                  <th>Đã thu</th>
                  <th>Còn phải thu</th>
                  <th>Vật tư</th>
                  <th>Nhân công trực tiếp</th>
                  <th>Vận chuyển</th>
                  <th>Bốc vác</th>
                  <th>Chi phí khác</th>
                  <th>Lãi gộp</th>
                  <th>Tỷ suất</th>
                </tr>
              </thead>
              <tbody>
                {orderFinancialRows.map((row) => (
                  <tr key={row.order.id} className="border-b border-slate-100 text-slate-700">
                    <td className="py-3 font-black text-slate-900">
                      {row.order.code}
                      {row.order.isWarranty && (
                        <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-700">BẢO HÀNH</span>
                      )}
                    </td>
                    <td>{row.order.customerName}</td>
                    <td>{formatCurrency(row.snapshot.quoteValue + row.snapshot.accessorySales)}</td>
                    <td>{formatCurrency(row.collected)}</td>
                    <td>{formatCurrency(row.remaining)}</td>
                    <td>{formatCurrency(row.snapshot.materialCost + row.snapshot.accessoryCost)}</td>
                    <td>{formatCurrency(row.snapshot.laborCost)}</td>
                    <td>{formatCurrency(row.snapshot.transportCost)}</td>
                    <td>{formatCurrency(row.snapshot.loaderCost)}</td>
                    <td>{formatCurrency(0)}</td>
                    <td className={`font-black ${row.snapshot.profit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(row.snapshot.profit)}</td>
                    <td className="font-black">{row.margin.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {mainTab === "overview" && (
      <>
      <div className="hidden grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-800">Thu chi & dòng tiền công ty</h3>
              <p className="text-sm text-slate-500">Theo dõi quỹ tiền mặt, ngân hàng và chuyển quỹ.</p>
            </div>
            <div className="text-right text-xs font-bold text-slate-500">Sổ tạm thời trước khi chuyển DB thật</div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm font-bold text-slate-500">Quỹ tiền mặt</div>
              <div className="mt-2 text-2xl font-black text-green-600">{financeLedger.cashBalance.toLocaleString("vi-VN")} đ</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm font-bold text-slate-500">Tài khoản ngân hàng</div>
              <div className="mt-2 text-2xl font-black text-blue-600">{financeLedger.bankBalance.toLocaleString("vi-VN")} đ</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <select className="h-11 rounded-lg border border-slate-200 px-3 bg-white font-bold" value={cashType} onChange={(event) => setCashType(event.target.value as CashTransactionType)}>
              <option value="cash_in">Phiếu thu tiền mặt</option>
              <option value="cash_out">Phiếu chi tiền mặt</option>
              <option value="bank_in">Thu vào ngân hàng</option>
              <option value="bank_out">Chi từ ngân hàng</option>
              <option value="transfer">Chuyển quỹ tiền mặt → ngân hàng</option>
            </select>
            <input className="h-11 rounded-lg border border-slate-200 px-3 font-bold outline-none focus:border-orange-400" type="number" placeholder="Số tiền" value={cashAmount || ""} onChange={(event) => setCashAmount(Number(event.target.value))} />
            <input className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-400 md:col-span-2" placeholder="Nội dung thu/chi" value={cashNote} onChange={(event) => setCashNote(event.target.value)} />
          </div>
          <button className="mt-3 min-h-11 rounded-lg bg-orange-500 px-4 font-black text-white" onClick={addCashTransaction} type="button">Ghi nhận thu / chi</button>
          <div className="mt-4 grid gap-2">
            {cashTransactions.slice(0, 6).map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <div>
                  <div className="font-black">{item.note}</div>
                  <div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("vi-VN")} • {item.accountName}</div>
                </div>
                <div className={`font-black ${item.type === "cash_out" || item.type === "bank_out" ? "text-red-600" : "text-green-600"}`}>{item.amount.toLocaleString("vi-VN")} đ</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-black text-slate-800">Công nợ khách hàng</h3>
            <p className="text-sm text-slate-500">Theo dõi đặt cọc, đợt 2, trước sản xuất, trước lắp đặt, nghiệm thu và hoàn công.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">Phải thu kế hoạch</div><div className="mt-1 text-xl font-black text-slate-900">{debtStats.planned.toLocaleString("vi-VN")} đ</div></div>
            <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">Đã thu</div><div className="mt-1 text-xl font-black text-green-600">{debtStats.collected.toLocaleString("vi-VN")} đ</div></div>
            <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">Còn phải thu</div><div className="mt-1 text-xl font-black text-orange-600">{debtStats.remaining.toLocaleString("vi-VN")} đ</div></div>
            <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">Quá hạn</div><div className="mt-1 text-xl font-black text-red-600">{debtStats.overdue.toLocaleString("vi-VN")} đ</div></div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <select className="h-11 rounded-lg border border-slate-200 px-3 bg-white font-bold" value={debtStage} onChange={(event) => setDebtStage(event.target.value as CustomerDebtStage)}>
              {(["deposit", "stage2", "before_production", "before_installation", "handover", "completed"] as CustomerDebtStage[]).map((value) => <option key={value} value={value}>{getDebtStageLabel(value)}</option>)}
            </select>
            <input className="h-11 rounded-lg border border-slate-200 px-3 font-bold outline-none focus:border-orange-400" type="number" placeholder="Phải thu" value={debtPlannedAmount || ""} onChange={(event) => setDebtPlannedAmount(Number(event.target.value))} />
            <input className="h-11 rounded-lg border border-slate-200 px-3 font-bold outline-none focus:border-orange-400" type="number" placeholder="Đã thu" value={debtCollectedAmount || ""} onChange={(event) => setDebtCollectedAmount(Number(event.target.value))} />
            <input className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-400" type="date" value={debtDueDate} onChange={(event) => setDebtDueDate(event.target.value)} />
            <select className="h-11 rounded-lg border border-slate-200 px-3 bg-white font-bold" value={debtStatus} onChange={(event) => setDebtStatus(event.target.value as CustomerDebtStatus)}>
              {Object.entries(customerDebtStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-400" placeholder="Ghi chú công nợ" value={debtNote} onChange={(event) => setDebtNote(event.target.value)} />
          </div>
          <button className="mt-3 min-h-11 rounded-lg bg-orange-500 px-4 font-black text-white" onClick={addCustomerDebt} type="button">Ghi nhận công nợ cho đơn đang chọn</button>
          <div className="mt-4 grid gap-2">
            {customerDebts.slice(0, 8).map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <div>
                  <div className="font-black">{item.orderCode} • {getDebtStageLabel(item.stage)}</div>
                  <div className="text-xs text-slate-500">{item.customerName}{item.dueDate ? ` • Hạn ${item.dueDate}` : ""}</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-slate-900">{item.collectedAmount.toLocaleString("vi-VN")} / {item.plannedAmount.toLocaleString("vi-VN")} đ</div>
                  <div className="text-xs font-bold text-slate-500">{customerDebtStatusLabels[item.status]}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* 2. Danh sách Đơn Hàng Bên Trái */}
        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm h-[600px] overflow-y-auto">
          <h3 className="mb-4 text-base font-black text-slate-800 flex items-center gap-2">
            <BriefcaseBusiness className="h-5 w-5 text-orange-500" />
            Danh sách đơn hàng
          </h3>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                  <th className="py-3 px-3">Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Giá trị đơn</th>
                  <th>Đã thu</th>
                  <th>Còn nợ</th>
                  <th>Trạng thái</th>
                  <th className="pr-3">LN tạm tính</th>
                </tr>
              </thead>
              <tbody>
                {orderFinancialRows.map(({ order, snapshot, collected, remaining, debtStatus, margin }) => {
                  const tone = getBudgetAlertTone(order);
                  const rowClass =
                    order.id === selectedOrderId
                      ? "bg-orange-50/70"
                      : tone === "purple"
                        ? "bg-purple-50/60"
                        : tone === "red"
                          ? "bg-red-50/60"
                          : "bg-white";
                  const statusClass =
                    debtStatus === "paid"
                      ? "bg-emerald-100 text-emerald-700"
                      : debtStatus === "overdue"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700";
                  return (
                    <tr key={order.id} className={`${rowClass} cursor-pointer border-b border-slate-100 text-slate-700`} onClick={() => setSelectedOrderId(order.id)}>
                      <td className="py-3 px-3 font-black text-slate-900">{order.code}</td>
                      <td>{order.customerName}</td>
                      <td>{formatCurrency(snapshot.quoteValue + snapshot.accessorySales)}</td>
                      <td>{formatCurrency(collected)}</td>
                      <td>{formatCurrency(remaining)}</td>
                      <td><span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusClass}`}>{debtStatus === "paid" ? "Đã hoàn tất" : debtStatus === "overdue" ? "Quá hạn" : "Còn nợ"}</span></td>
                      <td className={`pr-3 font-black ${snapshot.profit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(snapshot.profit)} ({margin.toFixed(0)}%)</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </aside>

        {/* 3. Panel Chi Tiết Theo Dõi & Hạch Toán Bên Phải */}
        {selectedOrder ? (
          <section className="grid gap-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-900">{selectedOrder.code}</h3>
                    <button
                      type="button"
                      onClick={() => exportOrderToExcel(selectedOrder, accounts, overtimeRequests, cashTransactions, orders)}
                      title="Tải toàn bộ dữ liệu đơn hàng (Excel)"
                      className={canExportFinance ? "flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-[10px] font-black text-slate-700 transition hover:bg-slate-50 hover:text-orange-500 shadow-sm" : "hidden"}
                    >
                      <Download className="h-3 w-3" />
                      Tải Excel
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{selectedOrder.customerName} - {selectedOrder.area}</p>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-black ${
                  getBudgetAlertTone(selectedOrder) === "purple"
                    ? "bg-purple-100 text-purple-700"
                    : getBudgetAlertTone(selectedOrder) === "red"
                      ? "bg-red-100 text-red-700"
                      : "bg-emerald-100 text-emerald-700"
                }`}>
                  {selectedOrderSnapshot.estimateValue > 0
                    ? `${((selectedOrderSnapshot.directSpent / selectedOrderSnapshot.estimateValue) * 100).toFixed(0)}% dự toán`
                    : "Chưa có dự toán"}
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs font-bold text-slate-500">Sale quản lý</div>
                  <div className="mt-1 text-sm font-black text-slate-900">{selectedOrder.saleName || "Chưa giao"}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs font-bold text-slate-500">Giá dự toán</div>
                  <div className="mt-1 text-sm font-black text-slate-900">{formatCurrency(selectedOrderSnapshot.estimateValue)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs font-bold text-slate-500">Giá báo khách</div>
                  <div className="mt-1 text-sm font-black text-slate-900">{formatCurrency(selectedOrderSnapshot.quoteValue)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs font-bold text-slate-500">Phát sinh tăng/giảm</div>
                  <div className="mt-1 text-sm font-black text-indigo-600">{formatCurrency(totalIncurred)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs font-bold text-slate-500">Chi trực tiếp hiện tại</div>
                  <div className="mt-1 text-sm font-black text-slate-900">{formatCurrency(selectedOrderSnapshot.directSpent)}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { id: "overview", label: "Tổng quan" },
                  { id: "profit", label: "Lãi lỗ" }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDetailTab(item.id as typeof detailTab)}
                    className={`rounded-lg px-3 py-2 text-xs font-black transition ${detailTab === item.id ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {currentPosition?.id === "director" && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm text-slate-900">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-red-100 text-red-600">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-red-800 text-sm">Quyền Hạn Giám Đốc</h4>
                    <p className="text-xs text-red-600">Bạn có quyền xóa vĩnh viễn đơn hàng lỗi hoặc đơn hàng mẫu này.</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (window.confirm(`[CẢNH BÁO] Bạn có chắc chắn muốn XÓA VĨNH VIỄN đơn hàng ${selectedOrder.code} của khách hàng ${selectedOrder.customerName} không?\n\nMọi dữ liệu liên quan sẽ bị xóa sạch và không thể khôi phục!`)) {
                      const response = await fetch("/api/orders/delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ orderId: selectedOrder.id })
                      });
                      const payload = await response.json();
                      if (!response.ok || !payload?.db?.orders) {
                        window.alert(payload?.error || "Không xóa được đơn hàng.");
                        return;
                      }
                      setOrders(payload.db.orders);
                      setSelectedOrderId("");
                    }
                  }}
                  className="flex min-h-10 items-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 px-4 text-xs font-black text-white transition shadow-sm"
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  XÓA ĐƠN HÀNG
                </button>
              </div>
            )}
            {detailTab === "income" && (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Thu theo đơn hàng</h3>
                    <p className="text-sm text-slate-500">Các khoản thu gắn trực tiếp với đơn đang chọn.</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="py-3">Khoản thu</th>
                        <th>Ngày thu</th>
                        <th>Số tiền</th>
                        <th>Hình thức thu</th>
                        <th>Ghi chú</th>
                        <th>Người ghi nhận</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrderIncomeRows.length === 0 ? (
                        <tr><td className="py-4 text-slate-400 italic" colSpan={6}>Chưa có khoản thu nào cho đơn này.</td></tr>
                      ) : selectedOrderIncomeRows.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 text-slate-700">
                          <td className="py-3 font-bold text-slate-900">{item.category || "Khoản thu"}</td>
                          <td>{item.createdAt.slice(0, 10)}</td>
                          <td className="font-black text-green-600">{formatCurrency(item.amount)}</td>
                          <td>{item.paymentMethod || item.accountName}</td>
                          <td>{item.note}</td>
                          <td>{item.createdBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {detailTab === "expense" && (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Chi theo đơn hàng</h3>
                    <p className="text-sm text-slate-500">Khoản chi thủ công của kế toán sẽ tự gắn vào đơn đang chọn.</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="py-3">Khoản chi</th>
                        <th>Ngày chi</th>
                        <th>Số tiền</th>
                        <th>Loại chi</th>
                        <th>Ghi chú</th>
                        <th>Người ghi nhận</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrderExpenseRows.length === 0 ? (
                        <tr><td className="py-4 text-slate-400 italic" colSpan={6}>Chưa có khoản chi nào cho đơn này.</td></tr>
                      ) : selectedOrderExpenseRows.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 text-slate-700">
                          <td className="py-3 font-bold text-slate-900">{item.category || "Chi phí khác"}</td>
                          <td>{item.createdAt.slice(0, 10)}</td>
                          <td className="font-black text-red-600">{formatCurrency(item.amount)}</td>
                          <td>{item.category || "Chi phí khác"}</td>
                          <td>{item.note}</td>
                          <td>{item.createdBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {detailTab === "profit" && (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-lg font-black text-slate-800">Lãi lỗ đơn hàng</h3>
                {selectedOrder?.isWarranty ? (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Đơn bảo hành: chi phí thực hiện vẫn được theo dõi, nhưng không tính vào lãi lỗ của đơn hàng. Phần này được xem là chi phí hoạt động tháng của xưởng.
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Doanh thu đơn hàng</div><div className="mt-1 text-xl font-black text-slate-900">{formatCurrency(selectedOrderSnapshot.quoteValue + selectedOrderSnapshot.accessorySales)}</div></div>
                  <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Tổng đã thu</div><div className="mt-1 text-xl font-black text-green-600">{formatCurrency(selectedOrderIncomeRows.reduce((sum, item) => sum + item.amount, 0))}</div></div>
                  <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Còn phải thu</div><div className={`mt-1 text-xl font-black ${debtColorClass}`}>{formatCurrency(remainingDebt)}</div></div>
                  <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Chi phí vật tư</div><div className="mt-1 text-xl font-black text-slate-900">{formatCurrency(selectedOrderSnapshot.materialCost + selectedOrderSnapshot.accessoryCost)}</div></div>
                  <div 
                    className="rounded-lg bg-slate-50 p-4 cursor-pointer hover:bg-slate-100 transition border border-slate-200"
                    onClick={() => setShowLaborDetails(!showLaborDetails)}
                  >
                    <div className="text-xs font-bold text-slate-500 flex justify-between items-center">
                      <span>Nhân công trực tiếp</span>
                      <span className="text-[10px] text-indigo-600 font-bold underline">
                        {showLaborDetails ? "Ẩn chi tiết" : "Xem chi tiết"}
                      </span>
                    </div>
                    <div className="mt-1 text-xl font-black text-slate-900">{formatCurrency(selectedOrderSnapshot.laborCost)}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Chi phí khác</div><div className="mt-1 text-xl font-black text-slate-900">{formatCurrency(selectedOrderExpenseRows.reduce((sum, item) => sum + item.amount, 0))}</div></div>
                  <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Lãi gộp</div><div className={`mt-1 text-xl font-black ${selectedOrderSnapshot.profit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(selectedOrderSnapshot.profit)}</div></div>
                  <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Tỷ suất lợi nhuận</div><div className="mt-1 text-xl font-black text-slate-900">{selectedOrderSnapshot.quoteValue > 0 ? `${((selectedOrderSnapshot.profit / selectedOrderSnapshot.quoteValue) * 100).toFixed(1)}%` : "0%"}</div></div>
                </div>

                {showLaborDetails && (
                  <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                    <h4 className="mb-4 text-md font-black text-slate-800 flex items-center gap-2">
                      <CalendarCheck className="h-5 w-5 text-indigo-500" />
                      Chi tiết công thợ trực tiếp
                    </h4>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                            <th className="py-2.5 px-4">Công đoạn</th>
                            <th>Người đảm nhận</th>
                            <th>Giờ hành chính</th>
                            <th>Giờ tăng ca</th>
                            <th>Tổng công</th>
                            <th className="text-right pr-4">Tiền công dự tính</th>
                          </tr>
                        </thead>
                        <tbody>
                          {financeStats.logsWithTime.map((log) => {
                            if (log.assigneeDetails.length === 0) {
                              return (
                                <tr key={log.step} className="border-b border-slate-100 text-slate-700">
                                  <td className="py-3 px-4 font-bold">{log.step}</td>
                                  <td className="italic text-slate-400 py-3" colSpan={5}>Chưa có nhân sự đảm nhận</td>
                                </tr>
                              );
                            }
                            return log.assigneeDetails.map((detail, idx) => (
                              <tr key={`${log.step}-${detail.name}-${idx}`} className="border-b border-slate-100 text-slate-700">
                                {idx === 0 ? (
                                  <td className="py-3 px-4 font-bold" rowSpan={log.assigneeDetails.length}>
                                    {log.step}
                                    <div className="text-xs font-normal text-slate-400">({log.workerCount} nhân sự)</div>
                                  </td>
                                ) : null}
                                <td className="font-semibold text-slate-900 py-3">{detail.name}</td>
                                <td>{detail.workingHours} giờ</td>
                                <td className={detail.overtimeHours > 0 ? "font-bold text-orange-600" : ""}>{detail.overtimeHours} giờ</td>
                                <td className="font-bold">{detail.workdays} công</td>
                                <td className="text-right pr-4 font-black text-slate-900">{(detail.cost || 0).toLocaleString("vi-VN")} đ</td>
                              </tr>
                            ));
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}
            {/* Lịch sử công đoạn & tính giờ làm việc */}
            {detailTab === "overview" && (
            <>
            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Bảng thu theo đơn hàng</h3>
                    <p className="text-sm text-slate-500">Các khoản thu tự gắn vào đơn đang chọn.</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-500">Tổng đã thu</div>
                    <div className="text-lg font-black text-emerald-600">{formatCurrency(selectedOrderIncomeRows.reduce((sum, item) => sum + item.amount, 0))}</div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input className="h-11 rounded-lg border border-slate-200 px-3 font-bold outline-none focus:border-orange-400" value={incomeCategory} onChange={(event) => setIncomeCategory(event.target.value)} placeholder="Khoản thu (Cọc lần 1, Cọc lần 2...)" />
                  <select className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-bold outline-none focus:border-orange-400" value={incomePaymentMethod} onChange={(event) => setIncomePaymentMethod(event.target.value)}>
                    <option value="Tiền mặt">Tiền mặt</option>
                    <option value="Chuyển khoản">Chuyển khoản</option>
                  </select>
                  <input className="h-11 rounded-lg border border-slate-200 px-3 font-bold outline-none focus:border-orange-400" type="number" value={incomeAmount || ""} onChange={(event) => setIncomeAmount(Number(event.target.value))} placeholder="Số tiền thu" />
                  <input className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-400" value={incomeNote} onChange={(event) => setIncomeNote(event.target.value)} placeholder="Ghi chú khoản thu" />
                </div>
                <button className="mt-3 min-h-11 rounded-lg bg-emerald-600 px-4 font-black text-white" onClick={addOrderIncome} type="button">Ghi nhận thu</button>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="py-3">Khoản thu</th>
                        <th>Ngày thu</th>
                        <th>Số tiền</th>
                        <th>Hình thức</th>
                        <th>Ghi chú</th>
                        <th>Người ghi</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrderIncomeRows.length === 0 ? (
                        <tr><td className="py-4 text-slate-400 italic" colSpan={7}>Chưa có khoản thu nào cho đơn này.</td></tr>
                      ) : selectedOrderIncomeRows.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 text-slate-700">
                          <td className="py-3 font-bold text-slate-900">{editingCashId === item.id ? <input className="h-9 w-full rounded border border-slate-200 px-2" value={editingCashCategory} onChange={(event) => setEditingCashCategory(event.target.value)} /> : (item.category || "Khoản thu")}</td>
                          <td>{item.createdAt.slice(0, 10)}</td>
                          <td className="font-black text-emerald-600">{editingCashId === item.id ? <input className="h-9 w-28 rounded border border-slate-200 px-2" type="number" value={editingCashAmount || ""} onChange={(event) => setEditingCashAmount(Number(event.target.value))} /> : formatCurrency(item.amount)}</td>
                          <td>{editingCashId === item.id ? <select className="h-9 rounded border border-slate-200 px-2" value={editingCashPaymentMethod} onChange={(event) => setEditingCashPaymentMethod(event.target.value)}><option value="Tiền mặt">Tiền mặt</option><option value="Chuyển khoản">Chuyển khoản</option></select> : (item.paymentMethod || item.accountName)}</td>
                          <td>{editingCashId === item.id ? <input className="h-9 w-full rounded border border-slate-200 px-2" value={editingCashNote} onChange={(event) => setEditingCashNote(event.target.value)} /> : item.note}</td>
                          <td>{item.createdBy}</td>
                          <td className="text-right py-2">
                            {editingCashId === item.id ? (
                              <div className="flex justify-end gap-1.5">
                                <button 
                                  type="button" 
                                  className="border border-emerald-600 rounded px-2 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm" 
                                  onClick={saveCashEdit}
                                >
                                  Lưu
                                </button>
                                <button 
                                  type="button" 
                                  className="border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition shadow-sm" 
                                  onClick={cancelCashEdit}
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <button 
                                type="button" 
                                className="border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition shadow-sm" 
                                onClick={() => beginCashEdit(item)}
                              >
                                Sửa
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Bảng chi theo đơn hàng</h3>
                    <p className="text-sm text-slate-500">Kế toán nhập chi phí trực tiếp cho đúng đơn đang chọn.</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-500">Tổng đã chi</div>
                    <div className="text-lg font-black text-red-600">
                      {formatCurrency(displayedOrderExpenseRows.reduce((sum, item) => sum + item.amount, 0))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <select
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-bold outline-none focus:border-orange-400"
                    value={expensePaymentMethod}
                    onChange={(event) => setExpensePaymentMethod(event.target.value)}
                  >
                    <option value="Tiền mặt">Tiền mặt</option>
                    <option value="Chuyển khoản">Chuyển khoản</option>
                  </select>
                  <input
                    className="h-11 rounded-lg border border-slate-200 px-3 font-bold outline-none focus:border-orange-400"
                    type="number"
                    value={expenseAmount || ""}
                    onChange={(event) => setExpenseAmount(Number(event.target.value))}
                    placeholder="Số tiền chi"
                  />
                  <input
                    className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-400"
                    value={expenseNote}
                    onChange={(event) => setExpenseNote(event.target.value)}
                    placeholder="Ghi chú khoản chi"
                  />
                </div>
                <button
                  className="mt-3 min-h-11 rounded-lg bg-red-600 px-4 font-black text-white"
                  onClick={addOrderExpense}
                  type="button"
                >
                  Ghi nhận chi
                </button>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500 font-bold">
                        <th className="py-3">Khoản chi</th>
                        <th>Ngày chi</th>
                        <th>Số tiền</th>
                        <th>Người ghi</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedOrderExpenseRows.length === 0 ? (
                        <tr>
                          <td className="py-4 text-slate-400 italic" colSpan={5}>
                            Chưa có khoản chi nào cho đơn này.
                          </td>
                        </tr>
                      ) : (
                        displayedOrderExpenseRows.map((item) => {
                          const isTotalLaborRow = selectedOrder && item.id === `auto-labor-total-${selectedOrder.id}`;
                          
                          if (isTotalLaborRow) {
                            return (
                              <Fragment key={item.id}>
                                <tr 
                                  className="border-b border-slate-100 text-slate-700 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer"
                                  onClick={() => setShowLaborBreakdown(!showLaborBreakdown)}
                                >
                                  <td className="py-3 font-bold text-slate-900 flex items-center gap-1.5">
                                    <span className="text-xs text-slate-400 select-none">{showLaborBreakdown ? "▼" : "▶"}</span>
                                    <span>{item.note} <span className="text-xs font-normal text-slate-400 italic">(Nhấp để {showLaborBreakdown ? "ẩn" : "xem"} chi tiết)</span></span>
                                  </td>
                                  <td>{item.createdAt.slice(0, 10)}</td>
                                  <td className="font-black text-red-600">
                                    {editingCashId === item.id ? (
                                      <input
                                        className="h-9 w-28 rounded border border-slate-200 px-2 text-sm font-normal"
                                        type="number"
                                        value={editingCashAmount || ""}
                                        onChange={(event) => setEditingCashAmount(Number(event.target.value))}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    ) : (
                                      formatCurrency(item.amount)
                                    )}
                                  </td>
                                  <td>{item.createdBy}</td>
                                  <td className="text-right py-2" onClick={(e) => e.stopPropagation()}>
                                    {editingCashId === item.id ? (
                                      <div className="flex justify-end gap-1.5">
                                        <button
                                          type="button"
                                          className="border border-emerald-600 rounded px-2 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm"
                                          onClick={saveCashEdit}
                                        >
                                          Lưu
                                        </button>
                                        <button
                                          type="button"
                                          className="border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition shadow-sm"
                                          onClick={cancelCashEdit}
                                        >
                                          Hủy
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        className="border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition shadow-sm"
                                        onClick={() => beginCashEdit(item)}
                                      >
                                        Sửa
                                      </button>
                                    )}
                                  </td>
                                </tr>
                                {showLaborBreakdown && autoLaborRows.map((subItem) => (
                                  <tr key={subItem.id} className="border-b border-slate-100/50 bg-slate-50/20 text-xs italic text-slate-600">
                                    <td className="py-2.5 pl-8 font-bold text-slate-700">— {subItem.note}</td>
                                    <td>{subItem.createdAt.slice(0, 10)}</td>
                                    <td className="font-black text-red-500/80">{formatCurrency(subItem.amount)}</td>
                                    <td>{subItem.createdBy}</td>
                                    <td></td>
                                  </tr>
                                ))}
                              </Fragment>
                            );
                          }

                          return (
                            <tr key={item.id} className="border-b border-slate-100 text-slate-700">
                              <td className="py-3 font-bold text-slate-900">
                                {editingCashId === item.id ? (
                                  <input
                                    className="h-9 w-full rounded border border-slate-200 px-2 text-sm font-normal"
                                    value={editingCashNote}
                                    onChange={(event) => setEditingCashNote(event.target.value)}
                                  />
                                ) : (
                                  item.note || "Chưa có ghi chú"
                                )}
                              </td>
                              <td>{item.createdAt.slice(0, 10)}</td>
                              <td className="font-black text-red-600">
                                {editingCashId === item.id ? (
                                  <input
                                    className="h-9 w-28 rounded border border-slate-200 px-2 text-sm font-normal"
                                    type="number"
                                    value={editingCashAmount || ""}
                                    onChange={(event) => setEditingCashAmount(Number(event.target.value))}
                                  />
                                ) : (
                                  formatCurrency(item.amount)
                                )}
                              </td>
                              <td>{item.createdBy}</td>
                              <td className="text-right py-2">
                                {item.isAuto ? null : editingCashId === item.id ? (
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      type="button"
                                      className="border border-emerald-600 rounded px-2 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm"
                                      onClick={saveCashEdit}
                                    >
                                      Lưu
                                    </button>
                                    <button
                                      type="button"
                                      className="border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition shadow-sm"
                                      onClick={cancelCashEdit}
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition shadow-sm"
                                    onClick={() => beginCashEdit(item)}
                                  >
                                    Sửa
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

            </div>

            {showLaborDetails && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-lg font-black text-slate-800 flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-green-500" />
                  Thời gian thực hiện & Công thợ từng công đoạn
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold">
                        <th className="py-2.5">Công đoạn</th>
                        <th>Người đảm nhận</th>
                        <th>Giờ hành chính</th>
                        <th>Giờ tăng ca</th>
                        <th>Tổng công</th>
                        <th className="text-right">Tiền công dự tính</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financeStats.logsWithTime.map((log) => {
                        if (log.assigneeDetails.length === 0) {
                          return (
                            <tr key={log.step} className="border-b border-slate-100 text-slate-700">
                              <td className="py-3 font-bold">{log.step}</td>
                              <td className="italic text-slate-400 py-3" colSpan={5}>Chưa có nhân sự đảm nhận</td>
                            </tr>
                          );
                        }
                        return log.assigneeDetails.map((detail, idx) => (
                          <tr key={`${log.step}-${detail.name}-${idx}`} className="border-b border-slate-100 text-slate-700">
                            {idx === 0 ? (
                              <td className="py-3 font-bold" rowSpan={log.assigneeDetails.length}>
                                {log.step}
                                <div className="text-xs font-normal text-slate-400">({log.workerCount} nhân sự)</div>
                              </td>
                            ) : null}
                            <td className="font-semibold text-slate-900 py-3">{detail.name}</td>
                            <td>{detail.workingHours} giờ</td>
                            <td className={detail.overtimeHours > 0 ? "font-bold text-orange-600" : ""}>{detail.overtimeHours} giờ</td>
                            <td className="font-bold">{detail.workdays} công</td>
                            <td className="text-right font-black text-slate-900">{(detail.cost || 0).toLocaleString("vi-VN")} đ</td>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}


            {/* Các khoản phát sinh do kế toán nhập */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm mt-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-800">Các khoản phát sinh</h3>
                  <p className="text-sm text-slate-500">Các khoản phát sinh tăng/giảm giá trị đơn hàng được tính riêng vào công nợ còn phải thu.</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-500">Tổng phát sinh</div>
                  <div className="text-lg font-black text-indigo-600">{formatCurrency(totalIncurred)}</div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-400"
                  value={incurredNote}
                  onChange={(event) => setIncurredNote(event.target.value)}
                  placeholder="Nội dung phát sinh (Vd: Thiết kế thêm kệ, đổi chất liệu...)"
                />
                <input
                  className="h-11 rounded-lg border border-slate-200 px-3 font-bold outline-none focus:border-orange-400"
                  type="number"
                  value={incurredAmount || ""}
                  onChange={(event) => setIncurredAmount(Number(event.target.value))}
                  placeholder="Số tiền phát sinh"
                />
                <button
                  className="min-h-11 rounded-lg bg-indigo-600 px-4 font-black text-white"
                  onClick={addIncurredCost}
                  type="button"
                >
                  Thêm phát sinh
                </button>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500 font-bold">
                      <th className="py-3">Nội dung phát sinh</th>
                      <th>Số tiền</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedOrder.incurredCosts || selectedOrder.incurredCosts.length === 0 ? (
                      <tr>
                        <td className="py-4 text-slate-400 italic" colSpan={3}>
                          Chưa có khoản phát sinh nào cho đơn này.
                        </td>
                      </tr>
                    ) : (
                      selectedOrder.incurredCosts.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-100 text-slate-700">
                          <td className="py-3 font-bold text-slate-900">{item.note}</td>
                          <td className="font-black text-indigo-600">{formatCurrency(item.amount)}</td>
                          <td className="py-2">
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-700 font-bold"
                              onClick={() => deleteIncurredCost(idx)}
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            </>
            )}
          </section>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500 bg-white">Không có đơn hàng nào được chọn.</div>
        )}
      </div>
      </>
      )}
    </section>
  );
}
