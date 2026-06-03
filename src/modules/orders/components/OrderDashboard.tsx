"use client";

import {
  AlertTriangle,
  BriefcaseBusiness,
  Camera,
  Check,
  CheckCircle2,
  Clock,
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
import { useEffect, useMemo, useRef, useState } from "react";
import type { UserAccount } from "@/modules/hr/accounts";
import type { Position } from "@/modules/hr/roles";
import { isCompanyWideOrderRole, isWorkerPosition, positions } from "@/modules/hr/roles";
import { attendanceSlots, getSlotWindow, isSlotOpen, getRequiredApprovals } from "@/modules/attendance/compensationRules";
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
  if (step === "Nghiệm thu") return false; // Nghiệm thu không giao việc!
  if (positionId === "admin" || positionId === "director") return true;
  if (positionId === "sale_manager") return ["Tiếp nhận", "Báo giá"].includes(step);
  if (positionId === "design_manager") return step === "Thiết kế";
  if (positionId === "workshop_manager") return ["Ra file", "Sản xuất"].includes(step);
  if (positionId === "supervisor_lead") return step === "Lắp đặt"; // (Bỏ Nghiệm thu!)
  return false;
}

export function OrderDashboard({ 
  accounts, 
  position, 
  currentUserName,
  currentAccountId,
  currentAccountLevel,
  orders,
  setOrders,
  overtimeRequests = [],
  compensationRequests = [],
  onCompensationRequestsChange,
  attendance = {},
  onAttendanceChange
}: { 
  accounts: UserAccount[]; 
  position: Position; 
  currentUserName: string;
  currentAccountId: string;
  currentAccountLevel: any;
  orders: Order[];
  setOrders: Dispatch<SetStateAction<Order[]>>;
  overtimeRequests: any[];
  compensationRequests: any[];
  onCompensationRequestsChange: (reqs: any[]) => void;
  attendance: Record<string, string>;
  onAttendanceChange: (att: Record<string, string>) => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const visibleOrders = useMemo(() => {
    const targetStatus = showArchived ? "archived" : "active";
    if (isCompanyWideOrderRole(position.id)) {
      return orders.filter((order) => order.status === targetStatus);
    }
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
  const [draggingOrderId, setDraggingOrderId] = useState("");
  const [dragOverStep, setDragOverStep] = useState<OrderStep | null>(null);
  const selectedOrder = visibleOrders.find((order) => order.id === selectedOrderId) ?? visibleOrders[0];

  if (isWorkerPosition(position.id)) {
    return (
      <WorkerWorkspace 
        currentUserName={currentUserName}
        currentAccountId={currentAccountId}
        currentAccountLevel={currentAccountLevel}
        orders={visibleOrders} 
        setOrders={setOrders} 
        overtimeRequests={overtimeRequests}
        compensationRequests={compensationRequests}
        onCompensationRequestsChange={onCompensationRequestsChange}
        attendance={attendance}
        onAttendanceChange={onAttendanceChange}
      />
    );
  }

  const allowedSteps = isCompanyWideOrderRole(position.id) ? orderSteps : visibleOrderStepsFor(position.id);

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

  function handleDropNextStep(order: Order, targetStep: OrderStep) {
    setDragOverStep(null);
    setDraggingOrderId("");
    const currentIndex = orderSteps.indexOf(order.step);
    const targetIndex = orderSteps.indexOf(targetStep);
    if (currentIndex < 0 || targetIndex !== currentIndex + 1) {
      showNotice("warning", "Chá»‰ Ä‘Æ°á»£c kÃ©o tháº£ Ä‘Æ¡n hÃ ng sang cÃ´t tiáº¿p theo.");
      return;
    }
    moveSelected(order);
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
                  <div
                    key={step}
                    className={`min-h-[560px] border-r border-slate-200 bg-gradient-to-b ${stepStyles[index]} ${dragOverStep === step ? "ring-2 ring-orange-300 ring-inset" : ""}`}
                    onDragLeave={() => {
                      if (dragOverStep === step) setDragOverStep(null);
                    }}
                    onDragOver={(event) => {
                      if (!draggingOrderId) return;
                      event.preventDefault();
                      setDragOverStep(step);
                    }}
                    onDrop={() => {
                      if (!draggingOrderId) return;
                      const order = visibleOrders.find((item) => item.id === draggingOrderId);
                      if (order) {
                        handleDropNextStep(order, step);
                      }
                    }}
                  >
                    <div className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/70 px-3 backdrop-blur">
                      <span className="text-xs font-bold text-slate-800 tracking-tight">{index + 1}. {step}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500">{stepOrders.length}</span>
                    </div>
                    <div className="grid gap-3 p-3">
                      {stepOrders.map((order) => (
                        <KanbanCard
                          key={order.id}
                          order={order}
                          selected={order.id === selectedOrder?.id}
                          onDragEnd={() => {
                            setDraggingOrderId("");
                            setDragOverStep(null);
                          }}
                          onDragStart={() => setDraggingOrderId(order.id)}
                          onSelect={setSelectedOrderId}
                        />
                      ))}
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
            
            // Cập nhật historyLogs khi giao việc - lấy đúng người theo công đoạn hiện tại
            updateOrder(assignOrder.id, (order) => {
              const nowStr = new Date().toISOString();
              const logs = order.historyLogs || [];
              // Xác định người đảm nhận dựa trên công đoạn hiện tại
              function getCorrectAssignee(currentLog: { step: string; assignee: string }): string {
                const step = order.step;
                if (step === "Tiếp nhận" || step === "Báo giá" || step === "Hoàn công") {
                  return patch.saleName || order.saleName || currentLog.assignee;
                } else if (step === "Thiết kế") {
                  return patch.designerName || order.designerName || currentLog.assignee;
                } else if (step === "Ra file") {
                  return patch.fileOperatorName || order.fileOperatorName || currentLog.assignee;
                } else if (step === "Sản xuất") {
                  return patch.productionWorkerName || order.productionWorkerName || currentLog.assignee;
                } else if (step === "Lắp đặt") {
                  return patch.installerName || order.installerName || currentLog.assignee;
                } else if (step === "Nghiệm thu") {
                  return patch.supervisorName || order.supervisorName || patch.installerName || order.installerName || currentLog.assignee;
                }
                return currentLog.assignee;
              }
              const updatedLogs = logs.map(log => 
                log.step === order.step ? { 
                  ...log, 
                  assignee: getCorrectAssignee(log),
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

  // 1. Lấy TOÀN BỘ người thực hiện mỗi công đoạn từ order.*Names (chính xác hơn historyLogs.assignee)
  function getAssigneeListForStep(step: string): string[] {
    switch (step) {
      case "Ti\u1ebfp nh\u1eadn":
      case "B\u00e1o gi\u00e1":
        return order.saleName ? order.saleName.split(",").map((s) => s.trim()).filter(Boolean) : [];
      case "Thi\u1ebft k\u1ebf":
        return ((order.designerNames?.length ? order.designerNames : [order.designerName]) as string[]).filter(Boolean);
      case "Ra file":
        return ((order.fileOperatorNames?.length ? order.fileOperatorNames : [order.fileOperatorName]) as string[]).filter(Boolean);
      case "S\u1ea3n xu\u1ea5t":
        return ((order.productionWorkerNames?.length ? order.productionWorkerNames : [order.productionWorkerName]) as string[]).filter(Boolean);
      case "L\u1eafp \u0111\u1eb7t":
        return ((order.installerNames?.length ? order.installerNames : [order.installerName]) as string[]).filter(Boolean);
      case "Nghi\u1ec7m thu":
      case "Ho\u00e0n c\u00f4ng":
        return ((order.supervisorNames?.length ? order.supervisorNames : [order.supervisorName]) as string[]).filter(Boolean);
      default:
        return [];
    }
  }

  // 2. Tính toán tiền công thợ và ngày công
  let totalLaborCost = 0;
  let totalWorkdays = 0;
  const logsSummary = (order.historyLogs || []).map((log) => {
    const workingHours = calculateWorkingHours(log.startedAt, log.completedAt);
    const assigneeList = getAssigneeListForStep(log.step);
    // Nếu không tìm được ai từ order fields, dùng log.assignee làm fallback
    const finalAssignees = assigneeList.length > 0 ? assigneeList : [log.assignee].filter(Boolean);

    // Tính OT và chi phí riêng cho từng người
    const assigneeDetails = finalAssignees.map((name) => {
      const personOT = overtimeRequests
        .filter((req) => req.orderCode === order.code && req.userDisplayName === name && req.status === "approved")
        .reduce((sum, req) => sum + (req.hours || 0), 0);
      const totalHours = workingHours + personOT;
      const workdays = parseFloat((totalHours / 8).toFixed(2));
      const cost = workdays * 350000;
      totalWorkdays += workdays;
      totalLaborCost += cost;
      return { name, overtimeHours: personOT, workdays, cost };
    });

    return {
      step: log.step,
      startedAt: log.startedAt,
      completedAt: log.completedAt,
      workingHours,
      assignees: assigneeDetails,
    };
  });

  // 3. Chi phí vật tư
  const materialCost = (order.materialsList || []).reduce((sum, mat) => sum + mat.price, 0);

  // 4. Phụ kiện ngoài
  let accessorySales = 0;
  let accessoryCost = 0;
  const accessoriesList = (order.externalAccessories || []).filter((acc) => acc.name.trim()).map((acc) => {
    const cost = acc.actualCost || acc.costPrice || 0;
    accessorySales += acc.sellPrice || 0;
    accessoryCost += cost;
    return acc;
  });

  // 5. Chi phí lắp đặt khác
  const transport = order.installationCosts?.transport || 0;
  const loader = order.installationCosts?.loader || 0;

  // 6. Doanh thu & Lợi nhuận
  const revenue = order.quotation.quoteValue + accessorySales;
  const totalExpenses = totalLaborCost + materialCost + accessoryCost + transport + loader;
  const profit = revenue - totalExpenses;

  // Tạo nội dung báo cáo văn bản
  let reportText = `======================================================
     BAO CAO QUYET TOAN CHI TIET DON HANG: ${order.code}
======================================================

1. THONG TIN KHACH HANG:
   - Khach hang: ${order.customerName}
   - So dien thoai: ${order.phone}
   - Dia chi: ${order.address}
   - Khu vuc: ${order.area}
   - Sale phu trach: ${order.saleName}
   - Thoi gian xuat bao cao: ${new Date().toLocaleString("vi-VN")}

2. LICH SU THUC HIEN CONG DOAN & TIEN CONG THO:
`;

  logsSummary.forEach((log, idx) => {
    const startStr = log.startedAt ? new Date(log.startedAt).toLocaleString("vi-VN") : "Chua ro";
    const endStr = log.completedAt ? new Date(log.completedAt).toLocaleString("vi-VN") : "Dang thuc hien";
    const isManyPeople = log.assignees.length > 1;

    reportText += `   [Moc ${idx + 1}] Cong doan: ${log.step}
         + Thoi gian bat dau: ${startStr}
         + Thoi gian hoan thanh: ${endStr}
         + Gio lam hanh chinh: ${log.workingHours} gio
         + So nguoi thuc hien: ${log.assignees.length} nguoi${isManyPeople ? " (moi nguoi tinh tien rieng)" : ""}
`;

    if (isManyPeople) {
      log.assignees.forEach((person, pIdx) => {
        reportText += `         + Nguoi ${pIdx + 1}: ${person.name}
             - Gio tang ca (OT) duoc duyet: ${person.overtimeHours} gio
             - Ngay cong quy doi: ${person.workdays} cong
             - Tien cong uoc tinh (350.000 d/ngay): ${person.cost.toLocaleString("vi-VN")} d
`;
      });
      const totalStepCost = log.assignees.reduce((s, p) => s + p.cost, 0);
      reportText += `         => Tong tien cong cong doan nay: ${totalStepCost.toLocaleString("vi-VN")} d\n`;
    } else if (log.assignees.length === 1) {
      const person = log.assignees[0];
      reportText += `         + Nguoi dam nhan: ${person.name}
         + Gio tang ca (OT) duoc duyet: ${person.overtimeHours} gio
         + Ngay cong quy doi: ${person.workdays} cong (Tong gio / 8)
         + Tien cong uoc tinh (350.000 d/ngay): ${person.cost.toLocaleString("vi-VN")} d
`;
    } else {
      reportText += `         + Nguoi dam nhan: Chua ghi nhan\n`;
    }
    reportText += "\n";
  });

  reportText += `3. CHI TIET VAT TU & CHI PHI LAP DAT PHU:
   * Danh sach vat tu san xuat:
`;

  if (!order.materialsList || order.materialsList.length === 0) {
    reportText += `     - Khong co vat tu ghi nhan.\n`;
  } else {
    order.materialsList.forEach((mat) => {
      reportText += `     - ${mat.name}: ${mat.price.toLocaleString("vi-VN")} d\n`;
    });
  }

  reportText += `   * Chi phi phu (Giam sat nhap):
     - Tien xe van chuyen: ${transport.toLocaleString("vi-VN")} d
     - Tien thue boc vac: ${loader.toLocaleString("vi-VN")} d

4. CHI TIET PHU KIEN NGOAI:
`;

  if (accessoriesList.length === 0) {
    reportText += `   - Khong co phu kien ngoai nao duoc khai bao.\n`;
  } else {
    accessoriesList.forEach((acc, idx) => {
      reportText += `   [Phu kien ${idx + 1}] ${acc.name}:
         + Gia ban (khach tra): ${acc.sellPrice.toLocaleString("vi-VN")} d
         + Gia von (Ke toan nhap): ${acc.costPrice.toLocaleString("vi-VN")} d
         + Chi phi thuc te: ${acc.actualCost.toLocaleString("vi-VN")} d
`;
    });
  }

  reportText += `
5. TONG HOP DOANH THU, CHI PHI & LOI NHUAN RONG DON HANG:
   - Tong Doanh Thu (Gia bao don hang + Phu kien ngoai): ${revenue.toLocaleString("vi-VN")} d
     + Gia bao don hang: ${order.quotation.quoteValue.toLocaleString("vi-VN")} d
     + Doanh thu phu kien: ${accessorySales.toLocaleString("vi-VN")} d

   - Tong Chi Phi Quyet Toan: ${totalExpenses.toLocaleString("vi-VN")} d
     + Chi phi tien cong tho (${totalWorkdays.toFixed(2)} cong): ${totalLaborCost.toLocaleString("vi-VN")} d
     + Chi phi vat tu san xuat: ${materialCost.toLocaleString("vi-VN")} d
     + Chi phi phu kien ngoai: ${accessoryCost.toLocaleString("vi-VN")} d
     + Chi phi xe co, boc xep: ${(transport + loader).toLocaleString("vi-VN")} d

   - LOI NHUAN RONG DON HANG (Doanh Thu - Chi Phi): ${profit.toLocaleString("vi-VN")} d (${profit >= 0 ? "CO LAI" : "BI THUA LO"})

======================================================
        BAO CAO DUOC PHAT HANH BOI HE THONG GOMITA
======================================================`;

  // Thêm UTF-8 BOM để Notepad/Word hiển thị đúng
  const blob = new Blob(["\uFEFF" + reportText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Quyet-toan-${order.code}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function KanbanCard({
  order,
  selected,
  onSelect,
  onDragStart,
  onDragEnd
}: {
  order: Order;
  selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const status = getWorkStatusMeta(order);
  const workers = getCurrentStepWorkers(order);
  return (
    <button
      className={`group relative rounded-lg border bg-white p-2 text-left shadow-sm transition duration-150 hover:z-20 hover:scale-[1.06] hover:shadow-xl ${selected ? "border-orange-400 ring-2 ring-orange-100" : "border-slate-200"}`}
      draggable
      onClick={() => onSelect(order.id)}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      type="button"
    >
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
            {order.step === "Nghiệm thu" ? (
              canHandle ? (
                <button 
                  className="min-h-11 rounded-lg bg-green-600 font-black text-white hover:bg-green-700 transition animate-pulse" 
                  onClick={() => {
                    const confirmed = globalThis.confirm(`Xác nhận nghiệm thu xong cho đơn hàng ${order.code} và chuyển sang Hoàn công?`);
                    if (confirmed) onApprove(order);
                  }} 
                  type="button"
                >
                  Đã nghiệm thu xong (Chuyển sang Hoàn công)
                </button>
              ) : null
            ) : (
              <button className="min-h-11 rounded-lg bg-orange-500 font-black text-white disabled:bg-slate-300" disabled={!canHandle || order.workStatus === "pending_confirmation" || orderSteps.indexOf(order.step) === orderSteps.length - 1} onClick={() => onMove(order)} type="button">
                {requiresManagerConfirmation(position.id, order) ? "Gửi quản lý xác nhận" : "Chuyển bước"}
              </button>
            )}
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
  currentAccountId,
  currentAccountLevel,
  orders, 
  setOrders,
  overtimeRequests,
  compensationRequests = [],
  onCompensationRequestsChange,
  attendance,
  onAttendanceChange
}: { 
  currentUserName: string; 
  currentAccountId: string;
  currentAccountLevel: any;
  orders: Order[]; 
  setOrders: Dispatch<SetStateAction<Order[]>>;
  overtimeRequests: any[];
  compensationRequests: any[];
  onCompensationRequestsChange: (reqs: any[]) => void;
  attendance: Record<string, string>;
  onAttendanceChange: (att: Record<string, string>) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? "");
  const [flowIndex, setFlowIndex] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [reportedDoneIds, setReportedDoneIds] = useState<string[]>([]);
  const monthDays = useMemo(() => getCurrentMonthDaysForWorker(), []);
  
  const workerAttendance = useMemo(() => {
    const data: Record<string, WorkerAttendanceKind> = {};
    monthDays.forEach((day) => {
      const d = day.getDate();
      attendanceSlots.forEach((slot) => {
        const key = `${currentAccountId}-${d}-${slot}`;
        if (attendance[key]) {
          data[`${d}-${slot}`] = attendance[key] as WorkerAttendanceKind;
        }
      });
    });
    return data;
  }, [attendance, currentAccountId, monthDays]);

  const [clockMessage, setClockMessage] = useState("");
  const workerOrders = orders;
  const selectedOrder = workerOrders.find((order) => order.id === selectedOrderId) ?? workerOrders[0];
  
  const currentSlot = useMemo(() => {
    return attendanceSlots.find((slot) => isSlotOpen(slot, currentTime)) ?? "07:30";
  }, [currentTime]);

  const slotWindow = getSlotWindow(currentSlot);
  const needsEndOfShiftQuestion = currentSlot === "11:30" || currentSlot === "17:30";

  const isSlotCurrentlyOpen = useMemo(() => {
    return attendanceSlots.some((slot) => isSlotOpen(slot, currentTime));
  }, [currentTime]);

  // Lọc các đơn thợ thực tế đang làm việc
  const activeWorkingOrders = useMemo(() => {
    return workerOrders.filter(o => o.workStatus === "working");
  }, [workerOrders]);

  const today = new Date().getDate();
  const hasClockedInCurrentSlot = useMemo(() => {
    return workerAttendance[`${today}-${currentSlot}`] === "normal" || workerAttendance[`${today}-${currentSlot}`] === "compensated";
  }, [workerAttendance, today, currentSlot]);

  // Tìm ngày (dayNum) gần nhất đã chấm công bù (hoặc đã gửi yêu cầu chấm công bù) trong tháng
  const latestCompDay = useMemo(() => {
    let maxDay = 0;
    
    // 1. Kiểm tra trong dữ liệu chấm công thực tế
    Object.keys(workerAttendance).forEach(key => {
      const parts = key.split("-");
      if (parts.length === 2) {
        const dayNum = Number(parts[0]);
        if (workerAttendance[key] === "compensated") {
          if (dayNum > maxDay) {
            maxDay = dayNum;
          }
        }
      }
    });

    // 2. Kiểm tra trong danh sách yêu cầu chấm công bù
    const workerReqs = compensationRequests.filter(req => req.employeeId === currentAccountId);
    workerReqs.forEach(req => {
      const reqDate = new Date(req.date);
      const now = new Date();
      if (reqDate.getMonth() === now.getMonth() && reqDate.getFullYear() === now.getFullYear()) {
        if (reqDate.getDate() > maxDay) {
          maxDay = reqDate.getDate();
        }
      }
    });

    return maxDay;
  }, [workerAttendance, compensationRequests, currentAccountId]);

  // Lọc các mốc thiếu công thông minh (khóa toàn bộ ngày trước mốc chấm công bù gần nhất)
  const missingSlots = useMemo(() => {
    const list: Array<{ date: string; slot: AttendanceSlot; isIgnored: boolean }> = [];
    const today = new Date().getDate();
    monthDays.forEach((day) => {
      // Chỉ tính các ngày từ đầu tháng tới hôm nay
      if (day.getDay() === 0 || day.getDate() > today) return;
      attendanceSlots.forEach((slot) => {
        const key = `${day.getDate()}-${slot}`;
        // Nếu chưa chấm công thành công (normal) hoặc chấm công bù (compensated)
        if (!workerAttendance[key]) {
          const dayNum = day.getDate();
          // Khóa toàn bộ những ngày trước mốc chấm công bù gần nhất (Xác định là ngày nghỉ)
          const isIgnored = latestCompDay > 0 && dayNum < latestCompDay;
          list.push({
            date: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
            slot,
            isIgnored
          });
        }
      });
    });
    return list;
  }, [monthDays, workerAttendance, latestCompDay]);

  const hasMissing = useMemo(() => {
    return missingSlots.filter(item => !item.isIgnored).length > 0;
  }, [missingSlots]);

  // Lọc các ngày thiếu công độc nhất để làm cột cho bảng chọn trong Modal
  const uniqueMissingDays = useMemo(() => {
    const daysMap = new Map<number, Date>();
    monthDays.forEach(day => {
      const dayNum = day.getDate();
      const hasMissingInDay = attendanceSlots.some(slot => !workerAttendance[`${dayNum}-${slot}`]);
      if (hasMissingInDay && day.getDay() !== 0 && dayNum <= today) {
        daysMap.set(dayNum, day);
      }
    });
    return Array.from(daysMap.values()).sort((a, b) => a.getDate() - b.getDate());
  }, [monthDays, workerAttendance, today]);

  // Quản lý Modal Chấm Công Bù Thông Minh
  const [compOpen, setCompOpen] = useState(false);
  const [compReason, setCompReason] = useState("");
  const [selectedCompSlots, setSelectedCompSlots] = useState<Array<{ date: string; slot: AttendanceSlot }>>([]);

  function markAttendance(kind: WorkerAttendanceKind, day = new Date().getDate(), slot = currentSlot) {
    const key = `${currentAccountId}-${day}-${slot}`;
    onAttendanceChange({ ...attendance, [key]: kind });
  }

  function submitCompensations() {
    if (selectedCompSlots.length === 0 || !compReason.trim()) return;

    // Group selected slots by date
    const grouped: Record<string, AttendanceSlot[]> = {};
    selectedCompSlots.forEach(item => {
      if (!grouped[item.date]) {
        grouped[item.date] = [];
      }
      grouped[item.date].push(item.slot);
    });

    const submissionSize = selectedCompSlots.length;
    const requiredApprovals = getRequiredApprovals(currentAccountLevel, submissionSize);

    const groupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newRequests = Object.entries(grouped).map(([date, slots], idx) => {
      return {
        id: `comp-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
        groupId,
        employeeId: currentAccountId,
        employeeName: currentUserName,
        employeePositionLevel: currentAccountLevel,
        date,
        slots,
        reason: compReason.trim(),
        missingCountInMonth: submissionSize,
        requiredApprovals,
        approvals: [],
        status: "pending",
        createdAt: new Date().toISOString()
      };
    });

    onCompensationRequestsChange([...newRequests, ...compensationRequests]);

    setCompOpen(false);
    setSelectedCompSlots([]);
    setCompReason("");

    let approvalText = "Nhân sự xác nhận";
    if (submissionSize > 8) {
      approvalText = "Nhân sự, Quản lý và Giám đốc xác nhận (do trên 8 mốc trong đơn này)";
    } else if (submissionSize >= 4) {
      approvalText = "Nhân sự và Quản lý xác nhận (do từ 4-8 mốc trong đơn này)";
    }

    // Hiển thị chính xác thông báo thành công theo mẫu
    alert(
      `Yêu cầu chấm công bù của bạn đã được gửi đi.\n` +
      `● Số mốc đăng ký bù: ${submissionSize} mốc\n` +
      `● Cấp phê duyệt cần thiết: ${approvalText}\n\n` +
      `Nếu không được xác nhận, liên hệ với nhân sự và quản lý để được xác nhận nhé.\n` +
      `Sau bạn nhớ chấm công đúng giờ để đảm bảo quyền lợi của mình.\n` +
      `Cảm ơn!`
    );
    setClockMessage(`Yêu cầu chấm công bù đã được gửi thành công. Cần: ${approvalText}.`);
  }

  function handleReportDone() {
    if (!selectedOrder) return;
    const confirmed = globalThis.confirm(`Bạn có chắc chắn muốn báo cáo hoàn thành cho đơn hàng ${selectedOrder.code} không?`);
    if (!confirmed) return;
    setReportedDoneIds(curr => [...curr, selectedOrder.id]);
    setOrders(curr => curr.map(o => o.id === selectedOrder.id ? requestStepConfirmation(o, currentUserName, "Thợ báo xong từ màn hình chính") : o));
    alert(`Đã gửi báo cáo hoàn thành đơn hàng ${selectedOrder.code} tới giám sát/quản lý phê duyệt.`);
  }

  function answerWork(done: boolean) {
    if (flowIndex === null) return;
    const order = activeWorkingOrders[flowIndex];
    if (done && order) {
      setReportedDoneIds((current) => current.includes(order.id) ? current : [...current, order.id]);
      setOrders((current) => current.map((item) => item.id === order.id ? requestStepConfirmation(item, currentUserName, "Báo xong khi chấm công cuối buổi") : item));
    }
    const nextIndex = flowIndex + 1;
    if (nextIndex < activeWorkingOrders.length) {
      setFlowIndex(nextIndex);
      return;
    }
    setFlowIndex(null);
    setCameraReady(true);
  }

  if (!mounted) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
        <p className="mt-4 text-sm font-bold text-slate-500">Đang tải không gian làm việc của thợ...</p>
      </div>
    );
  }

  return (
    <section className="grid gap-6 text-slate-900 pb-24">
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
            Mốc chấm công tiếp theo: <strong className="text-slate-800">{currentSlot}</strong> ({formatTime(slotWindow.opensAt)} - {formatTime(slotWindow.closesAt)})
          </div>
        </div>

        {isSlotCurrentlyOpen ? (
          hasClockedInCurrentSlot ? (
            <div className="rounded-xl border border-green-200 bg-emerald-50/50 p-6 text-center shadow-sm flex flex-col justify-center items-center text-slate-900 w-full min-h-[220px]">
              <CheckCircle2 className="h-12 w-12 text-green-600 mb-2 animate-bounce" />
              <h3 className="font-black text-slate-800 text-lg">ĐÃ HOÀN THÀNH CHẤM CÔNG</h3>
              <p className="text-xs text-green-700 font-semibold mt-2">
                Hệ thống đã ghi nhận chấm công mốc {currentSlot} thành công!
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Chúc bạn một ngày làm việc hiệu quả và an toàn.
              </p>
              
              {hasMissing && (
                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
                  Nếu còn thiếu công, hãy chấm công trên điện thoại để hệ thống hỏi đăng ký bù công.
                </div>
              )}

              {/* Báo cáo hoàn thành đơn hàng */}
              {selectedOrder && (
                <button 
                  className={`mt-4 flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl font-black transition text-sm ${
                    selectedOrder.workStatus === "pending_confirmation"
                      ? "bg-amber-100 text-amber-700 border border-amber-300 cursor-not-allowed"
                      : "bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600"
                  }`}
                  disabled={selectedOrder.workStatus === "pending_confirmation"}
                  onClick={handleReportDone}
                  type="button"
                >
                  <Check className="h-5 w-5" />
                  {selectedOrder.workStatus === "pending_confirmation" 
                    ? "ĐÃ BÁO CÁO XONG (CHỜ DUYỆT)" 
                    : "BÁO CÁO HOÀN THÀNH CÔNG VIỆC"}
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-6 text-center shadow-sm flex min-h-[220px] flex-col items-center justify-center text-slate-900 w-full">
              <Phone className="h-12 w-12 text-blue-600 mb-3" />
              <h3 className="font-black text-slate-800 text-lg">Chấm công chỉ thực hiện trên điện thoại</h3>
              <p className="mt-2 text-sm font-semibold text-blue-700">
                Mốc hiện tại: {currentSlot} ({formatTime(slotWindow.opensAt)} - {formatTime(slotWindow.closesAt)})
              </p>
              <p className="mt-3 max-w-md text-xs font-bold text-slate-500">
                Trên web chỉ theo dõi bảng công và công việc. Hãy dùng ứng dụng điện thoại để chấm công, chấm công bù và chụp ảnh GPS.
              </p>
              {selectedOrder && (
                <button
                  className={`mt-5 flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl font-black transition text-sm ${
                    selectedOrder.workStatus === "pending_confirmation"
                      ? "bg-amber-100 text-amber-700 border border-amber-300 cursor-not-allowed"
                      : "bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600"
                  }`}
                  disabled={selectedOrder.workStatus === "pending_confirmation"}
                  onClick={handleReportDone}
                  type="button"
                >
                  <Check className="h-5 w-5" />
                  {selectedOrder.workStatus === "pending_confirmation"
                    ? "ĐÃ BÁO CÁO XONG (CHỜ DUYỆT)"
                    : "BÁO CÁO HOÀN THÀNH CÔNG VIỆC"}
                </button>
              )}
            </div>
          )
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center shadow-sm flex flex-col justify-center items-center text-slate-500 w-full min-h-[220px]">
            <Clock className="h-10 w-10 text-slate-400 mb-3" />
            <h3 className="font-black text-slate-700 text-lg">Ngoài khung giờ chấm công</h3>
            <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
              Mỗi mốc chấm công chỉ mở trước 15 phút và đóng sau 1 tiếng của các khung giờ quy định:
            </p>
            <div className="mt-3 flex flex-wrap gap-2 justify-center text-xs font-bold text-slate-500">
              <span className="bg-slate-200/80 px-2.5 py-1 rounded-md">07:30</span>
              <span className="bg-slate-200/80 px-2.5 py-1 rounded-md">11:30</span>
              <span className="bg-slate-200/80 px-2.5 py-1 rounded-md">13:30</span>
              <span className="bg-slate-200/80 px-2.5 py-1 rounded-md">17:30</span>
            </div>
            
            {/* Vẫn cho phép thợ báo cáo hoàn thành đơn hàng độc lập */}
            {selectedOrder && (
              <button 
                className={`mt-5 flex min-h-11 w-full max-w-xs items-center justify-center gap-2 rounded-xl font-black transition text-xs ${
                  selectedOrder.workStatus === "pending_confirmation"
                    ? "bg-amber-100 text-amber-700 border border-amber-300 cursor-not-allowed"
                    : "bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600"
                }`}
                disabled={selectedOrder.workStatus === "pending_confirmation"}
                onClick={handleReportDone}
                type="button"
              >
                <Check className="h-4 w-4" />
                {selectedOrder.workStatus === "pending_confirmation" 
                  ? "ĐÃ BÁO CÁO XONG (CHỜ DUYỆT)" 
                  : "BÁO CÁO HOÀN THÀNH CÔNG VIỆC"}
              </button>
            )}
          </div>
        )}
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
            <h4 className="font-black text-slate-800 mb-3">Trạng thái công việc</h4>
            <div className="text-sm bg-slate-50 p-4 rounded-lg border">
              Trạng thái đơn hàng: <strong className="text-slate-800">{getWorkStatusMeta(selectedOrder).label}</strong>
              {selectedOrder.workStatus === "pending_confirmation" ? (
                <p className="mt-2 font-semibold text-amber-600">● Đơn đang chờ Giám sát hoặc Quản lý xưởng phê duyệt chuyển bước.</p>
              ) : (
                <p className="mt-2 font-semibold text-green-600">● Bạn đang thực hiện công việc này. Bấm nút "BÁO CÁO HOÀN THÀNH CÔNG VIỆC" ở góc trên khi làm xong nhé.</p>
              )}
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
        <WorkerAttendanceGrid monthDays={monthDays} attendance={workerAttendance} />
      </div>

      {flowIndex !== null ? (
        <ConfirmCard index={`${flowIndex + 1}/${activeWorkingOrders.length}`} orderCode={activeWorkingOrders[flowIndex]?.code ?? ""} onAnswer={answerWork} finalQuestion={flowIndex === activeWorkingOrders.length - 1} />
      ) : null}

      {/* 2. & 3. MODAL CHẤM CÔNG BÙ THÔNG MINH */}
      {compOpen ? (
        <Modal title="Đăng ký chấm công bù" onClose={() => setCompOpen(false)}>
          <div className="grid gap-4 max-h-[76vh] overflow-y-auto pr-1 text-slate-900">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 font-bold">
              Chỉ được chấm công bù các mốc trong vòng 3 ngày gần nhất. Các mốc cũ hơn sẽ bị hệ thống tự động khóa.
            </div>

             <div>
               <div className="mb-2 font-black text-sm text-slate-700">Các mốc thiếu công trong tháng (Chọn trực tiếp trên bảng)</div>
               {uniqueMissingDays.length === 0 ? (
                 <div className="text-center py-6 text-slate-400 italic">Tuyệt vời! Bạn không thiếu mốc chấm công nào.</div>
               ) : (
                 <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                   <div className="min-w-[500px] p-1">
                     <table className="w-full border-collapse text-xs text-center text-slate-800">
                       <thead>
                         <tr className="bg-slate-50 border-b border-slate-200">
                           <th className="p-2 text-left font-black text-slate-600 min-w-[90px]">Mốc giờ</th>
                           {uniqueMissingDays.map((day) => (
                             <th key={day.toISOString()} className="p-2 font-black text-slate-600">
                               {day.getDate()}/{day.getMonth() + 1}
                             </th>
                           ))}
                         </tr>
                       </thead>
                       <tbody>
                         {attendanceSlots.map((slot) => (
                           <tr key={slot} className="border-b border-slate-100 hover:bg-slate-50/50">
                             <td className="p-2 text-left font-black text-slate-700">{slot}</td>
                             {uniqueMissingDays.map((day) => {
                               const dayNum = day.getDate();
                               const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                               const kind = workerAttendance[`${dayNum}-${slot}`];
                               const dayDiff = today - dayNum;
                               const isLocked = dayDiff > 3;

                               if (kind === "normal" || kind === "compensated") {
                                 return (
                                   <td key={dayNum} className="p-2">
                                     <span className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700">
                                       <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                       Đã chấm
                                     </span>
                                   </td>
                                 );
                               }

                               if (isLocked) {
                                 return (
                                   <td key={dayNum} className="p-2">
                                     <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-[10px] font-bold text-red-400">
                                       <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                                       Khóa
                                     </span>
                                   </td>
                                 );
                               }

                               // Cho phép bù -> Ô tương tác được
                               const isChecked = selectedCompSlots.some(s => s.date === dateStr && s.slot === slot);
                               return (
                                 <td key={dayNum} className="p-2">
                                   <button
                                     type="button"
                                     onClick={() => {
                                       if (isChecked) {
                                         setSelectedCompSlots(curr => curr.filter(s => !(s.date === dateStr && s.slot === slot)));
                                       } else {
                                         setSelectedCompSlots(curr => [...curr, { date: dateStr, slot }]);
                                       }
                                     }}
                                     className={`w-full min-h-[34px] rounded-lg border text-center transition flex flex-col justify-center items-center font-bold px-1 py-0.5 ${
                                       isChecked
                                         ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                         : "bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100"
                                     }`}
                                   >
                                     <span className="text-[10px]">{isChecked ? "✓ Chọn" : "Bù"}</span>
                                   </button>
                                 </td>
                                );
                             })}
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
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

function ClockCard({ 
  currentSlot, 
  windowText, 
  cameraReady, 
  needsQuestion, 
  onStart, 
  onCapture,
  selectedOrder,
  onReportDone
}: { 
  currentSlot: string; 
  windowText: string; 
  cameraReady: boolean; 
  needsQuestion: boolean; 
  onStart: () => void; 
  onCapture: () => void;
  selectedOrder?: Order;
  onReportDone?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    if (cameraReady) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
        .then((s) => {
          setStream(s);
          setCameraError(false);
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch((err) => {
          console.warn("Camera warning:", err);
          setCameraError(true);
        });
    } else {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraReady]);

  return (
    <div className="rounded-xl border border-green-200 bg-emerald-50/50 p-6 text-center shadow-sm flex flex-col justify-center items-center text-slate-900 w-full">
      <h3 className="font-black text-slate-800 text-lg">Chấm công mốc hiện tại</h3>
      <div className="mt-3 text-5xl font-black text-green-600">{currentSlot}</div>
      <div className="mt-3 flex items-center justify-center gap-1.5 text-sm text-green-700 font-semibold"><CheckCircle2 className="h-4 w-4 text-green-600" />Đang trong giờ ({windowText})</div>
      
      {cameraReady && (
        <div className="mt-4 overflow-hidden rounded-lg border-2 border-green-500 bg-black w-full max-w-[280px] aspect-[4/3] relative flex items-center justify-center">
          {cameraError ? (
            <div className="p-4 text-xs font-bold text-red-500 bg-white w-full h-full flex flex-col justify-center items-center">
              <AlertTriangle className="h-8 w-8 text-red-500 mb-2 animate-bounce" />
              <span>Không mở được camera trực tiếp.</span>
              <span className="text-[10px] text-slate-400 mt-1">Vui lòng kiểm tra quyền camera của trình duyệt.</span>
            </div>
          ) : (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover scale-x-[-1]" 
            />
          )}
        </div>
      )}

      <button className="mt-5 flex min-h-14 w-full max-w-xs items-center justify-center gap-3 rounded-xl bg-green-600 text-xl font-black text-white shadow-lg shadow-green-600/20 hover:bg-green-700 transition" onClick={cameraReady ? onCapture : onStart} type="button">
        <Camera className="h-6 w-6" />
        {cameraReady ? "CHỤP ẢNH" : "CHẤM CÔNG"}
      </button>
      <div className="mt-2 text-xs text-slate-500">{cameraReady ? "Vui lòng chụp ảnh khuôn mặt." : needsQuestion ? "Cần báo cáo trạng thái đơn hàng trước khi chụp ảnh." : "Nhấp nút Chấm công."}</div>
      
      {selectedOrder && onReportDone && (
        <button 
          className={`mt-4 flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl font-black transition text-sm ${
            selectedOrder.workStatus === "pending_confirmation"
              ? "bg-amber-100 text-amber-700 border border-amber-300 cursor-not-allowed"
              : "bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600"
          }`}
          disabled={selectedOrder.workStatus === "pending_confirmation"}
          onClick={onReportDone}
          type="button"
        >
          <Check className="h-5 w-5" />
          {selectedOrder.workStatus === "pending_confirmation" 
            ? "ĐÃ BÁO CÁO XONG (CHỜ DUYỆT)" 
            : "BÁO CÁO HOÀN THÀNH CÔNG VIỆC"}
        </button>
      )}
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

function formatTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
