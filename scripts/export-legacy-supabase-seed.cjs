const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const sourceFile = path.join(rootDir, "src", "gomita_db.json");
const outputFile = path.join(rootDir, "supabase", "legacy-seed.json");

const positionCatalog = [
  { id: "admin", title: "Quản trị hệ thống", department: "Quản trị", level: "admin" },
  { id: "director", title: "Giám đốc", department: "Giám đốc", level: "director" },
  { id: "sale_manager", title: "Quản lý Sale", department: "Phòng Sale", level: "department_head" },
  { id: "sale", title: "Nhân viên Sale", department: "Phòng Sale", level: "staff" },
  { id: "design_manager", title: "Trưởng phòng thiết kế", department: "Phòng Thiết kế", level: "department_head" },
  { id: "designer", title: "Thiết kế", department: "Phòng Thiết kế", level: "staff" },
  { id: "workshop_manager", title: "Quản lý xưởng", department: "Xưởng", level: "department_head" },
  { id: "file_operator", title: "Ra file", department: "Xưởng", level: "staff" },
  { id: "production_worker", title: "Thợ sản xuất", department: "Xưởng", level: "staff" },
  { id: "supervisor_lead", title: "Trưởng giám sát", department: "Giám sát", level: "team_lead" },
  { id: "installer", title: "Thợ lắp đặt", department: "Giám sát", level: "staff" },
  { id: "accountant", title: "Kế toán", department: "Kế toán", level: "staff" },
  { id: "hr", title: "Nhân sự", department: "Nhân sự", level: "department_head" }
];

const orderStepMap = {
  "Tiếp nhận": "accepted",
  "Thiết kế": "design",
  "Báo giá": "quote",
  "Ra file": "file_prepare",
  "Sản xuất": "production",
  "Lắp đặt": "installation",
  "Nghiệm thu": "acceptance",
  "Hoàn công": "completion"
};

const cashTransactionKindMap = {
  cash_in: "receipt",
  bank_in: "receipt",
  cash_out: "payment",
  bank_out: "payment",
  transfer: "transfer"
};

