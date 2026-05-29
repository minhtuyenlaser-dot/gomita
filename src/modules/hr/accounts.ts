export type AccountStatus = "active" | "locked" | "pending_admin";

export type UserAccount = {
  id: string;
  displayName: string;
  username: string;
  password: string;
  department: string;
  positionIds: string[];
  status: AccountStatus;
  salaryType?: "daily" | "monthly";
  salaryValue?: number;
};

export const demoAccounts: UserAccount[] = [
  {
    id: "u-director",
    displayName: "Giám đốc GOMITA",
    username: "giamdoc",
    password: "123456",
    department: "Giám đốc",
    positionIds: ["director"],
    status: "active"
  }
];

export function authenticate(accounts: UserAccount[], username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedPassword = password.trim().toLowerCase();
  return accounts.find((account) => account.username.toLowerCase() === normalizedUsername && account.password.toLowerCase() === normalizedPassword && account.status === "active") ?? null;
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
