import { canSeePricing, isCompanyWideOrderRole } from "@/modules/hr/roles";

export const orderSteps = [
  "Tiếp nhận",
  "Thiết kế",
  "Báo giá",
  "Ra file",
  "Sản xuất",
  "Lắp đặt",
  "Nghiệm thu",
  "Hoàn công"
] as const;

export type OrderStep = (typeof orderSteps)[number];
export type OrderPriority = "normal" | "warning" | "urgent";
export type OrderStatus = "active" | "canceled" | "archived";
export type WorkStatus = "working" | "pending_confirmation" | "unconfirmed";

export type Order = {
  id: string;
  code: string;
  customerName: string;
  area: string;
  phone: string;
  address: string;
  step: OrderStep;
  assignee: string;
  saleName: string;
  designerName: string;
  designerNames?: string[];
  fileOperatorName: string;
  fileOperatorNames?: string[];
  workshopManagerName: string;
  supervisorName: string;
  supervisorNames?: string[];
  productionWorkerName: string;
  productionWorkerNames?: string[];
  installerName: string;
  installerNames?: string[];
  assignedInstallerDate?: string;
  deadline: string;
  progressPercent: 0 | 10 | 35 | 60 | 90 | 100;
  priority: OrderPriority;
  status: OrderStatus;
  workStatus: WorkStatus;
  pendingStep?: OrderStep;
  pendingBy?: string;
  pendingReason?: string;
  assignedTaskNote?: string;
  canceledReason?: string;
  canceledBy?: string;
  canceledAt?: string;
  canceledStep?: OrderStep;
  finalNote: string;
  volume: string;
  customerRequest: string;
  materialNote: string;
  colorNote: string;
  styleNote: string;
  preliminaryContent: string;
  customerInitialRequest: string;
  customerWish: string;
  survey: {
    floor: string;
    stairWidth: string;
    elevatorWidth: string;
    carDistance: string;
  };
  quotation: {
    estimateValue: number;
    quoteValue: number;
    estimatePhotoUploaded: boolean;
    quotePhotoUploaded: boolean;
    estimateEditCount?: number;
    quoteEditCount?: number;
  };
  checklist: {
    designFileSent: boolean;
    renderPhotoSent: boolean;
    preliminaryVolumeDone: boolean;
    fileAccepted: boolean;
    cncSentToZalo: boolean;
    workshopConfirmed: boolean;
    paymentCollected: boolean;
  };
  externalAccessories?: Array<{ name: string; sellPrice: number; costPrice: number; actualCost: number }>;
  installationCosts?: { transport: number; loader: number };
  materialsList?: Array<{ name: string; price: number }>;
  incurredCosts?: Array<{ note: string; amount: number }>;
  historyLogs?: Array<{ step: OrderStep; assignee: string; startedAt?: string; completedAt?: string; acceptedAt?: string; }>;
  customLaborCost?: number;
};


export type CreateOrderInput = {
  customerName: string;
  area: string;
  phone: string;
  address: string;
  createdByPositionId: string;
  assignedSaleName: string;
};

const baseAssignment = {
  saleName: "Nguyễn Thị Sale",
  designerName: "Hoàng Văn Thiết Kế",
  fileOperatorName: "Phạm Văn Ra File",
  workshopManagerName: "Nguyễn Văn Quản Đốc",
  supervisorName: "Phạm Văn Giám Sát",
  productionWorkerName: "Trần Văn Sản Xuất",
  installerName: "Lê Văn Lắp Đặt"
};

const emptyAssignment = {
  saleName: "",
  designerName: "",
  fileOperatorName: "",
  workshopManagerName: "",
  supervisorName: "",
  productionWorkerName: "",
  installerName: ""
};

