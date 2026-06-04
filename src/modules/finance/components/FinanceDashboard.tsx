"use client";

import type { Order, OrderStep } from "@/modules/orders/orderFlow";
import type { UserAccount } from "@/modules/hr/accounts";
import type { Position } from "@/modules/hr/roles";
import type { CashTransaction, CashTransactionType, CustomerDebt, CustomerDebtStage, CustomerDebtStatus } from "@/modules/finance/types";
import { customerDebtStageLabels, customerDebtStatusLabels } from "@/modules/finance/types";
import { useState, useMemo } from "react";
import { Plus, Trash2, CalendarCheck, BriefcaseBusiness, ReceiptText, ShieldCheck } from "lucide-react";

export function FinanceDashboard({ 
  orders, 
  setOrders, 
  overtimeRequests = [], 
  accounts = [],
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
  currentPosition?: Position;
  cashTransactions?: CashTransaction[];
  onCashTransactionsChange?: React.Dispatch<React.SetStateAction<CashTransaction[]>>;
  customerDebts?: CustomerDebt[];
  onCustomerDebtsChange?: React.Dispatch<React.SetStateAction<CustomerDebt[]>>;
}) {
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? "");
  const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId) ?? orders[0], [orders, selectedOrderId]);
  const [cashType, setCashType] = useState<CashTransactionType>("cash_in");
  const [cashAmount, setCashAmount] = useState(0);
  const [cashNote, setCashNote] = useState("");
  const [debtStage, setDebtStage] = useState<CustomerDebtStage>("deposit");
  const [debtPlannedAmount, setDebtPlannedAmount] = useState(0);
  const [debtCollectedAmount, setDebtCollectedAmount] = useState(0);
  const [debtDueDate, setDebtDueDate] = useState("");
  const [debtStatus, setDebtStatus] = useState<CustomerDebtStatus>("pending");
  const [debtNote, setDebtNote] = useState("");

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
    const newTransaction: CashTransaction = {
      id: `cash-${Date.now()}`,
      type: cashType,
      amount: cashAmount,
      note: cashNote.trim() || "Không ghi chú",
      createdAt: new Date().toISOString(),
      createdBy: currentPosition?.name || "Kế toán",
      accountName: cashType.includes("bank") ? "Tài khoản ngân hàng" : "Quỹ tiền mặt"
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

  function getHourlyRateForAssignee(displayName?: string, dateLike?: string) {
    if (!displayName) return 0;
    const account = accounts.find((item) => item.status === "active" && item.displayName === displayName);
    if (!account || !account.salaryValue) return 0;
    if ((account.salaryType ?? "daily") === "monthly") {
      const maxWorkDays = getMaxWorkDaysForDate(dateLike);
      return maxWorkDays > 0 ? account.salaryValue / maxWorkDays / 8 : 0;
    }
    return account.salaryValue / 8;
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

  return (
    <section className="grid gap-6 text-slate-900">
      {/* 1. Thanh Tổng hợp */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-slate-500">Doanh thu dự kiến</div>
          <div className="mt-2 text-2xl font-black text-blue-600">
            {selectedOrder ? (((selectedOrder.quotation?.quoteValue || 0) + financeStats.accessorySales).toLocaleString("vi-VN") + " đ") : "0 đ"}
          </div>
          <div className="mt-1 text-xs text-slate-400">Gồm giá báo và phụ kiện ngoài</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-slate-500">Chi phí vật tư</div>
          <div className="mt-2 text-2xl font-black text-orange-600">
            {financeStats.materialCost.toLocaleString("vi-VN")} đ
          </div>
          <div className="mt-1 text-xs text-slate-400">Tổng cộng {selectedOrder?.materialsList?.length || 0} mục vật tư</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-slate-500">Công thợ (bao gồm tăng ca)</div>
          <div className="mt-2 text-2xl font-black text-amber-600">
            {financeStats.laborCost.toLocaleString("vi-VN")} đ
          </div>
          <div className="mt-1 text-xs text-slate-400">Tổng {financeStats.totalWorkdays} ngày công thợ</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-slate-500">Lợi nhuận ròng dự tính</div>
          <div className={`mt-2 text-2xl font-black ${financeStats.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
            {financeStats.profit.toLocaleString("vi-VN")} đ
          </div>
          <div className="mt-1 text-xs text-slate-400">Lãi gộp sau chi phí nhân công, vật tư, phụ kiện</div>
        </div>
      </div>

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
            Xem lại toàn bộ đơn hàng
          </h3>
          <div className="grid gap-2">
            {orders.map(order => (
              <button 
                key={order.id} 
                className={`w-full rounded-lg border p-3 text-left transition ${order.id === selectedOrderId ? "border-orange-500 bg-orange-50/50 text-orange-950 font-bold" : "border-slate-100 bg-white hover:bg-slate-50 text-slate-700"}`}
                onClick={() => setSelectedOrderId(order.id)}
                type="button"
              >
                <div className="text-sm font-black">{order.code}</div>
                <div className="mt-1 text-xs text-slate-500">{order.customerName} - {order.area}</div>
                <span className="mt-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{order.step}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* 3. Panel Chi Tiết Theo Dõi & Hạch Toán Bên Phải */}
        {selectedOrder ? (
          <section className="grid gap-6">
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
                  onClick={() => {
                    if (window.confirm(`[CẢNH BÁO] Bạn có chắc chắn muốn XÓA VĨNH VIỄN đơn hàng ${selectedOrder.code} của khách hàng ${selectedOrder.customerName} không?\n\nMọi dữ liệu liên quan sẽ bị xóa sạch và không thể khôi phục!`)) {
                      setOrders(curr => curr.filter(o => o.id !== selectedOrder.id));
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
            {/* Lịch sử công đoạn & tính giờ làm việc */}
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
          </section>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500 bg-white">Không có đơn hàng nào được chọn.</div>
        )}
      </div>
    </section>
  );
}
