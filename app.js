const ROLES = {
  admin: "Quản trị",
  hr: "Nhân sự",
  accountant: "Kế toán",
  sales_manager: "Quản lý sale",
  sale: "Sale",
  design_manager: "Quản lý thiết kế",
  designer: "Thiết kế",
  workshop_manager: "Quản lý xưởng",
  file_staff: "Ra file",
  production_worker: "Thợ sản xuất",
  supervisor: "Giám sát",
  installer: "Thợ lắp đặt"
};

ROLES.supervisor_manager = "Giám sát trưởng";
ROLES.supervisor = "Nhân viên giám sát";

const DEPARTMENTS = {
  admin: "Ban giám đốc",
  hr: "Nhân sự",
  accounting: "Kế toán",
  sales: "Sale",
  design: "Thiết kế",
  file: "Ra file",
  workshop: "Xưởng",
  supervision: "Giám sát",
  install: "Lắp đặt"
};

const STEPS = [
  { id: "receive", name: "Chờ tiếp nhận", managerRoles: ["sales_manager", "admin"], workerRoles: ["sale"], department: "sales" },
  { id: "sale", name: "Tiếp nhận", managerRoles: ["sales_manager", "admin"], workerRoles: ["sale"], department: "sales" },
  { id: "design", name: "Thiết kế", managerRoles: ["design_manager", "admin"], workerRoles: ["designer"], department: "design" },
  { id: "quote", name: "Báo giá", managerRoles: ["sales_manager", "admin"], workerRoles: ["sale"], department: "sales" },
  { id: "file", name: "Ra file", managerRoles: ["workshop_manager", "admin"], workerRoles: ["file_staff"], department: "file" },
  { id: "production", name: "Sản xuất", managerRoles: ["workshop_manager", "admin"], workerRoles: ["production_worker"], department: "workshop" },
  { id: "install", name: "Lắp đặt", managerRoles: ["supervisor", "admin"], workerRoles: ["installer"], department: "install" },
  { id: "acceptance", name: "Nghiệm thu", managerRoles: ["supervisor", "admin"], workerRoles: ["supervisor", "sale"], department: "install" },
  { id: "close", name: "Hoàn công", managerRoles: ["accountant", "admin"], workerRoles: ["accountant"], department: "accounting" }
];

const STEPS_REQUIRE_WORKER_ACCEPT = ["design", "file", "production", "install"];

getStep("install").managerRoles = ["supervisor_manager", "admin"];
getStep("acceptance").managerRoles = ["supervisor_manager", "admin"];
getStep("acceptance").workerRoles = ["supervisor"];

const STATUSES = {
  unassigned: "Chưa giao việc",
  assigned: "Đã giao việc",
  working: "Đang làm",
  waiting: "Chờ quản lý xác nhận",
  approved: "Đã xác nhận",
  returned: "Bị trả lại",
  done: "Hoàn thành"
};

const ROLE_NAV = {
  admin: ["dashboard", "notifications", "orders", "incomplete", "work", "customers", "employees", "accounting", "materials", "files", "reports"],
  hr: ["dashboard", "notifications", "employees", "work", "reports"],
  accountant: ["dashboard", "notifications", "accounting", "materials", "orders", "reports"],
  sales_manager: ["dashboard", "notifications", "orders", "incomplete", "customers", "work", "reports"],
  sale: ["dashboard", "notifications", "orders", "customers", "work"],
  design_manager: ["dashboard", "notifications", "orders", "incomplete", "work", "files", "reports"],
  designer: ["notifications", "work", "orders", "files"],
  workshop_manager: ["dashboard", "notifications", "orders", "incomplete", "work", "materials", "reports"],
  file_staff: ["notifications", "work", "orders", "files"],
  production_worker: ["notifications", "work", "orders"],
  supervisor: ["notifications", "work", "orders", "files"],
  installer: ["notifications", "work", "orders", "files"]
};

ROLE_NAV.supervisor_manager = ["dashboard", "notifications", "orders", "incomplete", "work", "files", "reports"];

const NAV_LABELS = {
  dashboard: "Dashboard",
  notifications: "Thông báo",
  orders: "Đơn hàng",
  incomplete: "Đơn không hoàn thành",
  customers: "Khách hàng",
  work: "Chấm công và công việc cá nhân",
  employees: "Nhân sự",
  accounting: "Kế toán đơn hàng",
  materials: "Vật tư",
  files: "File / Ảnh",
  reports: "Báo cáo"
};

const DATA_VERSION = "clean-start-2026-05-29";

const ATTENDANCE_SLOTS = [
  { id: "morning", label: "7h30 s?ng", official: "07:30", start: "07:15", end: "08:30" },
  { id: "noon", label: "11h30 s?ng", official: "11:30", start: "11:15", end: "13:30" },
  { id: "afternoon", label: "1h30 chi?u", official: "13:30", start: "13:15", end: "14:30" },
  { id: "evening", label: "5h30 chi?u", official: "17:30", start: "17:15", end: "18:30" }
];

const WORKDAY_INTERVALS = [
  ["07:30", "11:30"],
  ["13:30", "17:30"]
];

const SALE_CHECKLIST_TASKS = ["Gọi điện cho khách", "Bổ sung thông tin", "Khảo sát"];
const DESIGN_CHECKLIST_TASKS = ["Gửi file thiết kế lên nhóm", "Lên kích thước cho đơn hàng dự toán"];
const QUOTE_CHECKLIST_TASKS = ["Số tiền dự toán", "Số tiền báo giá", "Ảnh dự toán", "Ảnh báo giá"];

const state = {
  currentUser: null,
  currentView: "dashboard",
  search: "",
  statusFilter: "all",
  selectedOrderId: null,
  taskTab: "mine",
  customerTab: "approved",
  pendingAttendance: null
};

let activeCameraStream = null;

function defaultData() {
  const users = [
    user("u1", "admin", "123456", "Quản trị GOMITA", "admin", "admin", "Giám đốc điều hành", 0),
    user("u_hr", "nhansu", "123456", "Nguyễn Văn Nhân Sự", "hr", "hr", "Trưởng phòng nhân sự", 350000),
    user("u_ac", "ketoan", "123456", "Trần Thị Kế Toán", "accountant", "accounting", "Kế toán trưởng", 300000),
    user("u_sm", "qlsale", "123456", "Phạm Văn Quản Lý Sale", "sales_manager", "sales", "Trưởng phòng kinh doanh", 320000),
    user("u_sale", "sale1", "123456", "Nguyễn Thị Sale", "sale", "sales", "Nhân viên kinh doanh", 250000),
    user("u_dm", "qlthietke", "123456", "Lê Văn Quản Lý Thiết Kế", "design_manager", "design", "Trưởng phòng thiết kế", 320000),
    user("u_des", "designer1", "123456", "Hoàng Văn Thiết Kế", "designer", "design", "Nhân viên thiết kế", 280000),
    user("u_wm", "quandoc", "123456", "Nguyễn Văn Quản Đốc", "workshop_manager", "production", "Quản đốc xưởng", 350000),
    user("u_pw", "thosanxuat1", "123456", "Trần Văn Sản Xuất", "production_worker", "production", "Thợ sản xuất gỗ", 300000),
    user("u_sv", "giamsat1", "123456", "Phạm Văn Giám Sát", "supervisor", "install", "Giám sát công trình", 320000),
    user("u_inst", "tholapdat1", "123456", "Lê Văn Lắp Đặt", "installer", "install", "Thợ lắp đặt nội thất", 300000)
  ];

  const customers = [
    customer("c_minh", "Lê Minh", 35, "0912345678", "123 Lạch Tray, Ngô Quyền, Hải Phòng", "Tủ bếp MDF", "Thiết kế hiện đại màu gỗ", "u_sale", "approved", "u_sm")
  ];

  const o = order("GOMITA-001", "Thi công nội thất căn hộ Anh Minh", "c_minh", "u_sale", "close", "done", "u_ac", "u_ac", 100, "2026-06-15", 350000000, 320000000);
  o.categories = "Tủ bếp MDF, Tủ quần áo";
  o.note = "Đơn hàng giả lập chạy đầy đủ các bước từ Chờ tiếp nhận đến Hoàn công";
  o.quoteEstimate = 350000000;
  o.quotePrice = 340000000;
  o.quoteApprovalStatus = "approved";
  o.quoteSubmittedBy = "u_sale";
  o.quoteSubmittedAt = "2026-05-25 15:30:00";
  o.stepStartedAt = "2026-05-29";
  o.finalReport = "Đã hoàn thành thi công lắp đặt và nghiệm thu đạt chuẩn chất lượng GOMITA.";

  const orders = [o];

  const tasks = [
    task("t_rec", "GOMITA-001", "receive", "Kiểm tra và duyệt thông tin khách hàng / đơn hàng mới", "u_sm", "u_sm", "approved", "2026-06-15", "Duyệt khách hàng mới"),
    task("t_sal", "GOMITA-001", "sale", "Tiếp nhận yêu cầu thiết kế từ khách hàng", "u_sale", "u_sm", "approved", "2026-06-15", "Trao đổi kỹ với khách về công năng"),
    task("t_des", "GOMITA-001", "design", "Thiết kế 3D tủ bếp và tủ quần áo", "u_des", "u_dm", "approved", "2026-06-15", "Thiết kế hiện đại, tông sáng"),
    task("t_quo", "GOMITA-001", "quote", "Lập báo giá chi tiết và chốt hợp đồng", "u_sale", "u_sm", "approved", "2026-06-15", "Đã chốt giá 340 triệu"),
    task("t_fil", "GOMITA-001", "file", "Ra file sản xuất CNC", "u_des", "u_wm", "approved", "2026-06-15", "File chạy CNC chuẩn kích thước"),
    task("t_pro", "GOMITA-001", "production", "Gia công sản xuất tại xưởng", "u_pw", "u_wm", "approved", "2026-06-15", "Cắt ván và dán cạnh chuẩn đẹp"),
    task("t_ins", "GOMITA-001", "install", "Lắp đặt tại công trình căn hộ Anh Minh", "u_inst", "u_sv", "approved", "2026-06-15", "Lắp đặt cẩn thận, chú ý bản lề"),
    task("t_acc", "GOMITA-001", "acceptance", "Nghiệm thu và bàn giao công trình", "u_sv", "u_sv", "approved", "2026-06-15", "Khách hàng nghiệm thu hài lòng 100%"),
    task("t_clo", "GOMITA-001", "close", "Quyết toán và hoàn công đơn hàng", "u_ac", "u_ac", "approved", "2026-06-15", "Hoàn công quyết toán kế toán")
  ];

  tasks.forEach(t => {
    t.acceptedAt = "2026-05-20 08:30:00";
    t.acceptedAtMs = Date.parse(t.acceptedAt);
    t.completedAt = "2026-05-29 17:30:00";
    t.completedAtMs = Date.parse(t.completedAt);
  });

  const materials = [
    mat("m1", "GOMITA-001", "Gỗ công nghiệp MDF phủ Melamine", "Công ty An Cường", 50, 450000, "2026-05-26", "2026-05-27", "2026-05-27", 0, "u_wm", "Đã về xưởng"),
    mat("m2", "GOMITA-001", "Bản lề giảm chấn Blum", "Đại lý Blum HP", 120, 35000, "2026-05-26", "2026-05-27", "2026-05-27", 0, "u_wm", "Đã về xưởng"),
    mat("m3", "GOMITA-001", "Ray trượt hộc kéo Hafele", "Đại lý Hafele HP", 20, 150000, "2026-05-26", "2026-05-27", "2026-05-27", 0, "u_wm", "Đã về xưởng")
  ];

  const expenses = [];
  const photos = [];
  const files = [];

  const attendance = [
    { id: "att1", userId: "u_pw", date: "2026-05-27", slotId: "morning", type: "daily_checkin", status: "Da ch?m", time: "2026-05-27 07:20:00" },
    { id: "att2", userId: "u_pw", date: "2026-05-27", slotId: "noon", type: "daily_checkin", status: "Da ch?m", time: "2026-05-27 11:25:00" },
    { id: "att3", userId: "u_pw", date: "2026-05-27", slotId: "afternoon", type: "daily_checkin", status: "Da ch?m", time: "2026-05-27 13:20:00" },
    { id: "att4", userId: "u_pw", date: "2026-05-27", slotId: "evening", type: "daily_checkin", status: "Da ch?m", time: "2026-05-27 17:28:00" },

    { id: "att5", userId: "u_inst", date: "2026-05-28", slotId: "morning", type: "daily_checkin", status: "Da ch?m", time: "2026-05-28 07:18:00" },
    { id: "att6", userId: "u_inst", date: "2026-05-28", slotId: "noon", type: "daily_checkin", status: "Da ch?m", time: "2026-05-28 11:22:00" },
    { id: "att7", userId: "u_inst", date: "2026-05-28", slotId: "afternoon", type: "daily_checkin", status: "Da ch?m", time: "2026-05-28 13:25:00" },
    { id: "att8", userId: "u_inst", date: "2026-05-28", slotId: "evening", type: "daily_checkin", status: "Da ch?m", time: "2026-05-28 17:26:00" }
  ];

  const makeupRequests = [];
  const overtimeRequests = [];
  const salaryAdvances = [];
  const departmentRequests = [];
  const auditLogs = [
    { time: "2026-05-20 08:00:00", text: "Sale Nguyễn Thị Sale tạo khách hàng Lê Minh & đơn hàng GOMITA-001." },
    { time: "2026-05-20 08:30:00", text: "Quản lý Sale Phạm Văn Quản Lý Sale duyệt khách hàng Lê Minh & bàn giao đơn hàng." },
    { time: "2026-05-21 09:00:00", text: "Nguyễn Thị Sale tiếp nhận yêu cầu & hoàn thành khảo sát thực tế." },
    { time: "2026-05-22 10:00:00", text: "Quản lý Thiết Kế Lê Văn Quản Lý Thiết Kế giao công đoạn Thiết kế cho designer Hoàng Văn Thiết Kế." },
    { time: "2026-05-24 16:30:00", text: "Hoàng Văn Thiết Kế hoàn thành bản vẽ 3D thiết kế tủ bếp & tủ quần áo." },
    { time: "2026-05-25 10:00:00", text: "Nguyễn Thị Sale lập báo giá và chốt hợp đồng thi công trị giá 340,000,000đ." },
    { time: "2026-05-26 11:00:00", text: "Hoàng Văn Thiết Kế xuất file CNC gửi xưởng sản xuất." },
    { time: "2026-05-27 15:00:00", text: "Thợ sản xuất Trần Văn Sản Xuất hoàn thành gia công tại xưởng." },
    { time: "2026-05-28 17:00:00", text: "Thợ lắp đặt Lê Văn Lắp Đặt hoàn thành lắp đặt tại công trình Anh Minh." },
    { time: "2026-05-29 11:30:00", text: "Giám sát Phạm Văn Giám Sát nghiệm thu công trình đạt chuẩn bàn giao." },
    { time: "2026-05-29 17:00:00", text: "Kế toán Trần Thị Kế Toán hoàn tất quyết toán & đóng đơn hàng GOMITA-001." }
  ];

  return {
    version: DATA_VERSION,
    users,
    customers,
    orders,
    tasks,
    materials,
    expenses,
    photos,
    files,
    attendance,
    makeupRequests,
    overtimeRequests,
    salaryAdvances,
    departmentRequests,
    auditLogs
  };
}

function user(id, username, password, name, role, department, title, salary) {
  return {
    id, username, password, name, role, roles: [role], department, title, salary,
    birthDate: "1990-01-01",
    phone: "09xx.xxx.xxx",
    address: "H?i Ph?ng",
    status: "Dang l?m",
    approvalStatus: "approved",
    createdBy: "system",
    approvedBy: "",
    approvedAt: "",
    insurance: "D? khai b?o",
    contract: "Hop dong 12 thang",
    startDate: "2025-01-01",
    salaryMode: "day",
    daySalary: salary,
    monthSalary: 0,
    cmtImage: "",
    cmtImageName: "",
    contractFile: "",
    contractFileName: "",
    locked: false
  };
}

function customer(id, name, age, phone, address, need, wish, createdBy, approvalStatus = "pending", approvedBy = "") {
  return {
    id,
    name,
    age,
    phone,
    address,
    need,
    wish,
    createdBy,
    approvalStatus,
    approvedBy,
    approvedAt: approvalStatus === "approved" ? "2026-05-20" : "",
    approvalNote: ""
  };
}

function order(code, projectName, customerId, saleId, stepId, status, assigneeId, managerId, progress, deadline, estimate, actualCost) {
  return {
    id: code,
    code,
    projectName,
    customerId,
    saleId,
    currentStepId: stepId,
    status,
    assigneeId,
    managerId,
    createdAt: "2026-05-20",
    deadline,
    progress,
    note: "T?t c? d? li??u tri?fn khai ph?i g?n v?>i ?'on h?ng n?y.",
    initialNeed: "",
    customerWish: "",
    categories: "T? b?p, t? ?o, k?? trang tr?",
    estimate,
    actualCost,
    finalReport: "Chua ho?n c?ng",
    archived: false,
    archivedAt: "",
    paidAt: "",
    incomplete: false,
    incompleteReason: "",
    overdueTracked: false,
    overdueHistory: [],
    returnedAt: "",
    returnedAtMs: 0,
    lastInfoAt: "2026-05-22",
    pendingNextStepId: "",
    pendingTransferNote: "",
    pendingTransferBy: "",
    transferFromStepId: "",
    transferFromAssigneeId: "",
    transferFromManagerId: "",
    waitStartedAt: "",
    waitStartedAtMs: 0,
    waitIntervals: [],
    waitPaused: false,
    waitPauseReason: "",
    waitPauseAt: "",
    waitPauseAtMs: 0,
    waitPauseConfirmedDate: "",
    reminderUntil: "",
    reminderDisabled: false,
    quoteEstimate: 0,
    quotePrice: 0,
    quoteEstimateImage: "",
    quoteEstimateImageName: "",
    quotePriceImage: "",
    quotePriceImageName: "",
    quoteApprovalStatus: "",
    quoteSubmittedBy: "",
    quoteSubmittedAt: "",
    completedExportedAt: "",
    stepStartedAt: "2026-05-22"
  };
}

function task(id, orderId, stepId, title, assigneeId, managerId, status, deadline, note) {
  return { id, orderId, stepId, title, assigneeId, managerId, status, deadline, note, createdAt: "2026-05-22", acceptedAt: "", acceptedAtMs: 0, completedAt: "", completedAtMs: 0, interruptions: [], interrupted: false };
}

function mat(id, orderId, name, supplier, qty, price, orderDate, expectedDate, actualDate, shipping, buyerId, status) {
  return { id, orderId, name, supplier, qty, price, orderDate, expectedDate, actualDate, shipping, buyerId, status };
}

function photo(id, orderId, stepId, uploadedBy, name, time, imageData = "", driveLink = "") {
  return { id, orderId, stepId, uploadedBy, name, time, imageData, driveLink, note: "Tu ghi nhan thoi gian chup/gui anh de cham cong." };
}

let db = loadDb();

function loadDb() {
  const raw = localStorage.getItem("gomita_company_db");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed.version !== DATA_VERSION) {
      const clean = defaultData();
      localStorage.setItem("gomita_company_db", JSON.stringify(clean));
      localStorage.setItem("gomita_company_session", "u1");
      return clean;
    }
    return migrateDb(parsed);
  }
  const data = defaultData();
  localStorage.setItem("gomita_company_db", JSON.stringify(data));
  return data;
}

function migrateDb(data) {
  data.users = data.users || [];
  data.users = data.users.map(u => ({
    ...u,
    roles: Array.isArray(u.roles) && u.roles.length ? u.roles : [u.role],
    approvalStatus: u.approvalStatus || "approved",
    createdBy: u.createdBy || "system",
    approvedBy: u.approvedBy || "",
    approvedAt: u.approvedAt || "",
    salaryMode: u.salaryMode || "day",
    daySalary: Number(u.daySalary || u.salary || 0),
    monthSalary: Number(u.monthSalary || 0),
    cmtImage: u.cmtImage || "",
    cmtImageName: u.cmtImageName || "",
    contractFile: u.contractFile || "",
    contractFileName: u.contractFileName || ""
  }));
  data.users.forEach(u => {
    const roles = userRoles(u);
    const oldSupervisor = roles.includes("supervisor") && !roles.includes("supervisor_manager") && (u.title || "").toLowerCase().includes("gi");
    if (oldSupervisor) {
      u.roles = roles.map(role => role === "supervisor" ? "supervisor_manager" : role);
      u.role = u.role === "supervisor" ? "supervisor_manager" : u.role;
      u.title = ROLES[u.role] || u.title;
    }
  });
  data.customers = (data.customers || []).map(c => ({
    createdBy: c.createdBy || "u5",
    approvalStatus: c.approvalStatus || "approved",
    approvedBy: c.approvedBy || "u4",
    approvedAt: c.approvedAt || "2026-05-20",
    approvalNote: c.approvalNote || "",
    ...c
  }));
  const salesManager = (data.users || []).find(u => (u.roles || [u.role]).includes("sales_manager") && !u.locked);
  const designManager = (data.users || []).find(u => (u.roles || [u.role]).includes("design_manager") && !u.locked);
  data.orders = (data.orders || []).map(o => {
    o = {
      incomplete: false,
      incompleteReason: "",
      archived: Boolean(o.archived),
      archivedAt: o.archivedAt || "",
      paidAt: o.paidAt || "",
      overdueTracked: Boolean(o.overdueTracked),
      overdueHistory: o.overdueHistory || [],
      returnedAt: o.returnedAt || "",
      returnedAtMs: Number(o.returnedAtMs) || 0,
      lastInfoAt: o.lastInfoAt || o.stepStartedAt || o.createdAt || today(),
      pendingNextStepId: "",
      pendingTransferNote: "",
      pendingTransferBy: "",
      transferFromStepId: o.transferFromStepId || "",
      transferFromAssigneeId: o.transferFromAssigneeId || "",
      transferFromManagerId: o.transferFromManagerId || "",
      waitStartedAt: o.waitStartedAt || "",
      waitStartedAtMs: Number(o.waitStartedAtMs) || 0,
      waitIntervals: o.waitIntervals || [],
      waitPaused: Boolean(o.waitPaused),
      waitPauseReason: o.waitPauseReason || "",
      waitPauseAt: o.waitPauseAt || "",
      waitPauseAtMs: Number(o.waitPauseAtMs) || 0,
      waitPauseConfirmedDate: o.waitPauseConfirmedDate || "",
      reminderUntil: "",
      reminderDisabled: false,
      quoteEstimate: Number(o.quoteEstimate || o.estimate || 0),
      quotePrice: Number(o.quotePrice || 0),
      quoteEstimateImage: o.quoteEstimateImage || "",
      quoteEstimateImageName: o.quoteEstimateImageName || "",
      quotePriceImage: o.quotePriceImage || "",
      quotePriceImageName: o.quotePriceImageName || "",
      quoteApprovalStatus: o.quoteApprovalStatus || "",
      quoteSubmittedBy: o.quoteSubmittedBy || "",
      quoteSubmittedAt: o.quoteSubmittedAt || "",
      completedExportedAt: o.completedExportedAt || "",
      ...o
    };
    if (["receive", "sale"].includes(o.currentStepId) && salesManager && (!o.managerId || getRoleFromData(data, o.managerId) === "admin")) {
      return { ...o, managerId: salesManager.id };
    }
    if (o.currentStepId === "design" && designManager && (!o.managerId || getRoleFromData(data, o.managerId) === "admin")) {
      return { ...o, managerId: designManager.id };
    }
    return o;
  });
  data.tasks = (data.tasks || []).map(t => {
    t = {
      acceptedAt: "",
      acceptedAtMs: 0,
      completedAt: "",
      completedAtMs: 0,
      interruptions: [],
      interrupted: false,
      ...t
    };
    if (["receive", "sale"].includes(t.stepId) && salesManager && (!t.managerId || getRoleFromData(data, t.managerId) === "admin")) {
      return { ...t, managerId: salesManager.id };
    }
    if (t.stepId === "design" && designManager && (!t.managerId || getRoleFromData(data, t.managerId) === "admin")) {
      return { ...t, managerId: designManager.id };
    }
    return t;
  });
  data.photos = (data.photos || []).map(p => ({
    imageData: "",
    driveLink: "",
    ...p
  }));
  data.attendance = (data.attendance || []).map(a => ({
    type: a.type || "task_photo",
    date: a.date || "",
    slotId: a.slotId || "",
    isLate: Boolean(a.isLate),
    photoId: a.photoId || "",
    driveLink: a.driveLink || "",
    ...a
  }));
  data.makeupRequests = (data.makeupRequests || []).map(r => ({
    approvals: r.approvals || {},
    status: r.status || "pending",
    ...r
  }));
  data.overtimeRequests = (data.overtimeRequests || []).map(r => ({
    approvals: r.approvals || {},
    status: r.status || "pending",
    hours: Number(r.hours) || 0,
    createdBy: r.createdBy || r.userId || "",
    createdByType: r.createdByType || "self",
    orderId: r.orderId || "",
    ...r
  }));
  data.salaryAdvances = data.salaryAdvances || [];
  data.departmentRequests = (data.departmentRequests || []).map(r => ({
    priority: true,
    status: "sent",
    acceptedAt: "",
    startedAt: "",
    completedAt: "",
    resultNote: "",
    ...r
  }));
  data.version = DATA_VERSION;
  localStorage.setItem("gomita_company_db", JSON.stringify(data));
  return data;
}

function getRoleFromData(data, userId) {
  return (data.users || []).find(u => u.id === userId)?.role || "";
}

function userRoles(user) {
  if (!user) return [];
  const roles = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role];
  return [...new Set(roles.filter(Boolean))];
}

function hasRole(user, roles) {
  const list = Array.isArray(roles) ? roles : [roles];
  return userRoles(user).some(role => list.includes(role));
}

function activeRole(user) {
  if (!user) return "";
  const roles = userRoles(user);
  const saved = localStorage.getItem("gomita_active_role_" + user.id);
  return roles.includes(saved) ? saved : roles[0];
}

function hasActiveRole(user, roles) {
  const list = Array.isArray(roles) ? roles : [roles];
  return list.includes(activeRole(user));
}

function roleNames(user) {
  return userRoles(user).map(role => ROLES[role] || role).join(", ");
}

function activeRoleName(user) {
  return ROLES[activeRole(user)] || activeRole(user);
}

function displayTaskTitle(title) {
  const raw = String(title || "");
  const fixed = restoreVietnameseText(fixFontText(raw));
  return fixed
    .replaceAll("Gọi cho khách", "Gọi điện cho khách")
    .replaceAll("Goi cho khach", "Gọi điện cho khách")
    .replaceAll("G?i cho kh?ch", "Gọi điện cho khách")
    .replaceAll("Bo sung thong tin", "Bổ sung thông tin")
    .replaceAll("B? sung thong tin", "Bổ sung thông tin")
    .replaceAll("B?. sung th?ng tin", "Bổ sung thông tin")
    .replaceAll("Khao sat", "Khảo sát")
    .replaceAll("Kh?o s?t", "Khảo sát")
    .replaceAll("Gui file thiet ke len nhom", "Gửi file thiết kế lên nhóm")
    .replaceAll("Len kich thuoc cho don hang du toan", "Lên kích thước cho đơn hàng dự toán")
    .replaceAll("So tien du toan", "Số tiền dự toán")
    .replaceAll("So tien bao gia", "Số tiền báo giá")
    .replaceAll("Anh du toan", "Ảnh dự toán")
    .replaceAll("Anh bao gia", "Ảnh báo giá")
    .replaceAll("Thc hin cang don", "Thực hiện công đoạn")
    .replaceAll("Thuc hien cong don", "Thực hiện công đoạn")
    .replaceAll("Thuc hien cong doan", "Thực hiện công đoạn")
    .replace(/Thc\s*hin\s*cang\s*[đd]on/gi, "Thực hiện công đoạn")
    .replace(/Thuc\s*hien\s*cong\s*(don|doan)/gi, "Thực hiện công đoạn")
    .replace(/Th.?c\s*hi.?n\s*c.?ng\s*[đd].?o.?n/gi, "Thực hiện công đoạn");
}

function checklistTitlesForStep(stepId) {
  if (stepId === "sale") return SALE_CHECKLIST_TASKS;
  if (stepId === "design") return DESIGN_CHECKLIST_TASKS;
  return [];
}

function normalizedChecklistTitle(title) {
  return displayTaskTitle(title).trim();
}

function isChecklistTask(t) {
  return Boolean(t && checklistTitlesForStep(t.stepId).includes(normalizedChecklistTitle(t.title)));
}

function checklistTaskForTitle(tasks, stepId, title) {
  return tasks.find(t => t.stepId === stepId && normalizedChecklistTitle(t.title) === title);
}

function stepChecklistDone(orderId, stepId) {
  return checklistTitlesForStep(stepId).every(title => db.tasks.some(t =>
    t.orderId === orderId
    && t.stepId === stepId
    && normalizedChecklistTitle(t.title) === title
    && ["done", "approved"].includes(t.status)
  ));
}

function quoteChecklistItems(order) {
  return [
    { title: "Số tiền dự toán", done: Number(order?.quoteEstimate || order?.estimate || 0) > 0, value: fmtMoney(Number(order?.quoteEstimate || order?.estimate || 0)) },
    { title: "Số tiền báo giá", done: Number(order?.quotePrice || 0) > 0, value: fmtMoney(Number(order?.quotePrice || 0)) },
    { title: "Ảnh dự toán", done: Boolean(order?.quoteEstimateImage), value: order?.quoteEstimateImageName || "Chưa có" },
    { title: "Ảnh báo giá", done: Boolean(order?.quotePriceImage), value: order?.quotePriceImageName || "Chưa có" }
  ];
}

function renderTaskRequirementSummary(order, stepId) {
  if (!order) return "";
  if (["sale", "design"].includes(stepId)) {
    const items = checklistTitlesForStep(stepId).map(title => {
      const done = db.tasks.some(t => t.orderId === order.id && t.stepId === stepId && normalizedChecklistTitle(t.title) === title && ["done", "approved"].includes(t.status));
      return `<li>${done ? "☑" : "☐"} ${title}</li>`;
    }).join("");
    return `<div class="checklist-summary"><b>Cần hoàn thành trước khi chuyển bước:</b><ul>${items}</ul></div>`;
  }
  if (stepId === "quote") {
    const items = quoteChecklistItems(order).map(item => `<li>${item.done ? "☑" : "☐"} ${item.title}: ${item.value}</li>`).join("");
    return `<div class="checklist-summary"><b>Cần hoàn thành trước khi chuyển bước:</b><ul>${items}</ul></div>`;
  }
  return "";
}
function saveDb() {
  localStorage.setItem("gomita_company_db", JSON.stringify(db));
}

function q(selector) {
  return document.querySelector(selector);
}

function qa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