const paymentStageMap = {
  deposit: "deposit",
  stage2: "phase_2",
  before_production: "before_production",
  before_installation: "before_installation",
  handover: "acceptance",
  completed: "completion"
};

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeId(prefix, value) {
  const slug = slugify(value || prefix) || "item";
  return `${prefix}-${slug}`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function pickProfileIdByName(snapshot, displayName) {
  if (!displayName) return null;
  const normalized = String(displayName).trim().toLowerCase();
  const account = (snapshot.accounts || []).find((item) => item.displayName.trim().toLowerCase() === normalized);
  return account ? account.id : null;
}

function splitNames(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function mapDocumentRows(account) {
  const rows = [];
  const baseCode = account.employeeCode || account.id;
  if (account.idCardFrontImage) {
    rows.push({
      id: makeId("doc", `${baseCode}-id-front`),
      profile_id: account.id,
      document_type: "id_front",
      file_path: `legacy/${baseCode}/id-front.txt`,
      file_name: "id-front.txt"
    });
  }
  if (account.idCardBackImage) {
    rows.push({
      id: makeId("doc", `${baseCode}-id-back`),
      profile_id: account.id,
      document_type: "id_back",
      file_path: `legacy/${baseCode}/id-back.txt`,
      file_name: "id-back.txt"
    });
  }
  if (account.laborContractImage) {
    rows.push({
      id: makeId("doc", `${baseCode}-labor-contract`),
      profile_id: account.id,
      document_type: "labor_contract",
      file_path: `legacy/${baseCode}/labor-contract.txt`,
      file_name: "labor-contract.txt"
    });
  }
  return rows;
}

function buildOrderAssignments(snapshot, order) {
  const rows = [];
  const stepAssignments = [
    { step: "accepted", names: splitNames(order.saleName) },
    { step: "design", names: splitNames(order.designerNames?.length ? order.designerNames : order.designerName) },
    { step: "quote", names: splitNames(order.saleName) },
    { step: "file_prepare", names: splitNames(order.fileOperatorNames?.length ? order.fileOperatorNames : order.fileOperatorName) },
    { step: "production", names: splitNames(order.productionWorkerNames?.length ? order.productionWorkerNames : order.productionWorkerName) },
    { step: "installation", names: splitNames(order.installerNames?.length ? order.installerNames : order.installerName) },
    { step: "acceptance", names: splitNames(order.supervisorNames?.length ? order.supervisorNames : order.supervisorName) },
    { step: "completion", names: splitNames(order.saleName) }
  ];

  stepAssignments.forEach(({ step, names }) => {
    names.forEach((name, index) => {
      const profileId = pickProfileIdByName(snapshot, name);
      rows.push({
        id: makeId("assign", `${order.id}-${step}-${index + 1}`),
        order_id: order.id,
        profile_id: profileId,
        legacy_employee_name: name,
        step,
        assigned_note: order.assignedTaskNote || null,
        started_at: null,
        finished_at: null
      });
    });
  });

  return rows;
}

function buildBudgetRow(order) {
  const accessoriesCost = (order.externalAccessories || []).reduce((sum, item) => sum + Number(item.actualCost || item.costPrice || 0), 0);
  const materialCost = (order.materialsList || []).reduce((sum, item) => sum + Number(item.price || 0), 0);
  const installationCost = Number(order.installationCosts?.transport || 0) + Number(order.installationCosts?.loader || 0);
  return {
    order_id: order.id,
    quoted_revenue: Number(order.quotation?.quoteValue || 0),
    budget_material_cost: Number(order.quotation?.estimateValue || 0),
    budget_labor_cost: 0,
    budget_other_cost: 0,
    actual_revenue: Number(order.quotation?.quoteValue || 0),
    actual_material_cost: materialCost,
    actual_labor_cost: installationCost,
    actual_other_cost: accessoriesCost
  };
}

function exportSeed(snapshot) {
  const departments = Array.from(
    new Set([
      ...positionCatalog.map((item) => item.department),
      ...(snapshot.accounts || []).map((item) => item.department).filter(Boolean)
    ])
  ).map((name) => ({
    id: makeId("dep", name),
    name
  }));

  const positions = positionCatalog.map((item) => ({
    id: item.id,
    department_id: makeId("dep", item.department),
    title: item.title,
    level: item.level
  }));

  const profiles = (snapshot.accounts || []).map((account) => ({
    id: account.id,
    full_name: account.displayName,
    phone: null,
    employee_code: account.employeeCode || null,
    active: account.status === "active",
    legacy_username: account.username,
    legacy_password: account.password,
    legacy_department: account.department,
    salary_type: account.salaryType || null,
    salary_value: account.salaryValue || 0,
    id_card_number: account.idCardNumber || null,
    labor_contract_note: account.laborContractNote || null
  }));

  const profilePositions = (snapshot.accounts || []).flatMap((account) =>
    (account.positionIds || []).map((positionId) => ({
      profile_id: account.id,
      position_id: positionId
    }))
  );

  const employeeDocuments = (snapshot.accounts || []).flatMap((account) => mapDocumentRows(account));

  const orders = (snapshot.orders || []).map((order) => ({
    id: order.id,
    code: order.code,
    customer_name: order.customerName,
    customer_phone: order.phone,
    customer_area: order.area,
    address: order.address,
    step: orderStepMap[order.step] || "accepted",
    assigned_sale_id: pickProfileIdByName(snapshot, order.saleName),
    progress_percent: Number(order.progressPercent || 0),
    deadline_at: order.deadline && order.deadline !== "Chưa đặt" ? `${order.deadline}T00:00:00+07:00` : null,
    created_by: pickProfileIdByName(snapshot, order.saleName),
    legacy_status: order.status,
    legacy_priority: order.priority,
    legacy_work_status: order.workStatus,
    customer_request: order.customerRequest || "",
    final_note: order.finalNote || ""
  }));

  const orderAssignments = (snapshot.orders || []).flatMap((order) => buildOrderAssignments(snapshot, order));
  const orderBudgets = (snapshot.orders || []).map((order) => buildBudgetRow(order));

  const leaveRequests = (snapshot.leaveRequests || []).map((item) => ({
    id: item.id,
    profile_id: item.employeeId,
    leave_type: item.type,
    from_date: item.fromDate,
    to_date: item.toDate,
    days: Number(item.days || 0),
    reason: item.reason,
    status: item.status,
    reviewed_by: pickProfileIdByName(snapshot, item.reviewedBy),
    reviewed_at: item.reviewedAt || null,
    created_at: item.createdAt
  }));

  const cashAccountNames = new Set(["Quỹ tiền mặt"]);
  (snapshot.cashTransactions || []).forEach((item) => {
    if (item.accountName) cashAccountNames.add(item.accountName);
  });

  const cashAccounts = Array.from(cashAccountNames).map((name) => ({
    id: makeId("cash", name),
    name,
    account_type: /ngân hàng|bank/i.test(name) ? "bank" : "cash",
    bank_name: /ngân hàng|bank/i.test(name) ? name : null,
    account_number: null,
    opening_balance: 0,
    active: true
  }));

  const cashTransactions = (snapshot.cashTransactions || []).map((item) => ({
    id: item.id,
    account_id: makeId("cash", item.accountName || "Quỹ tiền mặt"),
    transfer_account_id: null,
    order_id: null,
    kind: cashTransactionKindMap[item.type] || "payment",
    amount: Number(item.amount || 0),
    transaction_date: item.createdAt,
    category: item.type,
    note: item.note || "",
    created_by: pickProfileIdByName(snapshot, item.createdBy)
  }));

  const orderPaymentSchedules = (snapshot.customerDebts || []).map((item) => ({
    id: item.id,
    order_id: item.orderId,
    stage: paymentStageMap[item.stage] || "completion",
    due_date: item.dueDate || null,
    amount: Number(item.plannedAmount || 0),
    note: item.note || null
  }));

  const customerPayments = (snapshot.customerDebts || [])
    .filter((item) => Number(item.collectedAmount || 0) > 0)
    .map((item) => ({
      id: `${item.id}-paid`,
      order_id: item.orderId,
      schedule_id: item.id,
      amount: Number(item.collectedAmount || 0),
      paid_at: item.dueDate ? `${item.dueDate}T00:00:00+07:00` : new Date().toISOString(),
      payment_method: "legacy_import",
      received_by: null,
      note: item.note || null
    }));

  const unresolvedAttendance = Object.entries(snapshot.attendance || {}).map(([key, status]) => ({
    key,
    status,
    detail: snapshot.attendanceDetails?.[key] || null,
    reason: "Khóa attendance cũ chỉ có userId-day-slot, chưa đủ work_date đầy đủ để import thẳng."
  }));

  const warnings = [];
  if (unresolvedAttendance.length > 0) {
    warnings.push("Attendance cũ chưa đủ ngày đầy đủ (chỉ có day token), cần quy đổi trước khi import vào attendance_records.");
  }
  if ((snapshot.compensationRequests || []).length > 0) {
    warnings.push("Compensation requests cũ chưa được map sang bảng approval mới trong script đầu tiên này.");
  }

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      sourceFile,
      warnings,
      counts: {
        accounts: (snapshot.accounts || []).length,
        orders: (snapshot.orders || []).length,
        leaveRequests: leaveRequests.length,
        cashTransactions: cashTransactions.length,
        customerDebts: orderPaymentSchedules.length,
        unresolvedAttendance: unresolvedAttendance.length
      }
    },
    departments,
    positions,
    profiles,
    profile_positions: profilePositions,
    employee_documents: employeeDocuments,
    orders,
    order_assignments: orderAssignments,
    order_budgets: orderBudgets,
    leave_requests: leaveRequests,
    cash_accounts: cashAccounts,
    cash_transactions: cashTransactions,
    order_payment_schedules: orderPaymentSchedules,
    customer_payments: customerPayments,
    unresolved_attendance: unresolvedAttendance
  };
}

function main() {
  const snapshot = readJson(sourceFile);
  const payload = exportSeed(snapshot);
  writeJson(outputFile, payload);
  console.log(`Da xuat seed Supabase tai: ${outputFile}`);
  console.log(`Warnings: ${payload.metadata.warnings.length}`);
}

main();
