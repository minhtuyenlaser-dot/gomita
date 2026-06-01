export type AccountStatus = "active" | "locked" | "pending_admin";

export type UserAccount = {
  id: string;
  employeeCode?: string;
  displayName: string;
  username: string;
  password: string;
  department: string;
  positionIds: string[];
  status: AccountStatus;
  salaryType?: "daily" | "monthly";
  salaryValue?: number;
  idCardNumber?: string;
  idCardFrontImage?: string;
  idCardBackImage?: string;
  laborContractImage?: string;
  laborContractNote?: string;
};

export const demoAccounts: UserAccount[] = [
  {
    id: "u-director",
    employeeCode: "NV-0001",
    displayName: "Giám đốc GOMITA",
    username: "giamdoc",
    password: "123456",
    department: "Giám đốc",
    positionIds: ["director"],
    status: "active",
    idCardNumber: "001086000001",
    laborContractNote: "Hợp đồng điều hành công ty"
  }
];

function getEmployeeCodePrefix(department: string, positionIds: string[]) {
  const normalizedDepartment = department.trim().toLowerCase();
  const normalizedPositions = positionIds.map((item) => item.trim().toLowerCase());

  if (normalizedPositions.includes("accountant") || normalizedDepartment.includes("kế toán")) return "A";
  if (normalizedPositions.includes("sale") || normalizedPositions.includes("sale_manager") || normalizedDepartment.includes("sale")) return "S";
  if (
    normalizedPositions.includes("production_worker") ||
    normalizedPositions.includes("installer") ||
    normalizedPositions.includes("workshop_manager") ||
    normalizedPositions.includes("site_supervisor") ||
    normalizedPositions.includes("supervisor_lead") ||
    normalizedDepartment.includes("xưởng") ||
    normalizedDepartment.includes("giám sát")
  ) return "T";
  if (normalizedPositions.includes("hr") || normalizedDepartment.includes("nhân sự")) return "H";
  if (normalizedPositions.includes("designer") || normalizedDepartment.includes("thiết kế")) return "D";
  if (normalizedPositions.includes("director") || normalizedDepartment.includes("giám đốc")) return "GD";
  return "N";
}

export function suggestEmployeeCode(accounts: UserAccount[], department: string, positionIds: string[]) {
  const prefix = getEmployeeCodePrefix(department, positionIds);
  const usedNumbers = accounts
    .map((account) => (account.employeeCode || "").trim().toUpperCase())
    .filter((code) => code.startsWith(`GOMITA-${prefix}`))
    .map((code) => Number(code.replace(`GOMITA-${prefix}`, "")))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  let nextNumber = 1;
  for (const value of usedNumbers) {
    if (value === nextNumber) nextNumber += 1;
    if (value > nextNumber) break;
  }
  return `GOMITA-${prefix}${nextNumber}`;
}

export function getLoginAccounts(accounts: UserAccount[]) {
  if (accounts.length === 0) return demoAccounts;
  const hasDirector = accounts.some((account) => account.username.trim().toLowerCase() === "giamdoc");
  return hasDirector ? accounts : [...accounts, ...demoAccounts];
}

export function authenticate(accounts: UserAccount[], username: string, password: string) {
  const loginAccounts = getLoginAccounts(accounts);
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedPassword = password.trim().toLowerCase();
  return loginAccounts.find((account) => account.username.toLowerCase() === normalizedUsername && account.password.toLowerCase() === normalizedPassword && account.status === "active") ?? null;
}

export function validateAccount(input: Pick<UserAccount, "displayName" | "username" | "password" | "positionIds">) {
  const issues: string[] = [];
  if (!input.displayName.trim()) issues.push("Tên hiển thị là bắt buộc.");
  if (!input.username.trim()) issues.push("Tên đăng nhập là bắt buộc.");
  if (!input.password.trim()) issues.push("Mật khẩu là bắt buộc.");
  if (input.positionIds.length === 0) issues.push("Tài khoản phải có ít nhất một chức vụ.");
  return issues;
}

export function hasDuplicateUsername(accounts: UserAccount[], username: string, editingId?: string | null) {
  const normalizedUsername = username.trim().toLowerCase();
  return accounts.some((account) => account.id !== editingId && account.username.trim().toLowerCase() === normalizedUsername);
}