const FONT_FIX_REPLACEMENTS = [
  ["Qu?n tr?<", "Quan tri"], ["Qu?n tri", "Quan tri"], ["Qu?n l?", "Quan ly"], ["Nh?n s?", "Nhan su"],
  ["K? to?n", "Ke toan"], ["Thi?t k?", "Thiet ke"], ["xu?Yng", "xuong"], ["Xu?Yng", "Xuong"],
  ["Th? s?n xu?t", "Tho san xuat"], ["Gi?m s?t", "Giam sat"], ["Th? l?p", "Tho lap"], ["L?p", "Lap"],
  ["Ban gi?m", "Ban giam"], ["Nghi??m thu", "Nghiem thu"], ["Ho?n c?ng", "Hoan cong"], ["B?o gi?", "Bao gia"],
  ["S?n xu?t", "San xuat"], ["Ch? ti?p nh?n", "Cho tiep nhan"], ["Ti?p nh?n", "Tiep nhan"],
  ["Chua giao vi??c", "Chua giao viec"], ["D? giao vi??c", "Da giao viec"], ["Dang l?m", "Dang lam"],
  ["Ch? qu?n l? x?c nh?n", "Cho quan ly xac nhan"], ["D? x?c nh?n", "Da xac nhan"], ["B?< tr? l?i", "Bi tra lai"],
  ["Ho?n th?nh", "Hoan thanh"], ["Th?ng b?o", "Thong bao"], ["Don h?ng", "Don hang"], ["don h?ng", "don hang"],
  ["Kh?ch h?ng", "Khach hang"], ["kh?ch h?ng", "khach hang"], ["C?ng vi??c", "Cong viec"], ["c?ng vi??c", "cong viec"],
  ["c? nh?n", "ca nhan"], ["Ch?m c?ng", "Cham cong"], ["ch?m c?ng", "cham cong"], ["V?t tu", "Vat tu"],
  ["B?o c?o", "Bao cao"], ["s?ng", "sang"], ["chi?u", "chieu"], ["G?i cho kh?ch", "Goi cho khach"],
  ["B?. sung th?ng tin", "Bo sung thong tin"], ["Kh?o s?t", "Khao sat"], ["H?i Ph?ng", "Hai Phong"],
  ["D? khai b?o", "Da khai bao"], ["d? li??u", "du lieu"], ["D? li??u", "Du lieu"], ["tri?fn khai", "trien khai"],
  ["T? b?p", "Tu bep"], ["t? ?o", "tu ao"], ["k?? trang tr?", "ke trang tri"], ["Chua", "Chua"],
  ["T?i kho?n", "Tai khoan"], ["t?i kho?n", "tai khoan"], ["M?t kh?u", "Mat khau"], ["D?fng nh?p", "Dang nhap"],
  ["D?fng xu?t", "Dang xuat"], ["Xu?t", "Xuat"], ["Nh?p", "Nhap"], ["Di?u h?nh", "Dieu hanh"],
  ["n?Ti th?t", "noi that"], ["trung t?m", "trung tam"], ["to?n b?T", "toan bo"], ["m?Tt", "mot"],
  ["ri?ng", "rieng"], ["ch?c n?fng", "chuc nang"], ["vai tr?", "vai tro"], ["b?< kh?a", "bi khoa"],
  ["V?< tr?", "Vi tri"], ["C?n", "Can"], ["c?n", "can"], ["x? l?", "xu ly"], ["X? l?", "Xu ly"],
  ["x?c nh?n", "xac nhan"], ["X?c nh?n", "Xac nhan"], ["chuy?fn", "chuyen"], ["Chuy?fn", "Chuyen"],
  ["Duy??t", "Duyet"], ["duy??t", "duyet"], ["ph? duy??t", "phe duyet"], ["m?>i", "moi"], ["ki?fm tra", "kiem tra"],
  ["T?.ng", "Tong"], ["L?i nhu?n", "Loi nhuan"], ["d? ki?n", "du kien"], ["Danh s?ch", "Danh sach"],
  ["danh s?ch", "danh sach"], ["Thao t?c", "Thao tac"], ["C?nh b?o", "Canh bao"], ["c?p nh?t", "cap nhat"],
  ["t?m d?ng", "tam dung"], ["T?m d?ng", "Tam dung"], ["l? do", "ly do"], ["L? do", "Ly do"],
  ["Uu ti?n", "Uu tien"], ["Ngu?i", "Nguoi"], ["ng?y", "ngay"], ["Ng?y", "Ngay"], ["Tr?ng th?i", "Trang thai"],
  ["B? qua", "Bo qua"], ["D?c", "Doc"], ["B?n", "Ban"], ["thi?u", "thieu"], ["m?'c", "moc"],
  ["C? mu?'n", "Co muon"], ["kh?ng", "khong"], ["T?fng ca", "Tang ca"], ["t?fng ca", "tang ca"],
  ["th?i gian", "thoi gian"], ["d?ng", "dung"], ["Chu nhat khong cham cong thuong, van co the dang ky tang ca.", "Chu nhat khong cham cong thuong, van co the dang ky tang ca."],
  ["Dang trong gio cham cong", "Dang trong gio cham cong"], ["Nut cham cong mo theo", "Nut cham cong mo theo"],
  ["Chu nhat khong cham cong", "Chu nhat khong cham cong"], ["Da cham", "Da cham"], ["Cham cong", "Cham cong"],
  ["Ngoai gio cham cong", "Ngoai gio cham cong"], ["Tang ca", "Tang ca"], ["B?t", "Bat"], ["K?t th?c", "Ket thuc"],
  ["S?'", "So"], ["D? duy??t", "Da duyet"], ["Chua c?", "Chua co"], ["G?i", "Gui"], ["Y?u c?u", "Yeu cau"],
  ["B?ng", "Bang"], ["th?ng", "thang"], ["Ti?n", "Tien"], ["t?m t?nh", "tam tinh"], ["luong", "luong"],
  ["Bu?.i", "Buoi"], ["D? ch?m", "Da cham"], ["B?o h?nh", "Bao hanh"]
];

function fixFontText(value) {
  if (typeof value !== "string" || !/[?<'YTf]|�/.test(value)) return value;
  let text = value;
  FONT_FIX_REPLACEMENTS.forEach(([bad, good]) => {
    text = text.split(bad).join(good);
  });
  return text
    .replace(/�/g, "")
    .replace(/\?'/g, "đ")
    .replace(/\?Y/g, "ở")
    .replace(/\?>/g, "ớ")
    .replace(/\?T/g, "ộ")
    .replace(/\?f/g, "ă")
    .replace(/\?<|<\?/g, "ị")
    .replace(/\?\./g, "ổ")
    .replace(/\?\?/g, "")
    .replace(/\?/g, "");
}

function restoreVietnameseText(value) {
  let text = String(value || "");
  [
    ["Ban dang thieu", "Bạn đang thiếu"],
    ["moc cham cong", "mốc chấm công"],
    ["Co muon cham cong bu khong", "Có muốn chấm công bù không"],
    ["cham cong bu", "chấm công bù"],
    ["Cham cong bu", "Chấm công bù"],
    ["cham cong", "chấm công"],
    ["Cham cong", "Chấm công"],
    ["Thong bao", "Thông báo"],
    ["thong bao", "thông báo"],
    ["Nhan su", "Nhân sự"],
    ["nhan su", "nhân sự"],
    ["Khong co quyen", "Không có quyền"],
    ["Sua", "Sửa"],
    ["Khoa", "Khóa"],
    ["Xoa", "Xóa"],
    ["Goi cho khach", "Gọi cho khách"],
    ["Bo sung thong tin", "Bổ sung thông tin"],
    ["Khao sat", "Khảo sát"],
    ["Tang ca", "Tăng ca"],
    ["Chua co", "Chưa có"],
    ["Da duyet", "Đã duyệt"],
    ["Cho xac nhan", "Chờ xác nhận"],
    ["Di muon", "Đi muộn"],
    ["Trang thai", "Trạng thái"],
    ["Thao tac", "Thao tác"],
    ["Thc hin cang don", "Thực hiện công đoạn"],
    ["Thc hin cang đon", "Thực hiện công đoạn"],
    ["Thc hin cang Đon", "Thực hiện công đoạn"],
    ["Thuc hien cong don", "Thực hiện công đoạn"],
    ["Thuc hien cong doan", "Thực hiện công đoạn"],
    ["Thong tin don hang", "Thông tin đơn hàng"],
    ["Nhu cau ban dau", "Nhu cầu ban đầu"],
    ["Tam tu khach hang", "Tâm tư khách hàng"],
    ["Hang muc", "Hạng mục"],
    ["Sale phu trach", "Sale phụ trách"],
    ["Nguoi dang xu ly", "Người đang xử lý"],
    ["Quan ly cong doan", "Quản lý công đoạn"],
    ["Tien do", "Tiến độ"],
    ["Ghi chu", "Ghi chú"],
    ["Day chuyen cong don", "Dây chuyền công đoạn"],
    ["Day chuyen cong doan", "Dây chuyền công đoạn"],
    ["Da qua", "Đã qua"],
    ["Chua toi", "Chưa tới"],
    ["Cong viec ca don", "Công việc của đơn"],
    ["Cong viec cua don", "Công việc của đơn"],
    ["Da hoan thanh", "Đã hoàn thành"],
    ["Hoan thanh", "Hoàn thành"],
    ["Quan ly sale da duyet khach hang", "Quản lý sale đã duyệt khách hàng"],
    ["Don dang cho Sale nhan", "Đơn đang chờ Sale nhận"],
    ["Bo sung don hang", "Bổ sung đơn hàng"],
    ["Thong tin don hang", "Thông tin đơn hàng"],
    ["Yeu cau cua khach", "Yêu cầu của khách"],
    ["Khong co khach hang", "Không có khách hàng"],
    ["Khach hang da duyet", "Khách hàng đã duyệt"],
    ["Khach hang cho phe duyet", "Khách hàng chờ phê duyệt"],
    ["Tao khach hang", "Tạo khách hàng"],
    ["Dia chi", "Địa chỉ"],
    ["Nhu cau", "Nhu cầu"],
    ["Tam tu", "Tâm tư"],
    ["Duyet", "Duyệt"],
    ["Tra lai", "Trả lại"],
    ["Thiet ke can upload file hoac hinh anh truoc khi bao hoan thanh.", "Thiết kế cần upload file hoặc hình ảnh trước khi báo hoàn thành."],
    ["Thiet ke can upload file hoac hinh anh", "Thiết kế cần upload file hoặc hình ảnh"],
    ["truoc khi bao hoan thanh", "trước khi báo hoàn thành"],
    ["file hoac hinh anh", "file hoặc hình ảnh"],
    ["Ghi chu quan ly", "Ghi chú quản lý"],
    ["Ghi chu", "Ghi chú"],
    ["Cung lam", "Cùng làm"],
    ["Da nhan don", "Đã nhận đơn"],
    ["Da nhan", "Đã nhận"],
    ["Don hang", "Đơn hàng"],
    ["don hang", "đơn hàng"],
    ["Cong doan", "Công đoạn"],
    ["cong doan", "công đoạn"],
    ["Tiep nhan", "Tiếp nhận"],
    ["tiep nhan", "tiếp nhận"],
    ["Lap dat", "Lắp đặt"],
    ["lap dat", "lắp đặt"],
    ["Thiet ke", "Thiết kế"],
    ["thiet ke", "thiết kế"],
    ["phong khach", "phòng khách"],
    ["Bao hoan thanh", "Báo hoàn thành"],
    ["bao hoan thanh", "báo hoàn thành"],
    ["Da giao viec", "Đã giao việc"],
    ["Dang lam", "Đang làm"],
    ["Cho quan ly xac nhan", "Chờ quản lý xác nhận"],
    ["Da xac nhan", "Đã xác nhận"],
    ["Chua giao viec", "Chưa giao việc"],
    ["Hoan thanh", "Hoàn thành"],
    ["Xem don hang", "Xem đơn hàng"],
    ["Upload file/anh", "Upload file/ảnh"],
    ["Anh cong viec", "Ảnh công việc"],
    ["Canh bao nhan su dang co viec khac", "Cảnh báo nhân sự đang có việc khác"],
    ["Ban van muon giao them viec nay", "Bạn vẫn muốn giao thêm việc này"],
    ["Nhap ly do tra lai", "Nhập lý do trả lại"],
    ["Chua dat yeu cau, can chinh sua.", "Chưa đạt yêu cầu, cần chỉnh sửa."],
    ["Hay chup anh hoac chon anh truoc khi gui.", "Hãy chụp ảnh hoặc chọn ảnh trước khi gửi."],
    ["Camera chua san sang. Hay bat camera hoac chon anh tu may.", "Camera chưa sẵn sàng. Hãy bật camera hoặc chọn ảnh từ máy."],
    ["Chua chon file/anh.", "Chưa chọn file/ảnh."],
    ["Nhap ma don hang.", "Nhập mã đơn hàng."],
    ["Nhap ten khach hang.", "Nhập tên khách hàng."],
    ["Ten dang nhap khong duoc de trong.", "Tên đăng nhập không được để trống."],
    ["Mat khau hien tai khong dung.", "Mật khẩu hiện tại không đúng."],
    ["Nhap lai mat khau moi chua khop.", "Nhập lại mật khẩu mới chưa khớp."],
    ["Mat khau moi can toi thieu 4 ky tu.", "Mật khẩu mới cần tối thiểu 4 ký tự."],
    ["Ten dang nhap nay da duoc su dung.", "Tên đăng nhập này đã được sử dụng."],  ].forEach(([bad, good]) => {
    text = text.split(bad).join(good);
  });
  return text;
}

function fixFontInDom(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    const fixed = restoreVietnameseText(fixFontText(node.nodeValue));
    if (fixed !== node.nodeValue) node.nodeValue = fixed;
  });
  root.querySelectorAll?.("[placeholder],[title],[alt]").forEach(el => {
    ["placeholder", "title", "alt"].forEach(attr => {
      const value = el.getAttribute(attr);
      const fixed = restoreVietnameseText(fixFontText(value));
      if (fixed !== value) el.setAttribute(attr, fixed);
    });
  });
}

function ensureModalRoot() {
  let root = q("#modalRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "modalRoot";
    document.body.appendChild(root);
  }
  return root;
}

function appDialog({ title = "Thông báo", message = "", input = false, defaultValue = "", confirm = false } = {}) {
  return new Promise(resolve => {
    const root = ensureModalRoot();
    const safeMessage = restoreVietnameseText(fixFontText(String(message || ""))).replace(/\n/g, "<br>");
    const safeTitle = restoreVietnameseText(fixFontText(String(title || "Thông báo")));
    root.innerHTML = `
      <div class="modal-backdrop app-dialog-backdrop" onclick="event.stopPropagation()">
        <div class="modal app-dialog" onclick="event.stopPropagation()">
          <div class="modal-head"><h2>${safeTitle}</h2></div>
          <div class="modal-body">
            <p>${safeMessage}</p>
            ${input ? `<textarea id="appDialogInput">${restoreVietnameseText(fixFontText(String(defaultValue || "")))}</textarea>` : ""}
            <div class="task-actions" style="justify-content:flex-end;">
              ${(confirm || input) ? `<button class="secondary" id="appDialogCancel">Hủy</button>` : ""}
              <button class="success" id="appDialogOk">${input ? "Lưu" : "OK"}</button>
            </div>
          </div>
        </div>
      </div>
    `;
    const done = value => {
      root.innerHTML = "";
      resolve(value);
    };
    q("#appDialogOk")?.addEventListener("click", () => done(input ? q("#appDialogInput")?.value || "" : true));
    q("#appDialogCancel")?.addEventListener("click", () => done(input ? null : false));
    q("#appDialogInput")?.focus();
  });
}

function appAlert(message) {
  appDialog({ title: "Thông báo", message });
}

function appConfirm(message) {
  return appDialog({ title: "Xác nhận", message, confirm: true });
}

function appPrompt(message, defaultValue = "") {
  return appDialog({ title: "Nhập thông tin", message, input: true, defaultValue });
}
document.addEventListener("DOMContentLoaded", () => {
  fontFixObserver.observe(document.body, { childList: true, subtree: true });
  fixFontInDom(document.body);
});

function fmtMoney(value) {
  return (Number(value) || 0).toLocaleString("vi-VN") + " d";
}

function fmtDate(value) {
  if (!value) return "";
  return value.split("-").reverse().join("/");
}

function today() {
  return dateKey(new Date());
}

function dateKey(d) {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function dateFromKey(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isSundayDate(value) {
  const date = value instanceof Date ? value : dateFromKey(value);
  return date.getDay() === 0;
}

function nowText() {
  return new Date().toLocaleString("vi-VN", { hour12: false });
}

function nowMs() {
  return Date.now();
}

function hoursBetweenMs(start, end = nowMs()) {
  if (!start || end <= start) return 0;
  return (end - start) / 3600000;
}

function getUser(id) {
  return db.users.find(u => u.id === id);
}

function getCustomer(id) {
  return db.customers.find(c => c.id === id);
}

function getOrder(id) {
  return db.orders.find(o => o.id === id);
}

function getStep(id) {
  return STEPS.find(s => s.id === id);
}

function findManagerForStep(stepId) {
  const step = getStep(stepId);
  if (!step) return "";
  const manager = db.users.find(u => !hasRole(u, "admin") && hasRole(u, step.managerRoles) && !u.locked)
    || db.users.find(u => hasRole(u, step.managerRoles) && !u.locked);
  return manager ? manager.id : "";
}

function canSeeOrder(order, user = state.currentUser) {
  if (!user) return false;
  if (order.archived && !(user.id === state.currentUser?.id ? hasActiveRole(user, ["admin", "accountant", "sales_manager", "design_manager", "workshop_manager", "supervisor_manager"]) : hasRole(user, ["admin", "accountant", "sales_manager", "design_manager", "workshop_manager", "supervisor_manager"]))) return false;
  if (user.id === state.currentUser?.id) {
    if (hasActiveRole(user, ["admin", "hr", "accountant"])) return true;
    if (hasActiveRole(user, "sale") && order.currentStepId === "receive") return true;
    if (hasActiveRole(user, "sale") && order.saleId === user.id) return true;
    if (hasActiveRole(user, "sales_manager") && (["receive", "sale", "acceptance"].includes(order.currentStepId) || order.saleId === user.id)) return true;
  } else {
    if (hasRole(user, ["admin", "hr", "accountant"])) return true;
    if (hasRole(user, "sale") && order.currentStepId === "receive") return true;
    if (hasRole(user, "sale") && order.saleId === user.id) return true;
    if (hasRole(user, "sales_manager") && (["receive", "sale", "acceptance"].includes(order.currentStepId) || order.saleId === user.id)) return true;
  }
  const step = getStep(order.currentStepId);
  if (step && step.department === user.department) return true;
  if (order.assigneeId === user.id || order.managerId === user.id) return true;
  if ((db.departmentRequests || []).some(r => r.orderId === order.id && (r.fromManagerId === user.id || r.targetManagerId === user.id || canManageStep(r.targetStepId, user) || canManageStep(r.fromStepId, user)))) return true;
  return db.tasks.some(t => t.orderId === order.id && (t.assigneeId === user.id || t.managerId === user.id));
}

function canManageStep(stepId, user = state.currentUser) {
  const step = getStep(stepId);
  if (!step) return false;
  return user.id === state.currentUser?.id
    ? hasActiveRole(user, step.managerRoles)
    : hasRole(user, step.managerRoles);
}

function visibleOrders() {
  return db.orders.filter(o => canSeeOrder(o));
}

function visibleTasks(scope = "mine") {
  if (hasActiveRole(state.currentUser, "admin") && scope === "all") return db.tasks;
  if (scope === "managed") return db.tasks.filter(t => t.managerId === state.currentUser.id || canManageStep(t.stepId));
  return db.tasks.filter(t => t.assigneeId === state.currentUser.id || (scope === "managed" && t.managerId === state.currentUser.id));
}

function statusClass(status, deadline) {
  if (status === "waiting") return "waiting";
  if (status === "returned") return "returned";
  if (status === "done" || status === "approved") return "done";
  return "";
}

function statusBadge(status, deadline) {
  if (status === "waiting") return `<span class="badge wait">${STATUSES[status]}</span>`;
  if (status === "returned") return `<span class="badge returned">${STATUSES[status]}</span>`;
  if (status === "done" || status === "approved") return `<span class="badge done">${STATUSES[status]}</span>`;
  return `<span class="badge work">${STATUSES[status] || status}</span>`;
}

function render() {
  const session = localStorage.getItem("gomita_company_session");
  state.currentUser = session ? db.users.find(u => u.id === session) : null;
  if (!state.currentUser) return renderLogin();
  trackOverdueOrders();
  const allowed = allowedNav(state.currentUser);
  if (!allowed.includes(state.currentView)) state.currentView = allowed[0];

  q("#app").innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-logo">G</div>
          <div>
            <b>Quản lý GOMITA</b>
            <span>Điều hành công ty nội thất</span>
          </div>
        </div>
        ${renderSidebarAttendanceButton()}
        <nav class="nav">
          ${allowed.map(id => `<button class="nav-${id} ${state.currentView === id ? "active" : ""}" onclick="go('${id}')">${navText(id)}${navBadge(id)}</button>`).join("")}
        </nav>
        <div class="sidebar-footer">
          <p><b>${state.currentUser.name}</b><br>Đang dùng: ${activeRoleName(state.currentUser)}<br><span>${roleNames(state.currentUser)}</span></p>
          <button class="secondary" onclick="openMyAccountForm()" style="width:100%;margin-bottom:8px;">Tài khoản của tôi</button>
          <button class="secondary" onclick="exportData()" style="width:100%;margin-bottom:8px;">Xuất dữ liệu</button>
          <button class="secondary" onclick="q('#importDataInput').click()" style="width:100%;margin-bottom:8px;">Nhập dữ liệu</button>
          <input id="importDataInput" type="file" accept=".json" style="display:none" onchange="importData(event)">
          <button class="secondary" onclick="logout()">Đăng xuất</button>
        </div>
      </aside>
      <main class="main">
        <div class="topbar">
          <div>
            <h1>${NAV_LABELS[state.currentView]}</h1>
            <p>Đơn hàng / công trình là trung tâm của toàn bộ dữ liệu.</p>
          </div>
          <div class="user-pill">
            ${renderRoleSwitcher()}
            <div class="avatar">${state.currentUser.name.charAt(0)}</div>
          </div>
        </div>
        ${renderView()}
      </main>
    </div>
    <div id="modalRoot"></div>
  `;
}

function trackOverdueOrders() {
  let changed = false;
  db.orders.forEach(order => {
    if (!order.deadline || order.deadline >= today() || ["done", "approved", "incomplete"].includes(order.status)) return;
    if (!order.overdueTracked) {
      order.overdueTracked = true;
      order.overdueHistory = order.overdueHistory || [];
      order.overdueHistory.push({
        date: today(),
        time: nowText(),
        stepId: order.currentStepId,
        status: order.status,
        note: "Don qu? deadline, v?n cho qu?n l? ti?p nh?n/x? l? b?nh thu?ng v? luu theo d?i."
      });
      changed = true;
    }
  });
  if (changed) saveDb();
}

function renderLogin() {
  const demo = [
    ["admin", "Quản trị"]
  ];
  q("#app").innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="brand-mark">G</div>
        <h1>Quản lý GOMITA</h1>
        <p>Đăng nhập bằng tài khoản riêng để xem đúng chức năng theo vai trò.</p>
        <label>Tài khoản</label>
        <input id="username" value="admin">
        <label>Mật khẩu</label>
        <input id="password" type="password" value="123456">
        <button onclick="login()">Đăng nhập</button>
        <p id="loginError" style="color:#d34848;margin-top:12px;"></p>
      </div>
      <div class="login-aside">
        <h2>Quản lý đơn hàng, nhân sự, sản xuất và kế toán trên một luồng công việc.</h2>
        <p>Mỗi công việc, ảnh công trình, vật tư, chấm công và chi phí đều liên kết về đúng đơn hàng.</p>
        <div class="demo-users">
          ${demo.map(([u, label]) => `<button onclick="fillLogin('${u}')">${label}</button>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function fillLogin(username) {
  q("#username").value = username;
  q("#password").value = "123456";
}

function login() {
  const username = q("#username").value.trim();
  const password = q("#password").value;
  const user = db.users.find(u => u.username === username && u.password === password && !u.locked && (u.approvalStatus || "approved") === "approved");
  if (!user) {
    q("#loginError").textContent = "Sai t?i kho?n, m?t kh?u, t?i kho?n b?< kh?a ho?c ?'ang ch? Qu?n tr?< x?c nh?n.";
    return;
  }
  localStorage.setItem("gomita_company_session", user.id);
  state.currentView = allowedNav(user)[0];
  render();
}

function allowedNav(user) {
  return ROLE_NAV[activeRole(user)] || ["work"];
}

function renderRoleSwitcher() {
  const roles = userRoles(state.currentUser);
  if (roles.length <= 1) return `<span>${activeRoleName(state.currentUser)}</span>`;
  return `
    <label style="display:flex;align-items:center;gap:8px;">
      <span>Vị trí</span>
      <select style="width:170px;" onchange="switchActiveRole(this.value)">
        ${roles.map(role => `<option value="${role}" ${activeRole(state.currentUser) === role ? "selected" : ""}>${ROLES[role]}</option>`).join("")}
      </select>
    </label>
  `;
}

function switchActiveRole(role) {
  if (!userRoles(state.currentUser).includes(role)) return;
  localStorage.setItem("gomita_active_role_" + state.currentUser.id, role);
  state.currentView = (ROLE_NAV[role] || ["work"])[0];
  render();
}

function logout() {
  localStorage.removeItem("gomita_company_session");
  render();
}

function exportData() {
  saveDb();
  const payload = {
    app: "quan-ly-gomita",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: db
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "du-lieu-quan-ly-gomita-" + today().replaceAll("-", "") + ".json";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }, 100);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      const imported = parsed.data || parsed;
      if (!imported.users || !imported.customers || !imported.orders || !imported.tasks) {
        appAlert("File du lieu khong dung dinh dang Quan ly GOMITA.");
        return;
      }
      db = migrateDb(imported);
      saveDb();
      appAlert("Da nhap du lieu thanh cong. Phan mem se doc du lieu nay de test tiep luong don hang.");
      render();
    } catch (err) {
      console.error(err);
      appAlert("Khong doc duoc file du lieu.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function go(view) {
  state.currentView = view;
  if (view === "customers" && hasActiveRole(state.currentUser, ["admin", "sales_manager"]) && pendingCustomerCount() > 0) {
    state.customerTab = "pending";
  }
  render();
}

function pendingCustomerCount() {
  if (!state.currentUser) return 0;
  if (!hasActiveRole(state.currentUser, ["admin", "sales_manager"])) return 0;
  return db.customers.filter(c => c.approvalStatus === "pending").length;
}

function navText(id) {
  return NAV_LABELS[id];
}

function navBadge(id) {
  const count = navBadgeCount(id);
  return count > 0 ? `<span class="nav-badge">${count}</span>` : "";
}

function navBadgeCount(id) {
  if (!state.currentUser) return 0;
  if (id === "notifications") return unreadNotifications().length;
  if (id === "customers") return pendingCustomerCount();
  if (id === "work") return visibleTasks(hasActiveRole(state.currentUser, "admin") ? "managed" : "mine").filter(t => taskNeedsAction(t)).length + pendingAttendanceActionCount();
  if (id === "orders") return visibleOrders().filter(o => orderNeedsManagerAction(o)).length;
  if (id === "reports") return visibleOrders().filter(o => o.overdueTracked || orderWaitingLevel(o) === "director").length;
  return 0;
}

function notificationReadKey() {
  return "gomita_read_notifications_" + state.currentUser.id;
}

function readNotificationIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(notificationReadKey()) || "[]"));
  } catch {
    return new Set();
  }
}

function saveReadNotificationIds(ids) {
  localStorage.setItem(notificationReadKey(), JSON.stringify([...ids]));
}

function allNotifications() {
  if (!state.currentUser) return [];
  const items = [];
  visibleTasks(hasActiveRole(state.currentUser, "admin") ? "managed" : "mine")
    .filter(taskNeedsAction)
    .forEach(t => items.push({
      id: `task:${t.id}:${t.status}`,
      type: "C?ng vi??c",
      title: t.title,
      body: `${getOrder(t.orderId)?.code || t.orderId} - ${getStep(t.stepId)?.name || ""}: ${STATUSES[t.status] || t.status}`,
      action: `openOrderDetail('${t.orderId}')`
    }));
  visibleMakeupRequests()
    .filter(r => canApproveMakeupRequest(r) && r.status === "pending")
    .forEach(r => items.push({
      id: `makeup:${r.id}:${Object.keys(r.approvals || {}).join("-")}`,
      type: "Chấm công",
      title: "Yêu cầu chấm công bù cần xác nhận",
      body: `${getUser(r.userId)?.name || ""} thiếu ${r.items.length} mốc`,
      action: "state.currentView='work'; render()"
    }));
  visibleOvertimeRequests()
    .filter(r => canApproveOvertimeRequest(r) && r.status === "pending" && nextOvertimeApproval(r) !== "employee")
    .forEach(r => items.push({
      id: `overtime:${r.id}:${Object.keys(r.approvals || {}).join("-")}`,
      type: "Tăng ca",
      title: "Yêu cầu tăng ca cần xác nhận",
      body: `${getUser(r.userId)?.name || ""} đăng ký ${Number(r.hours || 0).toFixed(1)} giờ`,
      action: "state.currentView='work'; render()"
    }));
  visibleOrders()
    .filter(orderNeedsManagerAction)
    .forEach(o => items.push({
      id: `order:${o.id}:${o.status}:${o.waitPauseConfirmedDate || ""}`,
      type: "Đơn hàng",
      title: `${o.code} cần xử lý`,
      body: `${getStep(o.currentStepId)?.name || ""} - ${STATUSES[o.status] || o.status}`,
      action: `openOrderDetail('${o.id}')`
    }));
  const missing = missingAttendanceSlotsForMakeup(state.currentUser.id);
  const missingKey = missingAttendanceDismissKey(missing);
  if (missing.length && !localStorage.getItem(missingKey)) {
    items.push({
      id: `missing-attendance:${missingKey}`,
      type: "Chấm công",
      title: "Bạn đang thiếu công",
      body: `Bạn đang thiếu ${missing.length} mốc chấm công. Có muốn chấm công bù không?`,
      action: "handleMissingAttendanceNotification()"
    });
  }
  visibleOvertimeRequests()
    .filter(r => r.userId === state.currentUser.id && nextOvertimeApproval(r) === "employee")
    .forEach(r => items.push({
      id: `overtime-employee:${r.id}:${r.start}:${r.end}`,
      type: "Tăng ca",
      title: "Quản lý đăng ký tăng ca cho bạn",
      body: `Quản lý ${getUser(r.createdBy)?.name || ""} đã đăng ký tăng ca ${formatDateTimeLocal(r.start)} - ${formatDateTimeLocal(r.end)}. Bạn cần xác nhận thời gian có đúng không.`,
      action: "state.currentView='work'; render()"
    }));
  return items;
}

function unreadNotifications() {
  const read = readNotificationIds();
  return allNotifications().filter(n => !read.has(n.id));
}

function markNotificationRead(id) {
  const read = readNotificationIds();
  read.add(id);
  saveReadNotificationIds(read);
}

