"use client";

import {
  AlertTriangle,
  BriefcaseBusiness,
  Camera,
  Check,
  CheckCircle2,
  Eye,
  FileImage,
  MessageSquare,
  Phone,
  Plus,
  Search,
  User,
  X
} from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useMemo, useState } from "react";
import type { UserAccount } from "@/modules/hr/accounts";
import type { Position } from "@/modules/hr/roles";
import { isWorkerPosition, positions } from "@/modules/hr/roles";
import { attendanceSlots, getSlotWindow, isSlotOpen } from "@/modules/attendance/compensationRules";
import type { AttendanceSlot } from "@/modules/attendance/types";
import {
  buildOrder,
  canApproveStep,
  canCancelOrder,
  canHandleCurrentStep,
  canMoveToNextStep,
  canSeeOrder,
  canViewOrderPricing,
  getAssignedNames,
  getTransitionIssues,
  moveToNextStep,
  orderSteps,
  requestStepConfirmation,
  requiresManagerConfirmation,
  validateCreateOrder,
  visibleOrdersFor,
  visibleOrderStepsFor,
  type Order,
  type OrderStep
} from "../orderFlow";

type Notice = { type: "success" | "warning"; text: string };
type WorkerAttendanceKind = "normal" | "compensated";

const stepStyles = [
  "from-amber-50 to-orange-50 border-orange-200",
  "from-emerald-50 to-lime-50 border-lime-200",
  "from-blue-50 to-sky-50 border-blue-200",
  "from-violet-50 to-purple-50 border-purple-200",
  "from-pink-50 to-rose-50 border-pink-200",
  "from-orange-50 to-amber-50 border-orange-200",
  "from-sky-50 to-blue-50 border-sky-200",
  "from-green-50 to-emerald-50 border-emerald-200",
  "from-cyan-50 to-teal-50 border-cyan-200"
];

export function canManagerAssign(positionId: string, step: OrderStep): boolean {
  if (positionId === "admin" || positionId === "director") return true;
  if (positionId === "sale_manager") return ["Tiếp nhận", "Báo giá"].includes(step);
  if (positionId === "design_manager") return step === "Thiết kế";
  if (positionId === "workshop_manager") return ["Ra file", "Sản xuất"].includes(step);
  if (positionId === "supervisor_lead") return ["Lắp đặt", "Nghiệm thu"].includes(step);
  return false;
}

