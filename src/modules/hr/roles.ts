export type PositionLevel = "staff" | "team_lead" | "department_head" | "director" | "admin";

export type Department =
  | "Quản trị"
  | "Giám đốc"
  | "Phòng Sale"
  | "Phòng Thiết kế"
  | "Xưởng"
  | "Giám sát"
  | "Kế toán"
  | "Nhân sự";

export type Position = {
  id: string;
  name: string;
  department: Department;
  level: PositionLevel;
};

export const positions: Position[] = [
  { id: "admin", name: "Quản trị hệ thống", department: "Quản trị", level: "admin" },
  { id: "director", name: "Giám đốc", department: "Giám đốc", level: "director" },
  { id: "sale_manager", name: "Quản lý Sale", department: "Phòng Sale", level: "department_head" },
  { id: "sale", name: "Nhân viên Sale", department: "Phòng Sale", level: "staff" },
  { id: "design_manager", name: "Trưởng phòng thiết kế", department: "Phòng Thiết kế", level: "department_head" },
  { id: "designer", name: "Thiết kế", department: "Phòng Thiết kế", level: "staff" },
  { id: "workshop_manager", name: "Quản lý xưởng", department: "Xưởng", level: "department_head" },
  { id: "file_operator", name: "Ra file", department: "Xưởng", level: "staff" },
  { id: "production_worker", name: "Thợ sản xuất", department: "Xưởng", level: "staff" },
  { id: "supervisor_lead", name: "Trưởng giám sát", department: "Giám sát", level: "team_lead" },
  { id: "installer", name: "Thợ lắp đặt", department: "Giám sát", level: "staff" },
  { id: "accountant", name: "Kế toán", department: "Kế toán", level: "staff" },
  { id: "hr", name: "Nhân sự", department: "Nhân sự", level: "department_head" }
];

export type MenuItem = {
  id: string;
  label: string;
  icon: string;
  badge?: number;
};

const orderMenu: MenuItem = { id: "orders", label: "Đơn hàng", icon: "orders" };
const profileMenu: MenuItem = { id: "profile", label: "Thông tin cá nhân", icon: "profile" };

export function getMenuForPosition(positionId: string): MenuItem[] {
  const position = positions.find((p) => p.id === positionId);
  const isManager = position ? (position.level === "department_head" || position.level === "team_lead") : false;

  if (positionId === "director") {
    return [
      orderMenu,
      { id: "hr", label: "Nhân sự", icon: "hr" },
      { id: "attendance", label: "Duyệt công bù", icon: "reports" },
      { id: "finance", label: "Kế toán", icon: "finance" },
      { id: "reports", label: "Bảng lương công ty", icon: "reports" },
      { id: "admin", label: "Sao lưu & Phục hồi", icon: "admin" },
      { id: "feedback", label: "Góp ý PM", icon: "feedback" },
      profileMenu
    ];
  }

  if (positionId === "hr") {
    return [
      { id: "hr", label: "Nhân sự", icon: "hr" },
      { id: "attendance", label: "Duyệt công bù", icon: "reports" },
      { id: "reports", label: "Bảng lương công ty", icon: "reports" },
      profileMenu
    ];
  }

  if (positionId === "accountant") {
    return [
      orderMenu,
      { id: "finance", label: "Kế toán", icon: "finance" },
      profileMenu
    ];
  }

  if (positionId === "admin") {
    return [
      orderMenu,
      { id: "admin", label: "Backup/Restore", icon: "admin" },
      profileMenu
    ];
  }

  if (isManager) {
    return [
      orderMenu,
      { id: "attendance", label: "Duyệt công bù", icon: "reports" },
      profileMenu
    ];
  }

  return [orderMenu, profileMenu];
}

export function isWorkerPosition(positionId: string) {
  return positionId === "installer" || positionId === "production_worker";
}

export function mustClockIn(positionId: string) {
  return positionId !== "director";
}

export function canSeePricing(positionId: string, currentUserName: string, saleName: string) {
  return ["director", "accountant", "sale_manager"].includes(positionId) || (positionId === "sale" && currentUserName === saleName);
}

export function isCompanyWideOrderRole(positionId: string) {
  return ["admin", "director", "sale_manager", "design_manager", "workshop_manager", "accountant"].includes(positionId);
}