function openNotification(id) {
  const item = allNotifications().find(n => n.id === id);
  if (!item) return;
  markNotificationRead(id);
  if (item.action) {
    new Function(item.action)();
  } else {
    render();
  }
}

function markAllNotificationsRead() {
  const read = readNotificationIds();
  allNotifications().forEach(n => read.add(n.id));
  saveReadNotificationIds(read);
  render();
}

function taskNeedsAction(t) {
  if (t.assigneeId === state.currentUser.id && ["assigned", "working", "returned"].includes(t.status)) return true;
  if ((t.managerId === state.currentUser.id || canManageStep(t.stepId)) && t.status === "waiting") return true;
  return false;
}

function pendingAttendanceActionCount() {
  const makeup = visibleMakeupRequests().filter(r => canApproveMakeupRequest(r) && r.status === "pending").length;
  const overtime = visibleOvertimeRequests().filter(r => canApproveOvertimeRequest(r) && r.status === "pending").length;
  const raw = db.attendance.filter(a => attendanceNeedsConfirmation(a)).length;
  const missing = canUseDailyAttendance() ? missingAttendanceSlotsForMakeup(state.currentUser.id) : [];
  const missingNotice = missing.length && !localStorage.getItem(missingAttendanceDismissKey(missing)) ? 1 : 0;
  return makeup + overtime + raw + missingNotice;
}

function orderNeedsManagerAction(order) {
  return (canReceiveDepartment(order) || canConfirmStepTransfer(order) || canConfirmWaitingPause(order) || orderWaitingLevel(order) !== "") && canSeeOrder(order);
}

function renderView() {
  const views = {
    dashboard: renderDashboard,
    notifications: renderNotifications,
    orders: renderOrders,
    incomplete: renderIncompleteOrders,
    customers: renderCustomers,
    work: renderWork,
    employees: renderEmployees,
    accounting: renderAccounting,
    materials: renderMaterials,
    files: renderFiles,
    reports: renderReports
  };
  return (views[state.currentView] || renderDashboard)();
}

function renderDashboard() {
  const orders = visibleOrders();
  const trackedDeadline = orders.filter(o => o.overdueTracked).length;
  const completed = orders.filter(o => o.currentStepId === "close" || o.status === "done").length;
  const revenue = orders.reduce((s, o) => s + o.estimate, 0);
  const cost = orders.reduce((s, o) => s + o.actualCost, 0);
  const pendingCustomers = hasActiveRole(state.currentUser, ["admin", "sales_manager"])
    ? db.customers.filter(c => c.approvalStatus === "pending")
    : [];
  return `
    <section class="grid metrics">
      <div class="metric"><span>Tổng đơn hàng</span><b>${orders.length}</b></div>
      <div class="metric"><span>Đơn đang triển khai</span><b>${orders.length - completed}</b></div>
      <div class="metric"><span>Theo dõi deadline</span><b>${trackedDeadline}</b></div>
      <div class="metric"><span>Lợi nhuận dự kiến</span><b>${fmtMoney(revenue - cost)}</b></div>
    </section>
    ${pendingCustomers.length ? `
      <section class="panel" style="margin-top:14px;border-left:4px solid var(--orange);">
        <div class="toolbar" style="margin-bottom:0;">
          <div>
            <h2 style="margin-bottom:6px;">Khách hàng chờ phê duyệt</h2>
            <p style="margin:0;color:var(--muted);">Sale vừa tạo khách hàng mới, Quản lý sale cần kiểm tra trước khi cho tạo đơn.</p>
          </div>
          <button onclick="state.customerTab='pending'; go('customers')">Xem danh sách</button>
        </div>
        <div class="table-wrap" style="margin-top:12px;">
          <table>
            <thead><tr><th>Khách hàng</th><th>Sale tạo</th><th>SĐT</th><th>Nhu cầu</th><th>Thao tác</th></tr></thead>
            <tbody>${pendingCustomers.slice(0, 5).map(c => `<tr>
              <td><b>${c.name}</b><br>${c.address}</td>
              <td>${getUser(c.createdBy)?.name || ""}</td>
              <td>${c.phone}</td>
              <td>${c.need}</td>
              <td><button class="success" onclick="approveCustomer('${c.id}')">Duyệt</button> <button class="danger" onclick="rejectCustomer('${c.id}')">Trả lại</button></td>
            </tr>`).join("")}</tbody>
          </table>
        </div>
      </section>
    ` : ""}
    <section class="two-col" style="margin-top:14px;">
      <div class="panel">
        <h2>Công trình đang tắc theo công đoạn</h2>
        <div class="chart">
          ${STEPS.map(step => {
            const count = orders.filter(o => o.currentStepId === step.id && ["waiting", "returned"].includes(o.status)).length;
            return bar(step.name, count, Math.max(1, orders.length));
          }).join("")}
        </div>
      </div>
      <div class="panel">
        <h2>Công việc cần chú ý</h2>
        ${db.tasks.filter(t => canSeeOrder(getOrder(t.orderId))).slice(0, 6).map(renderTaskMini).join("") || `<div class="empty">Chưa có công việc cần chú ý.</div>`}
      </div>
    </section>
    <section class="panel" style="margin-top:14px;">
      <h2>Đơn hàng mới nhất</h2>
      ${renderOrderTable(orders.slice(0, 6))}
    </section>
  `;
}

function renderNotifications() {
  const items = unreadNotifications();
  return `
    <section class="panel">
      <div class="toolbar">
        <div>
          <h2>Thông báo</h2>
          <p class="muted">Bấm vào thông báo để đọc/xử lý. Sau khi đọc, badge sẽ mất.</p>
        </div>
        ${items.length ? `<button class="secondary" onclick="markAllNotificationsRead()">Đánh dấu đã đọc hết</button>` : ""}
      </div>
      ${items.map(n => `
        <div class="task-card notification-card">
          <h3>${n.title}</h3>
          <p><b>${n.type}</b> - ${n.body}</p>
          <div class="task-actions">
            <button class="success" onclick="openNotification('${n.id}')">Đọc / xử lý</button>
            <button class="secondary" onclick="markNotificationRead('${n.id}'); render()">Bỏ qua</button>
          </div>
        </div>
      `).join("") || `<div class="empty">Không có thông báo mới.</div>`}
    </section>
  `;
}

function bar(label, value, max) {
  return `
    <div class="bar-row">
      <span>${label}</span>
      <div class="bar"><span style="width:${Math.min(100, value / max * 100)}%"></span></div>
      <b>${value}</b>
    </div>
  `;
}

