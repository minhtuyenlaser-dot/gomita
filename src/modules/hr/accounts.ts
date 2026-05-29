export type AccountStatus = "active" | "locked" | "pending_admin";

export type UserAccount = {
  id: string;
  displayName: string;
  username: string;
  password: string;
  department: string;
  positionIds: string[];
  status: AccountStatus;
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
  },
  {
    id: "u-hr",
    displayName: "Nguyễn Văn Nhân Sự",
    username: "nhansu",
    password: "123456",
    department: "Nhân sự",
    positionIds: ["hr"],
    status: "active"
  },
  {
    id: "u-accountant",
    displayName: "Trần Thị Kế Toán",
    username: "ketoan",
    password: "123456",
    department: "Kế toán",
    positionIds: ["accountant"],
    status: "active"
  },
  {
    id: "u-sale-manager",
    displayName: "Phạm Văn Quản Lý Sale",
    username: "qlsale",
    password: "123456",
    department: "Phòng Sale",
    positionIds: ["sale_manager", "sale"],
    status: "active"
  },
  {
    id: "u-sale",
    displayName: "Nguyễn Thị Sale",
    username: "sale",
    password: "123456",
    department: "Phòng Sale",
    positionIds: ["sale"],
    status: "active"
  },
  {
    id: "u-design-manager",
    displayName: "Lê Văn Quản Lý Thiết Kế",
    username: "qlthietke",
    password: "123456",
    department: "Phòng Thiết kế",
    positionIds: ["design_manager"],
    status: "active"
  },
  {
    id: "u-designer",
    displayName: "Hoàng Văn Thiết Kế",
    username: "thietke",
    password: "123456",
    department: "Phòng Thiết kế",
    positionIds: ["designer"],
    status: "active"
  },
  {
    id: "u-workshop-manager",
    displayName: "Nguyễn Văn Quản Đốc",
    username: "quandoc",
    password: "123456",
    department: "Xưởng",
    positionIds: ["workshop_manager"],
    status: "active"
  },
  {
    id: "u-file",
    displayName: "Phạm Văn Ra File",
    username: "rafile",
    password: "123456",
    department: "Xưởng",
    positionIds: ["file_operator"],
    status: "active"
  },
  {
    id: "u-production-worker",
    displayName: "Trần Văn Sản Xuất",
    username: "thosanxuat",
    password: "123456",
    department: "Xưởng",
    positionIds: ["production_worker"],
    status: "active"
  },
  {
    id: "u-supervisor",
    displayName: "Phạm Văn Giám Sát",
    username: "giamsat",
    password: "123456",
    department: "Giám sát",
    positionIds: ["supervisor_lead"],
    status: "active"
  },
  {
    id: "u-installer",
    displayName: "Lê Văn Lắp Đặt",
    username: "tholapdat",
    password: "123456",
    department: "Giám sát",
    positionIds: ["installer"],
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
