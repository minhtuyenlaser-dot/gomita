"use client";

import type { Order, OrderStep } from "@/modules/orders/orderFlow";
import type { UserAccount } from "@/modules/hr/accounts";
import { positions, type Position } from "@/modules/hr/roles";
import type { CashTransaction, CashTransactionType, CustomerDebt, CustomerDebtStage, CustomerDebtStatus } from "@/modules/finance/types";
import { customerDebtStageLabels, customerDebtStatusLabels } from "@/modules/finance/types";
import { useState, useMemo } from "react";
import { Plus, Trash2, CalendarCheck, BriefcaseBusiness, ReceiptText, ShieldCheck, Download } from "lucide-react";

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
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? "");
  const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId) ?? orders[0], [orders, selectedOrderId]);
  const [mainTab, setMainTab] = useState<"overview" | "efficiency" | "profit">("overview");
  const [detailTab, setDetailTab] = useState<"overview" | "income" | "expense" | "debt" | "profit">("overview");
  const [cashType, setCashType] = useState<CashTransactionType>("cash_in");
  const [cashAmount, setCashAmount] = useState(0);
  const [cashNote, setCashNote] = useState("");
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

  // Form thêm vật tư mới
  const [newMatName, setNewMatName] = useState("");
  const [newMatPrice, setNewMatPrice] = useState(0);

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

  // Thêm vật tư mới vào đơn hàng
  function addMaterial() {
    if (!selectedOrder || !newMatName.trim() || newMatPrice <= 0) return;
    const updatedMats = [...(selectedOrder.materialsList || []), { name: newMatName.trim(), price: newMatPrice }];
    setOrders(current => current.map(o => o.id === selectedOrder.id ? { ...o, materialsList: updatedMats } : o));
    setNewMatName("");
    setNewMatPrice(0);
  }

  // Xóa vật tư
  function deleteMaterial(index: number) {
    if (!selectedOrder || !selectedOrder.materialsList) return;
    const updatedMats = selectedOrder.materialsList.filter((_, idx) => idx !== index);
    setOrders(current => current.map(o => o.id === selectedOrder.id ? { ...o, materialsList: updatedMats } : o));
  }

  // Cập nhật phụ kiện ngoài (giá vốn, chi phí thực tế)
  function updateAccessory(index: number, field: "costPrice" | "actualCost", value: number) {
    if (!selectedOrder || !selectedOrder.externalAccessories) return;
    const updatedAccs = selectedOrder.externalAccessories.map((acc, idx) => {
      if (idx === index) {
        return { ...acc, [field]: value };
      }
      return acc;
    });
    setOrders(current => current.map(o => o.id === selectedOrder.id ? { ...o, externalAccessories: updatedAccs } : o));
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

    const logsWithTime = (order.historyLogs || []).map((log) => {
      const regularHours = calculateWorkingHours(log.startedAt, log.completedAt);
      const overtimeHours = overtimeRequests
        .filter((req) => req.orderCode === order.code && req.userDisplayName === log.assignee && req.status === "approved")
        .reduce((sum, req) => sum + (req.hours || 0), 0);
      const hourlyRate = getHourlyRateForAssignee(log.assignee, log.completedAt || log.startedAt);
      return regularHours * hourlyRate + overtimeHours * hourlyRate * 1.5;
    });

    const laborCost = logsWithTime.reduce((sum, cost) => sum + cost, 0);
    const materialCost = (order.materialsList || []).reduce((sum, mat) => sum + mat.price, 0);
    let accessorySales = 0;
    let accessoryCost = 0;
    (order.externalAccessories || []).forEach((acc) => {
      if (!acc.name.trim()) return;
      accessorySales += acc.sellPrice || 0;
      accessoryCost += acc.actualCost || acc.costPrice || 0;
    });
    const transportCost = order.installationCosts?.transport || 0;
    const loaderCost = order.installationCosts?.loader || 0;
    const quoteValue = order.quotation?.quoteValue || 0;
    const estimateValue = order.quotation?.estimateValue || 0;
    const directSpent = materialCost + accessoryCost + laborCost + transportCost + loaderCost;
    const profit = quoteValue + accessorySales - directSpent;

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

  function getBudgetAlertTone(order?: Order) {
    const snapshot = buildOrderCostSnapshot(order);
    if (!snapshot.estimateValue) return "normal" as const;
    const ratio = snapshot.directSpent / snapshot.estimateValue;
    if (ratio > 0.95) return "purple" as const;
    if (ratio > 0.75) return "red" as const;
    return "normal" as const;
  }

  // Tính toán số liệu tài chính cho đơn hàng được chọn
  const financeStats = useMemo(() => {
    if (!selectedOrder) return { laborCost: 0, materialCost: 0, accessorySales: 0, accessoryCost: 0, profit: 0, totalWorkdays: 0, logsWithTime: [] };

    // 1. Tính công thợ & tiền công thợ dựa trên log lịch sử các công đoạn và tăng ca
    let totalWorkdays = 0;
    let laborCost = 0;
    const logsWithTime = (selectedOrder.historyLogs || []).map(log => {
      const workingHours = calculateWorkingHours(log.startedAt, log.completedAt);
      
      // Lấy giờ tăng ca được phê duyệt
      const overtimeHours = overtimeRequests
        .filter(req => req.orderCode === selectedOrder.code && req.userDisplayName === log.assignee && req.status === "approved")
        .reduce((sum, req) => sum + (req.hours || 0), 0);

      const totalHours = workingHours + overtimeHours;
      const workdays = totalHours / 8;
      totalWorkdays += workdays;

      const hourlyRate = getHourlyRateForAssignee(log.assignee, log.completedAt || log.startedAt);
      const stepCost = (workingHours * hourlyRate) + (overtimeHours * hourlyRate * 1.5);
      laborCost += stepCost;

      return {
        ...log,
        workingHours,
        overtimeHours,
        totalHours,
        hourlyRate,
        workdays: parseFloat(workdays.toFixed(2)),
        cost: stepCost
      };
    });

    // 2. Chi phí vật tư
    const materialCost = (selectedOrder.materialsList || []).reduce((sum, mat) => sum + mat.price, 0);

    // 3. Phụ kiện ngoài
    let accessorySales = 0;
    let accessoryCost = 0;
    (selectedOrder.externalAccessories || []).forEach(acc => {
      if (acc.name.trim()) {
        accessorySales += acc.sellPrice || 0;
        accessoryCost += acc.actualCost || acc.costPrice || 0;
      }
    });

    // 4. Chi phí lắp đặt khác (vận chuyển, bốc vác)
    const transport = selectedOrder.installationCosts?.transport || 0;
    const loader = selectedOrder.installationCosts?.loader || 0;

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
  }, [selectedOrder, overtimeRequests, accounts]);

  const selectedOrderSnapshot = useMemo(
    () => buildOrderCostSnapshot(selectedOrder),
    [selectedOrder, overtimeRequests, accounts]
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
      const orderDebts = customerDebts.filter((item) => item.orderId === order.id);
      const collected = orderDebts.reduce((sum, item) => sum + item.collectedAmount, 0);
      const planned = orderDebts.reduce((sum, item) => sum + item.plannedAmount, 0);
      const remaining = Math.max(0, planned - collected);
      const debtStatus = orderDebts.some((item) => item.status === "overdue")
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
  }, [orders, customerDebts, overtimeRequests, accounts]);

  const monthlyOverview = useMemo(() => {
    const monthTransactions = cashTransactions.filter((item) => normalizeMonth(item.createdAt) === reportMonth);
    const collectedThisMonth = monthTransactions
      .filter((item) => item.type === "cash_in" || item.type === "bank_in")
      .reduce((sum, item) => sum + item.amount, 0);
    const directMaterial = orderFinancialRows.reduce((sum, item) => sum + item.snapshot.materialCost + item.snapshot.accessoryCost + item.snapshot.transportCost + item.snapshot.loaderCost, 0);
    const directLabor = orderFinancialRows.reduce((sum, item) => sum + item.snapshot.laborCost, 0);
    const totalRevenue = orderFinancialRows.reduce((sum, item) => sum + item.snapshot.quoteValue + item.snapshot.accessorySales, 0);
    const totalProfit = orderFinancialRows.reduce((sum, item) => sum + item.snapshot.profit, 0);
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
      totalProfit
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
          assignedHours += calculateWorkingHours(log.startedAt, log.completedAt);
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

  const selectedOrderDebtRows = useMemo(() => {
    if (!selectedOrder) return [];
    return customerDebts.filter((item) => item.orderId === selectedOrder.id);
  }, [customerDebts, selectedOrder]);

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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
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
          <div className="text-sm font-bold text-slate-500">Lợi nhuận tạm tính</div>
          <div className={`mt-2 text-2xl font-black ${monthlyOverview.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(monthlyOverview.totalProfit)}
          </div>
          <div className="mt-1 text-xs text-slate-400">Lãi gộp từ các đơn hàng đang theo dõi</div>
        </div>
      </div>

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
                    <td className="py-3 font-black text-slate-900">{row.order.code}</td>
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
              {Object.entries(customerDebtStageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
                  <div className="font-black">{item.orderCode} • {customerDebtStageLabels[item.stage]}</div>
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
                  <h3 className="text-xl font-black text-slate-900">{selectedOrder.code}</h3>
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
              <div className="mt-4 grid gap-3 md:grid-cols-4">
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
                  <div className="text-xs font-bold text-slate-500">Chi trực tiếp hiện tại</div>
                  <div className="mt-1 text-sm font-black text-slate-900">{formatCurrency(selectedOrderSnapshot.directSpent)}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { id: "overview", label: "Tổng quan" },
                  { id: "income", label: "Thu" },
                  { id: "expense", label: "Chi" },
                  { id: "debt", label: "Công nợ" },
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
            {detailTab === "debt" && (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-lg font-black text-slate-800">Công nợ theo đơn hàng</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="py-3">Giai đoạn</th>
                        <th>Phải thu</th>
                        <th>Đã thu</th>
                        <th>Còn lại</th>
                        <th>Hạn thu</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrderDebtRows.length === 0 ? (
                        <tr><td className="py-4 text-slate-400 italic" colSpan={6}>Chưa có dữ liệu công nợ cho đơn này.</td></tr>
                      ) : selectedOrderDebtRows.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 text-slate-700">
                          <td className="py-3 font-bold text-slate-900">{customerDebtStageLabels[item.stage]}</td>
                          <td>{formatCurrency(item.plannedAmount)}</td>
                          <td>{formatCurrency(item.collectedAmount)}</td>
                          <td>{formatCurrency(Math.max(0, item.plannedAmount - item.collectedAmount))}</td>
                          <td>{item.dueDate || "-"}</td>
                          <td>{customerDebtStatusLabels[item.status]}</td>
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
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Doanh thu đơn hàng</div><div className="mt-1 text-xl font-black text-slate-900">{formatCurrency(selectedOrderSnapshot.quoteValue + selectedOrderSnapshot.accessorySales)}</div></div>
                  <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Tổng đã thu</div><div className="mt-1 text-xl font-black text-green-600">{formatCurrency(selectedOrderIncomeRows.reduce((sum, item) => sum + item.amount, 0))}</div></div>
                  <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Còn phải thu</div><div className="mt-1 text-xl font-black text-orange-600">{formatCurrency(selectedOrderDebtRows.reduce((sum, item) => sum + Math.max(0, item.plannedAmount - item.collectedAmount), 0))}</div></div>
                  <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Chi phí vật tư</div><div className="mt-1 text-xl font-black text-slate-900">{formatCurrency(selectedOrderSnapshot.materialCost + selectedOrderSnapshot.accessoryCost)}</div></div>
                  <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Nhân công trực tiếp</div><div className="mt-1 text-xl font-black text-slate-900">{formatCurrency(selectedOrderSnapshot.laborCost)}</div></div>
                  <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Vận chuyển / bốc vác</div><div className="mt-1 text-xl font-black text-slate-900">{formatCurrency(selectedOrderSnapshot.transportCost + selectedOrderSnapshot.loaderCost)}</div></div>
                  <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Chi phí khác</div><div className="mt-1 text-xl font-black text-slate-900">{formatCurrency(selectedOrderExpenseRows.reduce((sum, item) => sum + item.amount, 0))}</div></div>
                  <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Lãi gộp</div><div className={`mt-1 text-xl font-black ${selectedOrderSnapshot.profit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(selectedOrderSnapshot.profit)}</div></div>
                  <div className="rounded-lg bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">Tỷ suất lợi nhuận</div><div className="mt-1 text-xl font-black text-slate-900">{selectedOrderSnapshot.quoteValue > 0 ? `${((selectedOrderSnapshot.profit / selectedOrderSnapshot.quoteValue) * 100).toFixed(1)}%` : "0%"}</div></div>
                </div>
              </section>
            )}
            {/* Lịch sử công đoạn & tính giờ làm việc */}
            {detailTab === "overview" && (
            <>
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
                    {financeStats.logsWithTime.map((log, index) => (
                      <tr key={index} className="border-b border-slate-100 text-slate-700">
                        <td className="py-3 font-bold">{log.step}</td>
                        <td className="font-semibold text-slate-900">{log.assignee}</td>
                        <td>{log.workingHours} giờ</td>
                        <td className={log.overtimeHours > 0 ? "font-bold text-orange-600" : ""}>{log.overtimeHours} giờ</td>
                        <td className="font-bold">{log.workdays} công</td>
                        <td className="text-right font-black text-slate-900">{(log.cost || 0).toLocaleString("vi-VN")} đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quản lý vật tư thực tế */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-black text-slate-800 flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-orange-500" />
                Chi tiết vật tư & Chi phí lắp đặt phụ
              </h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-600 mb-2">Thêm vật tư mới</h4>
                  <div className="flex gap-2">
                    <input 
                      className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 outline-none" 
                      placeholder="Tên vật tư (Vd: Bản lề, Gỗ, Ván...)" 
                      value={newMatName} 
                      onChange={e => setNewMatName(e.target.value)}
                    />
                    <input 
                      className="h-10 w-28 rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 outline-none" 
                      type="number" 
                      placeholder="Giá tiền" 
                      value={newMatPrice || ""} 
                      onChange={e => setNewMatPrice(Number(e.target.value))}
                    />
                    <button className="h-10 w-10 grid place-items-center rounded-lg bg-orange-500 text-white font-bold" onClick={addMaterial} type="button">
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-4 grid gap-2 max-h-48 overflow-y-auto">
                    {(!selectedOrder.materialsList || selectedOrder.materialsList.length === 0) ? (
                      <div className="text-slate-400 text-sm italic">Chưa có vật tư được ghi nhận.</div>
                    ) : (
                      selectedOrder.materialsList.map((mat, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-sm">
                          <div>
                            <span className="font-bold">{mat.name}</span>
                          </div>
                          <div className="flex items-center gap-3 font-black">
                            {mat.price.toLocaleString("vi-VN")} đ
                            <button className="text-red-500 hover:text-red-700" onClick={() => deleteMaterial(idx)} type="button">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="border-l border-slate-100 pl-6">
                  <h4 className="font-bold text-sm text-slate-600 mb-3">Chi phí Lắp đặt bổ sung (Giám sát nhập)</h4>
                  <div className="grid gap-4">
                    <div className="flex justify-between items-center rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                      <span className="font-bold text-sm text-slate-700">Tiền vận chuyển</span>
                      <span className="font-black text-slate-900">{(selectedOrder.installationCosts?.transport || 0).toLocaleString("vi-VN")} đ</span>
                    </div>
                    <div className="flex justify-between items-center rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                      <span className="font-bold text-sm text-slate-700">Tiền bốc vác</span>
                      <span className="font-black text-slate-900">{(selectedOrder.installationCosts?.loader || 0).toLocaleString("vi-VN")} đ</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">● Các chi phí lắp đặt phụ này do Giám sát nhập khi lập checklist nghiệm thu.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Phụ kiện ngoài & Hạch toán giá vốn */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-2 text-lg font-black text-slate-800 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-500" />
                Hạch toán Phụ kiện ngoài (Kế toán nhập giá vốn)
              </h3>
              <p className="text-xs text-slate-500 mb-4">Các phụ kiện do phòng Sale khai báo tại bước Báo giá. Kế toán nhập Giá vốn và Chi phí thực tế để hạch toán lãi lỗ chính xác.</p>
              
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="py-2.5 px-3">Tên phụ kiện</th>
                      <th>Giá bán (khách)</th>
                      <th>Giá vốn (Kế toán nhập)</th>
                      <th className="pr-3">Chi phí thực tế (Kế toán nhập)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!selectedOrder.externalAccessories || selectedOrder.externalAccessories.filter(a => a.name.trim()).length === 0) ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400 italic">Không có phụ kiện ngoài nào được khai báo trong đơn hàng này.</td>
                      </tr>
                    ) : (
                      selectedOrder.externalAccessories.map((acc, idx) => {
                        if (!acc.name.trim()) return null;
                        return (
                          <tr key={idx} className="border-b border-slate-100 text-slate-700">
                            <td className="py-2.5 px-3 font-bold">{acc.name}</td>
                            <td className="font-black text-blue-600">{acc.sellPrice.toLocaleString("vi-VN")} đ</td>
                            <td>
                              <input 
                                className="h-9 w-32 rounded-lg border border-slate-200 px-2 font-black outline-none focus:border-indigo-500" 
                                type="number" 
                                value={acc.costPrice || ""} 
                                onChange={e => updateAccessory(idx, "costPrice", Number(e.target.value))}
                                placeholder="Giá vốn"
                              />
                            </td>
                            <td className="pr-3">
                              <input 
                                className="h-9 w-32 rounded-lg border border-slate-200 px-2 font-black outline-none focus:border-indigo-500" 
                                type="number" 
                                value={acc.actualCost || ""} 
                                onChange={e => updateAccessory(idx, "actualCost", Number(e.target.value))}
                                placeholder="CP thực tế"
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