function renderOrders() {
  const orders = visibleOrders().filter(o => {
    if (o.incomplete || (o.archived && state.statusFilter !== "completed")) return false;
    if (state.statusFilter === "completed" && !o.archived && o.status !== "done") return false;
    const customer = getCustomer(o.customerId);
    const haystack = `${o.code} ${o.projectName} ${customer?.name || ""}`.toLowerCase();
    const matchSearch = haystack.includes(state.search.toLowerCase());
    const matchStatus = state.statusFilter === "all" || state.statusFilter === "completed" || o.status === state.statusFilter;
    return matchSearch && matchStatus;
  });

  return `
    <div class="toolbar">
      <div class="toolbar-left">
        <input placeholder="Tìm mã đơn, khách, công trình" value="${state.search}" oninput="state.search=this.value; render()">
        <select onchange="state.statusFilter=this.value; render()">
          <option value="all">Tất cả trạng thái</option>
          ${Object.entries(STATUSES).map(([id, name]) => `<option value="${id}" ${state.statusFilter === id ? "selected" : ""}>${name}</option>`).join("")}
          <option value="completed" ${state.statusFilter === "completed" ? "selected" : ""}>Đơn hàng đã hoàn thành</option>
        </select>
      </div>
      <div class="toolbar-right">
        ${canCreateOrder() ? `<button onclick="openOrderForm()">Tạo đơn hàng</button>` : ""}
      </div>
    </div>
    <div class="kanban">
      ${STEPS.map(step => {
        const list = orders
          .filter(o => o.currentStepId === step.id)
          .sort(orderLaneSort);
        return `
          <section class="lane">
            <h3>${step.name}<span class="lane-count">${list.length}</span></h3>
            ${list.map(renderOrderCard).join("") || `<div class="empty">Không có đơn</div>`}
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function orderLaneSort(a, b) {
  if (a.status === "returned" && b.status !== "returned") return -1;
  if (b.status === "returned" && a.status !== "returned") return 1;
  return Number(b.returnedAtMs || 0) - Number(a.returnedAtMs || 0);
}

function renderIncompleteOrders() {
  const orders = visibleOrders().filter(o => o.incomplete && canViewIncompleteOrders());
  if (!canViewIncompleteOrders()) return `<section class="panel"><div class="empty">Bạn không có quyền xem khu vực này.</div></section>`;
  return `
    <section class="panel">
      <h2>Đơn hàng không hoàn thành</h2>
      <p class="muted">Khu vực này chỉ dành cho quản lý bộ phận trở lên xem lại các đơn đã mất hoặc không tiếp tục.</p>
      ${renderOrderTable(orders)}
    </section>
  `;
}

function canViewIncompleteOrders() {
  return hasActiveRole(state.currentUser, ["admin", "sales_manager", "design_manager", "workshop_manager", "accountant"]);
}

function canCreateOrder() {
  return hasActiveRole(state.currentUser, ["admin", "sales_manager", "sale"]);
}

function renderOrderCard(order) {
  const customer = getCustomer(order.customerId);
  const step = getStep(order.currentStepId);
  const canClaim = canClaimOrder(order);
  const canReceive = canReceiveDepartment(order);
  const canConfirmTransfer = canConfirmStepTransfer(order);
  const waitLevel = orderWaitingLevel(order);
  return `
    <article class="order-card ${statusClass(order.status, order.deadline)}" onclick="openOrderDetail('${order.id}')">
      <b>${order.code}</b>
      <p>${customer?.name || "Khách hàng"} - ${order.projectName}</p>
      <p>Sale: ${getUser(order.saleId)?.name || ""}</p>
      <p>Công đoạn: ${step?.name || ""}</p>
      <p>Người xử lý: ${orderAssigneeNames(order)}</p>
      <div class="progress"><span style="width:${order.progress}%"></span></div>
      <p>Deadline: ${fmtDate(order.deadline)} - ${daysInStep(order)} ngày ở công đoạn</p>
      ${orderNeedsFollowUp(order) ? `<p class="warning-text">Cảnh báo: cần gọi lại/cập nhật khách.</p>` : ""}
      ${order.waitPaused ? `<p class="warning-text">Đang tạm dừng: ${order.waitPauseReason || ""}</p>` : ""}
      ${waitLevel === "priority" ? `<p class="warning-text">Ưu tiên đầu tiên: chờ quá 4 giờ.</p>` : ""}
      ${waitLevel === "director" ? `<p class="red-text">Luồng đỏ Giám đốc: chờ quá 8 giờ.</p>` : ""}
      <div class="badge-row">${statusBadge(order.status, order.deadline)}</div>
      ${canClaim ? `<button class="success mini-action" onclick="event.stopPropagation(); claimOrder('${order.id}')">Nhận đơn</button>` : ""}
      ${canConfirmTransfer ? `<button class="success mini-action" onclick="event.stopPropagation(); confirmStepTransfer('${order.id}')">Xác nhận chuyển</button>` : ""}
      ${canReceive ? `<button class="success mini-action" onclick="event.stopPropagation(); receiveDepartment('${order.id}')">Tiếp nhận</button>` : ""}
    </article>
  `;
}

function canClaimOrder(order) {
  const customer = getCustomer(order.customerId);
  return hasActiveRole(state.currentUser, "sale")
    && order.currentStepId === "receive"
    && order.status === "unassigned"
    && customer?.approvalStatus === "approved";
}

function canReceiveDepartment(order) {
  return canManageStep(order.currentStepId)
    && order.currentStepId !== "receive"
    && order.status === "waiting"
    && !order.assigneeId;
}

function orderAssigneeNames(order) {
  const taskAssignees = db.tasks
    .filter(t => t.orderId === order.id && t.stepId === order.currentStepId && ["assigned", "working", "returned", "waiting"].includes(t.status))
    .map(t => getUser(t.assigneeId)?.name)
    .filter(Boolean);
  const names = taskAssignees.length ? taskAssignees : [getUser(order.assigneeId)?.name].filter(Boolean);
  return [...new Set(names)].join(", ") || "Chưa giao";
}

function startOrderWaiting(order, reason) {
  const time = nowText();
  const timeMs = nowMs();
  order.status = "waiting";
  order.waitStartedAt = time;
  order.waitStartedAtMs = timeMs;
  order.waitPaused = false;
  order.waitPauseReason = "";
  order.waitPauseAt = "";
  order.waitPauseAtMs = 0;
  order.waitPauseConfirmedDate = "";
  order.waitIntervals = order.waitIntervals || [];
  order.waitIntervals.push({
    startText: time,
    startMs: timeMs,
    endText: "",
    endMs: 0,
    reason,
    paused: false,
    pauseReason: ""
  });
}

function closeOrderWaiting(order, closedBy) {
  if (!order || order.status !== "waiting") return;
  const time = nowText();
  const timeMs = nowMs();
  const current = [...(order.waitIntervals || [])].reverse().find(item => !item.endMs);
  if (current) {
    current.endText = time;
    current.endMs = timeMs;
    current.closedBy = closedBy || state.currentUser?.id || "";
  }
  order.waitStartedAt = "";
  order.waitStartedAtMs = 0;
  order.waitPaused = false;
  order.waitPauseReason = "";
  order.waitPauseAt = "";
  order.waitPauseAtMs = 0;
  order.waitPauseConfirmedDate = "";
}

function resetWaitingClock(order, reason = "Thao t?c c?p nh?t ?'on h?ng") {
  if (!order || order.status !== "waiting") return;
  const time = nowText();
  const timeMs = nowMs();
  const current = [...(order.waitIntervals || [])].reverse().find(item => !item.endMs);
  if (current) {
    current.resetText = time;
    current.resetMs = timeMs;
    current.resetReason = reason;
  }
  order.waitStartedAt = time;
  order.waitStartedAtMs = timeMs;
}

function orderWaitingHours(order) {
  if (!order || order.status !== "waiting" || !order.waitStartedAtMs) return 0;
  return workingHoursBetweenMs(Number(order.waitStartedAtMs), nowMs());
}

function workingHoursBetweenMs(startMs, endMs = nowMs()) {
  if (!startMs || !endMs || endMs <= startMs) return 0;
  let totalMs = 0;
  forEachDateBetween(startMs, endMs, date => {
    WORKDAY_INTERVALS.forEach(([startTime, endTime]) => {
      const interval = clampInterval(dateTimeMs(date, startTime), dateTimeMs(date, endTime), startMs, endMs);
      if (interval.end > interval.start) totalMs += interval.end - interval.start;
    });
  });
  return totalMs / 3600000;
}

function orderWaitingLevel(order) {
  if (!order || order.status !== "waiting" || order.waitPaused) return "";
  if (order.currentStepId === "close") return "";
  const hours = orderWaitingHours(order);
  if (hours >= 8) return "director";
  if (hours >= 4) return "priority";
  return "";
}

function canPauseWaitingOrder(order) {
  return order
    && !["done", "approved", "incomplete"].includes(order.status)
    && !order.archived
    && !order.waitPaused
    && order.currentStepId !== "close"
    && canManageStep(order.currentStepId);
}

async function pauseWaitingOrder(orderId) {
  const order = getOrder(orderId);
  if (!canPauseWaitingOrder(order)) return;
  const reason = await appPrompt("Nhập lý do tạm dừng đơn hàng:", "Chờ đơn hàng trước xong");
  if (!reason) return;
  const time = nowText();
  order.waitPaused = true;
  order.waitPauseReason = reason;
  order.waitPauseAt = time;
  order.waitPauseAtMs = nowMs();
  order.waitPauseConfirmedDate = today();
  const current = [...(order.waitIntervals || [])].reverse().find(item => !item.endMs);
  if (current) {
    current.paused = true;
    current.pauseReason = reason;
    current.pauseConfirmedDates = [...(current.pauseConfirmedDates || []), today()];
  }
  order.note = `${order.note || ""}\n[${time} - ${state.currentUser.name}] Tạm dừng đơn hàng ở công đoạn ${getStep(order.currentStepId)?.name || ""}. Lý do: ${reason}.`.trim();
  log(`${state.currentUser.name} tạm dừng đơn ${order.code}: ${reason}`);
  saveDb();
  openOrderDetail(order.id);
}

function canConfirmWaitingPause(order) {
  return order
    && order.status === "waiting"
    && order.waitPaused
    && order.waitPauseConfirmedDate !== today()
    && canManageStep(order.currentStepId);
}

async function confirmWaitingPause(orderId) {
  const order = getOrder(orderId);
  if (!canConfirmWaitingPause(order)) return;
  const note = await appPrompt("X?c nh?n ti?p t?c t?m d?ng h?m nay. C? c?n b?. sung l? do kh?ng?", order.waitPauseReason || "Ti?p t?c t?m d?ng");
  if (note === null) return;
  order.waitPauseReason = note || order.waitPauseReason;
  order.waitPauseConfirmedDate = today();
  const current = [...(order.waitIntervals || [])].reverse().find(item => !item.endMs);
  if (current) {
    current.pauseReason = order.waitPauseReason;
    current.pauseConfirmedDates = [...(current.pauseConfirmedDates || []), today()];
  }
  order.note = `${order.note || ""}\n[${nowText()} - ${state.currentUser.name}] X?c nh?n ti?p t?c t?m d?ng ?'on h?ng trong ng?y ${fmtDate(today())}. L? do: ${order.waitPauseReason}.`.trim();
  saveDb();
  openOrderDetail(order.id);
}

async function resumeWaitingOrder(orderId) {
  const order = getOrder(orderId);
  if (!order || !order.waitPaused || !canManageStep(order.currentStepId)) return;
  const note = await appPrompt("Ghi ch? ti?p t?c tri?fn khai:", "Ti?p t?c tri?fn khai ?'on h?ng");
  if (note === null) return;
  const time = nowText();
  const timeMs = nowMs();
  const current = [...(order.waitIntervals || [])].reverse().find(item => !item.endMs);
  if (current) {
    current.resumeText = time;
    current.resumeMs = timeMs;
  }
  order.waitPaused = false;
  order.waitPauseReason = "";
  order.waitPauseAt = "";
  order.waitPauseAtMs = 0;
  order.waitPauseConfirmedDate = "";
  order.waitStartedAt = time;
  order.waitStartedAtMs = timeMs;
  order.note = `${order.note || ""}\n[${time} - ${state.currentUser.name}] Ti?p t?c tri?fn khai ?Y c?ng ?'o?n ${getStep(order.currentStepId)?.name || ""}: ${note || ""}`.trim();
  saveDb();
  openOrderDetail(order.id);
}

function renderWaitingAlert(order) {
  if (!order) return "";
  if (order.waitPaused) {
    return `<div class="panel wait-paused-panel"><h2>Đơn đang tạm dừng</h2><p>Lý do: ${restoreVietnameseText(fixFontText(order.waitPauseReason || "Chưa ghi lý do"))}</p><p>Xác nhận gần nhất: ${fmtDate(order.waitPauseConfirmedDate)}</p>${canConfirmWaitingPause(order) ? `<button class="warning" onclick="confirmWaitingPause('${order.id}')">Xác nhận tạm dừng hôm nay</button>` : ""}${canManageStep(order.currentStepId) ? `<button class="success" onclick="resumeWaitingOrder('${order.id}')">Tiếp tục triển khai</button>` : ""}</div>`;
  }
  if (order.status !== "waiting") {
    return canPauseWaitingOrder(order) ? `<div class="panel wait-paused-panel"><button class="warning" onclick="pauseWaitingOrder('${order.id}')">Tạm dừng đơn hàng</button></div>` : "";
  }
  const level = orderWaitingLevel(order);
  const hours = orderWaitingHours(order).toFixed(1);
  if (level === "director") return `<div class="panel red-flow-panel"><h2>Luồng đỏ gửi Giám đốc</h2><p>Đơn đã chờ xác nhận/tiếp nhận ${hours} giờ. Cần xử lý ưu tiên cấp cao.</p>${canPauseWaitingOrder(order) ? `<button class="warning" onclick="pauseWaitingOrder('${order.id}')">Tạm dừng đơn hàng</button>` : ""}</div>`;
  if (level === "priority") return `<div class="panel priority-panel"><h2>Ưu tiên đầu tiên</h2><p>Đơn đã chờ xác nhận/tiếp nhận ${hours} giờ. Quản lý cần xử lý hoặc tạm dừng có lý do.</p>${canPauseWaitingOrder(order) ? `<button class="warning" onclick="pauseWaitingOrder('${order.id}')">Tạm dừng đơn hàng</button>` : ""}</div>`;
  return canPauseWaitingOrder(order) ? `<div class="panel wait-paused-panel"><button class="warning" onclick="pauseWaitingOrder('${order.id}')">Tạm dừng đơn hàng</button></div>` : "";
}

function renderDeadlineTracking(order) {
  if (!order?.overdueTracked) return "";
  const latest = [...(order.overdueHistory || [])].reverse()[0];
  return `<p class="muted"><b>Theo dõi deadline:</b> Đã lưu theo dõi từ ${fmtDate(latest?.date || today())}. Quản lý vẫn tiếp nhận/xử lý bình thường.</p>`;
}

function daysInStep(order) {
  const start = new Date(order.stepStartedAt);
  const now = new Date();
  return Math.max(1, Math.ceil((now - start) / 86400000));
}

function renderOrderTable(orders) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Mã đơn</th><th>Công trình</th><th>Khách hàng</th><th>Công đoạn</th><th>Người xử lý</th><th>Deadline</th><th>Trạng thái</th></tr></thead>
        <tbody>
          ${orders.map(o => `<tr onclick="openOrderDetail('${o.id}')" style="cursor:pointer;">
            <td><b>${o.code}</b></td>
            <td>${o.projectName}</td>
            <td>${getCustomer(o.customerId)?.name || ""}</td>
            <td>${getStep(o.currentStepId)?.name || ""}</td>
            <td>${orderAssigneeNames(o)}</td>
            <td>${fmtDate(o.deadline)}</td>
            <td>${statusBadge(o.status, o.deadline)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderWork() {
  const managedAllowed = db.tasks.some(t => t.managerId === state.currentUser.id || canManageStep(t.stepId)) || hasActiveRole(state.currentUser, "admin");
  const scope = state.taskTab === "managed" && managedAllowed ? "managed" : "mine";
  const tasks = visibleTasks(scope);
  const showCompanyAttendance = canSeeAttendanceAndHours();
  const showPersonalTimesheet = canSeeAttendanceAndHours();
  return `
    ${renderDailyAttendancePanel()}
    <div class="tabs">
      <button class="${scope === "mine" ? "active" : ""}" onclick="state.taskTab='mine'; render()">Việc của tôi</button>
      ${managedAllowed ? `<button class="${scope === "managed" ? "active" : ""}" onclick="state.taskTab='managed'; render()">Việc chờ quản lý</button>` : ""}
    </div>
    ${scope === "mine" ? renderMyTaskSections(tasks) : `<section class="panel">${tasks.length ? tasks.map(renderTaskCard).join("") : `<div class="empty">Chưa có việc chờ quản lý xử lý.</div>`}</section>`}
    ${showPersonalTimesheet ? renderPersonalTimesheet(state.currentUser.id) : ""}
    ${showCompanyAttendance ? renderAttendance() : ""}
  `;
}

function canSeeAttendanceAndHours() {
  return hasActiveRole(state.currentUser, ["admin", "accountant"]) || state.currentUser?.department === "admin";
}

function renderMyTaskSections(tasks) {
  const normalTasks = tasks.filter(t => !["notification", "department_request"].includes(t.kind));
  const waitingReceive = normalTasks.filter(t =>
    (t.kind === "receive" && t.status === "waiting")
    || (t.status === "assigned" && !t.acceptedAt)
  );
  const working = normalTasks.filter(t => ["working", "returned"].includes(t.status) || (t.status === "assigned" && t.acceptedAt));
  const waitingConfirm = normalTasks.filter(t => t.status === "waiting" && t.kind !== "receive");
  const completed = normalTasks.filter(t => ["approved", "done"].includes(t.status));
  return `
    <section class="panel task-section">
      <h2>Việc chờ nhận / sắp làm</h2>
      ${waitingReceive.length ? waitingReceive.map(renderTaskCard).join("") : `<div class="empty">Không có việc chờ nhận.</div>`}
    </section>
    <section class="panel task-section">
      <h2>Việc đang làm</h2>
      ${working.length ? working.map(renderTaskCard).join("") : `<div class="empty">Không có việc đang làm.</div>`}
    </section>
    <section class="panel task-section">
      <h2>Đã hoàn thành - chờ xác nhận</h2>
      ${waitingConfirm.length ? waitingConfirm.map(renderTaskCard).join("") : `<div class="empty">Không có việc đang chờ xác nhận.</div>`}
    </section>
    <section class="panel task-section">
      <h2>Đã xác nhận / đã hoàn thành</h2>
      ${completed.length ? completed.map(renderTaskCard).join("") : `<div class="empty">Chưa có việc đã xác nhận.</div>`}
    </section>
    ${normalTasks.length ? "" : `<section class="panel"><div class="empty">Hôm nay không có công việc được giao. Trường hợp này vẫn được tính là đi làm và không tính là nghỉ.</div></section>`}
  `;
}

function renderDailyAttendancePanel() {
  if (!canUseDailyAttendance()) return "";
  const slot = currentAttendanceSlot();
  const checked = slot ? hasCheckedInSlot(today(), slot.id) : false;
  const missing = missingAttendanceSlotsForMakeup(state.currentUser.id);
  const timeNote = isSundayDate(new Date()) ? "Chủ nhật không chấm công thường, vẫn có thể đăng ký tăng ca." : slot ? `Đang trong giờ chấm công ${slot.start} - ${slot.end}.` : "Nút chấm công mở theo 4 khung giờ: 07:30, 11:30, 13:30, 17:30.";
  return `
    <section class="attendance-checkin panel">
      <div>
        <h2>Chấm công trong ngày</h2>
        <p>${checked ? `Bạn đã chấm công mốc ${slot.label} hôm nay.` : timeNote}</p>
        <p class="muted">Một ngày đủ 4 lần chấm công sẽ tính là 1 công.</p>
      </div>
      <div class="attendance-actions">
        <button class="success" onclick="openDailyAttendanceCamera()" ${!slot || checked ? "disabled" : ""}>Chấm công</button>
        ${missing.length && slot ? `<button class="secondary" onclick="openMakeupAttendanceForm()">Chấm công bù (${missing.length})</button>` : ""}
        ${isOutsideOfficeHours() ? `<button class="secondary" onclick="openOvertimeForm()">Đăng ký tăng ca</button>` : ""}
      </div>
    </section>
  `;
}

function canUseDailyAttendance() {
  return Boolean(state.currentUser)
    && !hasActiveRole(state.currentUser, "admin")
    && state.currentUser.department !== "admin";
}

function renderSidebarAttendanceButton() {
  if (!canUseDailyAttendance()) return "";
  const slot = currentAttendanceSlot();
  const checked = slot && hasCheckedInSlot(today(), slot.id);
  const label = isSundayDate(new Date()) ? "Chủ nhật không chấm công" : slot ? checked ? `Đã chấm ${slot.label}` : `Chấm công ${slot.label}` : "Ngoài giờ chấm công";
  return `
    <div class="sidebar-attendance">
      <button class="success" onclick="openDailyAttendanceCamera()" ${!slot || checked ? "disabled" : ""}>${label}</button>
    </div>
  `;
}

function currentAttendanceSlot(date = new Date()) {
  if (isSundayDate(date)) return null;
  const minutes = date.getHours() * 60 + date.getMinutes();
  return ATTENDANCE_SLOTS.find((slot, index) => {
    const start = timeToMinutes(slot.start);
    const end = timeToMinutes(slot.end);
    const next = ATTENDANCE_SLOTS[index + 1];
    const overlapsNextStart = next && next.start === slot.end;
    return minutes >= start && (overlapsNextStart ? minutes < end : minutes <= end);
  });
}

function timeToMinutes(value) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function isOutsideOfficeHours(date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes < timeToMinutes("07:30") || minutes > timeToMinutes("17:30");
}

function isLateForSlot(slot, date = new Date()) {
  if (!slot?.official) return false;
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes > timeToMinutes(slot.official);
}

function hasCheckedInSlot(date, slotId, userId = state.currentUser.id) {
  return db.attendance.some(a =>
    a.userId === userId &&
    a.type === "daily_checkin" &&
    a.status !== "B?< t? ch?'i" &&
    (a.date || "") === date &&
    a.slotId === slotId
  );
}

function missingAttendanceSlotsForMakeup(userId) {
  const days = daysThisMonthBeforeToday();
  const pendingKeys = new Set((db.makeupRequests || [])
    .filter(r => r.userId === userId && r.status !== "rejected")
    .flatMap(r => (r.items || []).map(item => `${item.date}|${item.slotId}`)));
  return days.flatMap(date => ATTENDANCE_SLOTS
    .filter(slot => !hasCheckedInSlot(date, slot.id, userId) && !pendingKeys.has(`${date}|${slot.id}`))
    .map(slot => ({ date, slotId: slot.id, label: slot.label })));
}

function missingAttendanceDismissKey(missing = missingAttendanceSlotsForMakeup(state.currentUser?.id)) {
  const key = (missing || []).map(item => `${item.date}|${item.slotId}`).sort().join(",");
  return `gomita_dismiss_missing_attendance_${state.currentUser?.id}_${key}`;
}

async function handleMissingAttendanceNotification() {
  const missing = missingAttendanceSlotsForMakeup(state.currentUser.id);
  if (!missing.length) return render();
  const yes = await appConfirm(`Bạn đang thiếu ${missing.length} mốc chấm công. Có muốn chấm công bù không?`);
  if (yes) {
    openMakeupAttendanceForm();
  } else {
    localStorage.setItem(missingAttendanceDismissKey(missing), "1");
    render();
  }
}

function daysThisMonthBeforeToday() {
  const now = new Date();
  const result = [];
  for (let day = 1; day < now.getDate(); day++) {
    const date = new Date(now.getFullYear(), now.getMonth(), day);
    if (isSundayDate(date)) continue;
    result.push(dateKey(date));
  }
  return result;
}

function slotLabel(slotId) {
  return ATTENDANCE_SLOTS.find(s => s.id === slotId)?.label || slotId;
}

function renderPersonalTimesheet(userId) {
  const summary = attendanceSummary(userId);
  const user = getUser(userId);
  return `
    <section class="panel" style="margin-top:14px;">
      <h2>Bảng công tháng này</h2>
      <div class="grid metrics">
        <div class="metric"><span>Tổng ngày công</span><b>${summary.workDays.toFixed(2)}</b></div>
        <div class="metric"><span>Tổng buổi công</span><b>${summary.halfDays}</b></div>
        <div class="metric"><span>Giờ tăng ca duyệt</span><b>${summary.overtimeHours.toFixed(1)}</b></div>
        <div class="metric"><span>Tiền tạm tính</span><b>${fmtMoney(summary.pay)}</b></div>
      </div>
      <p class="muted">Công thức hiện tại: lương ngày x số ngày công + lương ngày / 8 giờ x 1,5 x số giờ tăng ca - đã ứng. Lương ngày: ${fmtMoney(daySalary(user))}. Đã ứng tháng này: ${fmtMoney(summary.advances)}.</p>
      <div class="table-wrap" style="margin-top:12px;">
        <table>
          <thead><tr><th>Ngày</th>${ATTENDANCE_SLOTS.map(slot => `<th>${slot.label}</th>`).join("")}<th>Buổi sáng</th><th>Buổi chiều</th><th>Công ngày</th></tr></thead>
          <tbody>${summary.rows.map(row => `<tr>
            <td><b>${fmtDate(row.date)}</b></td>
            ${ATTENDANCE_SLOTS.map(slot => `<td>${row.slots[slot.id] ? "Đã chấm" : "Thiếu"}</td>`).join("")}
            <td>${row.morningHalf ? "0.5" : "0"}</td>
            <td>${row.afternoonHalf ? "0.5" : "0"}</td>
            <td><b>${row.dayWork}</b></td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
      ${renderPersonalOvertimeRequests(userId)}
    </section>
  `;
}
function attendanceSummary(userId) {
  const rows = daysThisMonthUntilToday().map(date => {
    const slots = Object.fromEntries(ATTENDANCE_SLOTS.map(slot => [slot.id, hasCheckedInSlot(date, slot.id, userId)]));
    const morningHalf = slots.morning && slots.noon;
    const afternoonHalf = slots.afternoon && slots.evening;
    const dayWork = (morningHalf ? 0.5 : 0) + (afternoonHalf ? 0.5 : 0);
    const hasMakeup = db.attendance.some(a => a.userId === userId && a.date === date && a.makeupRequestId);
    return { date, slots, morningHalf, afternoonHalf, dayWork, hasMakeup };
  });
  const workDays = rows.reduce((sum, row) => sum + row.dayWork, 0);
  const halfDays = rows.reduce((sum, row) => sum + (row.morningHalf ? 1 : 0) + (row.afternoonHalf ? 1 : 0), 0);
  const overtimeHours = approvedOvertimeHours(userId);
  const grossPay = daySalary(getUser(userId)) * workDays + daySalary(getUser(userId)) / 8 * 1.5 * overtimeHours;
  const advances = salaryAdvanceTotal(userId);
  const pay = Math.max(0, grossPay - advances);
  return { rows, workDays, halfDays, overtimeHours, grossPay, advances, pay };
}

function daysThisMonthUntilToday() {
  const now = new Date();
  const result = [];
  for (let day = 1; day <= now.getDate(); day++) {
    const date = new Date(now.getFullYear(), now.getMonth(), day);
    if (isSundayDate(date)) continue;
    result.push(dateKey(date));
  }
  return result;
}

function daySalary(user) {
  return Number(user?.daySalary || user?.salary || 0);
}

function monthSalary(user) {
  return Number(user?.monthSalary || 0);
}

function taskWorkHours(t) {
  const start = Number(t.acceptedAtMs) || parseViDateTime(t.acceptedAt);
  const end = Number(t.completedAtMs) || parseViDateTime(t.completedAt);
  if (!start || !end || end <= start) return 0;
  const intervals = attendedWorkIntervals(t.assigneeId, start, end);
  if (!intervals.length) return Math.round(((end - start) / 3600000) * 10) / 10;
  const effectiveIntervals = subtractTaskInterruptions(t, intervals, start, end);
  const hours = effectiveIntervals.reduce((sum, interval) => sum + dividedTaskHoursInInterval(t, interval.start, interval.end), 0);
  return Math.round(hours * 10) / 10;
}

function parseViDateTime(text) {
  if (!text) return 0;
  const direct = Date.parse(text);
  if (!Number.isNaN(direct)) return direct;
  const match = String(text).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?.*?(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return 0;
  const [, hour, minute, second = "0", day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime();
}

function taskLaborPay(t) {
  const user = getUser(t.assigneeId);
  const hours = taskWorkHours(t);
  const hourly = daySalary(user) / 8;
  const regularHours = Math.min(hours, 8);
  const overtimeHours = Math.max(0, hours - 8);
  const regularPay = hourly * regularHours;
  const overtimePay = hourly * 1.5 * overtimeHours;
  return { hours, regularHours, overtimeHours, regularPay, overtimePay, totalPay: regularPay + overtimePay };
}

function attendedWorkIntervals(userId, startMs, endMs) {
  const intervals = [];
  forEachDateBetween(startMs, endMs, date => {
    if (hasCheckedInSlot(date, "morning", userId) && hasCheckedInSlot(date, "noon", userId)) {
      intervals.push(clampInterval(dateTimeMs(date, "07:30"), dateTimeMs(date, "11:30"), startMs, endMs));
    }
    if (hasCheckedInSlot(date, "afternoon", userId) && hasCheckedInSlot(date, "evening", userId)) {
      intervals.push(clampInterval(dateTimeMs(date, "13:30"), dateTimeMs(date, "17:30"), startMs, endMs));
    }
  });
  return intervals.filter(x => x && x.end > x.start);
}

function subtractTaskInterruptions(task, intervals, taskStart, taskEnd) {
  const interruptions = (task.interruptions || [])
    .map(item => ({
      start: Number(item.startMs) || parseViDateTime(item.startText),
      end: Number(item.endMs) || parseViDateTime(item.endText) || taskEnd
    }))
    .filter(item => item.start && item.end && item.end > item.start)
    .map(item => ({ start: Math.max(item.start, taskStart), end: Math.min(item.end, taskEnd) }))
    .filter(item => item.end > item.start);
  if (!interruptions.length) return intervals;
  let result = intervals;
  interruptions.forEach(pause => {
    result = result.flatMap(interval => subtractInterval(interval, pause));
  });
  return result;
}

function subtractInterval(interval, block) {
  if (block.end <= interval.start || block.start >= interval.end) return [interval];
  const parts = [];
  if (block.start > interval.start) parts.push({ start: interval.start, end: Math.min(block.start, interval.end) });
  if (block.end < interval.end) parts.push({ start: Math.max(block.end, interval.start), end: interval.end });
  return parts.filter(item => item.end > item.start);
}

function dividedTaskHoursInInterval(task, startMs, endMs) {
  const boundaries = new Set([startMs, endMs]);
  concurrentTasks(task.assigneeId, startMs, endMs).forEach(t => {
    const range = taskRangeMs(t);
    if (!range) return;
    if (range.start > startMs && range.start < endMs) boundaries.add(range.start);
    if (range.end > startMs && range.end < endMs) boundaries.add(range.end);
  });
  const points = [...boundaries].sort((a, b) => a - b);
  let hours = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (b <= a) continue;
    const mid = a + (b - a) / 2;
    const activeCount = concurrentTasks(task.assigneeId, a, b).filter(t => {
      const range = taskRangeMs(t);
      return range && range.start <= mid && range.end >= mid;
    }).length || 1;
    hours += ((b - a) / 3600000) / activeCount;
  }
  return hours;
}

function concurrentTasks(userId, startMs, endMs) {
  return db.tasks.filter(t => {
    if (t.assigneeId !== userId) return false;
    if (["receive", "department_request", "notification"].includes(t.kind)) return false;
    const range = taskRangeMs(t);
    return range && range.start < endMs && range.end > startMs;
  });
}

function taskRangeMs(t) {
  const start = Number(t.acceptedAtMs) || parseViDateTime(t.acceptedAt);
  const end = Number(t.completedAtMs) || parseViDateTime(t.completedAt) || nowMs();
  if (!start || !end || end <= start) return null;
  return { start, end };
}

function forEachDateBetween(startMs, endMs, callback) {
  const start = new Date(startMs);
  const end = new Date(endMs);
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= last) {
    callback(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
}

function dateTimeMs(date, time) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0).getTime();
}

function clampInterval(start, end, min, max) {
  return { start: Math.max(start, min), end: Math.min(end, max) };
}

function salaryAdvanceTotal(userId) {
  const month = today().slice(0, 7);
  return (db.salaryAdvances || [])
    .filter(a => a.userId === userId && (a.date || "").startsWith(month))
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
}

function approvedOvertimeHours(userId) {
  const approved = (db.overtimeRequests || [])
    .filter(r => r.userId === userId && r.status === "approved")
    .map(r => ({
      start: Date.parse(r.start),
      end: Date.parse(r.end),
      managerPriority: r.createdByType === "manager",
      hours: Number(r.hours) || 0
    }))
    .filter(r => r.start && r.end && r.end > r.start)
    .sort((a, b) => Number(b.managerPriority) - Number(a.managerPriority) || a.start - b.start);
  let accepted = [];
  approved.forEach(item => {
    let parts = [{ start: item.start, end: item.end }];
    accepted.forEach(block => {
      parts = parts.flatMap(part => subtractInterval(part, block));
    });
    accepted = accepted.concat(parts);
  });
  return accepted.reduce((sum, item) => sum + (item.end - item.start) / 3600000, 0);
}

function lateAttendanceDaysThisMonth(userId) {
  const month = today().slice(0, 7);
  return new Set(db.attendance
    .filter(a => a.userId === userId && a.type === "daily_checkin" && a.isLate && (a.date || "").startsWith(month))
    .map(a => a.date)).size;
}

function renderPersonalOvertimeRequests(userId) {
  const rows = (db.overtimeRequests || []).filter(r => r.userId === userId);
  if (!rows.length) return "";
  return `
    <h2 style="margin-top:18px;">Tăng ca của tôi</h2>
    <div class="table-wrap">
      <table>
          <thead><tr><th>Bắt đầu</th><th>Kết thúc</th><th>Số giờ</th><th>Trạng thái</th><th>Đã duyệt</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td>${formatDateTimeLocal(r.start)}</td>
          <td>${formatDateTimeLocal(r.end)}</td>
          <td>${Number(r.hours || 0).toFixed(1)}</td>
          <td>${overtimeStatusText(r)}</td>
          <td>${Object.keys(r.approvals || {}).map(approvalLabel).join(", ") || "Chưa có"}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function openMakeupAttendanceForm() {
  const missing = missingAttendanceSlotsForMakeup(state.currentUser.id);
  const dates = [...new Set(missing.map(item => item.date))];
  if (!missing.length) {
    appAlert("Bạn không có mốc chấm công thiếu cần bù.");
    return;
  }
  q("#modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-head"><h2>Chấm công bù</h2><button class="secondary" onclick="closeModal()">Đóng</button></div>
        <div class="modal-body">
          <p class="muted">Chọn các mốc thiếu cần gửi Nhân sự xác nhận. Chấm công bù không cần ảnh và chỉ được tính công sau khi duyệt đủ cấp.</p>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Ngày</th>${ATTENDANCE_SLOTS.map(slot => `<th>${slot.label}</th>`).join("")}</tr></thead>
              <tbody>${dates.map(date => `<tr>
                <td><b>${fmtDate(date)}</b></td>
                ${ATTENDANCE_SLOTS.map(slot => {
                  const item = missing.find(x => x.date === date && x.slotId === slot.id);
                  return `<td>${item ? `<label class="check-cell"><input type="checkbox" name="makeupSlot" value="${date}|${slot.id}" checked> Bù</label>` : `<span class="muted">Đủ</span>`}</td>`;
                }).join("")}
              </tr>`).join("")}</tbody>
            </table>
          </div>
          <div class="field wide">
            <label>Lý do chấm công bù</label>
            <textarea id="makeupReason" placeholder="Ví dụ: quên chấm công, đi công trình xa, mất mạng..."></textarea>
          </div>
          <button style="margin-top:12px;" onclick="submitMakeupAttendance()">Gửi yêu cầu chấm công bù</button>
        </div>
      </div>
    </div>
  `;
}

function submitMakeupAttendance() {
  const selected = Array.from(document.querySelectorAll('input[name="makeupSlot"]:checked')).map(input => {
    const [date, slotId] = input.value.split("|");
    return { date, slotId };
  });
  if (!selected.length) {
    appAlert("Bạn chưa chọn mốc chấm công bù.");
    return;
  }
  const requiredApprovals = requiredMakeupApprovals(selected);
  db.makeupRequests.push({
    id: "mr" + Date.now(),
    userId: state.currentUser.id,
    department: state.currentUser.department,
    items: selected,
    reason: q("#makeupReason")?.value.trim() || "",
    requiredApprovals,
    approvals: {},
    status: "pending",
    createdAt: nowText()
  });
  log(`${state.currentUser.name} gửi yêu cầu chấm công bù ${selected.length} mốc`);
  saveDb();
  closeModal();
  render();
  appAlert("Yêu cầu chấm công bù của bạn đã được gửi đi, lần sau nhớ chấm đủ công nhé, để đảm bảo quyền lợi của mình.");
}

function openOvertimeForm(orderId = "", targetUserId = "") {
  const now = new Date();
  const start = toDateTimeLocalValue(now);
  const endDate = new Date(now.getTime() + 60 * 60 * 1000);
  const managedUsers = orderId ? overtimeManagedUsers(orderId) : [];
  const isManagerEntry = orderId && managedUsers.length && canManageOrderOvertime(orderId);
  q("#modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-head"><h2>Đăng ký tăng ca</h2><button class="secondary" onclick="closeModal()">Đóng</button></div>
        <div class="modal-body">
          <div class="form-grid">
            ${isManagerEntry ? `<div class="field wide"><label>Nhân sự tăng ca</label><select id="otUserId">${managedUsers.map(u => `<option value="${u.id}" ${u.id === targetUserId ? "selected" : ""}>${u.name}</option>`).join("")}</select></div>` : ""}
            <div class="field"><label>Bắt đầu tăng ca</label><input id="otStart" type="datetime-local" value="${start}"></div>
            <div class="field"><label>Kết thúc tăng ca</label><input id="otEnd" type="datetime-local" value="${toDateTimeLocalValue(endDate)}"></div>
            <div class="field wide"><label>Lý do / công việc</label><textarea id="otNote"></textarea></div>
          </div>
          <button style="margin-top:12px;" onclick="submitOvertimeRequest('${orderId}')">Gửi đăng ký tăng ca</button>
        </div>
      </div>
    </div>
  `;
}

function submitOvertimeRequest(orderId = "") {
  const start = q("#otStart").value;
  const end = q("#otEnd").value;
  const hours = calculateHours(start, end);
  if (!start || !end || hours <= 0) {
    appAlert("Thời gian tăng ca chưa hợp lệ.");
    return;
  }
  const managerEntry = orderId && canManageOrderOvertime(orderId);
  const targetUserId = managerEntry ? q("#otUserId")?.value : state.currentUser.id;
  const targetUser = getUser(targetUserId);
  if (!targetUser) return;
  db.overtimeRequests.push({
    id: "ot" + Date.now(),
    userId: targetUser.id,
    department: targetUser.department,
    start,
    end,
    hours,
    note: q("#otNote").value,
    approvals: managerEntry ? { manager: { userId: state.currentUser.id, time: nowText() } } : {},
    requiredApprovals: managerEntry ? ["manager", "employee", "hr"] : ["manager", "hr"],
    createdBy: state.currentUser.id,
    createdByType: managerEntry ? "manager" : "self",
    orderId,
    status: "pending",
    createdAt: nowText()
  });
  log(`${state.currentUser.name} dang k? tang ca ${hours.toFixed(1)} gi? cho ${targetUser.name}`);
  saveDb();
  closeModal();
  orderId ? openOrderDetail(orderId) : render();
}

function canManageOrderOvertime(orderId) {
  const order = getOrder(orderId);
  return Boolean(order) && canManageStep(order.currentStepId);
}

function overtimeManagedUsers(orderId) {
  const order = getOrder(orderId);
  if (!order || !canManageOrderOvertime(orderId)) return [];
  const ids = db.tasks
    .filter(t => t.orderId === orderId && (t.managerId === state.currentUser.id || canManageStep(t.stepId)))
    .map(t => t.assigneeId)
    .filter(Boolean);
  return [...new Set(ids)].map(getUser).filter(Boolean);
}

function toDateTimeLocalValue(date) {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function calculateHours(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.max(0, (endDate - startDate) / 3600000);
}

function formatDateTimeLocal(value) {
  if (!value) return "";
  const [date, time = ""] = value.split("T");
  return `${fmtDate(date)} ${time}`;
}

function requiredMakeupApprovals(items) {
  const count = items.length;
  const approvals = ["hr", "manager"];
  if (count > 12) approvals.push("director");
  return approvals;
}

function approvalLabel(type) {
  return { hr: "Nhân sự", manager: "Quản lý bộ phận", employee: "Nhân viên xác nhận", director: "Giám đốc" }[type] || type;
}

function makeupStatusText(request) {
  if (request.status === "approved") return "Đã duyệt";
  if (request.status === "rejected") return "Bị từ chối";
  return "Chờ xác nhận";
}

function canApproveMakeupRequest(request) {
  const needed = nextMakeupApproval(request);
  if (!needed) return false;
  if (needed === "hr") return hasActiveRole(state.currentUser, ["hr", "admin"]);
  if (needed === "manager") return hasActiveRole(state.currentUser, "admin") || isDepartmentManagerFor(request.department);
  if (needed === "director") return hasActiveRole(state.currentUser, "admin");
  return false;
}

function nextMakeupApproval(request) {
  return (request.requiredApprovals || []).find(type => !(request.approvals || {})[type]);
}

function isDepartmentManagerFor(department) {
  const role = activeRole(state.currentUser);
  if (department === "sales") return role === "sales_manager";
  if (department === "design") return role === "design_manager";
  if (["file", "workshop"].includes(department)) return role === "workshop_manager";
  if (["install", "supervision"].includes(department)) return role === "supervisor_manager";
  if (department === "accounting") return role === "accountant";
  if (department === "hr") return role === "hr";
  return false;
}

function approveMakeupRequest(id) {
  const request = (db.makeupRequests || []).find(r => r.id === id);
  if (!request || !canApproveMakeupRequest(request)) return;
  const approval = nextMakeupApproval(request);
  request.approvals = request.approvals || {};
  request.approvals[approval] = { userId: state.currentUser.id, time: nowText() };
  if (!nextMakeupApproval(request)) {
    request.status = "approved";
    createMakeupAttendanceRows(request);
  }
  log(`${state.currentUser.name} xác nhận chấm công bù ${request.id} cấp ${approvalLabel(approval)}`);
  saveDb();
  render();
}

function overtimeStatusText(request) {
  if (request.status === "approved") return "Đã duyệt";
  if (request.status === "rejected") return "Bị từ chối";
  return "Chờ xác nhận";
}

function canApproveOvertimeRequest(request) {
  const needed = nextOvertimeApproval(request);
  if (!needed) return false;
  if (needed === "employee") return request.userId === state.currentUser.id;
  if (needed === "hr") return hasActiveRole(state.currentUser, ["hr", "admin"]);
  if (needed === "manager") return hasActiveRole(state.currentUser, "admin") || isDepartmentManagerFor(request.department);
  return false;
}

function nextOvertimeApproval(request) {
  return (request.requiredApprovals || ["manager", "hr"]).find(type => !(request.approvals || {})[type]);
}

function approveOvertimeRequest(id) {
  const request = (db.overtimeRequests || []).find(r => r.id === id);
  if (!request || !canApproveOvertimeRequest(request)) return;
  const approval = nextOvertimeApproval(request);
  request.approvals = request.approvals || {};
  request.approvals[approval] = { userId: state.currentUser.id, time: nowText() };
  if (!nextOvertimeApproval(request)) request.status = "approved";
  log(`${state.currentUser.name} xác nhận tăng ca ${request.id} cấp ${approvalLabel(approval)}`);
  saveDb();
  render();
}

function canEditOvertimeRequest(request) {
  return request
    && request.status === "pending"
    && request.createdByType === "manager"
    && (request.createdBy === state.currentUser.id || hasActiveRole(state.currentUser, "admin"));
}

function openEditOvertimeForm(id) {
  const request = (db.overtimeRequests || []).find(r => r.id === id);
  if (!canEditOvertimeRequest(request)) return;
  q("#modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="closeModal(event)">
      <div class="modal small-modal" onclick="event.stopPropagation()">
        <div class="modal-head"><h2>Sửa lệnh tăng ca</h2><button class="secondary" onclick="closeModal()">Đóng</button></div>
        <div class="form-grid">
          <div class="field"><label>Bắt đầu tăng ca</label><input id="editOtStart" type="datetime-local" value="${request.start}"></div>
          <div class="field"><label>Kết thúc tăng ca</label><input id="editOtEnd" type="datetime-local" value="${request.end}"></div>
          <div class="field wide"><label>Lý do / công việc</label><textarea id="editOtNote">${request.note || ""}</textarea></div>
        </div>
        <div class="form-actions">
          <button class="secondary" onclick="closeModal()">Hu?</button>
          <button class="success" onclick="saveEditedOvertimeRequest('${request.id}')">Luu</button>
        </div>
      </div>
    </div>
  `;
}

function saveEditedOvertimeRequest(id) {
  const request = (db.overtimeRequests || []).find(r => r.id === id);
  if (!canEditOvertimeRequest(request)) return;
  const start = q("#editOtStart").value;
  const end = q("#editOtEnd").value;
  const hours = calculateHours(start, end);
  if (!start || !end || hours <= 0) {
    appAlert("Th?i gian tang ca chua h?p l?.");
    return;
  }
  request.start = start;
  request.end = end;
  request.hours = hours;
  request.note = q("#editOtNote").value;
  request.approvals = { manager: { userId: state.currentUser.id, time: nowText() } };
  request.status = "pending";
  request.editedAt = nowText();
  log(`${state.currentUser.name} s?a l?nh tang ca ${request.id}`);
  saveDb();
  closeModal();
  render();
}

function createMakeupAttendanceRows(request) {
  request.items.forEach(item => {
    if (hasCheckedInSlot(item.date, item.slotId, request.userId)) return;
    db.attendance.push({
      id: "a" + Date.now() + item.slotId,
      type: "daily_checkin",
      date: item.date,
      slotId: item.slotId,
      slotLabel: slotLabel(item.slotId),
      userId: request.userId,
      orderId: "",
      stepId: "",
      time: `${fmtDate(item.date)} ${slotLabel(item.slotId)}`,
      source: "Chấm công bù",
      photoId: "",
      driveLink: "",
      makeupRequestId: request.id,
      status: "D? x?c nh?n"
    });
  });
}

function renderTaskMini(t) {
  const order = getOrder(t.orderId);
  const canAcceptAssigned = canAcceptAssignedTask(t);
  const canComplete = canCompleteTask(t);
  const canApprove = canApproveTask(t);
  const canManagerComplete = canManagerCompleteInterruptedTask(t);
  const canApproveGroup = canApprove && hasGroupCoworkersToApprove(t);
  const canUploadDesign = t.assigneeId === state.currentUser.id && t.stepId === "design" && t.status === "working";
  const acceptedText = t.acceptedAt ? `<p><b>Đã nhận:</b> ${t.acceptedAt}</p>` : "";
  const coworkersText = taskCoworkersText(t);
  const topActions = `${canAcceptAssigned ? `<button class="success primary-task-action" onclick="acceptAssignedTask('${t.id}')">Nhận đơn hàng</button>` : ""}${canComplete ? `<button class="success primary-task-action" onclick="completeTask('${t.id}')">Đã hoàn thành</button>` : ""}`;
  return `
    <div class="task-card">
      ${topActions ? `<div class="task-actions task-actions-top">${topActions}</div>` : ""}
    <h3>${displayTaskTitle(t.title)}</h3>
      <p>${order?.code} - ${getStep(t.stepId)?.name}</p>
      ${renderTaskRequirementSummary(order, t.stepId)}
      ${coworkersText ? `<p><b>Cùng làm:</b> ${coworkersText}</p>` : ""}
      ${acceptedText}
      ${t.interrupted ? `<p class="warning-text">Công việc bị gián đoạn do đơn trả về công đoạn trước.</p>` : ""}
      <div>${statusBadge(t.status, t.deadline)}</div>
      <div class="task-actions">
        ${canAcceptAssigned ? `<button class="success" onclick="acceptAssignedTask('${t.id}')">Nhận đơn hàng</button>` : ""}
        ${canUploadDesign ? `<button class="secondary" onclick="openDesignUpload('${t.id}')">Upload file/ảnh</button>` : ""}
        ${canComplete ? `<button class="success" onclick="completeTask('${t.id}')">Đã hoàn thành</button>` : ""}
        ${canApprove ? `<button class="success" onclick="approveTask('${t.id}', 'one')">Xác nhận người này</button>${canApproveGroup ? `<button class="success" onclick="approveTask('${t.id}', 'all')">Xác nhận tất cả</button>` : ""}<button class="danger" onclick="returnTask('${t.id}')">Trả lại</button>` : ""}
        ${canManagerComplete ? `<button class="success" onclick="managerCompleteInterruptedTask('${t.id}')">Quản lý chấm hoàn thành</button>` : ""}
      </div>
    </div>
  `;
}

function renderTaskCard(t) {
  const order = getOrder(t.orderId);
  const departmentRequest = t.kind === "department_request" ? getDepartmentRequest(t.requestId) : null;
  const canAcceptAssigned = canAcceptAssignedTask(t);
  const canComplete = canCompleteTask(t);
  const canApprove = canApproveTask(t);
  const canManagerComplete = canManagerCompleteInterruptedTask(t);
  const canApproveGroup = canApprove && hasGroupCoworkersToApprove(t);
  const canReceiveTask = t.kind === "receive" && t.assigneeId === state.currentUser.id && t.status === "waiting";
  const canUploadDesign = t.assigneeId === state.currentUser.id && t.stepId === "design" && t.status === "working";
  const coworkersText = taskCoworkersText(t);
  const topActions = `${canReceiveTask ? `<button class="success primary-task-action" onclick="receiveDepartment('${t.orderId}')">Tiếp nhận</button>` : ""}${canAcceptAssigned ? `<button class="success primary-task-action" onclick="acceptAssignedTask('${t.id}')">Nhận đơn hàng</button>` : ""}${canComplete ? `<button class="success primary-task-action" onclick="completeTask('${t.id}')">Đã hoàn thành</button>` : ""}`;
  return `
    <article class="task-card">
      ${topActions ? `<div class="task-actions task-actions-top">${topActions}</div>` : ""}
      <h3>${displayTaskTitle(t.title)}</h3>
      <p><b>Đơn hàng:</b> ${order?.code} - ${order?.projectName}</p>
      <p><b>Công đoạn:</b> ${getStep(t.stepId)?.name} - <b>Deadline:</b> ${fmtDate(t.deadline)}</p>
      ${renderTaskRequirementSummary(order, t.stepId)}
      ${coworkersText ? `<p><b>Cùng làm:</b> ${coworkersText}</p>` : ""}
      <p><b>Ghi chú quản lý:</b> ${t.note}</p>
      ${t.acceptedAt ? `<p><b>Đã nhận đơn:</b> ${t.acceptedAt}</p>` : ""}
      ${t.interrupted ? `<p class="warning-text">Công việc bị gián đoạn do đơn trả về công đoạn trước.</p>` : ""}
      <div class="badge-row">${statusBadge(t.status, t.deadline)}</div>
      <div class="task-actions">
        <button class="secondary" onclick="openOrderDetail('${t.orderId}')">Xem đơn hàng</button>
        ${canAcceptDepartmentRequest(departmentRequest) ? `<button class="success" onclick="acceptDepartmentRequest('${departmentRequest.id}')">Tiếp nhận yêu cầu</button>` : ""}
        ${canWorkDepartmentRequest(departmentRequest) ? `<button class="warning" onclick="workDepartmentRequest('${departmentRequest.id}')">Xử lý yêu cầu</button>` : ""}
        ${canAcceptAssigned ? `<button class="success" onclick="acceptAssignedTask('${t.id}')">Nhận đơn hàng</button>` : ""}
        ${canUploadDesign ? `<button class="secondary" onclick="openDesignUpload('${t.id}')">Upload file/ảnh</button>` : ""}
        ${canReceiveTask ? `<button class="success" onclick="receiveDepartment('${t.orderId}')">Tiếp nhận</button>` : ""}
        ${canComplete ? `<button class="success" onclick="completeTask('${t.id}')">Đã hoàn thành</button>` : ""}
        ${canApprove ? `<button class="success" onclick="approveTask('${t.id}', 'one')">Xác nhận người này</button>${canApproveGroup ? `<button class="success" onclick="approveTask('${t.id}', 'all')">Xác nhận tất cả</button>` : ""}<button class="danger" onclick="returnTask('${t.id}')">Trả lại</button>` : ""}
        ${canManagerComplete ? `<button class="success" onclick="managerCompleteInterruptedTask('${t.id}')">Quản lý chấm hoàn thành</button>` : ""}
      </div>
    </article>
  `;
}

function canAcceptAssignedTask(t) {
  return t
    && STEPS_REQUIRE_WORKER_ACCEPT.includes(t.stepId)
    && t.assigneeId === state.currentUser.id
    && t.status === "assigned"
    && !t.acceptedAt;
}

function canCompleteTask(t) {
  if (!t || t.assigneeId !== state.currentUser.id) return false;
  if (t.kind === "department_request") return false;
  if (!["assigned", "working", "returned"].includes(t.status)) return false;
  if (STEPS_REQUIRE_WORKER_ACCEPT.includes(t.stepId) && !isChecklistTask(t) && !t.acceptedAt && t.status === "assigned") return false;
  return true;
}

function canApproveTask(t) {
  return t
    && !["receive", "department_request"].includes(t.kind)
    && (t.managerId === state.currentUser.id || canManageStep(t.stepId))
    && t.status === "waiting";
}

function sameWorkTasks(t) {
  if (!t) return [];
  return db.tasks.filter(x =>
    x.orderId === t.orderId
    && x.stepId === t.stepId
    && x.title === t.title
    && !["receive", "department_request", "notification"].includes(x.kind)
  );
}

function hasGroupCoworkersToApprove(t) {
  return sameWorkTasks(t).some(x => x.id !== t.id && !["approved", "done"].includes(x.status));
}

function canManagerCompleteInterruptedTask(t) {
  return t
    && t.interrupted
    && ["assigned", "working", "returned", "waiting"].includes(t.status)
    && (t.managerId === state.currentUser.id || canManageStep(t.stepId));
}

function taskCoworkersText(t) {
  if (!t || !t.orderId || !t.stepId) return "";
  const names = db.tasks
    .filter(x => x.orderId === t.orderId && x.stepId === t.stepId && x.id !== t.id && ["assigned", "working", "returned", "waiting"].includes(x.status))
    .map(x => {
      const user = getUser(x.assigneeId);
      if (!user) return "";
      const note = x.note ? ` (${x.note})` : "";
      return `${user.name}${note}`;
    })
    .filter(Boolean);
  return [...new Set(names)].join(", ");
}

function renderCustomers() {
  const canApprove = hasActiveRole(state.currentUser, ["admin", "sales_manager"]);
  const base = hasActiveRole(state.currentUser, "sale") && !hasActiveRole(state.currentUser, ["admin", "sales_manager"])
    ? db.customers.filter(c => c.createdBy === state.currentUser.id || db.orders.some(o => o.customerId === c.id && o.saleId === state.currentUser.id))
    : db.customers;
  const visible = base.filter(c => state.customerTab === "pending"
    ? c.approvalStatus === "pending"
    : c.approvalStatus !== "pending");
  const pendingCount = base.filter(c => c.approvalStatus === "pending").length;
  return `
    <div class="tabs">
      <button class="${state.customerTab === "approved" ? "active" : ""}" onclick="state.customerTab='approved'; render()">Khách hàng đã duyệt</button>
      <button class="${state.customerTab === "pending" ? "active" : ""}" onclick="state.customerTab='pending'; render()">Khách hàng chờ phê duyệt (${pendingCount})</button>
    </div>
    <div class="toolbar">
      <div></div>
      ${hasActiveRole(state.currentUser, ["admin", "sales_manager", "sale"]) ? `<button onclick="openCustomerForm()">Tạo khách hàng</button>` : ""}
    </div>
    <section class="panel">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Khách hàng</th><th>Sale tạo</th><th>SĐT</th><th>Địa chỉ</th><th>Nhu cầu</th><th>Tâm tư</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>${visible.map(c => `<tr>
            <td><b>${c.name}</b><br>${c.age ? c.age + " tuổi" : ""}</td>
            <td>${getUser(c.createdBy)?.name || ""}</td>
            <td>${c.phone}</td>
            <td>${c.address}</td>
            <td>${restoreVietnameseText(fixFontText(c.need))}</td>
            <td>${restoreVietnameseText(fixFontText(c.wish))}</td>
            <td>${customerStatusBadgeVi(c)}</td>
            <td>${canApprove && c.approvalStatus === "pending" ? `<button class="success" onclick="approveCustomer('${c.id}')">Duyệt</button> <button class="danger" onclick="rejectCustomer('${c.id}')">Trả lại</button>` : ""}</td>
          </tr>`).join("") || `<tr><td colspan="8"><div class="empty">Không có khách hàng trong mục này.</div></td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function customerStatusBadge(customer) {
  if (customer.approvalStatus === "pending") return `<span class="badge wait">Chờ phê duyệt</span>`;
  if (customer.approvalStatus === "rejected") return `<span class="badge returned">Bị trả lại</span>`;
  return `<span class="badge done">Đã duyệt</span>`;
}

function customerStatusBadgeVi(customer) {
  if (customer.approvalStatus === "pending") return `<span class="badge wait">Chờ phê duyệt</span>`;
  if (customer.approvalStatus === "rejected") return `<span class="badge returned">Bị trả lại</span>`;
  return `<span class="badge done">Đã duyệt</span>`;
}

function renderEmployees() {
  const canEdit = hasActiveRole(state.currentUser, ["admin", "hr"]);
  return `
    <div class="toolbar">
      <div></div>
      ${canEdit ? `<button onclick="openEmployeeForm()">Thêm tài khoản</button>` : ""}
    </div>
    <section class="panel">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nhân sự</th><th>Tài khoản</th><th>Vai trò</th><th>Phòng ban</th><th>Lương ngày</th><th>Lương tháng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>${db.users.map(u => `
            <tr>
              <td><button class="link-button" onclick="openEmployeeDetail('${u.id}')">${u.name}</button><br>${u.phone}</td>
              <td>${u.username}</td>
              <td>${roleNames(u)}</td>
              <td>${DEPARTMENTS[u.department]}</td>
              <td>${fmtMoney(daySalary(u))}</td>
              <td>${fmtMoney(monthSalary(u))}</td>
              <td>${employeeStatusText(u)}</td>
              <td>${employeeActionButtons(u)}</td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
    </section>
  `;
}

function employeeStatusText(user) {
  if ((user.approvalStatus || "approved") === "pending") return `<span class="badge wait">Chờ Quản trị xác nhận</span>`;
  if (user.locked) return "Đã khóa";
  return user.status;
}

function canOperateEmployee(targetUser) {
  if (targetUser.id === state.currentUser.id) return false;
  if (hasActiveRole(state.currentUser, "admin")) return true;
  if (!hasActiveRole(state.currentUser, "hr")) return false;
  return !hasRole(targetUser, "admin");
}

function employeeActionButtons(user) {
  if (!hasActiveRole(state.currentUser, ["admin", "hr"])) return "";
  const canOperate = canOperateEmployee(user);
  const canApprove = hasActiveRole(state.currentUser, "admin") && (user.approvalStatus || "approved") === "pending";
  return `
    ${canApprove ? `<button class="success" onclick="approveEmployee('${user.id}')">Duyệt</button>` : ""}
    ${canOperate ? `
      <button onclick="openEmployeeForm('${user.id}')">Sửa</button>
      <button class="secondary" onclick="toggleUserLock('${user.id}')">${user.locked ? "Mở khóa" : "Khóa"}</button>
      <button class="danger" onclick="deleteUser('${user.id}')">Xóa</button>
    ` : ""}
    ${!canOperate && user.id !== state.currentUser.id ? `<span class="badge">Không có quyền</span>` : ""}
  `;
}

function openEmployeeDetail(userId) {
  const u = getUser(userId);
  if (!u) return;
  const summary = attendanceSummary(userId);
  const advances = salaryAdvanceTotal(userId);
  const netMonthSalary = Math.max(0, monthSalary(u) - advances);
  q("#modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-head"><h2>Hồ sơ nhân sự</h2><button class="secondary" onclick="closeModal()">Đóng</button></div>
        <div class="modal-body">
          <section class="two-col">
            <div class="panel">
              <h2>${u.name}</h2>
              <p><b>Tài khoản:</b> ${u.username}</p>
              <p><b>Vai trò:</b> ${roleNames(u)}</p>
              <p><b>Phòng ban:</b> ${DEPARTMENTS[u.department]}</p>
              <p><b>Lương ngày:</b> ${fmtMoney(daySalary(u))}</p>
              <p><b>Lương tháng sau ứng:</b> ${fmtMoney(netMonthSalary)}</p>
              <p><b>Lương hiện tại:</b> ${fmtMoney(summary.pay)}</p>
              <p><b>Đã ứng tháng này:</b> ${fmtMoney(advances)}</p>
              ${hasActiveRole(state.currentUser, ["admin", "hr"]) ? `<button class="warning" onclick="recordSalaryAdvance('${u.id}')">Xác nhận ứng lương</button>` : ""}
            </div>
            <div class="panel">
              <h2>Giấy tờ</h2>
              <div class="doc-preview">${u.cmtImage ? `<img class="doc-image" src="${u.cmtImage}" alt="Ảnh CMT">` : `<div class="empty">Chưa có ảnh CMT</div>`}</div>
              <p><b>Ảnh CMT:</b> ${u.cmtImageName || "Chưa có"}</p>
              <p><b>Hợp đồng lao động:</b> ${u.contractFileName || "Chưa có"}</p>
              ${hasActiveRole(state.currentUser, ["admin", "hr"]) ? `
                <div class="form-grid">
                  <div class="field"><label>Cập nhật ảnh CMT</label><input type="file" accept="image/*" onchange="saveEmployeeFile(event, '${u.id}', 'cmt')"></div>
                  <div class="field"><label>Cập nhật hợp đồng lao động</label><input type="file" accept="image/*,.pdf,.doc,.docx" onchange="saveEmployeeFile(event, '${u.id}', 'contract')"></div>
                </div>
              ` : ""}
            </div>
          </section>
          ${renderPersonalTimesheet(userId)}
        </div>
      </div>
    </div>
  `;
}

async function recordSalaryAdvance(userId) {
  const amount = Number(await appPrompt("Nhập số tiền nhân sự ứng lương:", "0"));
  if (!amount || amount <= 0) return;
  const note = await appPrompt("Ghi chú ứng lương:", "Ứng lương trong tháng") || "";
  db.salaryAdvances.push({
    id: "sa" + Date.now(),
    userId,
    amount,
    note,
    date: today(),
    createdBy: state.currentUser.id,
    createdAt: nowText()
  });
  log(`${state.currentUser.name} xác nhận ${getUser(userId)?.name} ứng lương ${fmtMoney(amount)}`);
  saveDb();
  openEmployeeDetail(userId);
}

function saveEmployeeFile(event, userId, type) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const u = getUser(userId);
    if (!u) return;
    if (type === "cmt") {
      u.cmtImage = reader.result;
      u.cmtImageName = file.name;
    } else {
      u.contractFile = reader.result;
      u.contractFileName = file.name;
    }
    saveDb();
    openEmployeeDetail(userId);
  };
  reader.readAsDataURL(file);
}

function renderAttendance() {
  const rows = db.attendance.filter(a =>
    !a.makeupRequestId
    && (hasActiveRole(state.currentUser, ["admin", "hr"]) || a.userId === state.currentUser.id || canManageStep(a.stepId))
  );
  const makeupRequests = visibleMakeupRequests();
  const overtimeRequests = visibleOvertimeRequests();
  return `
    <section class="panel">
      <h2>Chấm công</h2>
      <p class="muted">Một ngày đủ 4 lần chấm công đã xác nhận sẽ tính là 1 công. Chấm công bù chỉ được tính sau khi được duyệt đủ cấp.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nhân sự</th><th>Ngày</th><th>Mốc</th><th>Thời gian</th><th>Nguồn</th><th>Đi muộn</th><th>Link ảnh</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>${rows.map(a => `<tr>
            <td>${getUser(a.userId)?.name}</td>
            <td>${fmtDate(a.date || "")}</td>
            <td>${a.slotLabel || getStep(a.stepId)?.name || "Bắt đầu làm việc"}</td>
            <td>${a.time}</td>
            <td>${a.source}</td>
            <td>${a.isLate ? "Có" : ""}</td>
            <td>${a.photoId ? `<button class="secondary" onclick="openPhotoPreview('${a.photoId}')">Xem ảnh</button>` : ""}</td>
            <td>${a.status}</td>
            <td>${attendanceNeedsConfirmation(a) ? `<button class="success" onclick="confirmAttendance('${a.id}')">Xác nhận</button>` : ""}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    </section>
    ${renderMakeupRequests(makeupRequests)}
    ${renderOvertimeRequests(overtimeRequests)}
    ${renderCompanyAttendanceSheet()}
  `;
}

function attendanceNeedsConfirmation(a) {
  if (!a || a.makeupRequestId) return false;
  if (["Đã xác nhận", "Đã duyệt", "approved"].includes(a.status)) return false;
  return canManageStep(a.stepId) || hasActiveRole(state.currentUser, ["admin", "hr"]);
}

function visibleMakeupRequests() {
  const requests = db.makeupRequests || [];
  if (hasActiveRole(state.currentUser, ["admin", "hr"])) return requests.filter(r => r.status !== "approved");
  return requests.filter(r => r.status !== "approved" && (r.userId === state.currentUser.id || canApproveMakeupRequest(r)));
}

function renderMakeupRequests(requests) {
  return `
    <section class="panel" style="margin-top:14px;">
      <h2>Yêu cầu chấm công bù</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nhân sự</th><th>Số lần thiếu</th><th>Số ngày</th><th>Mốc bù</th><th>Lý do</th><th>Cần duyệt</th><th>Đã duyệt</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>${requests.map(r => `<tr>
            <td>${getUser(r.userId)?.name || ""}</td>
            <td>${r.items.length}</td>
            <td>${new Set(r.items.map(i => i.date)).size}</td>
            <td>${r.items.map(i => `${fmtDate(i.date)} - ${slotLabel(i.slotId)}`).join("<br>")}</td>
            <td>${r.reason || ""}</td>
            <td>${r.requiredApprovals.map(approvalLabel).join(", ")}</td>
            <td>${Object.keys(r.approvals || {}).map(approvalLabel).join(", ") || "Chưa có"}</td>
            <td>${makeupStatusText(r)}</td>
            <td>${canApproveMakeupRequest(r) && r.status === "pending" ? `<button class="success" onclick="approveMakeupRequest('${r.id}')">Xác nhận</button>` : ""}</td>
          </tr>`).join("") || `<tr><td colspan="9"><div class="empty">Chưa có yêu cầu chấm công bù.</div></td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function visibleOvertimeRequests() {
  if (hasActiveRole(state.currentUser, ["admin", "hr"])) return db.overtimeRequests || [];
  return (db.overtimeRequests || []).filter(r => r.userId === state.currentUser.id || r.createdBy === state.currentUser.id || canApproveOvertimeRequest(r));
}

function renderOvertimeRequests(requests) {
  return `
    <section class="panel" style="margin-top:14px;">
      <h2>Yêu cầu tăng ca</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nhân sự</th><th>Bắt đầu</th><th>Kết thúc</th><th>Số giờ</th><th>Lý do</th><th>Cần duyệt</th><th>Đã duyệt</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>${requests.map(r => `<tr>
            <td>${getUser(r.userId)?.name || ""}</td>
            <td>${formatDateTimeLocal(r.start)}</td>
            <td>${formatDateTimeLocal(r.end)}</td>
            <td>${Number(r.hours || 0).toFixed(1)}</td>
            <td>${r.note || ""}</td>
            <td>${(r.requiredApprovals || []).map(approvalLabel).join(", ")}</td>
            <td>${Object.keys(r.approvals || {}).map(approvalLabel).join(", ") || "Chưa có"}</td>
            <td>${overtimeStatusText(r)}</td>
            <td>
              ${canApproveOvertimeRequest(r) && r.status === "pending" ? `<button class="success" onclick="approveOvertimeRequest('${r.id}')">${nextOvertimeApproval(r) === "employee" ? "Xác nhận đúng giờ" : "Xác nhận"}</button>` : ""}
              ${canEditOvertimeRequest(r) ? `<button class="secondary" onclick="openEditOvertimeForm('${r.id}')">Sửa</button>` : ""}
            </td>
          </tr>`).join("") || `<tr><td colspan="9"><div class="empty">Chưa có yêu cầu tăng ca.</div></td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderCompanyAttendanceSheet() {
  if (!hasActiveRole(state.currentUser, ["admin", "hr"])) return "";
  const days = daysThisMonthUntilToday();
  const users = db.users.filter(u => !u.locked);
  return `
    <section class="panel" style="margin-top:14px;">
      <h2>Bảng chấm công toàn công ty</h2>
      <p class="muted">X = đủ ngày công, / = nửa ngày công, ô trống = chưa đủ công ngày đó.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nhân sự</th>${days.map(d => `<th>${fmtDate(d).slice(0, 5)}</th>`).join("")}<th>Tổng ngày công</th><th>Lương</th></tr></thead>
          <tbody>${users.map(u => {
            const summary = attendanceSummary(u.id);
            const rowMap = Object.fromEntries(summary.rows.map(row => [row.date, row]));
            return `<tr>
              <td><button class="link-button" onclick="openEmployeeDetail('${u.id}')">${u.name}</button></td>
              ${days.map(d => `<td>${attendanceMark(rowMap[d])}</td>`).join("")}
              <td><b>${summary.workDays.toFixed(2)}</b></td>
              <td><b>${fmtMoney(summary.pay)}</b></td>
            </tr>`;
          }).join("")}</tbody>
        </table>
      </div>
    </section>
  `;
}

function attendanceMark(row) {
  if (!row) return "";
  const cls = row.hasMakeup ? " attendance-mark makeup" : " attendance-mark";
  if (row.dayWork >= 1) return `<span class="${cls.trim()}">X</span>`;
  if (row.dayWork >= 0.5) return `<span class="${cls.trim()}">/</span>`;
  if (row.hasMakeup) return `<span class="${cls.trim()}">Bù</span>`;
  return "";
}

function renderAccounting() {
  const orders = visibleOrders();
  return `
    <section class="panel">
      <h2>Kế toán nội bộ theo đơn hàng</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Đơn hàng</th><th>Dự toán</th><th>Đã chi</th><th>Cần chi thêm</th><th>Lợi nhuận dự kiến</th><th>Lợi nhuận thực tế</th><th>Hoàn công</th></tr></thead>
          <tbody>${orders.map(o => {
            const spent = db.expenses.filter(e => e.orderId === o.id).reduce((s, e) => s + e.amount, 0);
            return `<tr>
              <td><b>${o.code}</b><br>${o.projectName}</td>
              <td>${fmtMoney(o.estimate)}</td>
              <td>${fmtMoney(spent)}</td>
              <td>${fmtMoney(Math.max(0, o.actualCost - spent))}</td>
              <td>${fmtMoney(o.estimate - o.actualCost)}</td>
              <td>${fmtMoney(o.estimate - spent)}</td>
              <td>${restoreVietnameseText(fixFontText(o.finalReport))}<br>${canMarkOrderPaid(o) ? `<button class="success" onclick="markOrderPaid('${o.id}')">Thu đủ tiền</button>` : ""}${o.archived ? `<span class="badge done">Đã lưu trữ</span>` : ""}</td>
            </tr>`;
          }).join("") || `<tr><td colspan="7"><div class="empty">Chưa có đơn hàng.</div></td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}
function canMarkOrderPaid(order) {
  return order
    && !order.archived
    && hasActiveRole(state.currentUser, ["accountant", "admin"])
    && (order.currentStepId === "close" || order.status === "done" || order.status === "approved");
}

async function markOrderPaid(orderId) {
  const order = getOrder(orderId);
  if (!canMarkOrderPaid(order)) return;
  if (!await appConfirm(`X?c nh?n ?'? thu ?'? ti?n v? luu tr? ?'on ${order.code}?`)) return;
  const time = nowText();
  order.paidAt = time;
  order.archivedAt = time;
  order.archived = true;
  order.status = "done";
  order.finalReport = "D? thu ?'? ti?n v? luu tr?";
  order.note = `${order.note || ""}\n[${time} - ${state.currentUser.name}] K? to?n x?c nh?n thu ?'? ti?n. Don chuy?fn sang luu tr?.`.trim();
  db.tasks
    .filter(t => t.orderId === order.id && !["approved", "done"].includes(t.status))
    .forEach(t => {
      t.status = "done";
      t.completedAt = t.completedAt || time;
      t.completedAtMs = t.completedAtMs || nowMs();
    });
  saveDb();
  closeModal();
  render();
}

function renderMaterials() {
  const rows = db.materials.filter(m => canSeeOrder(getOrder(m.orderId)));
  return `
    <section class="panel">
      <h2>Vật tư theo từng đơn hàng</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Đơn hàng</th><th>Vật tư</th><th>Nhà cung cấp</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th><th>Ngày giao</th><th>Phí VC</th><th>Trạng thái</th></tr></thead>
          <tbody>${rows.map(m => `<tr>
            <td>${m.orderId}</td>
            <td><b>${m.name}</b></td>
            <td>${m.supplier}</td>
            <td>${m.qty}</td>
            <td>${fmtMoney(m.price)}</td>
            <td>${fmtMoney(m.qty * m.price)}</td>
            <td>${fmtDate(m.expectedDate)} / ${m.actualDate ? fmtDate(m.actualDate) : "Chưa giao"}</td>
            <td>${fmtMoney(m.shipping)}</td>
            <td>${restoreVietnameseText(fixFontText(m.status))}</td>
          </tr>`).join("") || `<tr><td colspan="9"><div class="empty">Chưa có vật tư.</div></td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}
function renderFiles() {
  const orders = visibleOrders();
  const photos = db.photos.filter(p => orders.some(o => o.id === p.orderId));
  const files = db.files.filter(f => orders.some(o => o.id === f.orderId));
  return `
    <section class="two-col">
      <div class="panel">
        <h2>?nh c?ng tr?nh</h2>
        <div class="photo-grid">${photos.map(p => `
          <div class="photo">
            ${p.imageData ? `<img class="photo-thumb image" src="${p.imageData}" alt="${p.name}">` : `<div class="photo-thumb">?NH</div>`}
            <b>${p.name}</b>
            <p>${p.orderId} ? ${getStep(p.stepId)?.name}</p>
            <p>${getUser(p.uploadedBy)?.name} ? ${p.time}</p>
            ${p.driveLink ? `<p><button class="secondary" onclick="openPhotoPreview('${p.id}')">Xem ?nh</button></p>` : ""}
          </div>
        `).join("")}</div>
      </div>
      <div class="panel">
        <h2>File theo ?'on h?ng</h2>
        <div class="file-grid">${files.map(f => `
          <div class="file-chip">
            <b>${f.name}</b>
            <p>${f.orderId} ? ${getStep(f.stepId)?.name}</p>
            <p>${getUser(f.uploadedBy)?.name} ? ${f.time}</p>
          </div>
        `).join("")}</div>
      </div>
    </section>
  `;
}

function renderReports() {
  const orders = visibleOrders();
  const revenue = orders.reduce((s, o) => s + Number(o.quotePrice || o.estimate || 0), 0);
  const cost = orders.reduce((s, o) => s + Number(o.actualCost || 0), 0);
  return `
    <section class="grid metrics">
      <div class="metric"><span>Doanh thu</span><b>${fmtMoney(revenue)}</b></div>
      <div class="metric"><span>Chi phí</span><b>${fmtMoney(cost)}</b></div>
      <div class="metric"><span>Lợi nhuận</span><b>${fmtMoney(revenue - cost)}</b></div>
      <div class="metric"><span>Chấm công tháng</span><b>${db.attendance.length}</b></div>
    </section>
    <section class="three-col" style="margin-top:14px;">
      <div class="panel"><h2>Hiệu suất nhân sự</h2>${db.users.map(u => bar(u.name, db.tasks.filter(t => t.assigneeId === u.id && ["waiting", "approved", "done"].includes(t.status)).length, 5)).join("")}</div>
      <div class="panel"><h2>Chi phí theo đơn hàng</h2>${orders.map(o => bar(o.code, Number(o.actualCost || 0) / 1000000, Math.max(1, Math.max(...orders.map(x => Number(x.actualCost || 0) / 1000000))))).join("")}</div>
      <div class="panel"><h2>Công đoạn đang tắc</h2>${STEPS.map(step => bar(step.name, orders.filter(o => o.currentStepId === step.id && ["waiting", "returned"].includes(o.status)).length, Math.max(1, orders.length))).join("")}</div>
    </section>
  `;
}
function renderActiveOrderWork(order, tasks) {
  const rows = tasks.filter(t => {
    if (["done", "approved"].includes(t.status)) return false;
    if (t.assigneeId === state.currentUser.id && ["assigned", "working", "returned", "waiting"].includes(t.status)) return true;
    if (canApproveTask(t)) return true;
    if (t.kind === "receive" && t.assigneeId === state.currentUser.id && t.status === "waiting") return true;
    return false;
  });
  if (!rows.length) return "";
  return `
    <section class="panel active-work-panel">
      <h2>Công việc đang làm</h2>
      ${rows.map(renderActiveOrderWorkItem).join("")}
    </section>
  `;
}

function renderActiveOrderWorkItem(t) {
  const canReceiveTask = t.kind === "receive" && t.assigneeId === state.currentUser.id && t.status === "waiting";
  const canAcceptAssigned = canAcceptAssignedTask(t);
  const canComplete = canCompleteTask(t);
  const canApprove = canApproveTask(t);
  const canApproveGroup = canApprove && hasGroupCoworkersToApprove(t);
  const coworkersText = taskCoworkersText(t);
  return `
    <article class="active-work-item">
      <div>
        <h3>${displayTaskTitle(t.title)}</h3>
        <p><b>Công đoạn:</b> ${getStep(t.stepId)?.name || ""} - <b>Trạng thái:</b> ${restoreVietnameseText(fixFontText(STATUSES[t.status] || t.status))}</p>
        ${coworkersText ? `<p><b>Cùng làm:</b> ${restoreVietnameseText(fixFontText(coworkersText))}</p>` : ""}
        ${t.note ? `<p><b>Ghi chú:</b> ${restoreVietnameseText(fixFontText(t.note))}</p>` : ""}
      </div>
      <div class="task-actions task-actions-top">
        ${canReceiveTask ? `<button class="success primary-task-action" onclick="receiveDepartment('${t.orderId}')">Tiếp nhận</button>` : ""}
        ${canAcceptAssigned ? `<button class="success primary-task-action" onclick="acceptAssignedTask('${t.id}')">Nhận đơn hàng</button>` : ""}
        ${canComplete ? `<button class="success primary-task-action" onclick="completeTask('${t.id}')">Đã hoàn thành</button>` : ""}
        ${canApprove ? `<button class="success primary-task-action" onclick="approveTask('${t.id}', 'one')">Xác nhận</button>${canApproveGroup ? `<button class="success primary-task-action" onclick="approveTask('${t.id}', 'all')">Xác nhận tất cả</button>` : ""}` : ""}
      </div>
    </article>
  `;
}

function openOrderDetail(orderId) {
  const o = getOrder(orderId);
  resetWaitingClock(o, "M?Y/x? l? ?'on h?ng");
  saveDb();
  const customer = getCustomer(o.customerId);
  ensureSaleChecklistTasks(o);
  const tasks = db.tasks.filter(t => t.orderId === orderId);
  const photos = db.photos.filter(p => p.orderId === orderId);
  const materials = db.materials.filter(m => m.orderId === orderId);
  const currentStepIndex = STEPS.findIndex(s => s.id === o.currentStepId);
  const isCloseStep = o.currentStepId === "close";
  const canReceive = !isCloseStep && o.currentStepId !== "acceptance" && canReceiveDepartment(o);
  const canAssign = !isCloseStep && o.currentStepId !== "acceptance" && canManageStep(o.currentStepId) && !canReceive && !o.pendingNextStepId && o.status !== "waiting";
  const canTransfer = !isCloseStep && canTransferToNextDepartment(o);
  const canConfirmTransfer = canConfirmStepTransfer(o);
  const canReopenTransfer = canReopenTransferredOrder(o);
  const canRequestDepartment = !isCloseStep && canCreateDepartmentRequest(o);
  const canSupplement = canSupplementOrder(o);
  const canProductionInstall = canTransferProductionToInstall(o);
  const canManagerOvertime = !isCloseStep && canManageOrderOvertime(o.id) && overtimeManagedUsers(o.id).length > 0;
  const canCompleteAcceptance = canCompleteAcceptanceStep(o);
  const activeWork = renderActiveOrderWork(o, tasks);
  q("#modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-head">
          <div><h2>${o.code} - ${o.projectName}</h2><p>${customer.name} - ${customer.phone} - ${customer.address}</p></div>
          <button class="secondary" onclick="closeModal()">Đóng</button>
        </div>
        <div class="modal-body">
          ${activeWork}
          <div class="two-col">
            <section class="panel">
              <h2>Thông tin đơn hàng</h2>
              <p><b>Nhu cầu ban đầu:</b> ${restoreVietnameseText(fixFontText(customer.need || o.initialNeed))}</p>
              <p><b>Tâm tư khách hàng:</b> ${restoreVietnameseText(fixFontText(customer.wish || o.customerWish))}</p>
              <p><b>Hạng mục:</b> ${restoreVietnameseText(fixFontText(o.categories))}</p>
              <p><b>Sale phụ trách:</b> ${getUser(o.saleId)?.name}</p>
              <p><b>Người đang xử lý:</b> ${orderAssigneeNames(o)}</p>
              <p><b>Quản lý công đoạn:</b> ${getUser(o.managerId)?.name || "Chưa giao"}</p>
              <p><b>Tiến độ:</b> ${o.progress}% - <b>Deadline:</b> ${fmtDate(o.deadline)}</p>
              ${renderDeadlineTracking(o)}
              <p><b>Ghi chú:</b> ${restoreVietnameseText(fixFontText(o.note))}</p>
              ${renderOrderFollowUpAlert(o)}
              ${renderWaitingAlert(o)}
              ${canApproveQuote(o) ? `<button class="success" onclick="approveQuote('${o.id}')">Xác nhận dự toán/báo giá</button>` : ""}
              ${o.pendingNextStepId ? `<p class="warning-text">Đang chờ quản lý xác nhận chuyển sang ${getStep(o.pendingNextStepId)?.name || "công đoạn tiếp theo"}.</p>` : ""}
              ${canTransfer ? `<button class="success" onclick="transferToNextDepartment('${o.id}')">Chuyển sang bộ phận tiếp theo</button>` : ""}
              ${canProductionInstall ? `<button class="success" onclick="transferProductionToInstall('${o.id}', 50)">Chuyển lắp đặt 50%</button><button class="success" onclick="transferProductionToInstall('${o.id}', 100)">Chuyển lắp đặt 100%</button>` : ""}
              ${canConfirmTransfer ? `<button class="success" onclick="confirmStepTransfer('${o.id}')">Xác nhận chuyển sang bộ phận tiếp theo</button>` : ""}
              ${canReopenTransfer ? `<button class="warning" onclick="reopenTransferredOrder('${o.id}')">Sửa lại thông tin</button>` : ""}
              ${canRequestDepartment ? `<button class="secondary" onclick="openDepartmentRequestForm('${o.id}')">Yêu cầu bộ phận trước</button>` : ""}
              ${canSupplement ? `<button class="secondary" onclick="openOrderSupplementForm('${o.id}')">Bổ sung đơn hàng</button>` : ""}
              ${canManagerOvertime ? `<button class="secondary" onclick="openOvertimeForm('${o.id}')">Đăng ký tăng ca nhân sự</button>` : ""}
              ${canReceive ? `<button class="success" onclick="receiveDepartment('${o.id}')">Tiếp nhận công đoạn</button>` : ""}
              ${canCompleteAcceptance ? `<button class="success" onclick="completeAcceptanceStep('${o.id}')">Hoàn thành công việc</button>` : ""}
              ${isCloseStep ? renderCloseStepActions(o) : ""}
              ${canAssign ? renderAssignForm(o) : ""}
            </section>
            <section class="panel">
              <h2>Dây chuyền công đoạn</h2>
              <div class="timeline">
                ${STEPS.map((s, i) => `<div class="timeline-item ${i < currentStepIndex ? "done" : i === currentStepIndex ? "active" : ""}">
                  <b>${s.name}</b>
                  <span>${i < currentStepIndex ? "Đã qua" : i === currentStepIndex ? STATUSES[o.status] : "Chưa tới"}</span>
                </div>`).join("")}
              </div>
            </section>
          </div>
          ${renderDepartmentRequests(o)}
          ${renderFinalAccountingSummary(o, tasks)}
          <section class="three-col" style="margin-top:14px;">
            <div class="panel"><h2>Kế toán</h2><p>Dự toán: <b>${fmtMoney(o.estimate)}</b></p><p>Chi phí thực tế: <b>${fmtMoney(o.actualCost)}</b></p><p>Lợi nhuận dự kiến: <b>${fmtMoney(o.estimate - o.actualCost)}</b></p>${canMarkOrderPaid(o) ? `<button class="success" onclick="markOrderPaid('${o.id}')">Thu đủ tiền</button>` : ""}${o.archived ? `<p class="muted"><b>Đã lưu trữ:</b> ${o.archivedAt}</p>` : ""}</div>
            <div class="panel"><h2>Vật tư</h2>${materials.map(m => `<p>${m.name}: <b>${m.qty}</b> - ${m.status}</p>`).join("") || "Chưa có vật tư"}</div>
            <div class="panel"><h2>Ảnh / File</h2>${photos.map(p => `<p>${p.imageData ? `<img class="photo-thumb image" src="${p.imageData}" alt="${p.name}">` : ""}${p.name}<br><span>${p.time}</span><br>${p.driveLink ? `<button class="secondary" onclick="openPhotoPreview('${p.id}')">Xem ảnh</button>` : ""}</p>`).join("") || "Chưa có ảnh"}</div>
          </section>
        </div>
      </div>
    </div>
  `;
}

function renderAssignForm(order) {
  const step = getStep(order.currentStepId);
  const candidates = db.users.filter(u => hasRole(u, step.workerRoles) && !u.locked);
  const activeTasks = db.tasks.filter(t => t.orderId === order.id && t.stepId === order.currentStepId && ["assigned", "working", "returned", "waiting"].includes(t.status));
  return `
    <div style="margin-top:16px;border-top:1px solid var(--line);padding-top:14px;">
      <h2>Phân công công đoạn</h2>
      <div class="form-grid">
        <div class="field"><label>Deadline</label><input id="assignDeadline" type="date" value="${order.deadline}"></div>
        <div class="field wide">
          <label>Nhân sự cùng làm</label>
          <div class="assign-list">
            ${candidates.map(u => {
              const existing = activeTasks.find(t => t.assigneeId === u.id);
              return `
                <label class="assign-row">
                  <input type="checkbox" class="assign-user-check" value="${u.id}" ${existing || u.id === order.assigneeId ? "checked" : ""} onchange="renderAssignWarnings('${order.id}')">
                  <span>${u.name}</span>
                  <input id="assignNote_${u.id}" type="text" value="${existing?.note || ""}" placeholder="Ghi chú riêng: VD làm giường tủ, làm vách">
                </label>
              `;
            }).join("") || `<div class="empty">Chưa có nhân sự phù hợp với công đoạn này.</div>`}
          </div>
        </div>
        <div class="field wide"><div id="assignWarnings" class="assign-warnings"></div></div>
      </div>
      <button style="margin-top:10px;" onclick="assignOrder('${order.id}')">Giao việc</button>
    </div>
  `;
}

function renderSaleChecklist(order, tasks) {
  if (!order) return "";
  if (["sale", "design"].includes(order.currentStepId)) {
    ensureStepChecklistTasks(order);
    const titles = checklistTitlesForStep(order.currentStepId);
    if (!titles.length) return "";
    const label = order.currentStepId === "sale" ? "Công việc Sale" : "Công việc Thiết kế";
    return `
      <div class="table-wrap checklist-table" style="margin-bottom:12px;">
        <table>
          <thead><tr><th>${label}</th><th>Đã hoàn thành</th><th>Thao tác</th></tr></thead>
          <tbody>${titles.map(title => {
            const t = checklistTaskForTitle(tasks, order.currentStepId, title);
            const done = t && ["done", "approved"].includes(t.status);
            return `<tr>
              <td>${title}</td>
              <td>${done ? "X" : ""}</td>
              <td>${t && !done && t.assigneeId === state.currentUser.id ? `<button class="success" onclick="completeTask('${t.id}')">Hoàn thành</button>` : ""}</td>
            </tr>`;
          }).join("")}</tbody>
        </table>
      </div>
    `;
  }
  if (order.currentStepId === "quote") {
    return `
      <div class="table-wrap checklist-table" style="margin-bottom:12px;">
        <table>
          <thead><tr><th>Yêu cầu Báo giá</th><th>Giá trị</th><th>Trạng thái</th></tr></thead>
          <tbody>${quoteChecklistItems(order).map(item => `<tr><td>${item.title}</td><td>${item.value}</td><td>${item.done ? "X" : ""}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }
  return "";
}

function renderCloseStepActions(order) {
  if (!canManageStep("close") && !hasActiveRole(state.currentUser, ["admin", "accountant"])) return "";
  return `
    <div class="task-actions" style="margin-top:12px;">
      <button class="secondary" onclick="openOrderSupplementForm('${order.id}')">Sửa thông tin</button>
      <button class="success" onclick="openFinalExport('${order.id}')">Xuất</button>
    </div>
  `;
}

function renderDepartmentRequests(order) {
  const requests = (db.departmentRequests || []).filter(r => r.orderId === order.id && canSeeDepartmentRequest(r));
  if (!requests.length) return "";
  return `
    <section class="panel priority-panel" style="margin-top:14px;">
      <h2>Yêu cầu bộ phận - luồng ưu tiên</h2>
      ${requests.map(r => `
        <div class="task-card priority-request">
          <h3>${getStep(r.fromStepId)?.name || "Bộ phận yêu cầu"} yêu cầu ${getStep(r.targetStepId)?.name || "Bộ phận nhận"}</h3>
          <p><b>Yêu cầu:</b> ${restoreVietnameseText(fixFontText(r.text))}</p>
          <p><b>Người yêu cầu:</b> ${getUser(r.fromManagerId)?.name || ""} - <b>Người nhận:</b> ${getUser(r.targetManagerId)?.name || "Chưa có quản lý"}</p>
          <p><b>Trạng thái:</b> ${departmentRequestStatus(r)}</p>
          ${r.resultNote ? `<p><b>Kết quả:</b> ${restoreVietnameseText(fixFontText(r.resultNote))}</p>` : ""}
          <div class="task-actions">
            ${canAcceptDepartmentRequest(r) ? `<button class="success" onclick="acceptDepartmentRequest('${r.id}')">Tiếp nhận</button>` : ""}
            ${canWorkDepartmentRequest(r) ? `<button class="warning" onclick="workDepartmentRequest('${r.id}')">Xử lý</button>` : ""}
            ${canFinishDepartmentRequest(r) ? `<button class="success" onclick="finishDepartmentRequest('${r.id}', 'next')">Chuyển sang công đoạn tiếp theo</button><button class="secondary" onclick="finishDepartmentRequest('${r.id}', 'return')">Trả về công đoạn yêu cầu</button>` : ""}
          </div>
        </div>
      `).join("")}
    </section>
  `;
}

function renderFinalAccountingSummary(order, tasks) {
  if (!canSeeFinalAccountingSummary(order)) return "";
  const workTasks = tasks.filter(t =>
    !["receive", "department_request", "notification"].includes(t.kind)
    && !["receive", "sale", "quote", "close"].includes(t.stepId)
    && t.assigneeId
  );
  const totals = workTasks.reduce((sum, t) => {
    const pay = taskLaborPay(t);
    sum.hours += pay.hours;
    sum.regularPay += pay.regularPay;
    sum.overtimePay += pay.overtimePay;
    sum.totalPay += pay.totalPay;
    return sum;
  }, { hours: 0, regularPay: 0, overtimePay: 0, totalPay: 0 });
  const constructionSteps = ["design", "file", "production", "install", "acceptance"];
  const orderTime = orderCompletionTimeSummary(order, tasks);
  return `
    <section class="panel" style="margin-top:14px;">
      <h2>Tổng kết đơn hàng - Kế toán hoàn công</h2>
      <div class="grid metrics" style="margin-bottom:12px;">
        <div class="metric"><span>Thời gian đơn hàng</span><b>${orderTime.effectiveHours.toFixed(1)} giờ</b></div>
        <div class="metric"><span>Thời gian chờ không tính</span><b>${orderTime.waitHours.toFixed(1)} giờ</b></div>
        <div class="metric"><span>Tổng giờ nhân công</span><b>${totals.hours.toFixed(1)} giờ</b></div>
      </div>
      <div class="table-wrap" style="margin-bottom:12px;">
        <table>
          <thead><tr><th>Nội dung</th>${constructionSteps.map(stepId => `<th>${getStep(stepId)?.name || stepId}</th>`).join("")}</tr></thead>
          <tbody>
            <tr><td><b>Người thực hiện</b></td>${constructionSteps.map(stepId => `<td>${stepSummaryCell(workTasks, stepId, "people")}</td>`).join("")}</tr>
            <tr><td><b>Giờ thực hiện</b></td>${constructionSteps.map(stepId => `<td>${stepSummaryCell(workTasks, stepId, "hours")}</td>`).join("")}</tr>
            <tr><td><b>Tổng tiền công</b></td>${constructionSteps.map(stepId => `<td>${stepSummaryCell(workTasks, stepId, "pay")}</td>`).join("")}</tr>
          </tbody>
        </table>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Công đoạn thi công</th>
              <th>Người thực hiện</th>
              <th>Nội dung</th>
              <th>Nhận đơn</th>
              <th>Hoàn thành</th>
              <th>Giờ thực hiện</th>
              <th>Lương ngày</th>
              <th>Lương làm thêm giờ</th>
              <th>Tổng tiền công</th>
            </tr>
          </thead>
          <tbody>
            ${workTasks.map(t => {
              const user = getUser(t.assigneeId);
              const pay = taskLaborPay(t);
              return `<tr>
                <td>${getStep(t.stepId)?.name || ""}</td>
                <td>${user?.name || ""}</td>
                <td>${t.note || t.title}</td>
                <td>${t.acceptedAt || "Chưa nhận"}</td>
                <td>${t.completedAt || "Chưa hoàn thành"}</td>
                <td>${pay.hours.toFixed(1)}</td>
                <td>${fmtMoney(pay.regularPay)}</td>
                <td>${fmtMoney(pay.overtimePay)}</td>
                <td><b>${fmtMoney(pay.totalPay)}</b></td>
              </tr>`;
            }).join("") || `<tr><td colspan="9"><div class="empty">Chưa có dữ liệu giờ thực hiện để tổng kết hoàn công.</div></td></tr>`}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="5">Tổng</th>
              <th>${totals.hours.toFixed(1)}</th>
              <th>${fmtMoney(totals.regularPay)}</th>
              <th>${fmtMoney(totals.overtimePay)}</th>
              <th>${fmtMoney(totals.totalPay)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
      <p class="muted">Giờ thực hiện được tính từ lúc nhân viên bấm Nhận đơn hàng đến lúc bấm Đã hoàn thành, chỉ tính các ca đã chấm công được cặp sáng/trưa hoặc chiều/tối. Nếu nhân viên làm nhiều đơn cùng lúc, giờ trong khoảng trùng nhau được chia đều cho số đơn đang triển khai. Tiền công tạm tính: lương ngày / 8 giờ; phần vượt 8 giờ tính hệ số 1,5.</p>
    </section>
  `;
}

function orderCompletionTimeSummary(order, tasks) {
  const start = dateTimeMs(order.createdAt || today(), "08:00");
  const completedTimes = tasks
    .map(t => Number(t.completedAtMs) || parseViDateTime(t.completedAt))
    .filter(Boolean);
  const end = order.status === "done" && completedTimes.length ? Math.max(...completedTimes) : nowMs();
  const waitMs = totalOrderWaitingMs(order, end);
  return {
    grossHours: hoursBetweenMs(start, end),
    waitHours: waitMs / 3600000,
    effectiveHours: Math.max(0, (end - start - waitMs) / 3600000)
  };
}

function totalOrderWaitingMs(order, fallbackEndMs = nowMs()) {
  return (order.waitIntervals || []).reduce((sum, item) => {
    const start = Number(item.startMs) || parseViDateTime(item.startText);
    const end = Number(item.endMs) || parseViDateTime(item.endText) || fallbackEndMs;
    if (!start || !end || end <= start) return sum;
    return sum + (end - start);
  }, 0);
}

function stepSummaryCell(tasks, stepId, field) {
  const rows = tasks.filter(t => t.stepId === stepId);
  if (!rows.length) return "";
  if (field === "people") {
    return [...new Set(rows.map(t => getUser(t.assigneeId)?.name).filter(Boolean))].join(", ");
  }
  const summary = rows.reduce((sum, t) => {
    const pay = taskLaborPay(t);
    sum.hours += pay.hours;
    sum.pay += pay.totalPay;
    return sum;
  }, { hours: 0, pay: 0 });
  if (field === "hours") return summary.hours.toFixed(1);
  if (field === "pay") return fmtMoney(summary.pay);
  return "";
}

function canSeeFinalAccountingSummary(order) {
  if (!state.currentUser || !order) return false;
  const roles = userRoles(state.currentUser);
  const isManager = roles.some(role => ["sales_manager", "design_manager", "workshop_manager", "supervisor_manager"].includes(role));
  const isSaleOnOrder = roles.includes("sale") && order.saleId === state.currentUser.id;
  return roles.includes("admin")
    || roles.includes("accountant")
    || isManager
    || isSaleOnOrder;
}

function canSeeFullOrderTaskHistory(order) {
  if (!state.currentUser || !order) return false;
  const roles = userRoles(state.currentUser);
  const isManager = roles.some(role => ["sales_manager", "design_manager", "workshop_manager", "supervisor_manager"].includes(role));
  const isSaleOnOrder = roles.includes("sale") && order.saleId === state.currentUser.id;
  return roles.includes("admin")
    || roles.includes("accountant")
    || isManager
    || isSaleOnOrder;
}

function departmentRequestStatus(r) {
  const labels = {
    sent: "D? g?i y?u c?u uu ti?n",
    accepted: "D? ti?p nh?n",
    working: "Dang x? l?",
    moved_next: "D? chuy?fn sang c?ng ?'o?n ti?p theo",
    returned_to_requester: "D? tr? v? c?ng ?'o?n y?u c?u"
  };
  return labels[r.status] || r.status;
}

function canSeeDepartmentRequest(r) {
  return hasActiveRole(state.currentUser, "admin")
    || r.fromManagerId === state.currentUser.id
    || r.targetManagerId === state.currentUser.id
    || canManageStep(r.fromStepId)
    || canManageStep(r.targetStepId);
}

function previousRequestSteps(order) {
  const currentIndex = STEPS.findIndex(s => s.id === order.currentStepId);
  if (currentIndex <= 0) return [];
  return STEPS.slice(0, currentIndex).filter(s => s.id !== "receive");
}

function canCreateDepartmentRequest(order) {
  return Boolean(order)
    && canManageStep(order.currentStepId)
    && previousRequestSteps(order).length > 0;
}

function ensureSaleChecklistTasks(order) {
  ensureStepChecklistTasks(order);
}

function ensureStepChecklistTasks(order) {
  if (!order) return;
  const stepId = order.currentStepId;
  const titles = checklistTitlesForStep(stepId);
  if (!titles.length) return;
  const assigneeId = stepId === "sale" ? (order.saleId || order.assigneeId) : order.assigneeId;
  if (!assigneeId) return;
  const managerId = findManagerForStep(stepId) || order.managerId || "";
  titles.forEach((title, index) => {
    const exists = db.tasks.some(t => t.orderId === order.id && t.stepId === stepId && normalizedChecklistTitle(t.title) === title);
    if (!exists) {
      const item = task(
        "t" + Date.now() + "cl" + stepId + index,
        order.id,
        stepId,
        title,
        assigneeId,
        managerId,
        "assigned",
        order.deadline,
        order.note
      );
      item.kind = "checklist";
      db.tasks.push(item);
    }
  });
  saveDb();
}

function renderOrderFollowUpAlert(order) {
  if (!orderNeedsFollowUp(order)) return "";
  return `
    <div class="panel alert-panel" style="margin:12px 0;">
      <h2>C?nh b?o ch?fm s?c kh?ch h?ng</h2>
      <p>Don ?Y kh?u ${getStep(order.currentStepId)?.name} qu? 3 ng?y chua c? c?p nh?t v? chua chuy?fn b?T ph?n ti?p theo. C?n g?i l?i cho kh?ch.</p>
      ${order.assigneeId === state.currentUser.id ? `<button class="warning" onclick="markCustomerFollowedUp('${order.id}')">D? g?i l?i / c?p nh?t</button>` : ""}
      ${canManageStep(order.currentStepId) ? `<button class="secondary" onclick="dismissFollowUpAlert('${order.id}')">T?t c?nh b?o</button>` : ""}
    </div>
  `;
}

function orderNeedsFollowUp(order) {
  if (!order || order.incomplete || order.reminderDisabled) return false;
  if (!["sale", "quote"].includes(order.currentStepId)) return false;
  if (order.reminderUntil && order.reminderUntil > today()) return false;
  const ref = order.lastInfoAt || order.stepStartedAt || order.createdAt || today();
  return daysBetween(ref, today()) >= 3;
}

function daysBetween(from, to) {
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  return Math.floor((end - start) / 86400000);
}

async function markCustomerFollowedUp(orderId) {
  const order = getOrder(orderId);
  const note = await appPrompt("Nh?p th?ng tin ?'? trao ?'?.i/c?p nh?t v?>i kh?ch:", "D? g?i l?i cho kh?ch.");
  if (!order || !note) return;
  order.lastInfoAt = today();
  order.note = `${order.note || ""}\n[${nowText()} - ${state.currentUser.name}] ${note}`.trim();
  log(`${state.currentUser.name} c?p nh?t ch?fm s?c kh?ch h?ng cho ${order.code}`);
  saveDb();
  openOrderDetail(orderId);
}

async function dismissFollowUpAlert(orderId) {
  const order = getOrder(orderId);
  if (!order || !canManageStep(order.currentStepId)) return;
  const action = await appPrompt("Nh?p s?' ng?y mu?'n nh?c l?i, ho?c nh?p 0 ?'?f kh?ng nh?c l?i n?a (?'on h?ng ?'? b?< m?t):", "3");
  if (action === null) return;
  const days = Number(action);
  if (days <= 0) {
    order.incomplete = true;
    order.incompleteReason = await appPrompt("L? do ?'on kh?ng ho?n th?nh:", "Don h?ng ?'? b?< m?t") || "Don h?ng ?'? b?< m?t";
    order.reminderDisabled = true;
    order.status = "incomplete";
  } else {
    const d = new Date();
    d.setDate(d.getDate() + days);
    order.reminderUntil = dateKey(d);
  }
  log(`${state.currentUser.name} t?t c?nh b?o ?'on ${order.code}`);
  saveDb();
  closeModal();
  render();
}

function closeModal(event) {
  if (event && event.target.className !== "modal-backdrop") return;
  stopAttendanceCamera();
  q("#modalRoot").innerHTML = "";
}

async function assignOrder(orderId) {
  const order = getOrder(orderId);
  const deadline = q("#assignDeadline").value;
  const selected = qa(".assign-user-check:checked").map(input => input.value);
  if (!selected.length) {
    appAlert("Bạn cần chọn ít nhất một nhân sự để giao việc.");
    return;
  }
  const busyWarnings = selected
    .map(userId => ({ user: getUser(userId), jobs: activeAssignmentsForUser(userId, order.id) }))
    .filter(item => item.jobs.length);
  if (busyWarnings.length) {
    const message = busyWarnings
      .map(item => `${item.user?.name || ""} đang làm: ${item.jobs.join("; ")}`)
      .join("\n");
    if (!await appConfirm(`Cảnh báo nhân sự đang có việc khác:\n${message}\n\nBạn vẫn muốn giao thêm việc này?`)) return;
  }
  order.assigneeId = selected[0];
  order.managerId = state.currentUser.id;
  order.deadline = deadline;
  order.status = "assigned";
  order.stepStartedAt = today();
  db.tasks = db.tasks.filter(t => !(t.orderId === order.id && t.stepId === order.currentStepId && !["approved", "done"].includes(t.status)));
  selected.forEach((assigneeId, index) => {
    const note = q(`#assignNote_${assigneeId}`)?.value.trim() || `Triển khai công đoạn ${getStep(order.currentStepId).name}`;
    db.tasks.push(task(
      "t" + Date.now() + index,
      order.id,
      order.currentStepId,
      `Thực hiện công đoạn ${getStep(order.currentStepId).name}`,
      assigneeId,
      state.currentUser.id,
      "assigned",
      deadline,
      note
    ));
  });
  log(`Giao việc ${order.code} cho ${selected.map(id => getUser(id)?.name).filter(Boolean).join(", ")}`);
  saveDb();
  closeModal();
  render();
}

function interruptStepTasks(order, stepId, reason) {
  const time = nowText();
  const timeMs = nowMs();
  const stepName = getStep(stepId)?.name || stepId;
  db.tasks
    .filter(t => t.orderId === order.id && t.stepId === stepId && ["assigned", "working", "returned", "waiting"].includes(t.status))
    .forEach(t => {
      t.interrupted = true;
      t.interruptions = t.interruptions || [];
      if (t.status === "waiting" && (Number(t.completedAtMs) || parseViDateTime(t.completedAt))) {
        const startMs = Number(t.completedAtMs) || parseViDateTime(t.completedAt);
        t.interruptions.push({ startText: t.completedAt || time, startMs, endText: time, endMs: timeMs, reason });
      } else {
        const last = t.interruptions[t.interruptions.length - 1];
        if (!last || last.endMs) {
        t.interruptions.push({ startText: time, startMs: timeMs, endText: "", endMs: 0, reason });
        }
      }
    });
  order.note = `${order.note || ""}\n[${time} - ${state.currentUser.name}] Gi?n ?'o?n c?ng ?'o?n ${stepName}: ${reason}. Kho?ng th?i gian gi?n ?'o?n kh?ng t?nh v?o gi? ho?n c?ng.`.trim();
}

function managerCompleteInterruptedTask(taskId) {
  const t = db.tasks.find(x => x.id === taskId);
  if (!canManagerCompleteInterruptedTask(t)) return;
  const order = getOrder(t.orderId);
  const time = nowText();
  const timeMs = nowMs();
  (t.interruptions || []).forEach(item => {
    if (!item.endMs) {
      item.endText = time;
      item.endMs = timeMs;
    }
  });
  if (!t.acceptedAt) {
    t.acceptedAt = t.createdAt || time;
    t.acceptedAtMs = t.acceptedAtMs || timeMs;
  }
  t.completedAt = time;
  t.completedAtMs = timeMs;
  t.status = "approved";
  t.interrupted = false;
  if (order) {
    order.note = `${order.note || ""}\n[${time} - ${state.currentUser.name}] Qu?n l? ch?m ho?n th?nh cho ${getUser(t.assigneeId)?.name || "nh?n s?"} ?Y c?ng ?'o?n ${getStep(t.stepId)?.name || ""}; kh?ng c?n bu?>c x?c nh?n th?m do c?ng vi??c b?< gi?n ?'o?n/tr? v?.`.trim();
  }
  log(`${state.currentUser.name} ch?m ho?n th?nh tr?c ti?p ${t.title} cho ${getUser(t.assigneeId)?.name || ""}`);
  saveDb();
  refreshAfterOrderAction(t.orderId);
}

function activeAssignmentsForUser(userId, excludeOrderId = "") {
  return db.tasks
    .filter(t => t.assigneeId === userId && t.orderId !== excludeOrderId && ["assigned", "working", "returned", "waiting"].includes(t.status))
    .map(t => {
      const order = getOrder(t.orderId);
      return `${order?.code || t.orderId} - ${order?.projectName || ""} (${getStep(t.stepId)?.name || ""}: ${restoreVietnameseText(fixFontText(STATUSES[t.status] || t.status))})`;
    });
}

function renderAssignWarnings(orderId) {
  const selected = qa(".assign-user-check:checked").map(input => input.value);
  const warnings = selected
    .map(userId => ({ user: getUser(userId), jobs: activeAssignmentsForUser(userId, orderId) }))
    .filter(item => item.jobs.length);
  const box = q("#assignWarnings");
  if (!box) return;
  box.innerHTML = warnings.length ? `
    <div class="warning-box">
      <b>Cảnh báo nhân sự đang có việc:</b>
      ${warnings.map(item => `<p><b>${item.user?.name || ""}</b> đang thực hiện: ${item.jobs.join("; ")}</p>`).join("")}
    </div>
  ` : "";
}

function canSupplementOrder(order) {
  if (!order || order.status === "incomplete") return false;
  if (order.assigneeId === state.currentUser.id && ["assigned", "working", "returned"].includes(order.status)) return true;
  if (canManageStep(order.currentStepId) && ["unassigned", "assigned", "working", "returned", "waiting"].includes(order.status)) return true;
  return false;
}

function openOrderSupplementForm(orderId) {
  const order = getOrder(orderId);
  const customer = getCustomer(order?.customerId);
  if (!order || !customer || !canSupplementOrder(order)) return;
  q("#modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="closeModal(event)">
      <div class="modal small-modal" onclick="event.stopPropagation()">
        <div class="modal-head">
          <div><h2>Bổ sung đơn hàng</h2><p>${order.code} - ${order.projectName}</p></div>
          <button class="secondary" onclick="openOrderDetail('${order.id}')">Đóng</button>
        </div>
        <div class="form-grid">
          <div class="field wide">
            <label>Thông tin đơn hàng</label>
            <textarea id="supplementOrderInfo">${order.initialNeed || customer.need || ""}</textarea>
          </div>
          <div class="field wide">
            <label>Yêu cầu của khách</label>
            <textarea id="supplementCustomerNeed">${order.customerWish || customer.wish || ""}</textarea>
          </div>
          <div class="field wide">
            <label>Ghi chú bổ sung</label>
            <textarea id="supplementNote" placeholder="Nội dung mới cần lưu vào ghi chú đơn hàng"></textarea>
          </div>
        </div>
        <div class="form-actions">
          <button class="secondary" onclick="openOrderDetail('${order.id}')">Hủy</button>
          <button class="success" onclick="saveOrderSupplement('${order.id}')">Lưu bổ sung</button>
        </div>
      </div>
    </div>
  `;
}

function saveOrderSupplement(orderId) {
  const order = getOrder(orderId);
  const customer = getCustomer(order?.customerId);
  if (!order || !customer || !canSupplementOrder(order)) return;
  const orderInfo = q("#supplementOrderInfo").value.trim();
  const customerNeed = q("#supplementCustomerNeed").value.trim();
  const note = q("#supplementNote").value.trim();
  order.initialNeed = orderInfo;
  order.customerWish = customerNeed;
  customer.need = orderInfo;
  customer.wish = customerNeed;
  order.lastInfoAt = today();
  const lines = [];
  if (orderInfo) lines.push(`Thông tin đơn hàng: ${orderInfo}`);
  if (customerNeed) lines.push(`Yêu cầu của khách: ${customerNeed}`);
  if (note) lines.push(`Ghi chú: ${note}`);
  if (lines.length) {
    order.note = `${order.note || ""}\n[${nowText()} - ${state.currentUser.name}] Bổ sung đơn hàng: ${lines.join(" | ")}`.trim();
  }
  log(`${state.currentUser.name} bổ sung thông tin đơn ${order.code}`);
  saveDb();
  openOrderDetail(order.id);
}

function canReopenTransferredOrder(order) {
  if (!order) return false;
  if (order.pendingNextStepId && order.status === "waiting") {
    return order.assigneeId === state.currentUser.id || canManageStep(order.currentStepId);
  }
  return Boolean(order.transferFromStepId)
    && order.status === "waiting"
    && !order.assigneeId
    && canManageStep(order.transferFromStepId);
}

async function reopenTransferredOrder(orderId) {
  const order = getOrder(orderId);
  if (!canReopenTransferredOrder(order)) return;
  const reason = await appPrompt("Nh?p n?Ti dung c?n s?a l?i:", "C?n b?. sung/s?a l?i th?ng tin tru?>c khi chuy?fn ti?p.");
  if (!reason) return;
  closeOrderWaiting(order, state.currentUser.id);
  if (order.pendingNextStepId) {
    interruptStepTasks(order, order.currentStepId, reason);
    order.pendingNextStepId = "";
    order.pendingTransferNote = "";
    order.pendingTransferBy = "";
    db.tasks
      .filter(t => t.orderId === order.id && t.stepId === order.currentStepId && t.assigneeId === order.assigneeId && ["waiting", "assigned"].includes(t.status))
      .forEach(t => { t.status = "working"; });
  } else {
    const blockedStepId = order.currentStepId;
    interruptStepTasks(order, blockedStepId, reason);
    order.currentStepId = order.transferFromStepId;
    order.assigneeId = order.transferFromAssigneeId || "";
    order.managerId = order.transferFromManagerId || findManagerForStep(order.transferFromStepId);
    db.tasks = db.tasks.filter(t => !(t.orderId === order.id && t.stepId === blockedStepId && t.kind === "receive" && ["waiting", "assigned"].includes(t.status)));
    db.tasks
      .filter(t => t.orderId === order.id && t.stepId === order.currentStepId && t.assigneeId === order.assigneeId && ["waiting", "assigned"].includes(t.status))
      .forEach(t => { t.status = "working"; });
  }
  order.status = "working";
  order.transferFromStepId = "";
  order.transferFromAssigneeId = "";
  order.transferFromManagerId = "";
  order.note = `${order.note || ""}\n[${nowText()} - ${state.currentUser.name}] S?a l?i sau khi chuy?fn/tr? v? c?ng ?'o?n tru?>c: ${reason}`.trim();
  log(`${state.currentUser.name} ?'ua ${order.code} v? tr?ng th?i ?'ang l?m ?'?f s?a l?i`);
  saveDb();
  openOrderDetail(order.id);
}

function openDepartmentRequestForm(orderId) {
  const order = getOrder(orderId);
  if (!canCreateDepartmentRequest(order)) return;
  const options = previousRequestSteps(order);
  q("#modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="closeModal(event)">
      <div class="modal small-modal" onclick="event.stopPropagation()">
        <div class="modal-head">
          <div><h2>Y?u c?u b?T ph?n tru?>c</h2><p>${order.code} ? ${order.projectName}</p></div>
          <button class="secondary" onclick="openOrderDetail('${order.id}')">D?ng</button>
        </div>
        <div class="form-grid">
          <div class="field wide">
            <label>B?T ph?n ti?p nh?n y?u c?u</label>
            <select id="requestTargetStep">${options.map(s => `<option value="${s.id}">${s.name}</option>`).join("")}</select>
          </div>
          <div class="field wide">
            <label>N?Ti dung y?u c?u</label>
            <textarea id="requestText" placeholder="Nh?p y?u c?u c?n b?T ph?n tru?>c x? l? uu ti?n"></textarea>
          </div>
        </div>
        <div class="form-actions">
          <button class="secondary" onclick="openOrderDetail('${order.id}')">Hu?</button>
          <button class="success" onclick="createDepartmentRequest('${order.id}')">G?i y?u c?u uu ti?n</button>
        </div>
      </div>
    </div>
  `;
}

function createDepartmentRequest(orderId) {
  const order = getOrder(orderId);
  if (!canCreateDepartmentRequest(order)) return;
  const targetStepId = q("#requestTargetStep").value;
  const text = q("#requestText").value.trim();
  if (!text) {
    appAlert("B?n c?n nh?p n?Ti dung y?u c?u.");
    return;
  }
  if (!previousRequestSteps(order).some(s => s.id === targetStepId)) {
    appAlert("Ch?? ?'u?c y?u c?u c?c b?T ph?n ph?a tru?>c, kh?ng ?'u?c y?u c?u b?T ph?n ph?a sau.");
    return;
  }
  const targetManagerId = findManagerForStep(targetStepId);
  const request = {
    id: "dr" + Date.now(),
    orderId: order.id,
    fromStepId: order.currentStepId,
    fromManagerId: state.currentUser.id,
    targetStepId,
    targetManagerId,
    text,
    priority: true,
    status: "sent",
    createdAt: nowText(),
    acceptedAt: "",
    startedAt: "",
    completedAt: "",
    resultNote: ""
  };
  db.departmentRequests = db.departmentRequests || [];
  db.departmentRequests.push(request);
  if (targetManagerId) {
    const requestTask = task(
      "t" + Date.now() + "dr",
      order.id,
      targetStepId,
      `Y?u c?u uu ti?n t? ${getStep(order.currentStepId)?.name}`,
      targetManagerId,
      targetManagerId,
      "waiting",
      order.deadline,
      text
    );
    requestTask.kind = "department_request";
    requestTask.requestId = request.id;
    db.tasks.push(requestTask);
  }
  order.note = `${order.note || ""}\n[${nowText()} - ${state.currentUser.name}] Y?u c?u ${getStep(targetStepId)?.name}: ${text}`.trim();
  log(`${state.currentUser.name} g?i y?u c?u uu ti?n ${order.code} t?>i ${getStep(targetStepId)?.name}`);
  saveDb();
  openOrderDetail(order.id);
}

function getDepartmentRequest(id) {
  return (db.departmentRequests || []).find(r => r.id === id);
}

function canAcceptDepartmentRequest(r) {
  return r && r.status === "sent" && (r.targetManagerId === state.currentUser.id || canManageStep(r.targetStepId));
}

function canWorkDepartmentRequest(r) {
  return r && r.status === "accepted" && (r.targetManagerId === state.currentUser.id || canManageStep(r.targetStepId));
}

function canFinishDepartmentRequest(r) {
  return r && r.status === "working" && (r.targetManagerId === state.currentUser.id || canManageStep(r.targetStepId));
}

function acceptDepartmentRequest(id) {
  const r = getDepartmentRequest(id);
  if (!canAcceptDepartmentRequest(r)) return;
  r.status = "accepted";
  r.acceptedAt = nowText();
  updateDepartmentRequestTask(r, "assigned");
  log(`${state.currentUser.name} ti?p nh?n y?u c?u uu ti?n ${r.orderId}`);
  saveDb();
  openOrderDetail(r.orderId);
}

function workDepartmentRequest(id) {
  const r = getDepartmentRequest(id);
  if (!canWorkDepartmentRequest(r)) return;
  r.status = "working";
  r.startedAt = nowText();
  updateDepartmentRequestTask(r, "working");
  log(`${state.currentUser.name} b?t ?'?u x? l? y?u c?u uu ti?n ${r.orderId}`);
  saveDb();
  openOrderDetail(r.orderId);
}

async function finishDepartmentRequest(id, mode) {
  const r = getDepartmentRequest(id);
  if (!canFinishDepartmentRequest(r)) return;
  const defaultText = mode === "next" ? "D? x? l? xong v? chuy?fn sang c?ng ?'o?n ti?p theo." : "D? x? l? xong v? tr? v? c?ng ?'o?n y?u c?u.";
  const note = await appPrompt("Nh?p k?t qu? x? l?:", defaultText);
  if (!note) return;
  r.status = mode === "next" ? "moved_next" : "returned_to_requester";
  r.completedAt = nowText();
  r.resultNote = note;
  updateDepartmentRequestTask(r, "done");
  const order = getOrder(r.orderId);
  if (order) {
    if (mode === "return") {
      interruptStepTasks(order, r.fromStepId, note);
    }
    order.note = `${order.note || ""}\n[${r.completedAt} - ${state.currentUser.name}] ${getStep(r.targetStepId)?.name} x? l? y?u c?u: ${note}`.trim();
  }
  log(`${state.currentUser.name} ho?n t?t y?u c?u uu ti?n ${r.orderId}`);
  saveDb();
  openOrderDetail(r.orderId);
}

function updateDepartmentRequestTask(request, status) {
  db.tasks
    .filter(t => t.kind === "department_request" && t.requestId === request.id)
    .forEach(t => {
      t.status = status;
      if (status === "done") t.completedAt = nowText();
    });
}

function canTransferToNextDepartment(order) {
  if (!order || order.assigneeId !== state.currentUser.id) return false;
  if (!["sale", "design", "quote"].includes(order.currentStepId)) return false;
  if (order.currentStepId === "sale" && !stepChecklistDone(order.id, "sale")) return false;
  if (order.currentStepId === "design" && (!stepChecklistDone(order.id, "design") || !hasDesignDeliverables(order.id))) return false;
  if (order.currentStepId === "quote" && !quoteReadyForTransfer(order)) return false;
  return ["assigned", "working", "returned"].includes(order.status);
}

function quoteReadyForTransfer(order) {
  return Boolean(order)
    && Number(order.quoteEstimate || order.estimate || 0) > 0
    && Number(order.quotePrice || 0) > 0
    && Boolean(order.quoteEstimateImage)
    && Boolean(order.quotePriceImage)
    && order.quoteApprovalStatus === "approved";
}

function saleChecklistDone(orderId) {
  return stepChecklistDone(orderId, "sale");
}
function canConfirmStepTransfer(order) {
  return Boolean(order?.pendingNextStepId)
    && order.status === "waiting"
    && canManageStep(order.currentStepId);
}


async function transferToNextDepartment(orderId) {
  const order = getOrder(orderId);
  if (!canTransferToNextDepartment(order)) return;
  const note = await appPrompt("C?p nh?t th?ng tin/ghi ch? chuy?fn b?T ph?n:", "");
  if (note) order.note = `${order.note || ""}\n[${nowText()} - ${state.currentUser.name}] ${note}`.trim();
  order.lastInfoAt = today();
  const next = nextStep(order.currentStepId);
  if (!next) return;
  startOrderWaiting(order, `Ch? qu?n l? x?c nh?n chuy?fn sang ${next.name}`);
  order.pendingNextStepId = next.id;
  order.pendingTransferNote = note || "";
  order.pendingTransferBy = state.currentUser.id;
  order.transferFromStepId = order.currentStepId;
  order.transferFromAssigneeId = order.assigneeId;
  order.transferFromManagerId = order.managerId;
  log(`${state.currentUser.name} g?i y?u c?u chuy?fn ${order.code} sang ${next.name}`);
  saveDb();
  closeModal();
  render();
}

function canTransferProductionToInstall(order) {
  return Boolean(order)
    && order.currentStepId === "production"
    && !order.pendingNextStepId
    && !order.archived
    && canManageStep("production")
    && ["assigned", "working", "returned", "approved", "unassigned"].includes(order.status);
}

function canCompleteAcceptanceStep(order) {
  return Boolean(order)
    && order.currentStepId === "acceptance"
    && !order.pendingNextStepId
    && !order.archived
    && !["done", "approved", "incomplete"].includes(order.status)
    && canManageStep("acceptance");
}

async function completeAcceptanceStep(orderId) {
  const order = getOrder(orderId);
  if (!canCompleteAcceptanceStep(order)) return;
  if (!await appConfirm(`Xác nhận hoàn thành nghiệm thu đơn ${order.code}?`)) return;
  const time = nowText();
  closeOrderWaiting(order, state.currentUser.id);
  order.status = "approved";
  order.assigneeId = "";
  order.managerId = state.currentUser.id;
  order.note = `${order.note || ""}\n[${time} - ${state.currentUser.name}] Hoàn thành nghiệm thu. Chuyển sang hoàn công/kế toán.`.trim();
  moveOrderNextStep(order, { waitForNextManager: true, targetStepId: "close" });
  log(`${state.currentUser.name} hoàn thành nghiệm thu ${order.code}`);
  saveDb();
  closeModal();
  render();
}

async function transferProductionToInstall(orderId, percent) {
  const order = getOrder(orderId);
  if (!canTransferProductionToInstall(order)) return;
  const note = await appPrompt(`Ghi ch? chuy?n l?p d?t ${percent}%:`, percent === 50 ? "Tri?n khai l?p d?t d?t 1 song song v?i s?n xu?t ph?n c?n l?i." : "S?n xu?t ho?n t?t, chuy?n l?p d?t to?n b?.");
  if (note === null) return;
  order.installTransferPercent = percent;
  order.note = `${order.note || ""}\n[${nowText()} - ${state.currentUser.name}] Chuy?n sang l?p d?t ${percent}%${note ? `: ${note}` : ""}`.trim();
  startOrderWaiting(order, `Ch? gi?m s?t ti?p nh?n l?p d?t ${percent}%`);
  moveOrderNextStep(order, { waitForNextManager: true, targetStepId: "install" });
  log(`${state.currentUser.name} chuy?n ${order.code} sang l?p d?t ${percent}%`);
  saveDb();
  closeModal();
  render();
}

async function confirmStepTransfer(orderId) {
  const order = getOrder(orderId);
  if (!canConfirmStepTransfer(order)) return;
  const nextName = getStep(order.pendingNextStepId)?.name || "b?T ph?n ti?p theo";
  if (!await appConfirm(`X?c nh?n chuy?fn ?'on ${order.code} sang ${nextName}?`)) return;
  closeOrderWaiting(order, state.currentUser.id);
  moveOrderNextStep(order, { waitForNextManager: true, targetStepId: order.pendingNextStepId });
  order.pendingNextStepId = "";
  order.pendingTransferNote = "";
  order.pendingTransferBy = "";
  log(`${state.currentUser.name} x?c nh?n chuy?fn ${order.code} sang ${nextName}`);
  saveDb();
  closeModal();
  render();
}

function nextStep(stepId) {
  const index = STEPS.findIndex(s => s.id === stepId);
  return index >= 0 ? STEPS[index + 1] : null;
}

function receiveDepartment(orderId) {
  const order = getOrder(orderId);
  if (!canReceiveDepartment(order)) return;
  closeOrderWaiting(order, state.currentUser.id);
  order.status = "unassigned";
  order.managerId = state.currentUser.id;
  order.stepStartedAt = today();
  db.tasks
    .filter(t => t.orderId === order.id && t.stepId === order.currentStepId && t.assigneeId === state.currentUser.id)
    .forEach(t => {
      t.status = "approved";
      t.completedAt = nowText();
    });
  log(`${state.currentUser.name} ti?p nh?n c?ng ?'o?n ${getStep(order.currentStepId)?.name} c?a ${order.code}`);
  saveDb();
  closeModal();
  render();
}

function claimOrder(orderId) {
  const order = getOrder(orderId);
  const customer = getCustomer(order?.customerId);
  if (!order || !canClaimOrder(order)) {
    appAlert("Don n?y chua ?'? ?'i?u ki??n ?'?f Sale nh?n.");
    return;
  }
  if (customer?.approvalStatus !== "approved") {
    appAlert("Kh?ch h?ng chua ?'u?c Qu?n l? sale duy??t.");
    return;
  }
  const salesManagerId = findManagerForStep("sale") || order.managerId || "";
  order.currentStepId = "sale";
  order.status = "assigned";
  order.saleId = state.currentUser.id;
  order.assigneeId = state.currentUser.id;
  order.managerId = salesManagerId;
  order.progress = Math.max(order.progress || 0, 10);
  order.stepStartedAt = today();
  order.lastInfoAt = today();
  createSaleReceptionTasks(order, state.currentUser.id, salesManagerId);
  log(`${state.currentUser.name} nh?n ?'on ${order.code}`);
  saveDb();
  render();
}

function createSaleReceptionTasks(order, saleId, managerId) {
  SALE_CHECKLIST_TASKS.forEach((title, index) => {
    if (db.tasks.some(t => t.orderId === order.id && t.stepId === "sale" && normalizedChecklistTitle(t.title) === title)) return;
    const item = task(
      "t" + Date.now() + index,
      order.id,
      "sale",
      title,
      saleId,
      managerId,
      "assigned",
      order.deadline,
      order.note
    );
    item.kind = "checklist";
    db.tasks.push(item);
  });
}

function acceptAssignedTask(taskId) {
  const t = db.tasks.find(x => x.id === taskId);
  if (!canAcceptAssignedTask(t)) return;
  const order = getOrder(t.orderId);
  const acceptedAt = nowText();
  const acceptedAtMs = nowMs();
  const stepName = getStep(t.stepId)?.name || "c?ng ?'o?n";
  t.status = "working";
  t.acceptedAt = acceptedAt;
  t.acceptedAtMs = acceptedAtMs;
  if (order) {
    order.status = "working";
    order.stepStartedAt = today();
    order.note = `${order.note || ""}\n[${acceptedAt} - ${state.currentUser.name}] D? nh?n ?'on h?ng ${stepName}.`.trim();
  }
  log(`${state.currentUser.name} nh?n ?'on ${stepName} ${order?.code || t.orderId}`);
  saveDb();
  openOrderDetail(t.orderId);
}

function refreshAfterOrderAction(orderId) {
  if (q("#modalRoot").innerHTML.trim()) {
    openOrderDetail(orderId);
  } else {
    render();
  }
}

function completeTask(taskId) {
  const t = db.tasks.find(x => x.id === taskId);
  if (!canCompleteTask(t)) return;
  if (t.stepId === "quote" && !quoteReadyForTransfer(getOrder(t.orderId))) {
    openQuoteCompletionForm(t.id);
    return;
  }
  openCompleteTaskChecklist(taskId);
}

function completeTaskChecklistItems(t) {
  const sameOrderMine = db.tasks.filter(x =>
    x.orderId === t.orderId
    && x.assigneeId === state.currentUser.id
    && !["notification", "department_request", "receive"].includes(x.kind)
    && ["assigned", "working", "returned"].includes(x.status)
  );
  const items = sameOrderMine.length ? sameOrderMine : [t];
  return items.map(item => ({ id: item.id, title: displayTaskTitle(item.title), step: getStep(item.stepId)?.name || "" }));
}

function openCompleteTaskChecklist(taskId) {
  const t = db.tasks.find(x => x.id === taskId);
  if (!t) return;
  const items = completeTaskChecklistItems(t);
  q("#modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="closeModal(event)">
      <div class="modal small-modal" onclick="event.stopPropagation()">
        <div class="modal-head"><h2>Rà soát trước khi hoàn thành</h2><button class="secondary" onclick="closeModal()">Đóng</button></div>
        <div class="modal-body">
          <p class="muted">Tích từng việc đã làm xong để tránh quên việc trước khi gửi chờ quản lý xác nhận.</p>
          <div class="completion-checklist">
            ${items.map(item => `
              <label>
                <input type="checkbox" class="complete-check-item" value="${item.id}">
                <span><b>${item.title}</b>${item.step ? ` - ${item.step}` : ""}</span>
              </label>
            `).join("")}
          </div>
          <div class="task-actions" style="justify-content:flex-end;margin-top:14px;">
            <button class="secondary" onclick="closeModal()">Hủy</button>
            <button class="success" onclick="submitCompleteTaskChecklist('${taskId}')">Gửi hoàn thành</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function submitCompleteTaskChecklist(taskId) {
  const checked = qa(".complete-check-item").filter(input => input.checked).map(input => input.value);
  const required = completeTaskChecklistItems(db.tasks.find(x => x.id === taskId)).map(item => item.id);
  const missing = required.filter(id => !checked.includes(id));
  if (missing.length) {
    appAlert("Bạn cần tích đủ các công việc đã hoàn thành trước khi gửi.");
    return;
  }
  required.forEach(id => finalizeCompleteTask(id, true));
  saveDb();
  refreshAfterOrderAction(db.tasks.find(x => x.id === taskId)?.orderId);
}
function finalizeCompleteTask(taskId, silent = false) {
  const t = db.tasks.find(x => x.id === taskId);
  if (!canCompleteTask(t)) return;
  if (t.stepId === "design" && normalizedChecklistTitle(t.title).includes("Gửi file") && !hasDesignDeliverables(t.orderId)) {
    appAlert("Thiết kế cần upload file hoặc hình ảnh trước khi báo hoàn thành.");
    return;
  }
  if (t.stepId === "quote" && !quoteReadyForTransfer(getOrder(t.orderId))) {
    openQuoteCompletionForm(t.id);
    return;
  }
  if (t.kind === "notification") {
    t.status = "done";
    t.completedAt = nowText();
    t.completedAtMs = nowMs();
    if (!silent) {
      saveDb();
      refreshAfterOrderAction(t.orderId);
    }
    return;
  }
  const isChecklist = isChecklistTask(t);
  const isSaleChecklist = t.stepId === "sale";
  const managerCompletesOwnStep = !isChecklist && !isSaleChecklist && canManageStep(t.stepId);
  t.status = isChecklist || isSaleChecklist ? "done" : managerCompletesOwnStep ? "approved" : "waiting";
  t.completedAt = nowText();
  t.completedAtMs = nowMs();
  const order = getOrder(t.orderId);
  if (isChecklist || isSaleChecklist) order.lastInfoAt = today();
  const hasActiveSameStep = db.tasks.some(x => x.orderId === t.orderId && x.stepId === t.stepId && x.id !== t.id && ["assigned", "working", "returned"].includes(x.status));
  if (isSaleChecklist || isChecklist) {
    order.status = "assigned";
  } else if (hasActiveSameStep) {
    order.status = "working";
  } else {
    startOrderWaiting(order, `Chờ quản lý xác nhận công đoạn ${getStep(t.stepId)?.name || ""}`);
  }
  order.note = `${order.note || ""}\n[${nowText()} - ${state.currentUser.name}] Hoàn thành ${displayTaskTitle(t.title)}.`.trim();
  if (!silent) {
    saveDb();
    refreshAfterOrderAction(t.orderId);
  }
}

function hasDesignDeliverables(orderId) {
  return db.files.some(f => f.orderId === orderId && f.stepId === "design")
    || db.photos.some(p => p.orderId === orderId && p.stepId === "design");
}

function openQuoteCompletionForm(taskId) {
  const t = db.tasks.find(x => x.id === taskId);
  const order = getOrder(t?.orderId);
  if (!t || !order) return;
  q("#modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="closeModal(event)">
      <div class="modal small-modal" onclick="event.stopPropagation()">
        <div class="modal-head"><h2>Dự toán công trình</h2><button class="secondary" onclick="openOrderDetail('${order.id}')">Đóng</button></div>
        <div class="form-grid">
          <div class="field"><label>Số tiền dự toán</label><input id="quoteEstimate" type="number" value="${order.quoteEstimate || order.estimate || ""}"></div>
          <div class="field"><label>Số tiền báo giá</label><input id="quotePrice" type="number" value="${order.quotePrice || ""}"></div>
          <div class="field wide"><label>Ảnh dự toán</label><input id="quoteEstimateImage" type="file" accept="image/*"></div>
          <div class="field wide"><label>Ảnh báo giá</label><input id="quotePriceImage" type="file" accept="image/*"></div>
          <p class="muted wide">Ảnh dự toán chỉ giám đốc, kế toán, sale và quản lý sale xem được. Ảnh báo giá giám sát trưởng được xem.</p>
        </div>
        <div class="form-actions">
          <button class="secondary" onclick="openOrderDetail('${order.id}')">Hủy</button>
          <button class="success" onclick="submitQuoteCompletion('${taskId}')">Lưu và hoàn thành báo giá</button>
        </div>
      </div>
    </div>
  `;
}

function readFileAsDataUrl(file) {
  return new Promise(resolve => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.readAsDataURL(file);
  });
}

async function submitQuoteCompletion(taskId) {
  const t = db.tasks.find(x => x.id === taskId);
  const order = getOrder(t?.orderId);
  if (!t || !order) return;
  const estimate = Number(q("#quoteEstimate").value) || 0;
  const price = Number(q("#quotePrice").value) || 0;
  const estimateFile = q("#quoteEstimateImage").files[0];
  const priceFile = q("#quotePriceImage").files[0];
  if (!estimate || !price) return appAlert("Bạn phải nhập đủ số tiền dự toán và số tiền báo giá.");
  if (!estimateFile && !order.quoteEstimateImage) return appAlert("Bạn phải tải ảnh dự toán.");
  if (!priceFile && !order.quotePriceImage) return appAlert("Bạn phải tải ảnh báo giá.");
  const estimateImage = await readFileAsDataUrl(estimateFile);
  const priceImage = await readFileAsDataUrl(priceFile);
  order.quoteEstimate = estimate;
  order.quotePrice = price;
  order.estimate = estimate;
  order.actualCost = estimate;
  if (estimateImage) {
    order.quoteEstimateImage = estimateImage;
    order.quoteEstimateImageName = estimateFile.name;
  }
  if (priceImage) {
    order.quotePriceImage = priceImage;
    order.quotePriceImageName = priceFile.name;
  }
  order.quoteSubmittedBy = state.currentUser.id;
  order.quoteSubmittedAt = nowText();
  if (canManageStep("quote")) {
    order.quoteApprovalStatus = "approved";
    t.status = "approved";
    t.completedAt = nowText();
    t.completedAtMs = nowMs();
    closeOrderWaiting(order, state.currentUser.id);
    order.status = "approved";
    moveOrderNextStep(order);
  } else {
    order.quoteApprovalStatus = "pending";
    t.status = "waiting";
    t.completedAt = nowText();
    t.completedAtMs = nowMs();
    startOrderWaiting(order, "Chờ quản lý sale xác nhận dự toán và báo giá");
  }
  order.note = `${order.note || ""}\n[${nowText()} - ${state.currentUser.name}] Nhập dự toán ${fmtMoney(estimate)} và báo giá ${fmtMoney(price)}.`.trim();
  saveDb();
  closeModal();
  render();
}

function canApproveQuote(order) {
  return Boolean(order)
    && order.currentStepId === "quote"
    && order.quoteApprovalStatus === "pending"
    && canManageStep("quote");
}

function approveQuote(orderId) {
  const order = getOrder(orderId);
  if (!canApproveQuote(order)) return;
  order.quoteApprovalStatus = "approved";
  db.tasks
    .filter(t => t.orderId === orderId && t.stepId === "quote" && t.status === "waiting")
    .forEach(t => {
      t.status = "approved";
      if (!t.completedAt) t.completedAt = nowText();
      if (!t.completedAtMs) t.completedAtMs = nowMs();
    });
  closeOrderWaiting(order, state.currentUser.id);
  order.status = "approved";
  order.note = `${order.note || ""}\n[${nowText()} - ${state.currentUser.name}] Quản lý sale xác nhận dự toán và báo giá.`.trim();
  moveOrderNextStep(order);
  saveDb();
  closeModal();
  render();
}

function approveTask(taskId, mode = "one") {
  const t = db.tasks.find(x => x.id === taskId);
  if (!canApproveTask(t)) return;
  const order = getOrder(t.orderId);
  const approveAll = mode === "all" && hasGroupCoworkersToApprove(t);
  const time = nowText();
  const timeMs = nowMs();
  const targets = approveAll
    ? sameWorkTasks(t).filter(x => !["approved", "done"].includes(x.status))
    : [t];
  targets.forEach(item => {
    if (!item.acceptedAt) {
      item.acceptedAt = time;
      item.acceptedAtMs = timeMs;
    }
    if (!item.completedAt) {
      item.completedAt = time;
      item.completedAtMs = timeMs;
    }
    item.status = "approved";
  });
  const hasUnapprovedSameStep = db.tasks.some(x =>
    x.orderId === t.orderId
    && x.stepId === t.stepId
    && !["receive", "department_request", "notification"].includes(x.kind)
    && !["approved", "done"].includes(x.status)
  );
  if (hasUnapprovedSameStep) {
    if (order.status !== "waiting") startOrderWaiting(order, `Ch? qu?n l? x?c nh?n c?c c?ng vi??c c?n l?i ?Y ${getStep(t.stepId)?.name || "c?ng ?'o?n"}`);
  } else {
    closeOrderWaiting(order, state.currentUser.id);
    order.status = "approved";
    moveOrderNextStep(order);
  }
  order.note = `${order.note || ""}\n[${time} - ${state.currentUser.name}] ${approveAll ? "X?c nh?n t?t c? nh?n s? c?ng ho?n th?nh" : `X?c nh?n ${getUser(t.assigneeId)?.name || "nh?n s?"} ho?n th?nh`} c?ng ?'o?n ${getStep(t.stepId)?.name || ""}.`.trim();
  log(`${state.currentUser.name} ${approveAll ? "x?c nh?n t?t c? c?ng ho?n th?nh" : "x?c nh?n"} c?ng ?'o?n ${getStep(t.stepId).name} c?a ${order.code}`);
  saveDb();
  refreshAfterOrderAction(order.id);
}

async function returnTask(taskId) {
  const reason = await appPrompt("Nh?p l? do tr? l?i:", "Chua ?'?t y?u c?u, c?n ch??nh s?a.");
  if (!reason) return;
  const t = db.tasks.find(x => x.id === taskId);
  if (!canApproveTask(t)) return;
  const order = getOrder(t.orderId);
  closeOrderWaiting(order, state.currentUser.id);
  t.status = "returned";
  t.note = reason;
  order.currentStepId = t.stepId;
  order.status = "returned";
  order.returnedAt = nowText();
  order.returnedAtMs = nowMs();
  order.managerId = t.managerId || order.managerId;
  order.assigneeId = t.assigneeId || order.assigneeId;
  order.note = reason;
  log(`${state.currentUser.name} tr? l?i c?ng vi??c ${t.title}: ${reason}`);
  saveDb();
  refreshAfterOrderAction(order.id);
}

function moveOrderNextStep(order, options = {}) {
  const index = STEPS.findIndex(s => s.id === order.currentStepId);
  if (index >= STEPS.length - 1) {
    order.status = "done";
    order.progress = 100;
    order.finalReport = "D? ho?n c?ng";
    return;
  }
  const next = options.targetStepId ? getStep(options.targetStepId) : STEPS[index + 1];
  if (!next) return;
  order.currentStepId = next.id;
  if (options.waitForNextManager) {
    startOrderWaiting(order, `Ch? qu?n l? ${next.name} ti?p nh?n`);
  } else {
    order.status = "unassigned";
  }
  order.transferFromStepId = options.waitForNextManager ? STEPS[index].id : "";
  order.transferFromAssigneeId = options.waitForNextManager ? order.assigneeId : "";
  order.transferFromManagerId = options.waitForNextManager ? order.managerId : "";
  order.assigneeId = "";
  order.managerId = findManagerForStep(next.id);
  order.progress = Math.round((index + 1) / (STEPS.length - 1) * 100);
  order.stepStartedAt = today();
  order.lastInfoAt = today();
  if (options.waitForNextManager && order.managerId) {
    const receiveTask = task(
      "t" + Date.now(),
      order.id,
      next.id,
      `Ti?p nh?n c?ng ?'o?n ${next.name}`,
      order.managerId,
      order.managerId,
      "waiting",
      order.deadline,
      order.note
    );
    receiveTask.kind = "receive";
    db.tasks.push(receiveTask);
  }
  if (next.id === "quote") {
    closeOrderWaiting(order, "auto_quote");
    const saleId = order.saleId;
    order.status = "assigned";
    order.assigneeId = saleId;
    order.managerId = findManagerForStep("quote");
    db.tasks.push(task(
      "t" + Date.now() + "q",
      order.id,
      "quote",
      "Lập báo giá cho khách hàng",
      saleId,
      order.managerId,
      "assigned",
      order.deadline,
      order.note
    ));
    if (order.managerId) {
      const notifyTask = task(
        "t" + Date.now() + "qn",
        order.id,
        "quote",
        "Thông báo: đơn đã chuyển sang báo giá",
        order.managerId,
        order.managerId,
        "assigned",
        order.deadline,
        "Trưởng bộ phận chỉ cần tích đã xem."
      );
      notifyTask.kind = "notification";
      db.tasks.push(notifyTask);
    }
  }
}

function openDailyAttendanceCamera() {
  if (!canUseDailyAttendance()) return;
  if (isSundayDate(new Date())) {
    appAlert("Chủ nhật không chấm công thường. Nếu có đi làm, bạn đăng ký tăng ca.");
    return;
  }
  const slot = currentAttendanceSlot();
  if (!slot) {
    appAlert("Nút chấm công chỉ mở trong các khung 07:30-08:30, 11:30-13:30, 13:30-14:30, 17:30-18:30.");
    return;
  }
  if (hasCheckedInSlot(today(), slot.id)) {
    appAlert(`Bạn đã chấm công mốc ${slot.label} hôm nay.`);
    return;
  }
  const time = nowText();
  state.pendingAttendance = { type: "daily_checkin", time, date: today(), slotId: slot.id, slotLabel: slot.label, imageData: "", driveLink: "" };
  q("#modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="closeModal(event)">
      <div class="modal attendance-modal" onclick="event.stopPropagation()">
        <div class="modal-head"><h2>Chấm công đầu ngày</h2><button class="secondary" onclick="closeModal()">Đóng</button></div>
        <div class="modal-body">
          <div class="attendance-camera">
            <div>
              <video id="attendanceVideo" autoplay playsinline muted></video>
              <canvas id="attendanceCanvas" style="display:none;"></canvas>
              <img id="attendancePreview" alt="Ảnh chấm công đã đóng dấu thời gian" style="display:none;">
            </div>
            <div class="attendance-side">
              <p><b>Nhân viên:</b> ${state.currentUser.name}</p>
              <p><b>Mốc chấm công:</b> ${slot.label}</p>
              <p><b>Thời điểm chấm công:</b><br><span id="attendanceTime">${time}</span></p>
              <input id="attendanceFile" type="file" accept="image/*" capture="environment" style="display:none" onchange="handleAttendanceFile(event)">
              <button onclick="startAttendanceCamera()">Bật camera</button>
              <button class="secondary" onclick="captureAttendancePhoto()">Chụp ảnh</button>
              <button class="secondary" onclick="q('#attendanceFile').click()">Chọn ảnh từ máy</button>
              <button id="sendAttendanceBtn" class="success" onclick="sendAttendancePhoto()" disabled>Gửi ảnh và chấm công</button>
              <p class="muted">Sau khi gửi, phần mềm sẽ yêu cầu xác nhận ngày giờ. Thời điểm này là thời điểm bắt đầu làm việc.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  startAttendanceCamera();
}

function openAttendanceCamera(taskId) {
  const t = db.tasks.find(x => x.id === taskId);
  const order = getOrder(t?.orderId);
  if (!t || t.assigneeId !== state.currentUser.id) return;
  const time = nowText();
  state.pendingAttendance = { type: "task_photo", taskId, time, date: today(), imageData: "", driveLink: "" };
  q("#modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="closeModal(event)">
      <div class="modal attendance-modal" onclick="event.stopPropagation()">
        <div class="modal-head"><h2>Chụp ảnh chấm công</h2><button class="secondary" onclick="closeModal()">Đóng</button></div>
        <div class="modal-body">
          <div class="attendance-camera">
            <div>
              <video id="attendanceVideo" autoplay playsinline muted></video>
              <canvas id="attendanceCanvas" style="display:none;"></canvas>
              <img id="attendancePreview" alt="Ảnh chấm công đã đóng dấu thời gian" style="display:none;">
            </div>
            <div class="attendance-side">
              <p><b>Don hang:</b> ${order?.code || t.orderId}</p>
              <p><b>Cong doan:</b> ${getStep(t.stepId)?.name || ""}</p>
              <p><b>Nhan vien:</b> ${state.currentUser.name}</p>
              <p><b>Thời điểm chấm công:</b><br><span id="attendanceTime">${time}</span></p>
              <input id="attendanceFile" type="file" accept="image/*" capture="environment" style="display:none" onchange="handleAttendanceFile(event)">
              <button onclick="startAttendanceCamera()">Bat camera</button>
              <button class="secondary" onclick="captureAttendancePhoto()">Chụp ảnh</button>
              <button class="secondary" onclick="q('#attendanceFile').click()">Chon anh tu may</button>
              <button id="sendAttendanceBtn" class="success" onclick="sendAttendancePhoto()" disabled>Gửi ảnh và chấm công</button>
              <p class="muted">Sau khi gui, phan mem se yeu cau xac nhan ngay gio. Anh duoc dong dau thoi gian va luu kem link noi bo; Google Drive can ket noi API khi dua len online.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  startAttendanceCamera();
}

async function startAttendanceCamera() {
  const video = q("#attendanceVideo");
  if (!video || !navigator.mediaDevices?.getUserMedia) {
    appAlert("Trình duyệt không hỗ trợ camera. Hãy chọn ảnh từ máy để chấm công.");
    return;
  }
  try {
    stopAttendanceCamera();
    activeCameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    video.srcObject = activeCameraStream;
  } catch (err) {
    appAlert("Không mở được camera. Hãy kiểm tra quyền camera hoặc chọn ảnh từ máy.");
  }
}

function stopAttendanceCamera() {
  if (!activeCameraStream) return;
  activeCameraStream.getTracks().forEach(track => track.stop());
  activeCameraStream = null;
}

function captureAttendancePhoto() {
  const video = q("#attendanceVideo");
  if (!video || !video.videoWidth) {
    appAlert("Camera chua san sang. Hay bat camera hoac chon anh tu may.");
    return;
  }
  stampAttendanceImage(video, video.videoWidth, video.videoHeight);
}

function handleAttendanceFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => stampAttendanceImage(img, img.naturalWidth, img.naturalHeight);
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function stampAttendanceImage(source, width, height) {
  const canvas = q("#attendanceCanvas");
  const preview = q("#attendancePreview");
  const video = q("#attendanceVideo");
  if (!canvas || !preview || !state.pendingAttendance) return;
  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / width);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const stamp = `GOMITA | ${state.currentUser.name} | ${state.pendingAttendance.time}`;
  const pad = Math.max(18, Math.round(canvas.width * 0.018));
  const fontSize = Math.max(24, Math.round(canvas.width * 0.028));
  ctx.font = `700 ${fontSize}px Arial`;
  const textWidth = ctx.measureText(stamp).width;
  ctx.fillStyle = "rgba(6, 23, 44, 0.82)";
  ctx.fillRect(0, canvas.height - fontSize - pad * 2, Math.min(canvas.width, textWidth + pad * 2), fontSize + pad * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(stamp, pad, canvas.height - pad);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
  state.pendingAttendance.imageData = dataUrl;
  preview.src = dataUrl;
  preview.style.display = "block";
  if (video) video.style.display = "none";
  q("#sendAttendanceBtn").disabled = false;
  stopAttendanceCamera();
}

async function sendAttendancePhoto() {
  const pending = state.pendingAttendance;
  if (!pending?.imageData) {
    appAlert("Hay chup anh hoac chon anh truoc khi gui.");
    return;
  }
  if (!await appConfirm(`Xác nhận ngày giờ chấm công: ${pending.time}?`)) return;
  const photoId = "p" + Date.now();
  const isDaily = pending.type === "daily_checkin";
  const t = isDaily ? null : db.tasks.find(x => x.id === pending.taskId);
  if (!isDaily && !t) return;
  const slot = ATTENDANCE_SLOTS.find(s => s.id === pending.slotId);
  const isLate = isDaily && isLateForSlot(slot);
  const driveLink = await uploadPhotoToGoogleDrive({
    photoId,
    orderId: isDaily ? "" : t.orderId,
    stepId: isDaily ? "" : t.stepId,
    userId: state.currentUser.id,
    userName: state.currentUser.name,
    time: pending.time,
    imageData: pending.imageData
  });
  db.photos.push(photo(
    photoId,
    isDaily ? "" : t.orderId,
    isDaily ? "" : t.stepId,
    state.currentUser.id,
    isDaily ? "Ảnh chấm công trong ngày" : "Ảnh chấm công " + getStep(t.stepId).name,
    pending.time,
    pending.imageData,
    driveLink
  ));
  db.attendance.push({
    id: "a" + Date.now(),
    type: isDaily ? "daily_checkin" : "task_photo",
    date: pending.date || today(),
    slotId: pending.slotId || "",
    slotLabel: pending.slotLabel || "",
    isLate,
    userId: state.currentUser.id,
    orderId: isDaily ? "" : t.orderId,
    stepId: isDaily ? "" : t.stepId,
    time: pending.time,
    source: isDaily ? `Chấm công ${pending.slotLabel}` : "Chụp ảnh chấm công",
    photoId,
    driveLink,
    status: isDaily ? "Đã xác nhận" : "Chờ quản lý xác nhận"
  });
  log(isDaily ? `${state.currentUser.name} chấm công trong ngày` : `${state.currentUser.name} chụp ảnh chấm công cho ${t.orderId}`);
  state.pendingAttendance = null;
  saveDb();
  closeModal();
  render();
  if (isDaily && lateAttendanceDaysThisMonth(state.currentUser.id) > 3) {
    appAlert("Tháng này bạn chấm công muộn hơi nhiều, cố gắng chấm công đúng giờ để đảm bảo quyền lợi của mình.");
  }
}

function createInternalPhotoLink(photoId) {
  return `local-gomita-photo://${photoId}`;
}

async function uploadPhotoToGoogleDrive(payload) {
  if (!window.GOMITA_GOOGLE_DRIVE_UPLOAD_URL) return createInternalPhotoLink(payload.photoId);
  try {
    const res = await fetch(window.GOMITA_GOOGLE_DRIVE_UPLOAD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Google Drive upload failed");
    const data = await res.json();
    return data.link || data.webViewLink || createInternalPhotoLink(payload.photoId);
  } catch (err) {
    appAlert("Chưa đẩy được ảnh lên Google Drive. Phần mềm tạm lưu ảnh và link nội bộ để không mất chấm công.");
    return createInternalPhotoLink(payload.photoId);
  }
}

async function uploadWorkPhoto(taskId) {
  const t = db.tasks.find(x => x.id === taskId);
  const name = await appPrompt("T?n ?nh / ghi ch? ?nh:", "?nh c?ng vi??c " + getStep(t.stepId).name);
  if (!name) return;
  const time = nowText();
  db.photos.push(photo("p" + Date.now(), t.orderId, t.stepId, state.currentUser.id, name, time));
  db.attendance.push({
    id: "a" + Date.now(),
    userId: state.currentUser.id,
    orderId: t.orderId,
    stepId: t.stepId,
    time,
    source: "Upload ?nh c?ng vi??c",
    status: "Ch? qu?n l? x?c nh?n"
  });
  appAlert(`Đã upload ảnh và ghi nhận chấm công lúc ${time}. Nếu thời gian sai, hãy phản hồi với quản lý.`);
  log(`${state.currentUser.name} upload ?nh cho ${t.orderId}`);
  saveDb();
  render();
}

function openDesignUpload(taskId) {
  const t = db.tasks.find(x => x.id === taskId);
  if (!t || t.assigneeId !== state.currentUser.id) return;
  q("#modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-head"><h2>Upload file / ?nh thi?t k?</h2><button class="secondary" onclick="closeModal()">D?ng</button></div>
        <div class="modal-body">
          <p class="muted">File v? ?nh s? luu theo ?'on h?ng, c?ng ?'o?n Thi?t k? v? ngu?i upload.</p>
          <input id="designUploadInput" type="file" multiple accept="image/*,.pdf,.dwg,.dxf,.skp,.doc,.docx,.xls,.xlsx">
          <button style="margin-top:12px;" onclick="saveDesignUpload('${taskId}')">Luu file / ?nh</button>
        </div>
      </div>
    </div>
  `;
}

function saveDesignUpload(taskId) {
  const t = db.tasks.find(x => x.id === taskId);
  const files = Array.from(q("#designUploadInput")?.files || []);
  if (!t || !files.length) return appAlert("Chua ch?n file/?nh.");
  let pending = files.length;
  files.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = () => {
      const id = "f" + Date.now() + index;
      db.files.push({
        id,
        orderId: t.orderId,
        stepId: t.stepId,
        uploadedBy: state.currentUser.id,
        name: file.name,
        time: nowText(),
        data: reader.result
      });
      if (file.type.startsWith("image/")) {
        db.photos.push(photo("p" + Date.now() + index, t.orderId, t.stepId, state.currentUser.id, file.name, nowText(), reader.result, createInternalPhotoLink(id)));
      }
      pending -= 1;
      if (!pending) {
        log(`${state.currentUser.name} upload ${files.length} file/?nh thi?t k? cho ${t.orderId}`);
        saveDb();
        closeModal();
        render();
      }
    };
    reader.readAsDataURL(file);
  });
}

function confirmAttendance(id) {
  const row = db.attendance.find(a => a.id === id);
  row.status = "D? x?c nh?n";
  saveDb();
  render();
}

function openPhotoPreview(photoId) {
  const p = db.photos.find(x => x.id === photoId);
  if (!p) return;
  q("#modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="closeModal(event)">
      <div class="modal photo-preview-modal" onclick="event.stopPropagation()">
        <div class="modal-head"><h2>${p.name}</h2><button class="secondary" onclick="closeModal()">D?ng</button></div>
        <div class="modal-body">
          ${p.imageData ? `<img class="photo-preview" src="${p.imageData}" alt="${p.name}">` : `<div class="empty">?nh n?y chua c? d? li??u hi?fn th?<.</div>`}
          <p><b>Don h?ng:</b> ${p.orderId}</p>
          <p><b>C?ng ?'o?n:</b> ${getStep(p.stepId)?.name || ""}</p>
          <p><b>Ngu?i g?i:</b> ${getUser(p.uploadedBy)?.name || ""}</p>
          <p><b>Th?i gian:</b> ${p.time}</p>
          <p><b>Link luu:</b> ${p.driveLink || "Chua c?"}</p>
        </div>
      </div>
    </div>
  `;
}

function openOrderForm() {
  const customers = db.customers.filter(c => {
    if (c.approvalStatus !== "approved") return false;
    if (hasActiveRole(state.currentUser, "sale") && !hasActiveRole(state.currentUser, ["admin", "sales_manager"])) return c.createdBy === state.currentUser.id || db.orders.some(o => o.customerId === c.id && o.saleId === state.currentUser.id);
    return true;
  });
  q("#modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-head"><h2>Tạo đơn hàng</h2><button class="secondary" onclick="closeModal()">Đóng</button></div>
        <div class="modal-body">
          <p style="margin-top:0;color:var(--muted);line-height:1.5;">Sale có thể chọn khách đã duyệt hoặc nhập khách mới ngay tại đây. Nếu là khách mới, đơn sẽ chờ Quản lý sale duyệt thông tin trước khi chuyển sang thiết kế.</p>
          <div class="form-grid">
            <div class="field"><label>Mã đơn</label><input id="newCode" readonly placeholder="Tự tạo theo khách hàng"></div>
            <div class="field"><label>Tên công trình</label><input id="newProject"></div>
            <div class="field">
              <label>Loại khách hàng</label>
              <select id="orderCustomerMode" onchange="toggleOrderCustomerMode()">
                <option value="new">Nhập khách hàng mới</option>
                ${customers.length ? `<option value="existing">Chọn khách đã duyệt</option>` : ""}
              </select>
            </div>
            <div class="field" id="existingCustomerField" style="display:none;"><label>Khách hàng đã duyệt</label><select id="newCustomer" onchange="updateOrderCode()">${customers.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}</select></div>
            <div class="field new-customer-field"><label>Tên khách hàng</label><input id="orderCustomerName" oninput="updateOrderCode()"></div>
            <div class="field new-customer-field"><label>Tuổi khách hàng</label><input id="orderCustomerAge" type="number"></div>
            <div class="field new-customer-field"><label>Số điện thoại</label><input id="orderCustomerPhone" oninput="updateOrderCode()"></div>
            <div class="field new-customer-field"><label>Địa chỉ</label><input id="orderCustomerAddress" oninput="updateOrderCode()"></div>
            <div class="field wide new-customer-field"><label>Nhu cầu ban đầu</label><textarea id="orderCustomerNeed"></textarea></div>
            <div class="field wide new-customer-field"><label>Tâm tư / mong muốn khách hàng</label><textarea id="orderCustomerWish"></textarea></div>
            <div class="field"><label>Deadline</label><input id="newDeadline" type="date" value="${today()}"></div>
            <div class="field wide"><label>Hạng mục thi công</label><input id="newCategories" placeholder="VD: Tủ bếp, tủ áo, kệ tivi"></div>
            <div class="field wide"><label>Ghi chú</label><textarea id="newNote"></textarea></div>
          </div>
          <button style="margin-top:12px;" onclick="createOrder()">Lưu đơn hàng</button>
        </div>
      </div>
    </div>
  `;
  toggleOrderCustomerMode();
  updateOrderCode();
}

function toggleOrderCustomerMode() {
  const mode = q("#orderCustomerMode")?.value || "new";
  const existing = q("#existingCustomerField");
  if (existing) existing.style.display = mode === "existing" ? "block" : "none";
  document.querySelectorAll(".new-customer-field").forEach(el => {
    el.style.display = mode === "new" ? "block" : "none";
  });
  updateOrderCode();
}

function updateOrderCode() {
  const input = q("#newCode");
  if (!input) return;
  const mode = q("#orderCustomerMode")?.value || "new";
  let name = "";
  let address = "";
  let phone = "";

  if (mode === "existing") {
    const customer = getCustomer(q("#newCustomer")?.value);
    name = customer?.name || "";
    address = customer?.address || "";
    phone = customer?.phone || "";
  } else {
    name = q("#orderCustomerName")?.value || "";
    address = q("#orderCustomerAddress")?.value || "";
    phone = q("#orderCustomerPhone")?.value || "";
  }

  input.value = createOrderCode(name, address, phone);
}

function createOrderCode(customerName, address, phone) {
  const name = cleanCodePart(customerName || "Khach");
  const area = cleanCodePart(extractAddressArea(address) || "Dia chi");
  const last3 = String(phone || "").replace(/\D/g, "").slice(-3) || "000";
  return `${name}-${area}-${last3}`;
}

function cleanCodePart(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("?'", "d")
    .replace(/D/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function extractAddressArea(address) {
  const parts = String(address || "")
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);
  if (!parts.length) return "";
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
}

function createOrder() {
  updateOrderCode();
  const code = q("#newCode").value.trim();
  if (!code) return appAlert("Nh?p m? ?'on h?ng.");
  const mode = q("#orderCustomerMode")?.value || "new";
  let customerId = q("#newCustomer")?.value || "";
  let customerNeedsApproval = false;

  if (mode === "new") {
    const name = q("#orderCustomerName").value.trim();
    if (!name) return appAlert("Nh?p t?n kh?ch h?ng.");
    customerId = "c" + Date.now();
    customerNeedsApproval = !hasActiveRole(state.currentUser, ["admin", "sales_manager"]);
    db.customers.push(customer(
      customerId,
      name,
      Number(q("#orderCustomerAge").value) || 0,
      q("#orderCustomerPhone").value,
      q("#orderCustomerAddress").value,
      q("#orderCustomerNeed").value,
      q("#orderCustomerWish").value,
      state.currentUser.id,
      customerNeedsApproval ? "pending" : "approved",
      customerNeedsApproval ? "" : state.currentUser.id
    ));
  }

  const salesManagerId = findManagerForStep("receive") || state.currentUser.id;
  const o = order(code, q("#newProject").value.trim(), customerId, state.currentUser.id, "receive", customerNeedsApproval ? "waiting" : "unassigned", "", salesManagerId, 0, q("#newDeadline").value, 0, 0);
  o.categories = q("#newCategories").value;
  o.note = customerNeedsApproval
    ? "Kh?ch h?ng m?>i ch? Qu?n l? sale duy??t. " + q("#newNote").value
    : q("#newNote").value;
  if (customerNeedsApproval) startOrderWaiting(o, "Ch? Qu?n l? sale duy??t kh?ch h?ng/?'on h?ng m?>i");
  db.orders.push(o);
  if (customerNeedsApproval) {
    db.tasks.push(task(
      "t" + Date.now(),
      o.id,
      "receive",
      "Ki?fm tra v? duy??t th?ng tin kh?ch h?ng / ?'on h?ng m?>i",
      salesManagerId,
      salesManagerId,
      "waiting",
      o.deadline,
      o.note
    ));
  }
  if (customerNeedsApproval) state.customerTab = "pending";
  saveDb();
  closeModal();
  render();
}

function openCustomerForm() {
  q("#modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-head"><h2>Tạo khách hàng</h2><button class="secondary" onclick="closeModal()">Đóng</button></div>
        <div class="modal-body">
          <p style="margin-top:0;color:var(--muted);line-height:1.5;">Khách hàng do Sale tạo sẽ vào mục “Khách hàng chờ phê duyệt”. Quản lý sale kiểm tra thông tin rồi duyệt trước khi tạo hoặc triển khai đơn hàng.</p>
          <div class="form-grid">
            <div class="field"><label>Tên khách</label><input id="cName"></div>
            <div class="field"><label>Tuổi</label><input id="cAge" type="number"></div>
            <div class="field"><label>Số điện thoại</label><input id="cPhone"></div>
            <div class="field"><label>Địa chỉ</label><input id="cAddress"></div>
            <div class="field wide"><label>Nhu cầu ban đầu</label><textarea id="cNeed"></textarea></div>
            <div class="field wide"><label>Tâm tư / mong muốn</label><textarea id="cWish"></textarea></div>
          </div>
          <button style="margin-top:12px;" onclick="createCustomer()">Lưu khách hàng</button>
        </div>
      </div>
    </div>
  `;
}

function createCustomer() {
  const status = hasActiveRole(state.currentUser, ["admin", "sales_manager"]) ? "approved" : "pending";
  db.customers.push(customer(
    "c" + Date.now(),
    q("#cName").value,
    Number(q("#cAge").value) || 0,
    q("#cPhone").value,
    q("#cAddress").value,
    q("#cNeed").value,
    q("#cWish").value,
    state.currentUser.id,
    status,
    status === "approved" ? state.currentUser.id : ""
  ));
  if (status === "pending") state.customerTab = "pending";
  log(status === "pending"
    ? `${state.currentUser.name} t?o kh?ch h?ng ${q("#cName").value} v? chuy?fn sang Qu?n l? sale ph? duy??t`
    : `${state.currentUser.name} t?o v? duy??t kh?ch h?ng ${q("#cName").value}`);
  saveDb();
  closeModal();
  render();
}

function approveCustomer(id) {
  const customer = getCustomer(id);
  customer.approvalStatus = "approved";
  customer.approvedBy = state.currentUser.id;
  customer.approvedAt = today();
  customer.approvalNote = "";
  db.orders
    .filter(o => o.customerId === id && o.currentStepId === "receive" && o.status === "waiting")
    .forEach(o => {
      closeOrderWaiting(o, state.currentUser.id);
      const time = nowText();
      o.currentStepId = "sale";
      o.status = "working";
      o.assigneeId = o.saleId;
      o.managerId = findManagerForStep("sale") || state.currentUser.id;
      o.stepStartedAt = today();
      o.lastInfoAt = today();
      o.note = `${restoreVietnameseText(fixFontText(o.note || ""))}\n[${time} - ${state.currentUser.name}] Quản lý sale đã duyệt khách hàng. Đơn tự chuyển cho Sale phụ trách và Sale không cần xác nhận nhận đơn.`.trim();
      ensureSaleChecklistTasks(o);
      db.tasks
        .filter(t => t.orderId === o.id && t.stepId === "sale" && t.assigneeId === o.saleId)
        .forEach(t => {
          t.status = "working";
          t.acceptedAt = time;
          t.acceptedAtMs = nowMs();
          t.managerId = o.managerId;
        });
    });
  db.tasks
    .filter(t => t.stepId === "receive" && db.orders.some(o => o.customerId === id && o.id === t.orderId))
    .forEach(t => {
      t.status = "approved";
      t.completedAt = nowText();
    });
  log(`${state.currentUser.name} duy??t kh?ch h?ng ${customer.name}`);
  saveDb();
  render();
}

async function rejectCustomer(id) {
  const note = await appPrompt("Nh?p l? do tr? l?i th?ng tin kh?ch h?ng:", "Thi?u th?ng tin c?n b?. sung.");
  if (!note) return;
  const customer = getCustomer(id);
  customer.approvalStatus = "rejected";
  customer.approvalNote = note;
  log(`${state.currentUser.name} tr? l?i kh?ch h?ng ${customer.name}: ${note}`);
  saveDb();
  render();
}

function openMyAccountForm() {
  const u = state.currentUser;
  q("#modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="closeModal(event)">
      <div class="modal small-modal" onclick="event.stopPropagation()">
        <div class="modal-head">
          <div><h2>T?i kho?n c?a t?i</h2><p>${u.name} ? ${roleNames(u)}</p></div>
          <button class="secondary" onclick="closeModal()">D?ng</button>
        </div>
        <div class="form-grid">
          <div class="field wide"><label>T?n ?'?fng nh?p</label><input id="myUsername" value="${u.username}"></div>
          <div class="field wide"><label>M?t kh?u hi??n t?i</label><input id="myCurrentPassword" type="password"></div>
          <div class="field wide"><label>M?t kh?u m?>i</label><input id="myNewPassword" type="password" placeholder="D?f tr?'ng n?u kh?ng ?'?.i m?t kh?u"></div>
          <div class="field wide"><label>Nh?p l?i m?t kh?u m?>i</label><input id="myConfirmPassword" type="password"></div>
        </div>
        <div class="form-actions">
          <button class="secondary" onclick="closeModal()">Hu?</button>
          <button class="success" onclick="saveMyAccount()">Luu thay ?'?.i</button>
        </div>
      </div>
    </div>
  `;
}

async function saveMyAccount() {
  const u = state.currentUser;
  const username = q("#myUsername").value.trim();
  const currentPassword = q("#myCurrentPassword").value;
  const newPassword = q("#myNewPassword").value;
  const confirmPassword = q("#myConfirmPassword").value;
  if (!username) return appAlert("T?n ?'?fng nh?p kh?ng ?'u?c ?'?f tr?'ng.");
  if (currentPassword !== u.password) return appAlert("M?t kh?u hi??n t?i kh?ng ?'?ng.");
  if (db.users.some(x => x.id !== u.id && x.username.toLowerCase() === username.toLowerCase())) {
    return appAlert("T?n ?'?fng nh?p n?y ?'? ?'u?c s? d?ng.");
  }
  if (newPassword || confirmPassword) {
    if (newPassword.length < 4) return appAlert("M?t kh?u m?>i c?n t?'i thi?fu 4 k? t?.");
    if (newPassword !== confirmPassword) return appAlert("Nh?p l?i m?t kh?u m?>i chua kh?>p.");
    u.password = newPassword;
  }
  u.username = username;
  log(`${u.name} ?'?.i th?ng tin ?'?fng nh?p c? nh?n`);
  saveDb();
  closeModal();
  render();
}

function openEmployeeForm(userId = "") {
  const editing = userId ? getUser(userId) : null;
  if (editing && !canOperateEmployee(editing)) {
    appAlert("Bạn không có quyền sửa tài khoản này.");
    return;
  }
  const selectedRoles = editing ? userRoles(editing) : [];
  const mainRole = editing ? activeRole(editing) : "admin";
  q("#modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-head"><h2>${editing ? "Sửa tài khoản nhân sự" : "Thêm tài khoản nhân sự"}</h2><button class="secondary" onclick="closeModal()">Đóng</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field"><label>Họ tên</label><input id="uName" value="${editing?.name || ""}"></div>
            <div class="field"><label>Tài khoản</label><input id="uUsername" value="${editing?.username || ""}"></div>
            <div class="field"><label>Mật khẩu</label><input id="uPassword" value="${editing?.password || "123456"}"></div>
            <div class="field"><label>Vai trò chính</label><select id="uRole">${Object.entries(ROLES).map(([id, name]) => `<option value="${id}" ${mainRole === id ? "selected" : ""}>${name}</option>`).join("")}</select></div>
            <div class="field"><label>Phòng ban</label><select id="uDept">${Object.entries(DEPARTMENTS).map(([id, name]) => `<option value="${id}" ${editing?.department === id ? "selected" : ""}>${name}</option>`).join("")}</select></div>
            <div class="field"><label>Lương ngày</label><input id="uSalary" type="number" value="${editing?.daySalary || editing?.salary || ""}"></div>
            <div class="field"><label>Lương tháng</label><input id="uMonthSalary" type="number" value="${editing?.monthSalary || ""}"></div>
            <div class="field"><label>Cách tính lương</label><select id="uSalaryMode"><option value="day" ${(editing?.salaryMode || "day") === "day" ? "selected" : ""}>Theo ngày công</option></select></div>
            <div class="field wide">
              <label>Cấp thêm quyền vị trí (tài khoản sẽ có ô chọn vị trí khi đăng nhập)</label>
              <div class="checkbox-grid">
                ${Object.entries(ROLES).map(([id, name]) => `
                  <label><input type="checkbox" name="uExtraRoles" value="${id}" ${selectedRoles.includes(id) && id !== mainRole ? "checked" : ""}> ${name}</label>
                `).join("")}
              </div>
            </div>
          </div>
          <button style="margin-top:12px;" onclick="${editing ? `updateEmployee('${userId}')` : "createEmployee()"}">Lưu tài khoản</button>
        </div>
      </div>
    </div>
  `;
}

function createEmployee() {
  const role = q("#uRole").value;
  const roles = [role, ...Array.from(document.querySelectorAll('input[name="uExtraRoles"]:checked')).map(input => input.value)];
  const username = q("#uUsername").value.trim();
  if (!username) return appAlert("Tên đăng nhập không được để trống.");
  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) return appAlert("Tên đăng nhập này đã được sử dụng.");
  if (hasActiveRole(state.currentUser, "hr") && !hasActiveRole(state.currentUser, "admin") && roles.includes("admin")) {
    appAlert("Nhân sự không có quyền tạo tài khoản Quản trị/Giám đốc.");
    return;
  }
  const newUser = user("u" + Date.now(), username, q("#uPassword").value, q("#uName").value, role, q("#uDept").value, ROLES[role], Number(q("#uSalary").value) || 0);
  newUser.roles = [...new Set(roles)];
  newUser.salaryMode = q("#uSalaryMode").value;
  newUser.daySalary = Number(q("#uSalary").value) || 0;
  newUser.monthSalary = Number(q("#uMonthSalary").value) || 0;
  newUser.createdBy = state.currentUser.id;
  if (hasActiveRole(state.currentUser, "hr") && !hasActiveRole(state.currentUser, "admin")) {
    newUser.approvalStatus = "pending";
    newUser.locked = true;
  } else {
    newUser.approvalStatus = "approved";
    newUser.approvedBy = state.currentUser.id;
    newUser.approvedAt = today();
  }
  db.users.push(newUser);
  log(`${state.currentUser.name} tạo tài khoản ${newUser.name}${newUser.approvalStatus === "pending" ? " chờ Quản trị xác nhận" : ""}`);
  saveDb();
  closeModal();
  render();
}

function updateEmployee(id) {
  const u = getUser(id);
  if (!u) return;
  if (!canOperateEmployee(u)) {
    appAlert("Bạn không có quyền sửa tài khoản này.");
    return;
  }
  const role = q("#uRole").value;
  const roles = [role, ...Array.from(document.querySelectorAll('input[name="uExtraRoles"]:checked')).map(input => input.value)];
  const username = q("#uUsername").value.trim();
  if (!username) return appAlert("Tên đăng nhập không được để trống.");
  if (db.users.some(x => x.id !== id && x.username.toLowerCase() === username.toLowerCase())) return appAlert("Tên đăng nhập này đã được sử dụng.");
  if (hasActiveRole(state.currentUser, "hr") && !hasActiveRole(state.currentUser, "admin") && roles.includes("admin")) {
    appAlert("Nhân sự không có quyền cấp quyền Quản trị/Giám đốc.");
    return;
  }
  u.name = q("#uName").value;
  u.username = username;
  u.password = q("#uPassword").value;
  u.role = role;
  u.roles = [...new Set(roles)];
  u.department = q("#uDept").value;
  u.title = ROLES[role];
  u.salary = Number(q("#uSalary").value) || 0;
  u.salaryMode = q("#uSalaryMode").value;
  u.daySalary = Number(q("#uSalary").value) || 0;
  u.monthSalary = Number(q("#uMonthSalary").value) || 0;
  if (!u.roles.includes(activeRole(u))) {
    localStorage.setItem("gomita_active_role_" + u.id, role);
  }
  log(`${state.currentUser.name} sửa tài khoản ${u.name}`);
  saveDb();
  closeModal();
  render();
}

function approveEmployee(id) {
  if (!hasActiveRole(state.currentUser, "admin")) {
    appAlert("Chỉ Quản trị có quyền xác nhận tài khoản mới.");
    return;
  }
  const u = getUser(id);
  if (!u) return;
  u.approvalStatus = "approved";
  u.approvedBy = state.currentUser.id;
  u.approvedAt = today();
  u.locked = false;
  log(`${state.currentUser.name} duyệt tài khoản ${u.name}`);
  saveDb();
  render();
}

function toggleUserLock(id) {
  const u = getUser(id);
  if (u.id === state.currentUser.id) return appAlert("Không thể khóa chính tài khoản đang đăng nhập.");
  if (!canOperateEmployee(u)) {
    appAlert("Bạn không có quyền khóa/mở khóa tài khoản này.");
    return;
  }
  u.locked = !u.locked;
  log(`${state.currentUser.name} ${u.locked ? "khóa" : "mở khóa"} tài khoản ${u.name}`);
  saveDb();
  render();
}

async function deleteUser(id) {
  const u = getUser(id);
  if (!u) return;
  if (u.id === state.currentUser.id) {
    appAlert("Không thể xóa chính tài khoản đang đăng nhập.");
    return;
  }
  if (!canOperateEmployee(u)) {
    appAlert("Bạn không có quyền xóa tài khoản này.");
    return;
  }

  const used =
    db.orders.some(o => o.saleId === id || o.assigneeId === id || o.managerId === id) ||
    db.tasks.some(t => t.assigneeId === id || t.managerId === id) ||
    db.attendance.some(a => a.userId === id) ||
    db.photos.some(p => p.uploadedBy === id) ||
    db.files.some(f => f.uploadedBy === id);

  const message = used
    ? `T?i kho?n "${u.name}" ?'ang c? d? li??u li?n quan. B?n c? ch?c ch?n mu?'n x?a t?i kho?n n?y kh?ng?`
    : `B?n c? ch?c ch?n mu?'n x?a t?i kho?n "${u.name}" kh?ng?`;

  if (!await appConfirm(message)) return;

  db.users = db.users.filter(user => user.id !== id);
  log(`${state.currentUser.name} x?a t?i kho?n ${u.name}`);
  saveDb();
  render();
}

function log(message) {
  db.auditLogs.push({ id: "log" + Date.now(), userId: state.currentUser?.id, message, time: nowText() });
}

render();