export function OrderDashboard({ 
  accounts, 
  position, 
  currentUserName,
  orders,
  setOrders,
  overtimeRequests = []
}: { 
  accounts: UserAccount[]; 
  position: Position; 
  currentUserName: string;
  orders: Order[];
  setOrders: Dispatch<SetStateAction<Order[]>>;
  overtimeRequests: any[];
}) {
  const [showArchived, setShowArchived] = useState(false);
  const visibleOrders = useMemo(() => {
    const targetStatus = showArchived ? "archived" : "active";
    return orders.filter((order) => order.status === targetStatus && canSeeOrder(position.id, currentUserName, order));
  }, [currentUserName, orders, position.id, showArchived]);
  const canceledOrders = useMemo(() => orders.filter((order) => order.status === "canceled"), [orders]);
  const [selectedOrderId, setSelectedOrderId] = useState(visibleOrders[0]?.id ?? "");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const [moveOrder, setMoveOrder] = useState<Order | null>(null);
  const [showCanceled, setShowCanceled] = useState(false);
  const selectedOrder = visibleOrders.find((order) => order.id === selectedOrderId) ?? visibleOrders[0];

  if (isWorkerPosition(position.id)) {
    return (
      <WorkerWorkspace 
        currentUserName={currentUserName} 
        orders={visibleOrders} 
        setOrders={setOrders} 
        overtimeRequests={overtimeRequests}
      />
    );
  }

  const allowedSteps = visibleOrderStepsFor(position.id);

  function showNotice(type: Notice["type"], text: string) {
    setNotice({ type, text });
  }

  function updateOrder(orderId: string, updater: (order: Order) => Order) {
    setOrders((current) => current.map((order) => (order.id === orderId ? updater(order) : order)));
  }

  function moveSelected(order: Order) {
    if (!canHandleCurrentStep(position.id, order)) {
      showNotice("warning", "Vị trí hiện tại chỉ được xử lý đơn ở công đoạn thuộc bộ phận của mình.");
      return;
    }
    const issues = getTransitionIssues(order);
    if (issues.length) {
      showNotice("warning", issues.join(" "));
      return;
    }
    if (requiresManagerConfirmation(position.id, order)) {
      updateOrder(order.id, (current) => requestStepConfirmation(current, currentUserName, "Đề nghị chuyển bước"));
      showNotice("success", `Đã gửi yêu cầu chuyển ${order.code} cho quản lý xác nhận.`);
      return;
    }
    updateOrder(order.id, moveToNextStep);
    showNotice("success", `Đã chuyển ${order.code} sang bước tiếp theo.`);
  }

  function approveSelected(order: Order) {
    updateOrder(order.id, moveToNextStep);
    showNotice("success", `Đã xác nhận và chuyển ${order.code} sang ${order.pendingStep ?? "bước tiếp theo"}.`);
  }

  return (
    <section className="grid gap-4">
      {notice ? <NoticeBar notice={notice} onClose={() => setNotice(null)} /> : null}

      <section className="grid min-h-[calc(100vh-150px)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm xl:grid-cols-[minmax(820px,1fr)_360px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-4">
            <div className="relative min-w-full max-w-2xl flex-1 sm:min-w-64">
              <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <input className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-orange-400" placeholder="Tìm kiếm đơn hàng, khách hàng, SĐT..." onChange={(event) => showNotice("success", `Đã lọc theo từ khóa: ${event.target.value || "trống"}`)} />
            </div>
            <button className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-bold" onClick={() => showNotice("success", "Đang xem các đơn theo quyền của vị trí hiện tại.")} type="button">Theo quyền</button>
            {["sale", "sale_manager", "director", "admin"].includes(position.id) ? (
              <button className="flex h-11 items-center gap-2 rounded-lg bg-orange-500 px-5 font-bold text-white" onClick={() => setCreateOpen(true)} type="button">
                <Plus className="h-4 w-4" />
                Tạo đơn hàng
              </button>
            ) : null}
            {position.id === "director" ? (
              <button className="h-11 rounded-lg border border-red-200 px-4 text-sm font-bold text-red-600" onClick={() => setShowCanceled(true)} type="button">
                Đơn bị hủy ({canceledOrders.length})
              </button>
            ) : null}
            {["accountant", "director", "admin"].includes(position.id) ? (
              <button className={`h-11 rounded-lg border px-4 text-sm font-bold transition duration-150 ${showArchived ? "border-green-600 bg-green-50 text-green-700" : "border-slate-200 text-slate-700"}`} onClick={() => setShowArchived(!showArchived)} type="button">
                {showArchived ? "Xem đơn Đang chạy" : `Kho lưu trữ (${orders.filter(o => o.status === "archived").length})`}
              </button>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <div className="grid min-w-[1080px] grid-cols-9">
              {orderSteps.map((step, index) => {
                const stepOrders = allowedSteps.includes(step) ? visibleOrders.filter((order) => order.step === step) : [];
                return (
                  <div key={step} className={`min-h-[560px] border-r border-slate-200 bg-gradient-to-b ${stepStyles[index]}`}>
                    <div className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/70 px-3 backdrop-blur">
                      <span className="text-xs font-bold text-slate-800 tracking-tight">{index + 1}. {step}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500">{stepOrders.length}</span>
                    </div>
                    <div className="grid gap-3 p-3">
                      {stepOrders.map((order) => <KanbanCard key={order.id} order={order} selected={order.id === selectedOrder?.id} onSelect={setSelectedOrderId} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {selectedOrder ? (
          <OrderSidePanel
            currentUserName={currentUserName}
            order={selectedOrder}
            position={position}
            onMove={setMoveOrder}
            onApprove={approveSelected}
            onPatch={(patch) => updateOrder(selectedOrder.id, (current) => ({ ...current, ...patch }))}
            onAssign={setAssignOrder}
            onCancel={setCancelOrder}
            overtimeRequests={overtimeRequests}
          />
        ) : (
          <aside className="border-t border-slate-200 bg-white p-4 text-slate-500 xl:border-l xl:border-t-0">Chưa có đơn phù hợp với quyền.</aside>
        )}
      </section>

      {createOpen ? (
        <CreateOrderModal
          accounts={accounts}
          currentUserName={currentUserName}
          positionId={position.id}
          onClose={() => setCreateOpen(false)}
          onCreate={(order) => {
            setOrders((current) => [order, ...current]);
            setCreateOpen(false);
            setSelectedOrderId(order.id);
            showNotice("success", `Đã tạo đơn ${order.code}. Đơn đang ở Tiếp nhận.`);
          }}
          existingCodes={orders.map((order) => order.code)}
        />
      ) : null}

      {cancelOrder ? (
        <CancelOrderModal
          order={cancelOrder}
          onClose={() => setCancelOrder(null)}
          onSubmit={(reason) => {
            updateOrder(cancelOrder.id, (order) => ({
              ...order,
              status: "canceled",
              canceledReason: reason,
              canceledBy: currentUserName,
              canceledAt: new Date().toISOString(),
              canceledStep: order.step
            }));
            setCancelOrder(null);
            showNotice("success", `Đã hủy đơn ${cancelOrder.code} và lưu vào danh sách đơn bị hủy.`);
          }}
        />
      ) : null}

      {showCanceled ? <CanceledOrdersModal orders={canceledOrders} onClose={() => setShowCanceled(false)} /> : null}
      
      {assignOrder ? (
        <AssignTaskModal
          order={assignOrder}
          accounts={accounts}
          currentPosition={position}
          onClose={() => setAssignOrder(null)}
          onSubmit={(patch) => {
            const assignConfig = getAssignConfig(position.id, assignOrder);
            const autoAccept = assignConfig.targetPositionId === "production_worker" || assignConfig.targetPositionId === "installer";
            
            // Cập nhật historyLogs khi giao việc
            updateOrder(assignOrder.id, (order) => {
              const nowStr = new Date().toISOString();
              const logs = order.historyLogs || [];
              const updatedLogs = logs.map(log => 
                log.step === order.step ? { 
                  ...log, 
                  assignee: patch.productionWorkerName || patch.installerName || patch.designerName || patch.fileOperatorName || patch.saleName || log.assignee, 
                  startedAt: nowStr 
                } : log
              );
              return { 
                ...order, 
                ...patch, 
                workStatus: autoAccept ? "working" : "unconfirmed",
                historyLogs: updatedLogs
              };
            });
            setAssignOrder(null);
            showNotice("success", `Đã giao việc cho đơn ${assignOrder.code}.`);
          }}
        />
      ) : null}

      {moveOrder ? (
        <MoveChecklistModal
          order={moveOrder}
          position={position}
          onClose={() => setMoveOrder(null)}
          onSubmit={(patch) => {
            const patchedOrder = { ...moveOrder, ...patch };
            updateOrder(moveOrder.id, (order) => ({ ...order, ...patch }));
            setMoveOrder(null);
            moveSelected(patchedOrder);
          }}
        />
      ) : null}
    </section>
  );
}

function CancelOrderModal({ order, onClose, onSubmit }: { order: Order; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Modal title={`Hủy đơn ${order.code}`} onClose={onClose}>
      <div className="grid gap-3 text-slate-900">
        <div className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-600">Đơn bị hủy sẽ được lưu lại để Giám đốc xem lịch sử.</div>
        <textarea className="min-h-28 w-full rounded-lg border border-slate-200 p-3 outline-none focus:border-orange-400" placeholder="Bắt buộc nhập lý do hủy" value={reason} onChange={(event) => setReason(event.target.value)} />
        <button className="min-h-12 rounded-lg bg-red-500 font-black text-white disabled:bg-slate-300" disabled={!reason.trim()} onClick={() => onSubmit(reason.trim())} type="button">Xác nhận hủy đơn</button>
      </div>
    </Modal>
  );
}

function CanceledOrdersModal({ orders, onClose }: { orders: Order[]; onClose: () => void }) {
  return (
    <Modal title="Đơn bị hủy" onClose={onClose}>
      <div className="grid max-h-[70vh] gap-3 overflow-y-auto text-slate-900">
        {orders.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-slate-500">Chưa có đơn bị hủy.</div> : null}
        {orders.map((order) => (
          <article key={order.id} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="font-black">{order.code} - {order.customerName}</div>
            <div className="mt-1 text-slate-600">Công đoạn lúc hủy: {order.canceledStep ?? order.step}</div>
            <div className="mt-1 text-slate-600">Người hủy: {order.canceledBy ?? "Chưa có"}</div>
            <div className="mt-1 font-bold text-red-600">Lý do: {order.canceledReason}</div>
          </article>
        ))}
      </div>
    </Modal>
  );
}

function downloadOrderArchive(order: Order, overtimeRequests: any[] = []) {
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

  // 1. Tính toán tiền công thợ và ngày công
  let totalLaborCost = 0;
  let totalWorkdays = 0;
  const logsSummary = (order.historyLogs || []).map(log => {
    const workingHours = calculateWorkingHours(log.startedAt, log.completedAt);
    
    // Lấy giờ tăng ca được phê duyệt
    const overtimeHours = overtimeRequests
      .filter(req => req.orderCode === order.code && req.userDisplayName === log.assignee && req.status === "approved")
      .reduce((sum, req) => sum + (req.hours || 0), 0);

    const totalHours = workingHours + overtimeHours;
    const workdays = parseFloat((totalHours / 8).toFixed(2));
    const dayRate = 350000;
    const cost = workdays * dayRate;
    
    totalWorkdays += workdays;
    totalLaborCost += cost;

    return {
      step: log.step,
      assignee: log.assignee,
      workingHours,
      overtimeHours,
      workdays,
      cost
    };
  });

  // 2. Chi phí vật tư
  const materialCost = (order.materialsList || []).reduce((sum, mat) => sum + mat.price, 0);

  // 3. Phụ kiện ngoài
  let accessorySales = 0;
  let accessoryCost = 0;
  const accessoriesList = (order.externalAccessories || []).filter(acc => acc.name.trim()).map(acc => {
    const cost = acc.actualCost || acc.costPrice || 0;
    accessorySales += acc.sellPrice || 0;
    accessoryCost += cost;
    return acc;
  });

  // 4. Chi phí lắp đặt khác
  const transport = order.installationCosts?.transport || 0;
  const loader = order.installationCosts?.loader || 0;

  // 5. Doanh thu & Lợi nhuận
  const revenue = order.quotation.quoteValue + accessorySales;
  const totalExpenses = totalLaborCost + materialCost + accessoryCost + transport + loader;
  const profit = revenue - totalExpenses;

  // Tạo nội dung báo cáo văn bản
  let reportText = `======================================================
     BÁO CÁO QUYẾT TOÁN CHI TIẾT ĐƠN HÀNG: ${order.code}
======================================================

1. THÔNG TIN KHÁCH HÀNG:
   - Khách hàng: ${order.customerName}
   - Số điện thoại: ${order.phone}
   - Địa chỉ: ${order.address}
   - Khu vực: ${order.area}
   - Sale phụ trách: ${order.saleName}
   - Thời gian xuất báo cáo: ${new Date().toLocaleString("vi-VN")}

2. LỊCH SỬ THỰC HIỆN CÔNG ĐOẠN & TIỀN CÔNG THỢ:
`;

  logsSummary.forEach((log, idx) => {
    reportText += `   [Mốc ${idx + 1}] Công đoạn: ${log.step}
         + Người đảm nhận: ${log.assignee}
         + Giờ làm hành chính: ${log.workingHours} giờ
         + Giờ làm tăng ca (OT): ${log.overtimeHours} giờ
         + Số ngày công quy đổi: ${log.workdays} công (Tính: Tổng giờ / 8)
         + Tiền công ước tính (350.000 đ/ngày): ${log.cost.toLocaleString("vi-VN")} đ
\n`;
  });

  reportText += `3. CHI TIẾT VẬT TƯ & CHI PHÍ LẮP ĐẶT PHỤ:
   * Danh sách vật tư sản xuất:
`;

  if (!order.materialsList || order.materialsList.length === 0) {
    reportText += `     - Không có vật tư ghi nhận.
`;
  } else {
    order.materialsList.forEach((mat) => {
      reportText += `     - ${mat.name}: ${mat.price.toLocaleString("vi-VN")} đ
`;
    });
  }

  reportText += `   * Chi phí phụ (Giám sát nhập):
     - Tiền xe vận chuyển: ${transport.toLocaleString("vi-VN")} đ
     - Tiền thuê bốc vác: ${loader.toLocaleString("vi-VN")} đ

4. CHI TIẾT PHỤ KIỆN NGOÀI:
`;

  if (accessoriesList.length === 0) {
    reportText += `   - Không có phụ kiện ngoài nào được khai báo.
`;
  } else {
    accessoriesList.forEach((acc, idx) => {
      reportText += `   [Phụ kiện ${idx + 1}] ${acc.name}:
         + Giá bán (khách trả): ${acc.sellPrice.toLocaleString("vi-VN")} đ
         + Giá vốn (Kế toán nhập): ${acc.costPrice.toLocaleString("vi-VN")} đ
         + Chi phí thực tế: ${acc.actualCost.toLocaleString("vi-VN")} đ
`;
    });
  }

  reportText += `
5. TỔNG HỢP DOANH THU, CHI PHÍ & LỢI NHUẬN RÒNG ĐƠN HÀNG:
   - Tổng Doanh Thu (Giá báo đơn hàng + Phụ kiện ngoài): ${revenue.toLocaleString("vi-VN")} đ
     + Giá báo đơn hàng: ${order.quotation.quoteValue.toLocaleString("vi-VN")} đ
     + Doanh thu phụ kiện: ${accessorySales.toLocaleString("vi-VN")} đ

   - Tổng Chi Phí Quyết Toán: ${totalExpenses.toLocaleString("vi-VN")} đ
     + Chi phí tiền công thợ: ${totalLaborCost.toLocaleString("vi-VN")} đ
     + Chi phí vật tư sản xuất: ${materialCost.toLocaleString("vi-VN")} đ
     + Chi phí phụ kiện ngoài: ${accessoryCost.toLocaleString("vi-VN")} đ
     + Chi phí xe cộ, bốc xếp: ${(transport + loader).toLocaleString("vi-VN")} đ

   - LỢI NHUẬN RÒNG ĐƠN HÀNG (Doanh Thu - Chi Phí): ${profit.toLocaleString("vi-VN")} đ (${profit >= 0 ? "CÓ LÃI" : "BỊ THUA LỖ"})

======================================================
        BÁO CÁO ĐƯỢC PHÁT HÀNH BỞI HỆ THỐNG GOMITA
======================================================`;

  const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Quyet-toan-${order.code}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function KanbanCard({ order, selected, onSelect }: { order: Order; selected: boolean; onSelect: (id: string) => void }) {
  const status = getWorkStatusMeta(order);
  const workers = getCurrentStepWorkers(order);
  return (
    <button className={`group relative rounded-lg border bg-white p-2 text-left shadow-sm transition duration-150 hover:z-20 hover:scale-[1.06] hover:shadow-xl ${selected ? "border-orange-400 ring-2 ring-orange-100" : "border-slate-200"}`} onClick={() => onSelect(order.id)} type="button">
      <div className="flex items-start justify-between gap-2">
        <div className="break-words text-[11px] font-black leading-5">{order.code}</div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${status.className}`}>{status.label}</span>
      </div>
      <div className="mt-1 truncate text-[11px] font-bold">{order.customerName}</div>
      <div className="hidden group-hover:block">
        <div className="mt-2 text-xs text-slate-600">{order.area}</div>
        <div className="mt-2 text-xs font-bold text-slate-700">Đang làm: {workers || "Chưa giao"}</div>
        <div className="mt-2 text-xs text-slate-600">{order.deadline}</div>
        {order.pendingStep ? <div className="mt-2 text-xs font-bold text-amber-700">Chờ duyệt sang {order.pendingStep}</div> : null}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500 group-hover:mt-3">
        <span className="flex gap-1">
          <FileImage className="h-4 w-4 text-blue-500" />
          <BriefcaseBusiness className="h-4 w-4 text-orange-500" />
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="h-4 w-4" />
          {order.priority === "warning" ? 3 : 1}
        </span>
      </div>
    </button>
  );
}

function OrderSidePanel({
  order,
  position,
  currentUserName,
  onMove,
  onApprove,
  onPatch,
  onAssign,
  onCancel,
  overtimeRequests = []
}: {
  order: Order;
  position: Position;
  currentUserName: string;
  onMove: (order: Order) => void;
  onApprove: (order: Order) => void;
  onPatch: (patch: Partial<Order>) => void;
  onAssign: (order: Order) => void;
  onCancel: (order: Order) => void;
  overtimeRequests?: any[];
}) {
  const [activeTab, setActiveTab] = useState("Thông tin");
  const canPrice = canViewOrderPricing(position.id, currentUserName, order);
  const issues = getTransitionIssues(order);
  const canSupplement = (["sale", "designer"].includes(position.id) && getAssignedNames(order, position.id).includes(currentUserName)) || ["sale_manager", "design_manager", "director", "admin"].includes(position.id);
  const canHandle = canHandleCurrentStep(position.id, order);
  const canApprove = canApproveStep(position.id, order);
  const canCancel = canCancelOrder(position.id, order);
  const status = getWorkStatusMeta(order);
  
  // Tự động nhận việc cho Thợ sản xuất & Thợ lắp đặt (không hiển thị nút Tiếp nhận công việc cho họ)
  const isWorker = position.id === "production_worker" || position.id === "installer";
  const canAcceptAssignedWork = !isWorker && canHandle && order.workStatus === "unconfirmed" && getCurrentStepWorkers(order).includes(currentUserName);

  // Phân quyền giao việc thắt chặt của Trưởng bộ phận
  const canAssign = canManagerAssign(position.id, order.step);

  return (
    <aside className="border-t border-slate-200 bg-white xl:border-l xl:border-t-0 text-slate-900">
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
        <h2 className="font-black">Chi tiết đơn hàng</h2>
        <button className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100" type="button" aria-label="Đóng">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="grid gap-5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-black">{order.code}</h3>
          <span className="rounded-md bg-orange-100 px-2 py-1 text-xs font-bold text-orange-700">{order.step}</span>
        </div>
        <div className={`rounded-lg p-3 text-sm font-bold ${status.className}`}>
          {status.label}{order.pendingStep ? `: chờ xác nhận chuyển sang ${order.pendingStep}` : ""}
          {order.pendingBy ? <div className="mt-1 text-xs">Người gửi: {order.pendingBy}</div> : null}
        </div>

        <div className="grid gap-3 text-sm">
          <PanelRow label="Khách hàng" value={order.customerName} />
          <PanelRow label="Số điện thoại" value={position.id === "installer" || position.id === "supervisor_lead" ? order.phone : maskPhone(order.phone)} />
          <PanelRow label="Địa chỉ" value={order.address} />
          <PanelRow label="Sale" value={order.saleName} />
          {canPrice ? <PanelRow label="Dự toán" value={`${order.quotation.estimateValue.toLocaleString("vi-VN")} đ`} strong /> : null}
        </div>

        <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 text-center text-xs font-bold">
          {["Thông tin", "Lịch sử", "File & Ảnh"].map((tab) => (
            <button key={tab} className={`min-h-10 ${activeTab === tab ? "border-b-2 border-orange-500 text-orange-600" : "text-slate-500"}`} onClick={() => {
              setActiveTab(tab);
            }} type="button">{tab}</button>
          ))}
        </div>

        {activeTab === "Thông tin" ? (
          <div className="grid gap-4">
            <OrderInfo order={order} positionId={position.id} />
            {canHandle && (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="mb-2 font-black text-slate-800 text-sm">Nhập liệu & Checklist công việc</div>
                <WorkflowChecks order={order} onPatch={onPatch} />
              </div>
            )}
          </div>
        ) : null}
        {activeTab === "Lịch sử" ? <InfoBlock label="Log quan trọng" value="Chuyển bước, sửa báo giá, sửa tài chính, trả đơn, sửa công và hoàn thành sẽ được ghi log." /> : null}
        {activeTab === "File & Ảnh" ? <InfoBlock label="File & Ảnh" value="Ảnh khảo sát/render/hoàn công lưu Supabase Storage. File CNC không upload PM, chỉ xác nhận đã gửi nhóm Zalo." /> : null}

        <TransitionSummary order={order} />

        {issues.length ? (
          <div className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-700">
            <AlertTriangle className="mr-1 inline h-4 w-4" />
            {issues[0]}
          </div>
        ) : null}

        <div className="border-t border-slate-200 pt-4">
          <div className="mb-3 font-black">Hành động</div>
          <div className="grid gap-3">
            {!canHandle ? <div className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-600">Vị trí này chỉ được xem, không được xử lý công đoạn hiện tại.</div> : null}
            {canAcceptAssignedWork ? (
              <button className="min-h-11 rounded-lg border border-green-500 bg-green-50 font-black text-green-700" onClick={() => onPatch({ workStatus: "working" })} type="button">
                Tiếp nhận công việc
              </button>
            ) : null}
            {canApprove ? (
              <button className="min-h-11 rounded-lg bg-green-600 font-black text-white" onClick={() => onApprove(order)} type="button">
                Quản lý xác nhận chuyển bước
              </button>
            ) : null}
            <button className="min-h-11 rounded-lg bg-orange-500 font-black text-white disabled:bg-slate-300" disabled={!canHandle || order.workStatus === "pending_confirmation" || orderSteps.indexOf(order.step) === orderSteps.length - 1} onClick={() => onMove(order)} type="button">
              {requiresManagerConfirmation(position.id, order) ? "Gửi quản lý xác nhận" : "Chuyển bước"}
            </button>
            {canAssign ? (
              <button className="min-h-11 rounded-lg border border-blue-200 bg-blue-50 font-black text-blue-700" onClick={() => onAssign(order)} type="button">
                Giao việc
              </button>
            ) : null}
            <button className="min-h-11 rounded-lg border border-slate-200 font-bold" onClick={() => onPatch({ finalNote: `${order.finalNote} (Đã tạo yêu cầu trả đơn/tách đơn)` })} type="button">
              Trả đơn / tách đơn con
            </button>
            {canCancel ? (
              <button className="min-h-11 rounded-lg border border-red-300 bg-red-50 font-black text-red-600" onClick={() => onCancel(order)} type="button">
                Hủy đơn
              </button>
            ) : null}
            {["accountant", "director", "admin"].includes(position.id) && order.step === "Hoàn công" && order.checklist.paymentCollected ? (
              <div className="grid gap-3">
                <button className="min-h-11 rounded-lg border border-green-500 bg-green-50 font-black text-green-700" onClick={() => downloadOrderArchive(order, overtimeRequests)} type="button">
                  Tải hồ sơ quyết toán (.txt)
                </button>
                <button className="min-h-11 rounded-lg bg-green-600 font-black text-white hover:bg-green-700 transition" onClick={() => {
                  onPatch({ status: "archived" });
                  alert(`Đơn hàng ${order.code} đã hoàn thành xuất sắc và được lưu trữ thành công!`);
                }} type="button">
                  Hoàn thành & Lưu trữ đơn hàng
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

function OrderInfo({ order, positionId }: { order: Order; positionId: string }) {
  const workerView = ["production_worker", "installer"].includes(positionId);
  return (
    <div className="grid gap-4 text-sm text-slate-900">
      <InfoBlock label={workerView ? "Thông tin cần làm" : "Mô tả yêu cầu"} value={order.volume || "Chưa bổ sung"} />
      <InfoBlock label="Yêu cầu khách" value={order.customerRequest || "Chưa bổ sung"} />
      <InfoBlock label="Gỗ/vật liệu" value={order.materialNote || "Chưa bổ sung"} />
      <InfoBlock label="Màu sắc" value={order.colorNote || "Chưa bổ sung"} />
      <InfoBlock label="Ghi chú cuối" value={order.finalNote} />
      {!workerView ? <InfoBlock label="Khảo sát" value={`${order.survey.floor || "Chưa có"} · Cầu thang: ${order.survey.stairWidth || "Chưa có"} · Thang máy: ${order.survey.elevatorWidth || "Chưa có"} · Ô tô cách cửa: ${order.survey.carDistance || "Chưa có"}`} /> : null}
    </div>
  );
}

function WorkflowChecks({ order, onPatch }: { order: Order; onPatch: (patch: Partial<Order>) => void }) {
  if (order.step === "Tiếp nhận") {
    return (
      <div className="grid gap-3 text-slate-950">
        <TextInput label="Mô tả yêu cầu/công việc" value={order.volume} onChange={(value) => onPatch({ volume: value })} />
        <TextInput label="Khách dùng gỗ/vật liệu gì" value={order.materialNote} onChange={(value) => onPatch({ materialNote: value })} />
        <TextInput label="Khách muốn màu gì" value={order.colorNote} onChange={(value) => onPatch({ colorNote: value })} />
        <TextInput label="Phong cách/ghi chú thiết kế" value={order.styleNote} onChange={(value) => onPatch({ styleNote: value })} />
        <TextInput label="Nội dung sơ bộ công trình" value={order.preliminaryContent} onChange={(value) => onPatch({ preliminaryContent: value })} />
        <TextInput label="Yêu cầu ban đầu của khách" value={order.customerInitialRequest} onChange={(value) => onPatch({ customerInitialRequest: value, customerRequest: value })} />
        <TextInput label="Tâm tư, mong muốn của khách" value={order.customerWish} onChange={(value) => onPatch({ customerWish: value })} />
        <TextInput label="Làm ở tầng mấy" value={order.survey.floor} onChange={(value) => onPatch({ survey: { ...order.survey, floor: value } })} />
        <TextInput label="Cầu thang rộng bao nhiêu" value={order.survey.stairWidth} onChange={(value) => onPatch({ survey: { ...order.survey, stairWidth: value } })} />
        <TextInput label="Thang máy rộng bao nhiêu hoặc ghi không có" value={order.survey.elevatorWidth} onChange={(value) => onPatch({ survey: { ...order.survey, elevatorWidth: value } })} />
        <TextInput label="Ô tô đỗ cách cửa bao nhiêu mét" value={order.survey.carDistance} onChange={(value) => onPatch({ survey: { ...order.survey, carDistance: value } })} />
      </div>
    );
  }

  if (order.step === "Thiết kế") {
    return (
      <div className="grid gap-3 text-slate-950">
        <TextInput label="Khách muốn màu gì" value={order.colorNote} onChange={(value) => onPatch({ colorNote: value })} />
        <TextInput label="Phong cách thiết kế" value={order.styleNote} onChange={(value) => onPatch({ styleNote: value })} />
        <TextInput label="Nội dung công trình" value={order.preliminaryContent} onChange={(value) => onPatch({ preliminaryContent: value })} />
        <TextInput label="Yêu cầu của khách" value={order.customerInitialRequest || order.customerRequest} onChange={(value) => onPatch({ customerInitialRequest: value, customerRequest: value })} />
        <TextInput label="Tâm tư, mong muốn của khách" value={order.customerWish} onChange={(value) => onPatch({ customerWish: value })} />
        <TextInput label="Làm ở tầng mấy" value={order.survey.floor} onChange={(value) => onPatch({ survey: { ...order.survey, floor: value } })} />
        <TextInput label="Cầu thang rộng bao nhiêu" value={order.survey.stairWidth} onChange={(value) => onPatch({ survey: { ...order.survey, stairWidth: value } })} />
        <TextInput label="Thang máy rộng bao nhiêu hoặc ghi không có" value={order.survey.elevatorWidth} onChange={(value) => onPatch({ survey: { ...order.survey, elevatorWidth: value } })} />
        <TextInput label="Ô tô đỗ cách cửa bao nhiêu mét" value={order.survey.carDistance} onChange={(value) => onPatch({ survey: { ...order.survey, carDistance: value } })} />
        <CheckItem label="Đã gửi file lên nhóm" checked={order.checklist.designFileSent} onChange={(checked) => onPatch({ checklist: { ...order.checklist, designFileSent: checked } })} />
        <CheckItem label="Đã gửi ảnh render công trình đẹp nhất" checked={order.checklist.renderPhotoSent} onChange={(checked) => onPatch({ checklist: { ...order.checklist, renderPhotoSent: checked } })} />
        <CheckItem label="Đã lên khối lượng dự toán sơ bộ" checked={order.checklist.preliminaryVolumeDone} onChange={(checked) => onPatch({ checklist: { ...order.checklist, preliminaryVolumeDone: checked } })} />
      </div>
    );
  }

  if (order.step === "Báo giá") {
    const accs = order.externalAccessories || Array.from({ length: 10 }, () => ({ name: "", sellPrice: 0, costPrice: 0, actualCost: 0 }));
    return (
      <div className="grid gap-3 text-slate-950">
        <NumberInput label="Dự toán *" value={order.quotation.estimateValue} onChange={(value) => onPatch({ quotation: { ...order.quotation, estimateValue: value } })} />
        <NumberInput label="Báo giá *" value={order.quotation.quoteValue} onChange={(value) => onPatch({ quotation: { ...order.quotation, quoteValue: value } })} />
        <CheckItem label="Đã upload ảnh dự toán *" checked={order.quotation.estimatePhotoUploaded} onChange={(checked) => onPatch({ quotation: { ...order.quotation, estimatePhotoUploaded: checked } })} />
        <CheckItem label="Đã upload ảnh báo giá *" checked={order.quotation.quotePhotoUploaded} onChange={(checked) => onPatch({ quotation: { ...order.quotation, quotePhotoUploaded: checked } })} />
        
        {/* Phụ kiện ngoài trong bước Báo giá - 10 dòng trống */}
        <div className="mt-4 border-t border-slate-200 pt-3">
          <h4 className="text-sm font-black mb-2 text-slate-800">Phụ kiện ngoài (Tối đa 10 dòng)</h4>
          <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
            {Array.from({ length: 10 }).map((_, idx) => {
              const acc = accs[idx] || { name: "", sellPrice: 0, costPrice: 0, actualCost: 0 };
              return (
                <div key={idx} className="flex gap-2 items-center">
                  <span className="text-xs font-bold text-slate-400 w-4">#{idx + 1}</span>
                  <input 
                    className="h-9 flex-1 rounded border border-slate-200 px-2 text-xs" 
                    placeholder="Tên phụ kiện" 
                    value={acc.name} 
                    onChange={(e) => {
                      const nextAccs = [...accs];
                      nextAccs[idx] = { ...acc, name: e.target.value };
                      onPatch({ externalAccessories: nextAccs });
                    }}
                  />
                  <input 
                    className="h-9 w-24 rounded border border-slate-200 px-2 text-xs" 
                    type="number" 
                    placeholder="Giá bán" 
                    value={acc.sellPrice || ""} 
                    onChange={(e) => {
                      const nextAccs = [...accs];
                      nextAccs[idx] = { ...acc, sellPrice: Number(e.target.value) };
                      onPatch({ externalAccessories: nextAccs });
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (order.step === "Ra file") {
    return (
      <div className="grid gap-2 text-slate-950">
        <CheckItem label="Ra file đã nhận và hoàn thành việc" checked={order.checklist.fileAccepted} onChange={(checked) => onPatch({ checklist: { ...order.checklist, fileAccepted: checked } })} />
        <CheckItem label="Đã gửi CNC lên nhóm Zalo" checked={order.checklist.cncSentToZalo} onChange={(checked) => onPatch({ checklist: { ...order.checklist, cncSentToZalo: checked } })} />
        <CheckItem label="Quản lý xưởng đã xác nhận" checked={order.checklist.workshopConfirmed} onChange={(checked) => onPatch({ checklist: { ...order.checklist, workshopConfirmed: checked } })} />
      </div>
    );
  }

  if (order.step === "Lắp đặt") {
    return (
      <div className="grid gap-3 text-slate-950">
        <NumberInput 
          label="Tiền vận chuyển (Giám sát nhập) *" 
          value={order.installationCosts?.transport || 0} 
          onChange={(val) => onPatch({ installationCosts: { ...(order.installationCosts || { transport: 0, loader: 0 }), transport: val } })} 
        />
        <NumberInput 
          label="Tiền bốc vác (Giám sát nhập) *" 
          value={order.installationCosts?.loader || 0} 
          onChange={(val) => onPatch({ installationCosts: { ...(order.installationCosts || { transport: 0, loader: 0 }), loader: val } })} 
        />
      </div>
    );
  }

  if (order.step === "Hoàn công") {
    return <CheckItem label="Kế toán xác nhận thu đủ tiền" checked={order.checklist.paymentCollected} onChange={(checked) => onPatch({ checklist: { ...order.checklist, paymentCollected: checked } })} />;
  }

  return <InfoBlock label="Công việc" value="Bước này chưa cần nhập thêm checklist trong demo." />;
}

function TransitionSummary({ order }: { order: Order }) {
  const issues = getTransitionIssues(order);
  const nextStep = orderSteps[orderSteps.indexOf(order.step) + 1];
  if (!nextStep) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
      <div className="font-black">Tổng kết trước khi chuyển sang {nextStep}</div>
      <div className="mt-2 grid gap-1">
        {issues.length === 0 ? (
          <div className="font-bold text-green-700">Đã đủ thông tin bắt buộc.</div>
        ) : issues.map((issue) => (
          <div key={issue} className="font-bold text-amber-700">Cần bổ sung: {issue}</div>
        ))}
      </div>
      <div className="mt-2 text-xs text-slate-500">Các mục checklist và thông tin bắt buộc phải đủ thì nút chuyển bước mới mở.</div>
    </div>
  );
}

function WorkerWorkspace({ 
  currentUserName, 
  orders, 
  setOrders,
  overtimeRequests 
}: { 
  currentUserName: string; 
  orders: Order[]; 
  setOrders: Dispatch<SetStateAction<Order[]>>;
  overtimeRequests: any[];
}) {
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? "");
  const [flowIndex, setFlowIndex] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [reportedDoneIds, setReportedDoneIds] = useState<string[]>([]);
  const monthDays = useMemo(() => getCurrentMonthDaysForWorker(), []);
  const [attendance, setAttendance] = useState<Record<string, WorkerAttendanceKind>>(() => buildWorkerAttendance(monthDays));
  const [clockMessage, setClockMessage] = useState("");
  const workerOrders = orders;
  const selectedOrder = workerOrders.find((order) => order.id === selectedOrderId) ?? workerOrders[0];
  const currentSlot = useMemo(() => attendanceSlots.find((slot) => isSlotOpen(slot)) ?? "07:30", []);
  const slotWindow = getSlotWindow(currentSlot);
  const needsEndOfShiftQuestion = currentSlot === "11:30" || currentSlot === "17:30";

  // Quản lý Modal Chấm Công Bù Thông Minh
  const [compOpen, setCompOpen] = useState(false);
  const [compReason, setCompReason] = useState("");
  const [selectedCompSlots, setSelectedCompSlots] = useState<Array<{ date: string; slot: AttendanceSlot }>>([]);

  // Lọc các mốc thiếu công thông minh
  const missingSlots = useMemo(() => {
    const list: Array<{ date: string; slot: AttendanceSlot; isIgnored: boolean }> = [];
    const today = new Date().getDate();
    monthDays.forEach((day) => {
      // Chỉ tính các ngày từ đầu tháng tới hôm nay
      if (day.getDay() === 0 || day.getDate() > today) return;
      attendanceSlots.forEach((slot) => {
        const key = `${day.getDate()}-${slot}`;
        // Nếu chưa chấm công thành công (normal) hoặc chấm công bù (compensated)
        if (!attendance[key]) {
          // Bị coi là bỏ qua nếu quá hạn 3 ngày tính từ hôm nay (đủ số lần nhắc nhở)
          const isIgnored = (today - day.getDate()) > 3;
          list.push({
            date: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
            slot,
            isIgnored
          });
        }
      });
    });
    return list;
  }, [monthDays, attendance]);

  function markAttendance(kind: WorkerAttendanceKind, day = new Date().getDate(), slot = currentSlot) {
    setAttendance((current) => ({ ...current, [`${day}-${slot}`]: kind }));
  }

  function submitCompensations() {
    if (selectedCompSlots.length === 0 || !compReason.trim()) return;

    // Ghi nhận chấm công bù
    setAttendance(current => {
      const next = { ...current };
      selectedCompSlots.forEach(item => {
        const day = Number(item.date.split("-")[2]);
        next[`${day}-${item.slot}`] = "compensated";
      });
      return next;
    });

    setCompOpen(false);
    setSelectedCompSlots([]);
    setCompReason("");

    // Hiển thị chính xác thông báo thành công theo mẫu
    alert(
      "Yêu cầu chấm công bù của bạn đã được gửi đi.\n" +
      "Nếu không được xác nhận, liên hệ với nhân sự và quản lý để được xác nhận nhé.\n" +
      "Sau bạn nhớ chấm công đúng giờ để đảm bảo quyền lợi của mình.\n" +
      "Cảm ơn!"
    );
    setClockMessage("Yêu cầu chấm công bù đã được gửi thành công.");
  }

  function answerWork(done: boolean) {
    if (flowIndex === null) return;
    const order = workerOrders[flowIndex];
    if (done && order) {
      setReportedDoneIds((current) => current.includes(order.id) ? current : [...current, order.id]);
      setOrders((current) => current.map((item) => item.id === order.id ? requestStepConfirmation(item, currentUserName, "Báo xong khi chấm công cuối buổi") : item));
    }
    const nextIndex = flowIndex + 1;
    if (nextIndex < workerOrders.length) {
      setFlowIndex(nextIndex);
      return;
    }
    setFlowIndex(null);
    setCameraReady(true);
  }

  return (
    <section className="grid gap-6 text-slate-900">
      {clockMessage ? <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700">{clockMessage}</div> : null}
      
      {/* 4. Nút Chấm Công Tách Riêng - To, Dễ Nhìn, Trên Cùng */}
      <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-800">Xin chào, {currentUserName}!</h2>
            <p className="text-sm text-slate-500 mt-1">Đảm bảo chấm công đúng giờ để ghi nhận ngày công đầy đủ.</p>
            <div className="mt-4 flex items-center gap-3">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-bold text-slate-700">Trạng thái: Có {workerOrders.length} công việc đang đảm nhiệm</span>
            </div>
          </div>
          <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-500">
            Mốc chấm công tiếp theo: <strong className="text-slate-800">{currentSlot}</strong> ({formatTime(slotWindow.opensAt.toISOString())} - {formatTime(slotWindow.closesAt.toISOString())})
          </div>
        </div>

        <ClockCard 
          currentSlot={currentSlot} 
          windowText={`${formatTime(slotWindow.opensAt.toISOString())} - ${formatTime(slotWindow.closesAt.toISOString())}`} 
          cameraReady={cameraReady} 
          needsQuestion={needsEndOfShiftQuestion} 
          onStart={() => {
            if (needsEndOfShiftQuestion && workerOrders.length) setFlowIndex(0);
            else setCameraReady(true);
          }} 
          onCapture={() => {
            markAttendance("normal");
            setClockMessage(`Đã chấm công mốc ${currentSlot} và cập nhật vào bảng công tháng.`);
            setCameraReady(false);
            setOrders((current) => current.map((order) => reportedDoneIds.includes(order.id) ? { ...order, finalNote: `${order.finalNote} (Thợ đã báo xong khi chấm công)` } : order));
            
            // Luồng chấm công bù chủ động
            const actualMissing = missingSlots.filter(item => !item.isIgnored);
            if (actualMissing.length > 0) {
              setTimeout(() => {
                const wishComp = globalThis.confirm(
                  `Bạn đang thiếu ${actualMissing.length} mốc chấm công trong 3 ngày gần nhất.\n` +
                  `Bạn có muốn thực hiện đăng ký chấm công bù ngay bây giờ không?`
                );
                if (wishComp) {
                  setCompOpen(true);
                }
              }, 600);
            }
          }} 
        />
      </div>

      {/* Danh sách công việc đang làm */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-black">Danh sách công việc của tôi</h2>
          <p className="mt-1 text-sm text-slate-500">Bấm "Xem" để cập nhật trạng thái chi tiết của công việc.</p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[1.2fr_1.2fr_1.2fr_0.9fr_1fr_0.7fr] bg-slate-50 px-5 py-4 text-sm font-black text-slate-600">
              <div>Mã đơn hàng</div>
              <div>Khách hàng</div>
              <div>Công việc</div>
              <div>Tiến độ</div>
              <div>Hạn hoàn thành</div>
              <div>Thao tác</div>
            </div>
            {workerOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400 italic">Hiện tại bạn chưa được giao công việc nào.</div>
            ) : (
              workerOrders.map((order) => (
                <button key={order.id} className={`grid w-full grid-cols-[1.2fr_1.2fr_1.2fr_0.9fr_1fr_0.7fr] items-center border-t border-slate-200 px-5 py-5 text-left ${selectedOrder?.id === order.id ? "bg-orange-50/60" : "bg-white"}`} onClick={() => setSelectedOrderId(order.id)} type="button">
                  <div><div className="font-black">{order.code}</div><div className="mt-1 text-sm text-slate-500">Nội thất</div></div>
                  <div><div>{order.customerName}</div><div className="mt-1 text-sm text-slate-500">{order.area}</div></div>
                  <div><div>{order.step === "Sản xuất" ? "Sản xuất tủ" : "Lắp đặt nội thất"}</div><div className="mt-1 text-sm text-slate-500">{order.materialNote || "Vật liệu theo đơn"}</div></div>
                  <div><div>{order.progressPercent}%</div><div className="mt-2 h-2 rounded-full bg-slate-200"><div className="h-full rounded-full bg-amber-400" style={{ width: `${order.progressPercent}%` }} /></div></div>
                  <div><div>{order.deadline}</div><div className={`mt-1 text-sm font-bold ${order.workStatus === "pending_confirmation" ? "text-amber-600" : "text-red-500"}`}>{getWorkStatusMeta(order).label}</div></div>
                  <div><span className="inline-flex h-10 items-center gap-2 rounded-lg border border-orange-400 px-4 font-bold text-orange-600"><Eye className="h-4 w-4" />Xem</span></div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedOrder ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <WorkerDetail order={selectedOrder} />
          
          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="font-black text-slate-800 mb-3">Checklist trước khi hoàn thành</h4>
            <div className="grid gap-3">
              <label className="flex items-center gap-3 text-sm p-3 rounded-lg border border-slate-200">
                <input 
                  type="checkbox" 
                  checked={reportedDoneIds.includes(selectedOrder.id) || selectedOrder.workStatus === "pending_confirmation"} 
                  disabled={selectedOrder.workStatus === "pending_confirmation"}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setReportedDoneIds(curr => [...curr, selectedOrder.id]);
                      setOrders(curr => curr.map(o => o.id === selectedOrder.id ? requestStepConfirmation(o, currentUserName, "Thợ báo xong") : o));
                    }
                  }}
                />
                <span className="font-bold">Đã làm xong công việc và báo cáo giám sát</span>
              </label>
              
              <div className="text-xs text-slate-500 mt-2 bg-slate-50 p-3 rounded border">
                Trạng thái: <strong>{getWorkStatusMeta(selectedOrder).label}</strong>
                {selectedOrder.workStatus === "pending_confirmation" && (
                  <p className="mt-1 font-semibold text-amber-600">● Đơn đang chờ Giám sát hoặc Quản lý xưởng phê duyệt chuyển bước.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {/* Bảng công tháng & Modal Chấm công bù */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-xl font-black">Bảng công tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}</h3>
            <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
              <LegendDot color="bg-green-500" label="Đã chấm thành công" />
              <LegendDot color="bg-blue-500" label="Đã chấm công bù" />
              <LegendDot color="bg-slate-300" label="Thiếu công" />
            </div>
          </div>
        </div>
        <WorkerAttendanceGrid monthDays={monthDays} attendance={attendance} />
      </div>

      {flowIndex !== null ? (
        <ConfirmCard index={`${flowIndex + 1}/${workerOrders.length}`} orderCode={workerOrders[flowIndex]?.code ?? ""} onAnswer={answerWork} finalQuestion={flowIndex === workerOrders.length - 1} />
      ) : null}

      {/* 2. & 3. MODAL CHẤM CÔNG BÙ THÔNG MINH */}
      {compOpen ? (
        <Modal title="Đăng ký chấm công bù" onClose={() => setCompOpen(false)}>
          <div className="grid gap-4 max-h-[76vh] overflow-y-auto pr-1 text-slate-900">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 font-bold">
              Chỉ được chấm công bù các mốc trong vòng 3 ngày gần nhất. Các mốc cũ hơn sẽ bị hệ thống tự động khóa.
            </div>

            <div>
              <div className="mb-2 font-black text-sm text-slate-700">Các mốc thiếu công trong tháng</div>
              {missingSlots.length === 0 ? (
                <div className="text-center py-6 text-slate-400 italic">Tuyệt vời! Bạn không thiếu mốc chấm công nào.</div>
              ) : (
                <div className="grid gap-2 max-h-60 overflow-y-auto rounded-lg border p-2">
                  {missingSlots.map((item, idx) => {
                    const isChecked = selectedCompSlots.some(s => s.date === item.date && s.slot === item.slot);
                    return (
                      <label key={idx} className={`flex min-h-11 items-center gap-3 rounded-lg border p-2 text-xs font-bold ${item.isIgnored ? "bg-slate-50 text-slate-400 opacity-60 cursor-not-allowed" : "border-slate-200 hover:bg-slate-50 cursor-pointer"}`}>
                        <input 
                          type="checkbox" 
                          disabled={item.isIgnored} 
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCompSlots(curr => [...curr, { date: item.date, slot: item.slot }]);
                            } else {
                              setSelectedCompSlots(curr => curr.filter(s => !(s.date === item.date && s.slot === item.slot)));
                            }
                          }}
                        />
                        <span className="flex-1">{formatDate(item.date)} - Mốc {item.slot}</span>
                        {item.isIgnored ? (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">Đã khóa (Quá 3 ngày)</span>
                        ) : (
                          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-600">Cho phép bù</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <label className="grid gap-1.5 text-sm font-black">
              Lý do thiếu công
              <textarea 
                className="min-h-20 rounded-lg border border-slate-200 p-3 font-normal" 
                placeholder="Ví dụ: Quên điện thoại, Đi khảo sát công trình ngoài, v.v." 
                value={compReason} 
                onChange={e => setCompReason(e.target.value)}
              />
            </label>

            <button 
              className="min-h-12 rounded-lg bg-green-600 font-black text-white disabled:bg-slate-300 disabled:text-slate-500" 
              disabled={selectedCompSlots.length === 0 || !compReason.trim()}
              onClick={submitCompensations} 
              type="button"
            >
              Gửi yêu cầu chấm công bù
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function WorkerAttendanceGrid({ monthDays, attendance }: { monthDays: Date[]; attendance: Record<string, WorkerAttendanceKind> }) {
  return (
    <div className="overflow-x-auto text-slate-900">
      <div className="min-w-[1240px]">
        <div className="grid border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-600" style={{ gridTemplateColumns: `110px repeat(${monthDays.length}, 36px)` }}>
          <div>Mốc giờ</div>
          {monthDays.map((day) => <div key={day.toISOString()} className="text-center">{day.getDate()}</div>)}
        </div>
        {attendanceSlots.map((slot) => (
          <div key={slot} className="grid items-center border-b border-slate-100 px-4 py-3 text-sm" style={{ gridTemplateColumns: `110px repeat(${monthDays.length}, 36px)` }}>
            <div className="font-black">{slot}</div>
            {monthDays.map((day) => {
              const kind = attendance[`${day.getDate()}-${slot}`];
              return <div key={`${day.toISOString()}-${slot}`} className="grid place-items-center"><span className={`h-3 w-3 rounded-full ${kind === "normal" ? "bg-green-500" : kind === "compensated" ? "bg-blue-500" : "bg-slate-300"}`} /></div>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function buildWorkerAttendance(days: Date[]) {
  const data: Record<string, WorkerAttendanceKind> = {};
  const today = new Date().getDate();
  days.forEach((day) => {
    if (day.getDay() === 0 || day.getDate() > today) return;
    attendanceSlots.forEach((slot) => {
      if ((day.getDate() + slot.length) % 8 !== 0) data[`${day.getDate()}-${slot}`] = "normal";
    });
  });
  return data;
}

function findMissingWorkerSlot(days: Date[], attendance: Record<string, WorkerAttendanceKind>) {
  const today = new Date().getDate();
  for (const day of days) {
    if (day.getDay() === 0 || day.getDate() > today) continue;
    for (const slot of attendanceSlots) {
      if (!attendance[`${day.getDate()}-${slot}`]) return { day: day.getDate(), slot };
    }
  }
  return null;
}

function getCurrentMonthDaysForWorker() {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => new Date(now.getFullYear(), now.getMonth(), index + 1));
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span>;
}

function WorkerDetail({ order }: { order: Order }) {
  const people = [
    ["Sale phụ trách", order.saleName, "0987 654 321"],
    ["Thiết kế", order.designerName, "0976 543 210"],
    ["Ra file", order.fileOperatorName, "0986 123 456"],
    ["Quản lý", order.workshopManagerName, "0965 789 123"]
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm flex-1 text-slate-900">
      <h3 className="font-black text-slate-800">Chi tiết đơn hàng đang chọn</h3>
      <div className="mt-4 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-lg bg-amber-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-black text-amber-950">{order.code}</h4>
            <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">{order.step}</span>
          </div>
          <div className="mt-3 text-sm font-semibold">{order.volume}</div>
          <div className="mt-4 grid gap-3 text-sm">
            <MiniRow icon={<User className="h-4 w-4" />} label="Khách hàng" value={order.customerName} />
            <MiniRow icon={<CheckCircle2 className="h-4 w-4" />} label="Tiến độ" value={`${order.progressPercent}%`} />
          </div>
        </div>
        <div>
          <h4 className="mb-3 font-black text-slate-700">Người liên quan công trình</h4>
          <div className="grid gap-2">
            {people.map(([role, name, phone]) => (
              <div key={role} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-orange-100 text-orange-600"><User className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1"><div className="text-xs text-slate-500">{role}</div><div className="font-bold">{name}</div></div>
                <Phone className="h-4 w-4 text-slate-500" /><span className="text-sm">{phone}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-950">
            <div className="font-black text-amber-900">Ghi chú yêu cầu lắp đặt:</div>
            <div className="mt-1">- {order.customerRequest}</div>
            <div>- {order.finalNote}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClockCard({ currentSlot, windowText, cameraReady, needsQuestion, onStart, onCapture }: { currentSlot: string; windowText: string; cameraReady: boolean; needsQuestion: boolean; onStart: () => void; onCapture: () => void }) {
  return (
    <div className="rounded-xl border border-green-200 bg-emerald-50/50 p-6 text-center shadow-sm flex flex-col justify-center items-center text-slate-900">
      <h3 className="font-black text-slate-800 text-lg">Chấm công mốc hiện tại</h3>
      <div className="mt-3 text-5xl font-black text-green-600">{currentSlot}</div>
      <div className="mt-3 flex items-center justify-center gap-1.5 text-sm text-green-700 font-semibold"><CheckCircle2 className="h-4 w-4 text-green-600" />Đang trong giờ ({windowText})</div>
      
      <button className="mt-5 flex min-h-14 w-full max-w-xs items-center justify-center gap-3 rounded-xl bg-green-600 text-xl font-black text-white shadow-lg shadow-green-600/20 hover:bg-green-700 transition" onClick={cameraReady ? onCapture : onStart} type="button">
        <Camera className="h-6 w-6" />
        {cameraReady ? "CHỤP ẢNH" : "CHẤM CÔNG"}
      </button>
      <div className="mt-3 text-xs text-slate-500">{cameraReady ? "Vui lòng chụp ảnh khuôn mặt." : needsQuestion ? "Cần báo cáo trạng thái đơn hàng trước khi chụp ảnh." : "Nhấp nút Chấm công."}</div>
    </div>
  );
}

function ConfirmCard({ index, orderCode, finalQuestion, onAnswer }: { index: string; orderCode: string; finalQuestion: boolean; onAnswer: (done: boolean) => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl ring-2 ring-orange-100 text-slate-900 text-center">
        <div className="flex items-center justify-between"><h3 className="font-black">Xác nhận hoàn thành</h3><span className="rounded-md bg-slate-100 px-2 py-1 text-sm font-bold text-slate-500">{index}</span></div>
        <div className="mt-8 text-slate-700">Bạn đã hoàn thiện đơn hàng</div>
        <div className="mt-2 text-xl font-black text-slate-900">{orderCode}</div>
        <div className="mt-1">chưa?</div>
        <div className="mt-6 grid gap-3">
          <button className="min-h-12 rounded-lg border border-green-500 font-bold text-green-600 hover:bg-green-50 transition" onClick={() => onAnswer(true)} type="button"><Check className="mr-2 inline h-5 w-5" />Đã xong</button>
          <button className="min-h-12 rounded-lg border border-red-400 font-bold text-red-500 hover:bg-red-50 transition" onClick={() => onAnswer(false)} type="button">Chưa xong</button>
        </div>
        <div className="mt-4 text-xs text-slate-500">Chúng tôi sẽ chuyển trạng thái sang Chờ duyệt chuyển bước.</div>
      </section>
    </div>
  );
}

function CreateOrderModal({ accounts, currentUserName, positionId, existingCodes, onCreate, onClose }: { accounts: UserAccount[]; currentUserName: string; positionId: string; existingCodes: string[]; onCreate: (order: Order) => void; onClose: () => void }) {
  const sales = useMemo(() => {
    return accounts.filter(
      (acc) => acc.status === "active" && acc.positionIds.includes("sale")
    );
  }, [accounts]);

  const [input, setInput] = useState({ customerName: "", area: "", phone: "", address: "" });
  const [selectedSales, setSelectedSales] = useState<string[]>(() => {
    if (positionId === "sale") {
      const isCurrentSaleActive = sales.some(s => s.displayName === currentUserName);
      return isCurrentSaleActive ? [currentUserName] : [];
    }
    return [];
  });
  const [issues, setIssues] = useState<string[]>([]);

  function toggleSale(name: string) {
    setSelectedSales((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name]
    );
  }

  function submit() {
    const assignedSaleName = selectedSales.join(", ");
    const nextInput = { ...input, assignedSaleName, createdByPositionId: positionId };
    const nextIssues = validateCreateOrder(nextInput);
    if (nextIssues.length) {
      setIssues(nextIssues);
      return;
    }
    onCreate(buildOrder(nextInput, existingCodes));
  }

  return (
    <Modal title="Tạo đơn hàng mới" onClose={onClose}>
      <div className="grid gap-3 text-slate-900">
        <TextInput label="Tên khách hàng *" value={input.customerName} onChange={(value) => setInput({ ...input, customerName: value })} />
        <TextInput label="Khu vực" value={input.area} onChange={(value) => setInput({ ...input, area: value })} />
        <TextInput label="Số điện thoại *" value={input.phone} onChange={(value) => setInput({ ...input, phone: value })} />
        <TextInput label="Địa chỉ *" value={input.address} onChange={(value) => setInput({ ...input, address: value })} />
        
        <div className="grid gap-1">
          <span className="text-sm font-bold text-slate-700">Sale phụ trách *</span>
          <div className="grid max-h-40 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 bg-white">
            {sales.map((sale) => (
              <label key={sale.id} className="flex min-h-10 items-center gap-3 rounded-lg border border-slate-100 px-3 text-sm font-medium cursor-pointer hover:bg-slate-50 transition">
                <input
                  checked={selectedSales.includes(sale.displayName)}
                  type="checkbox"
                  onChange={() => toggleSale(sale.displayName)}
                  className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="min-w-0 flex-1 text-slate-700 font-semibold">{sale.displayName}</span>
                <span className="text-xs text-slate-400 font-bold">{sale.department}</span>
              </label>
            ))}
            {sales.length === 0 && (
              <div className="text-xs text-slate-400 text-center py-2">Không tìm thấy tài khoản Sale nào trong công ty</div>
            )}
          </div>
        </div>

        {issues.length ? <div className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-600">{issues.join(" ")}</div> : null}
        <button className="min-h-12 rounded-lg bg-orange-500 font-black text-white hover:bg-orange-600 transition" onClick={submit} type="button">Tạo đơn</button>
      </div>
    </Modal>
  );
}

// SkipModal removed since Chờ tiếp nhận step is removed.

function MoveChecklistModal({ order, position, onClose, onSubmit }: { order: Order; position: Position; onClose: () => void; onSubmit: (patch: Partial<Order>) => void }) {
  const [draft, setDraft] = useState<Order>(order);
  const [showErrors, setShowErrors] = useState(false);
  const nextStep = orderSteps[orderSteps.indexOf(draft.step) + 1];
  const issues = getTransitionIssues(draft);

  function patchDraft(patch: Partial<Order>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function submit() {
    if (issues.length) {
      setShowErrors(true);
      return;
    }
    onSubmit(draft);
  }

  return (
    <Modal title={`Tổng kết chuyển bước ${order.code}`} onClose={onClose}>
      <div className="grid max-h-[76vh] gap-4 overflow-y-auto pr-1 text-slate-900">
        <div className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700">
          Điền đủ thông tin và tích đủ checklist trước khi chuyển sang {nextStep ?? "bước tiếp theo"}.
        </div>
        <WorkflowChecks order={draft} onPatch={patchDraft} />
        <TransitionSummary order={draft} />
        {showErrors && issues.length ? (
          <div className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-700">
            {issues.map((issue) => <div key={issue}>Cần bổ sung: {issue}</div>)}
          </div>
        ) : null}
        <button className="min-h-12 rounded-lg bg-orange-500 font-black text-white" onClick={submit} type="button">
          {requiresManagerConfirmation(position.id, draft) ? "Gửi quản lý xác nhận" : "Chuyển bước"}
        </button>
      </div>
    </Modal>
  );
}

function AssignTaskModal({ order, accounts, currentPosition, onClose, onSubmit }: { order: Order; accounts: UserAccount[]; currentPosition: Position; onClose: () => void; onSubmit: (patch: Partial<Order>) => void }) {
  const assignConfig = getAssignConfig(currentPosition.id, order);
  const eligibleAccounts = accounts.filter((account) => account.status === "active" && account.positionIds.some((positionId) => assignConfig.assignablePositionIds.includes(positionId)));
  const initialSelected = getInitialAssignedNames(order, assignConfig.targetPositionId);
  const [draft, setDraft] = useState({
    selectedNames: initialSelected,
    assignedTaskNote: order.assignedTaskNote ?? ""
  });

  function toggleName(name: string) {
    setDraft((current) => ({
      ...current,
      selectedNames: current.selectedNames.includes(name)
        ? current.selectedNames.filter((item) => item !== name)
        : [...current.selectedNames, name]
    }));
  }

  function submit() {
    const selectedNames = draft.selectedNames;
    onSubmit(buildAssignmentPatch(assignConfig.targetPositionId, selectedNames, draft.assignedTaskNote));
  }

  return (
    <Modal title={`Giao việc đơn hàng ${order.code}`} onClose={onClose}>
      <div className="grid gap-3 text-slate-900">
        <div className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700">
          {assignConfig.description}
        </div>
        {eligibleAccounts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">Chưa có nhân sự phù hợp trong phòng ban này.</div>
        ) : (
          <div className="grid max-h-56 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
            {eligibleAccounts.map((account) => (
              <label key={account.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-bold cursor-pointer hover:bg-slate-50">
                <input checked={draft.selectedNames.includes(account.displayName)} type="checkbox" onChange={() => toggleName(account.displayName)} />
                <span className="min-w-0 flex-1">{account.displayName}</span>
                <span className="text-xs text-slate-500">{account.positionIds.map((id) => positions.find((position) => position.id === id)?.name ?? id).join(", ")}</span>
              </label>
            ))}
          </div>
        )}
        <label className="grid gap-1 text-sm font-bold">
          Nội dung giao việc
          <textarea className="min-h-24 rounded-lg border border-slate-200 p-3 font-normal outline-none focus:border-orange-400" value={draft.assignedTaskNote} onChange={(event) => setDraft({ ...draft, assignedTaskNote: event.target.value })} />
        </label>
        <button className="min-h-12 rounded-lg bg-blue-600 font-black text-white disabled:bg-slate-300" disabled={draft.selectedNames.length === 0} onClick={submit} type="button">Lưu giao việc</button>
      </div>
    </Modal>
  );
}

function getAssignConfig(positionId: string, order: Order) {
  if (positionId === "sale_manager" || positionId === "director" || positionId === "admin") {
    if (["Tiếp nhận", "Báo giá"].includes(order.step)) {
      return { targetPositionId: "sale", assignablePositionIds: ["sale"], description: "Giao việc cho nhân sự phòng Sale." };
    }
  }
  if (positionId === "design_manager" || positionId === "director" || positionId === "admin") {
    if (order.step === "Thiết kế") {
      return { targetPositionId: "designer", assignablePositionIds: ["designer"], description: "Trưởng phòng thiết kế giao việc cho nhân sự phòng Thiết kế." };
    }
  }
  if (positionId === "workshop_manager" || positionId === "director" || positionId === "admin") {
    if (order.step === "Ra file") {
      return { targetPositionId: "file_operator", assignablePositionIds: ["file_operator"], description: "Quản lý xưởng giao việc ra file cho nhân sự xưởng." };
    }
    if (order.step === "Sản xuất") {
      return { targetPositionId: "production_worker", assignablePositionIds: ["production_worker"], description: "Quản lý xưởng giao việc sản xuất cho nhân sự xưởng." };
    }
  }
  if (positionId === "supervisor_lead" || positionId === "director" || positionId === "admin") {
    if (["Lắp đặt", "Nghiệm thu"].includes(order.step)) {
      return { targetPositionId: "installer", assignablePositionIds: ["installer"], description: "Trưởng giám sát giao việc cho nhân sự lắp đặt." };
    }
  }
  return { targetPositionId: "sale", assignablePositionIds: ["sale"], description: "Giao việc cho đơn hàng." };
}

function getInitialAssignedNames(order: Order, positionId: string) {
  return getAssignedNames(order, positionId);
}

function buildAssignmentPatch(positionId: string, selectedNames: string[], assignedTaskNote: string): Partial<Order> {
  const firstName = selectedNames[0] ?? "";
  if (positionId === "sale") return { saleName: firstName, assignee: firstName, assignedTaskNote };
  if (positionId === "designer") return { designerName: firstName, designerNames: selectedNames, assignedTaskNote };
  if (positionId === "file_operator") return { fileOperatorName: firstName, fileOperatorNames: selectedNames, assignedTaskNote };
  if (positionId === "production_worker") return { productionWorkerName: firstName, productionWorkerNames: selectedNames, assignedTaskNote };
  if (positionId === "installer") return { installerName: firstName, installerNames: selectedNames, assignedTaskNote };
  if (positionId === "supervisor_lead") return { supervisorName: firstName, supervisorNames: selectedNames, assignedTaskNote };
  return { assignedTaskNote };
}

function getCurrentStepWorkers(order: Order) {
  if (["Tiếp nhận", "Báo giá"].includes(order.step)) return getAssignedNames(order, "sale").join(", ");
  if (order.step === "Thiết kế") return getAssignedNames(order, "designer").join(", ");
  if (order.step === "Ra file") return getAssignedNames(order, "file_operator").join(", ");
  if (order.step === "Sản xuất") return getAssignedNames(order, "production_worker").join(", ");
  if (["Lắp đặt", "Nghiệm thu"].includes(order.step)) return getAssignedNames(order, "installer").join(", ");
  if (order.step === "Hoàn công") return getAssignedNames(order, "sale").join(", ");
  return "";
}

function getWorkStatusMeta(order: Order) {
  if (order.workStatus === "pending_confirmation") {
    return { label: "Chờ xác nhận", className: "bg-amber-100 text-amber-700" };
  }
  if (order.workStatus === "unconfirmed") {
    return { label: "Chưa xác nhận", className: "bg-slate-100 text-slate-600" };
  }
  return { label: "Đang làm", className: "bg-green-100 text-green-700" };
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-black text-slate-900">{title}</h2><button className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100 text-slate-600" onClick={onClose} type="button"><X className="h-5 w-5" /></button></div>
        {children}
      </section>
    </div>
  );
}

function NoticeBar({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm font-bold ${notice.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
      <span>{notice.text}</span>
      <button onClick={onClose} type="button"><X className="h-4 w-4" /></button>
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-sm font-bold text-slate-700">{label}<input className="h-10 rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-orange-400" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="grid gap-1 text-sm font-bold text-slate-700">{label}<input className="h-10 rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-orange-400" type="number" value={value || ""} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function CheckItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 cursor-pointer hover:bg-slate-50"><input checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

function PanelRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="grid grid-cols-[110px_1fr] gap-3 text-sm"><span className="text-slate-500">{label}</span><span className={`text-right ${strong ? "font-black" : "font-bold"}`}>{value}</span></div>;
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return <div className="text-sm"><div className="mb-1 text-slate-400 font-bold">{label}</div><div className="font-semibold text-slate-800">{value}</div></div>;
}

function MiniRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex gap-3 border-t border-amber-100 pt-3"><span className="text-slate-600">{icon}</span><div><div className="text-xs text-slate-400">{label}</div><div className="font-bold text-slate-800">{value}</div></div></div>;
}

function maskPhone(phone: string) {
  return `${phone.slice(0, 3)}***${phone.slice(-3)}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