const completeRequiredInfo = {
  volume: "Thi công nội thất phòng khách, bếp, 3 phòng ngủ.",
  customerRequest: "Gỗ MDF An Cường, màu sáng, thi công gọn sạch.",
  materialNote: "MDF chống ẩm An Cường.",
  colorNote: "Tông trắng kem phối vân gỗ sáng.",
  styleNote: "Hiện đại, ít tay nắm, dễ vệ sinh.",
  preliminaryContent: "Nội thất căn hộ đầy đủ phòng khách, bếp và phòng ngủ.",
  customerInitialRequest: "Cần thiết kế tối ưu diện tích, nhiều khoang chứa đồ.",
  customerWish: "Muốn hoàn thiện trước khi nhận nhà và giữ hiện trường sạch.",
  survey: { floor: "Tầng 12", stairWidth: "1.2m", elevatorWidth: "1.1m", carDistance: "20m" }
};

const completeChecklist = {
  designFileSent: true,
  renderPhotoSent: true,
  preliminaryVolumeDone: true,
  fileAccepted: true,
  cncSentToZalo: true,
  workshopConfirmed: true,
  paymentCollected: true
};

function makeDemoOrder(input: {
  id: string;
  code: string;
  customerName: string;
  area: string;
  phone: string;
  address: string;
  step: OrderStep;
  deadline: string;
  progressPercent: Order["progressPercent"];
  priority?: OrderPriority;
  paymentCollected?: boolean;
}): Order {
  // Tạo log lịch sử demo cho các công đoạn trước
  const historyLogs: Order["historyLogs"] = [
    { step: "Tiếp nhận", assignee: baseAssignment.saleName, startedAt: "2026-05-20T13:30:00.000Z", completedAt: "2026-05-21T09:30:00.000Z" },
    { step: "Thiết kế", assignee: baseAssignment.designerName, startedAt: "2026-05-21T13:30:00.000Z", completedAt: "2026-05-22T15:30:00.000Z" },
    { step: "Báo giá", assignee: baseAssignment.saleName, startedAt: "2026-05-22T16:00:00.000Z", completedAt: "2026-05-23T10:00:00.000Z" }
  ];

  if (getStepIndex(input.step) >= getStepIndex("Ra file")) {
    historyLogs.push({ step: "Ra file", assignee: baseAssignment.fileOperatorName, startedAt: "2026-05-23T13:30:00.000Z", completedAt: "2026-05-24T16:00:00.000Z" });
  }
  if (getStepIndex(input.step) >= getStepIndex("Sản xuất")) {
    historyLogs.push({ step: "Sản xuất", assignee: baseAssignment.productionWorkerName, startedAt: "2026-05-25T07:30:00.000Z", completedAt: "2026-05-26T17:30:00.000Z" });
  }
  if (getStepIndex(input.step) >= getStepIndex("Lắp đặt")) {
    historyLogs.push({ step: "Lắp đặt", assignee: baseAssignment.installerName, startedAt: "2026-05-27T07:30:00.000Z", completedAt: "2026-05-28T11:30:00.000Z" });
  }

  // Luôn bắt đầu log cho công đoạn hiện tại nếu chưa hoàn thành
  historyLogs.push({ step: input.step, assignee: getAssignedNames({ step: input.step } as any, input.step === "Hoàn công" ? "sale" : input.step === "Nghiệm thu" ? "installer" : input.step)[0] || baseAssignment.saleName, startedAt: new Date(Date.now() - 3600000 * 4).toISOString() });

  const accessories: Order["externalAccessories"] = Array.from({ length: 10 }, (_, i) => ({
    name: i < 3 ? `Phụ kiện ${i + 1}` : "",
    sellPrice: i < 3 ? (i + 1) * 150000 : 0,
    costPrice: i < 3 ? (i + 1) * 100000 : 0,
    actualCost: i < 3 ? (i + 1) * 105000 : 0
  }));

  return {
    ...baseAssignment,
    ...completeRequiredInfo,
    id: input.id,
    code: input.code,
    customerName: input.customerName,
    area: input.area,
    phone: input.phone,
    address: input.address,
    step: input.step,
    assignee: baseAssignment.saleName,
    designerNames: [baseAssignment.designerName],
    fileOperatorNames: [baseAssignment.fileOperatorName],
    supervisorNames: [baseAssignment.supervisorName],
    productionWorkerNames: [baseAssignment.productionWorkerName],
    installerNames: [baseAssignment.installerName],
    deadline: input.deadline,
    progressPercent: input.progressPercent,
    priority: input.priority ?? "normal",
    status: "active",
    workStatus: "working",
    finalNote: "Theo dõi sát tiến độ và cập nhật khi khách thay đổi yêu cầu.",
    quotation: { estimateValue: 350000000, quoteValue: 385000000, estimatePhotoUploaded: true, quotePhotoUploaded: true },
    checklist: { ...completeChecklist, paymentCollected: input.paymentCollected ?? input.step === "Hoàn công" },
    externalAccessories: accessories,
    installationCosts: { transport: 0, loader: 0 },
    materialsList: [
      { name: "Gỗ MDF chống ẩm An Cường", price: 15000000 },
      { name: "Bản lề hơi giảm chấn", price: 2400000 }
    ],
    historyLogs
  };
}

export const demoOrders: Order[] = [];

export function createOrderCode(customerName: string, area: string, phone: string, existingCodes: string[]) {
  const base = `${normalizeCodePart(customerName)}-${normalizeCodePart(area)}-${phone.replace(/\D/g, "").slice(-3)}`;
  if (!existingCodes.includes(base)) return base;

  let suffix = 2;
  while (existingCodes.includes(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function validateCreateOrder(input: CreateOrderInput) {
  const issues: string[] = [];
  if (!input.customerName.trim()) issues.push("Tên khách hàng là bắt buộc.");
  if (!input.address.trim()) issues.push("Địa chỉ là bắt buộc.");
  if (!input.phone.trim()) issues.push("Số điện thoại là bắt buộc.");
  if (!input.assignedSaleName.trim()) issues.push("Vui lòng chọn ít nhất một nhân viên Sale phụ trách.");
  return issues;
}

export function buildOrder(input: CreateOrderInput, existingCodes: string[]): Order {
  const code = createOrderCode(input.customerName, input.area || input.address, input.phone, existingCodes);
  const saleName = input.assignedSaleName.trim();
  const nowStr = new Date().toISOString();
  return {
    ...makeDemoOrder({
      id: `new-${Date.now()}`,
      code,
      customerName: input.customerName.trim(),
      area: input.area.trim() || "Chưa rõ",
      phone: input.phone.trim(),
      address: input.address.trim(),
      step: "Tiếp nhận",
      deadline: "Chưa đặt",
      progressPercent: 10
    }),
    saleName,
    assignee: saleName,
    designerName: emptyAssignment.designerName,
    fileOperatorName: emptyAssignment.fileOperatorName,
    workshopManagerName: emptyAssignment.workshopManagerName,
    supervisorName: emptyAssignment.supervisorName,
    productionWorkerName: emptyAssignment.productionWorkerName,
    installerName: emptyAssignment.installerName,
    designerNames: [],
    fileOperatorNames: [],
    supervisorNames: [],
    productionWorkerNames: [],
    installerNames: [],
    volume: "",
    customerRequest: "",
    materialNote: "",
    colorNote: "",
    styleNote: "",
    preliminaryContent: "",
    customerInitialRequest: "",
    customerWish: "",
    survey: { floor: "", stairWidth: "", elevatorWidth: "", carDistance: "" },
    quotation: { estimateValue: 0, quoteValue: 0, estimatePhotoUploaded: false, quotePhotoUploaded: false },
    checklist: {
      designFileSent: false,
      renderPhotoSent: false,
      preliminaryVolumeDone: false,
      fileAccepted: false,
      cncSentToZalo: false,
      workshopConfirmed: false,
      paymentCollected: false
    },
    externalAccessories: Array.from({ length: 10 }, () => ({ name: "", sellPrice: 0, costPrice: 0, actualCost: 0 })),
    materialsList: [],
    workStatus: "working",
    historyLogs: [
      { step: "Tiếp nhận", assignee: saleName, startedAt: nowStr }
    ]
  };
}

export function getStepIndex(step: OrderStep) {
  return orderSteps.indexOf(step);
}

export function getTransitionIssues(order: Order) {
  const issues: string[] = [];

  if (order.step === "Tiếp nhận") {
    if (!order.volume.trim()) issues.push("Thiếu nội dung/hạng mục công việc.");
    if (!order.address.trim()) issues.push("Thiếu địa chỉ.");
    if (!order.phone.trim()) issues.push("Thiếu số điện thoại.");
  }

  if (order.step === "Thiết kế") {
    if (!order.colorNote.trim()) issues.push("Thiếu thông tin khách muốn màu gì.");
    if (!order.styleNote.trim()) issues.push("Thiếu phong cách thiết kế.");
    if (!order.preliminaryContent.trim()) issues.push("Thiếu nội dung công trình.");
    if (!order.customerInitialRequest.trim() && !order.customerRequest.trim()) issues.push("Thiếu yêu cầu của khách.");
    if (!order.customerWish.trim()) issues.push("Thiếu tâm tư, mong muốn của khách.");
    if (!order.survey.floor.trim()) issues.push("Thiếu thông tin làm ở tầng mấy.");
    if (!order.survey.stairWidth.trim()) issues.push("Thiếu chiều rộng cầu thang.");
    if (!order.survey.elevatorWidth.trim()) issues.push("Thiếu chiều rộng thang máy hoặc ghi không có.");
    if (!order.survey.carDistance.trim()) issues.push("Thiếu khoảng cách ô tô đỗ tới cửa nhà khách.");
    if (!order.checklist.designFileSent) issues.push("Chưa tích đã gửi file lên nhóm.");
    if (!order.checklist.renderPhotoSent) issues.push("Chưa tích đã gửi ảnh render đẹp nhất.");
    if (!order.checklist.preliminaryVolumeDone) issues.push("Chưa tích đã lên khối lượng dự toán sơ bộ.");
  }

  if (order.step === "Báo giá") {
    if (!order.customerName.trim()) issues.push("Thiếu thông tin khách hàng.");
    if (!order.volume.trim()) issues.push("Thiếu thông tin đơn hàng.");
    if (!order.saleName.trim()) issues.push("Thiếu Sale phụ trách.");
    if (!order.quotation.estimateValue) issues.push("Chưa nhập dự toán.");
    if (!order.quotation.quoteValue) issues.push("Chưa nhập báo giá.");
    if (!order.quotation.estimatePhotoUploaded) issues.push("Chưa có ảnh dự toán.");
    if (!order.quotation.quotePhotoUploaded) issues.push("Chưa có ảnh báo giá.");
  }

  if (order.step === "Ra file") {
    if (!order.checklist.fileAccepted) issues.push("Ra file chưa nhận/hoàn thành việc.");
    if (!order.checklist.cncSentToZalo) issues.push("Chưa xác nhận đã gửi CNC lên nhóm Zalo.");
    if (!order.checklist.workshopConfirmed) issues.push("Quản lý xưởng chưa xác nhận.");
  }

  if (order.step === "Sản xuất") {
    if (!order.productionWorkerName.trim()) issues.push("Chưa có thợ sản xuất.");
    if (!order.volume.trim()) issues.push("Thiếu thông tin sản xuất.");
  }

  if (order.step === "Lắp đặt") {
    if (!order.installerName.trim()) issues.push("Chưa có thợ lắp đặt.");
    if (!order.finalNote.trim()) issues.push("Thiếu ghi chú lắp đặt.");
  }

  if (order.step === "Hoàn công" && !order.checklist.paymentCollected) {
    issues.push("Kế toán chưa xác nhận thu đủ tiền.");
  }

  return issues;
}

export function canMoveToNextStep(order: Order) {
  return order.workStatus !== "pending_confirmation" && getStepIndex(order.step) < orderSteps.length - 1 && getTransitionIssues(order).length === 0;
}

export function moveToNextStep(order: Order): Order {
  const nextStep = orderSteps[getStepIndex(order.step) + 1];
  if (!nextStep) return order;

  const nowStr = new Date().toISOString();
  const updatedLogs = (order.historyLogs || []).map(log => 
    log.step === order.step ? { ...log, completedAt: log.completedAt || nowStr } : log
  );

  let nextAssignee = order.saleName;
  if (nextStep === "Thiết kế") nextAssignee = order.designerName;
  else if (nextStep === "Ra file") nextAssignee = order.fileOperatorName;
  else if (nextStep === "Sản xuất") nextAssignee = order.productionWorkerName;
  else if (nextStep === "Lắp đặt") nextAssignee = order.installerName;
  else if (nextStep === "Nghiệm thu") nextAssignee = order.supervisorName || order.installerName || "";
  else if (nextStep === "Hoàn công") nextAssignee = "";
  else if (nextStep === "Báo giá" || nextStep === "Tiếp nhận") nextAssignee = order.saleName;

  if (!updatedLogs.some(log => log.step === nextStep)) {
    updatedLogs.push({
      step: nextStep,
      assignee: nextAssignee,
      startedAt: nowStr
    });
  }

  return {
    ...order,
    step: nextStep,
    progressPercent: progressByStep(nextStep),
    workStatus: "working",
    pendingStep: undefined,
    pendingBy: undefined,
    pendingReason: undefined,
    historyLogs: updatedLogs
  };
}

export function requestStepConfirmation(order: Order, requestedBy: string, reason = "Nhân viên báo hoàn thành") {
  const nextStep = orderSteps[getStepIndex(order.step) + 1];
  if (!nextStep) return order;
  const nowStr = new Date().toISOString();
  const updatedLogs = (order.historyLogs || []).map(log => 
    log.step === order.step ? { ...log, completedAt: log.completedAt || nowStr } : log
  );
  return {
    ...order,
    workStatus: "pending_confirmation" as const,
    pendingStep: nextStep,
    pendingBy: requestedBy,
    pendingReason: reason,
    historyLogs: updatedLogs
  };
}

export function canApproveStep(positionId: string, order: Order) {
  if (order.workStatus !== "pending_confirmation") return false;
  if (positionId === "admin" || positionId === "director") return true;
  if (["Tiếp nhận", "Báo giá"].includes(order.step)) return positionId === "sale_manager";
  if (order.step === "Thiết kế") return positionId === "design_manager";
  if (["Ra file", "Sản xuất"].includes(order.step)) return positionId === "workshop_manager";
  if (["Lắp đặt", "Nghiệm thu"].includes(order.step)) return positionId === "supervisor_lead";
  if (order.step === "Hoàn công") return positionId === "accountant";
  return false;
}

export function requiresManagerConfirmation(positionId: string, order: Order) {
  if (positionId === "admin" || positionId === "director") return false;
  if (order.step === "Thiết kế" && ["designer", "design_manager"].includes(positionId)) return false;
  return ["sale", "designer", "file_operator", "production_worker", "installer"].includes(positionId);
}

export function canSeeOrder(positionId: string, currentUserName: string, order: Order) {
  if (positionId === "accountant") {
    return getStepIndex(order.step) >= getStepIndex("Báo giá");
  }
  if (isCompanyWideOrderRole(positionId)) return true;
  if (positionId === "hr") return false;
  if (positionId === "sale") {
    const sales = order.saleName ? order.saleName.split(",").map(s => s.trim()) : [];
    return sales.includes(currentUserName);
  }
  if (positionId === "designer") return getAssignedNames(order, "designer").includes(currentUserName) && ["Thiết kế", "Báo giá", "Ra file"].includes(order.step);
  if (positionId === "file_operator") return getAssignedNames(order, "file_operator").includes(currentUserName) && ["Ra file", "Sản xuất", "Lắp đặt"].includes(order.step);
  if (positionId === "supervisor_lead") return getStepIndex(order.step) >= getStepIndex("Sản xuất");
  if (positionId === "production_worker") return getAssignedNames(order, "production_worker").includes(currentUserName) && order.step === "Sản xuất";
  if (positionId === "installer") return getAssignedNames(order, "installer").includes(currentUserName) && order.step === "Lắp đặt";
  return false;
}

export function visibleOrdersFor(positionId: string, currentUserName: string, orders: Order[]) {
  return orders.filter((order) => order.status === "active" && canSeeOrder(positionId, currentUserName, order));
}

export function visibleOrderStepsFor(positionId: string) {
  if (positionId === "accountant") return orderSteps.filter((step) => getStepIndex(step) >= getStepIndex("Báo giá"));
  if (positionId === "designer" || positionId === "design_manager") return orderSteps.filter((step) => ["Thiết kế", "Báo giá", "Ra file"].includes(step));
  if (positionId === "file_operator") return orderSteps.filter((step) => ["Ra file", "Sản xuất", "Lắp đặt"].includes(step));
  if (positionId === "supervisor_lead") return orderSteps.filter((step) => getStepIndex(step) >= getStepIndex("Sản xuất"));
  if (positionId === "production_worker") return orderSteps.filter((step) => step === "Sản xuất");
  if (positionId === "installer") return orderSteps.filter((step) => step === "Lắp đặt");
  return orderSteps;
}

export function canViewOrderPricing(positionId: string, currentUserName: string, order: Order) {
  const sales = order.saleName ? order.saleName.split(",").map(s => s.trim()) : [];
  return ["director", "accountant", "sale_manager"].includes(positionId) || (positionId === "sale" && sales.includes(currentUserName));
}

export function canHandleCurrentStep(positionId: string, order: Order) {
  if (positionId === "admin") return true;
  if (["Tiếp nhận", "Báo giá"].includes(order.step)) return ["sale", "sale_manager"].includes(positionId);
  if (order.step === "Thiết kế") return ["designer", "design_manager"].includes(positionId);
  if (order.step === "Ra file") return ["file_operator", "workshop_manager"].includes(positionId);
  if (order.step === "Sản xuất") return positionId === "workshop_manager";
  if (["Lắp đặt", "Nghiệm thu"].includes(order.step)) return positionId === "supervisor_lead";
  if (order.step === "Hoàn công") return positionId === "accountant";
  return false;
}

export function getAssignedNames(order: Order, positionId: string) {
  if (positionId === "designer" || positionId === "design_manager") return order.designerNames?.length ? order.designerNames : [order.designerName].filter(Boolean);
  if (positionId === "file_operator") return order.fileOperatorNames?.length ? order.fileOperatorNames : [order.fileOperatorName].filter(Boolean);
  if (positionId === "production_worker") return order.productionWorkerNames?.length ? order.productionWorkerNames : [order.productionWorkerName].filter(Boolean);
  if (positionId === "installer") return order.installerNames?.length ? order.installerNames : [order.installerName].filter(Boolean);
  if (positionId === "supervisor_lead") return order.supervisorNames?.length ? order.supervisorNames : [order.supervisorName].filter(Boolean);
  if (positionId === "sale" || positionId === "sale_manager") return order.saleName ? order.saleName.split(",").map(s => s.trim()) : [];
  if (positionId === "workshop_manager") return [order.workshopManagerName].filter(Boolean);
  return [];
}

export function canCancelOrder(positionId: string, order: Order) {
  if (positionId === "director") return true;
  if (positionId === "sale_manager") return ["Tiếp nhận", "Báo giá"].includes(order.step);
  if (positionId === "workshop_manager") return ["Ra file", "Sản xuất"].includes(order.step);
  if (positionId === "supervisor_lead") return ["Lắp đặt", "Nghiệm thu"].includes(order.step);
  if (positionId === "accountant") return order.step === "Hoàn công";
  return false;
}

function progressByStep(step: OrderStep): Order["progressPercent"] {
  const progress: Record<OrderStep, Order["progressPercent"]> = {
    "Tiếp nhận": 10,
    "Thiết kế": 35,
    "Báo giá": 35,
    "Ra file": 60,
    "Sản xuất": 60,
    "Lắp đặt": 90,
    "Nghiệm thu": 90,
    "Hoàn công": 100
  };
  return progress[step];
}

function normalizeCodePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase();
}
