"use client";

import {
  BriefcaseBusiness,
  CalendarCheck,
  ChevronDown,
  Clock,
  FileImage,
  Folder,
  LineChart,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
  X
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { demoAccounts, type UserAccount } from "@/modules/hr/accounts";
import { AccountManagement } from "@/modules/hr/components/AccountManagement";
import { LoginScreen } from "@/modules/hr/components/LoginScreen";
import { CompanyPayrollDashboard, ProfileDashboard } from "@/modules/hr/components/ProfileDashboard";
import { BackupRestoreDashboard } from "@/modules/hr/components/BackupRestoreDashboard";
import type { LeaveRequest } from "@/modules/hr/leave";
import { getMenuForPosition, mustClockIn, positions } from "@/modules/hr/roles";
import { FinanceDashboard } from "@/modules/finance/components/FinanceDashboard";
import type { CashTransaction, CustomerDebt } from "@/modules/finance/types";
import { getApiUrl } from "@/lib/api";
import { OrderDashboard } from "@/modules/orders/components/OrderDashboard";
import { demoOrders, type Order, getAssignedNames } from "@/modules/orders/orderFlow";
import { AttendanceDashboard } from "@/modules/attendance/components/AttendanceDashboard";
import { isSlotOpen } from "@/modules/attendance/compensationRules";

const iconMap = {
  orders: BriefcaseBusiness,
  profile: UserCircle,
  finance: ReceiptText,
  hr: Users,
  reports: LineChart,
  files: FileImage,
  settings: Settings,
  production: Folder,
  archive: Folder,
  admin: ShieldCheck
};

function isValidStoredAccount(value: unknown): value is UserAccount {
  if (!value || typeof value !== "object") return false;
  const account = value as Partial<UserAccount>;
  return typeof account.id === "string" && Array.isArray(account.positionIds) && typeof account.displayName === "string";
}

function readStoredJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Bỏ qua dữ liệu localStorage lỗi ở ${key}.`, error);
    localStorage.removeItem(key);
    return null;
  }
}

export default function HomePage() {
  const [accounts, setAccounts] = useState<UserAccount[]>(demoAccounts);
  const [currentAccount, setCurrentAccount] = useState<UserAccount | null>(null);
  const [positionId, setPositionId] = useState("");
  const [activeModule, setActiveModule] = useState("orders");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [overtimeOpen, setOvertimeOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [backendError, setBackendError] = useState("");
  const [currentSystemTime, setCurrentSystemTime] = useState(() => new Date());

  // Khôi phục phiên đăng nhập từ localStorage khi F5
  useEffect(() => {
    const session = readStoredJson<{ account?: UserAccount; positionId?: string; activeModule?: string }>("gomita_web_session_v3");
    if (!session) return;
    if (!isValidStoredAccount(session.account)) {
      console.warn("Phiên đăng nhập cũ không còn hợp lệ, đã tự xóa.");
      localStorage.removeItem("gomita_web_session_v3");
      return;
    }
    setCurrentAccount(session.account);
    setPositionId(typeof session.positionId === "string" ? session.positionId : "");
    setActiveModule(typeof session.activeModule === "string" && session.activeModule.length > 0 ? session.activeModule : "orders");
  }, []);

  // Tự động ghi nhớ phiên làm việc vào localStorage khi thay đổi
  useEffect(() => {
    if (currentAccount) {
      localStorage.setItem(
        "gomita_web_session_v3",
        JSON.stringify({ 
          account: currentAccount, 
          positionId, 
          activeModule 
        })
      );
    } else {
      localStorage.removeItem("gomita_web_session_v3");
    }
  }, [currentAccount, positionId, activeModule]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSystemTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const [orders, setOrders] = useState<Order[]>(demoOrders);
  const [overtimeRequests, setOvertimeRequests] = useState<any[]>([]);
  const [compensationRequests, setCompensationRequests] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [customerDebts, setCustomerDebts] = useState<CustomerDebt[]>([]);
  const [holidayDates, setHolidayDates] = useState<string[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [attendanceDetails, setAttendanceDetails] = useState<Record<string, { photo: string; gps: string; time: string }>>({});

  // Đồng bộ thời gian thực với GOMITA API Server dùng chung
  useEffect(() => {
    function fetchData() {
      fetch(getApiUrl("/api/data"))
        .then((res) => res.json())
        .then((data) => {
          setBackendError("");
          if (data.accounts) setAccounts(data.accounts);
          if (data.orders) setOrders(data.orders);
          if (data.overtimeRequests) setOvertimeRequests(data.overtimeRequests);
          if (data.compensationRequests) setCompensationRequests(data.compensationRequests);
          if (data.leaveRequests) setLeaveRequests(data.leaveRequests);
          if (data.cashTransactions) setCashTransactions(data.cashTransactions);
          if (data.customerDebts) setCustomerDebts(data.customerDebts);
          if (data.holidayDates) setHolidayDates(data.holidayDates);
          if (data.attendance) setAttendance(data.attendance);
          if (data.attendanceDetails) setAttendanceDetails(data.attendanceDetails);
        })
        .catch((err) => {
          console.error("Không kết nối được backend trung tâm.", err);
          setBackendError("Không kết nối được backend trung tâm. Dữ liệu đơn hàng, nhân sự và tài chính sẽ không cập nhật cho đến khi kết nối lại.");
        });
    }

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Tự động đồng bộ ngược lại backend trung tâm
  useEffect(() => {
    if (accounts === demoAccounts) return;
    fetch(getApiUrl("/api/sync"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accounts })
    }).catch(() => {});
  }, [accounts]);

  useEffect(() => {
    if (orders === demoOrders) return;
    fetch(getApiUrl("/api/sync"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders })
    }).catch(() => {});
  }, [orders]);

  useEffect(() => {
    if (overtimeRequests.length === 0) return;
    fetch(getApiUrl("/api/sync"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overtimeRequests })
    }).catch(() => {});
  }, [overtimeRequests]);

  useEffect(() => {
    if (compensationRequests.length === 0) return;
    fetch(getApiUrl("/api/sync"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compensationRequests })
    }).catch(() => {});
  }, [compensationRequests]);

  useEffect(() => {
    if (leaveRequests.length === 0) return;
    fetch(getApiUrl("/api/sync"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaveRequests })
    }).catch(() => {});
  }, [leaveRequests]);

  useEffect(() => {
    if (cashTransactions.length === 0) return;
    fetch(getApiUrl("/api/sync"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cashTransactions })
    }).catch(() => {});
  }, [cashTransactions]);

  useEffect(() => {
    if (customerDebts.length === 0) return;
    fetch(getApiUrl("/api/sync"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerDebts })
    }).catch(() => {});
  }, [customerDebts]);

  useEffect(() => {
    fetch(getApiUrl("/api/sync"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holidayDates })
    }).catch(() => {});
  }, [holidayDates]);

  useEffect(() => {
    if (Object.keys(attendance).length === 0) return;
    fetch(getApiUrl("/api/sync"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendance })
    }).catch(() => {});
  }, [attendance]);

  useEffect(() => {
    if (Object.keys(attendanceDetails).length === 0) return;
    fetch(getApiUrl("/api/sync"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceDetails })
    }).catch(() => {});
  }, [attendanceDetails]);

  const allowedPositions = useMemo(() => currentAccount ? positions.filter((position) => currentAccount.positionIds?.includes(position.id)) : [], [currentAccount]);
  const currentPosition = positions.find((position) => position.id === positionId) ?? allowedPositions[0] ?? positions[0];
  const menu = useMemo(() => getMenuForPosition(currentPosition.id), [currentPosition.id]);

  // Bộ lọc các đơn hàng được giao cho người dùng hiện tại để chọn khi tăng ca
  const assignedOrders = useMemo(() => {
    if (!currentAccount) return [];
    return orders.filter(order => getAssignedNames(order, currentPosition.id).includes(currentAccount.displayName));
  }, [orders, currentAccount, currentPosition.id]);

  useEffect(() => {
    if (!currentAccount) return;
    if (!menu.some((item) => item.id === activeModule)) {
      setActiveModule(menu[0]?.id ?? "orders");
    }
  }, [activeModule, currentAccount, menu]);

  if (!currentAccount) {
    return <LoginScreen accounts={accounts} onLogin={(account) => {
      setCurrentAccount(account);
      const nextPositionId = account.positionIds[0] ?? "sale";
      setPositionId(nextPositionId);
      setActiveModule(getMenuForPosition(nextPositionId)[0]?.id ?? "profile");
    }} />;
  }

  function changePosition(value: string) {
    setPositionId(value);
    const nextMenu = getMenuForPosition(value);
    setActiveModule(nextMenu[0]?.id ?? "orders");
  }

  const content = (
    <>
      {activeModule === "orders" && (
        <OrderDashboard 
          accounts={accounts} 
          currentUserName={currentAccount.displayName} 
          currentAccountId={currentAccount.id}
          currentAccountLevel={currentPosition.level}
          position={currentPosition} 
          orders={orders}
          setOrders={setOrders}
          overtimeRequests={overtimeRequests}
          compensationRequests={compensationRequests}
          onCompensationRequestsChange={setCompensationRequests}
          attendance={attendance}
          onAttendanceChange={setAttendance}
        />
      )}
      {activeModule === "profile" && (
        <ProfileDashboard 
          account={currentAccount} 
          accounts={accounts} 
          position={currentPosition} 
          overtimeRequests={overtimeRequests} 
          attendance={attendance} 
          compensationRequests={compensationRequests}
          onCompensationRequestsChange={setCompensationRequests}
          leaveRequests={leaveRequests}
          onLeaveRequestsChange={setLeaveRequests}
        />
      )}
      {activeModule === "reports" && <CompanyPayrollDashboard accounts={accounts} overtimeRequests={overtimeRequests} attendance={attendance} />}
      {activeModule === "attendance" && (
        <AttendanceDashboard 
          position={currentPosition}
          accounts={accounts}
          compensationRequests={compensationRequests}
          onCompensationRequestsChange={setCompensationRequests}
          attendance={attendance}
          onAttendanceChange={setAttendance}
          attendanceDetails={attendanceDetails}
        />
      )}
      {activeModule === "finance" && (
        <FinanceDashboard 
          orders={orders} 
          setOrders={setOrders} 
          overtimeRequests={overtimeRequests} 
          accounts={accounts}
          currentPosition={currentPosition}
          cashTransactions={cashTransactions}
          onCashTransactionsChange={setCashTransactions}
          customerDebts={customerDebts}
          onCustomerDebtsChange={setCustomerDebts}
        />
      )}
      {activeModule === "hr" && <AccountManagement accounts={accounts} currentAccountId={currentAccount.id} currentPositionId={currentPosition.id} onAccountsChange={setAccounts} holidayDates={holidayDates} onHolidayDatesChange={setHolidayDates} leaveRequests={leaveRequests} onLeaveRequestsChange={setLeaveRequests} />}
      {activeModule === "admin" && (
        <BackupRestoreDashboard 
          onDataRestored={(restoredData) => {
            if (restoredData.accounts) setAccounts(restoredData.accounts);
            if (restoredData.orders) setOrders(restoredData.orders);
            if (restoredData.overtimeRequests) setOvertimeRequests(restoredData.overtimeRequests);
            if (restoredData.compensationRequests) setCompensationRequests(restoredData.compensationRequests);
            if (restoredData.leaveRequests) setLeaveRequests(restoredData.leaveRequests);
            if (restoredData.cashTransactions) setCashTransactions(restoredData.cashTransactions);
            if (restoredData.customerDebts) setCustomerDebts(restoredData.customerDebts);
            if (restoredData.holidayDates) setHolidayDates(restoredData.holidayDates);
            if (restoredData.attendance) setAttendance(restoredData.attendance);
            if (restoredData.attendanceDetails) setAttendanceDetails(restoredData.attendanceDetails);
          }}
        />
      )}
      {!["orders", "profile", "reports", "finance", "hr", "admin", "attendance"].includes(activeModule) && <Placeholder title={menu.find((item) => item.id === activeModule)?.label ?? "Module"} />}
    </>
  );

  if (["production_worker", "installer", "workshop_manager", "site_supervisor"].includes(currentPosition.id)) {
    return (
      <main className="min-h-screen bg-slate-50">
        <WorkerTopBar 
          account={currentAccount} 
          allowedPositions={allowedPositions} 
          positionId={currentPosition.id} 
          positionName={currentPosition.name} 
          onLogout={() => setCurrentAccount(null)} 
          onPositionChange={changePosition} 
        />
        <div className="p-4 pb-24 md:p-6">{content}</div>
        <WorkerBottomNav activeModule={activeModule} onChange={setActiveModule} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <aside className={`fixed inset-y-0 left-0 z-40 w-56 bg-[#071a38] text-white transition-transform md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-full flex-col">
          <div className="flex h-20 items-center gap-3 px-6">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500 font-black">G</div>
            <div className="text-2xl font-black tracking-wide text-orange-500">GOMITA</div>
          </div>

          <nav className="grid gap-1 px-3">
            {menu.map((item) => {
              const Icon = iconMap[item.icon as keyof typeof iconMap] ?? BriefcaseBusiness;
              const active = activeModule === item.id;
              return (
                <button key={item.id} className={`relative flex min-h-14 items-center gap-3 rounded-lg px-4 text-left font-bold ${active ? "bg-white/15 text-white shadow-[inset_4px_0_0_#f97316]" : "text-slate-200 hover:bg-white/10"}`} onClick={() => {
                  setActiveModule(item.id);
                  setSidebarOpen(false);
                }} type="button">
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {mustClockIn(currentPosition.id) ? <SidebarClock onOvertime={() => setOvertimeOpen(true)} /> : null}
        </div>
      </aside>

      {sidebarOpen ? <button className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} type="button" aria-label="Đóng menu" /> : null}

      <section className="md:pl-56">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-7">
          <div className="flex items-center gap-3">
            <button className="rounded-lg border border-slate-200 p-2 md:hidden" onClick={() => setSidebarOpen(true)} type="button" aria-label="Mở menu">
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-black">{menu.find((item) => item.id === activeModule)?.label ?? "Đơn hàng"}</h1>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <RoleSelect allowedPositions={allowedPositions} value={currentPosition.id} onChange={changePosition} />
            <div className="hidden items-center gap-3 md:flex">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-200"><UserCircle className="h-8 w-8 text-slate-500" /></div>
              <div>
                <div className="font-black">{currentAccount.displayName}</div>
                <div className="text-sm text-slate-500">{currentPosition.name}</div>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </div>
            <button className="grid h-10 w-10 place-items-center rounded-lg hover:bg-slate-100" onClick={() => setCurrentAccount(null)} type="button" aria-label="Đăng xuất">
              <LogOut className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </header>

        <div className="p-4 md:p-7">
          {backendError ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {backendError}
            </div>
          ) : null}
          {toast ? <div className="mb-4 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700">{toast}<button onClick={() => setToast("")} type="button"><X className="h-4 w-4" /></button></div> : null}
          {content}
        </div>
      </section>

      {overtimeOpen ? (
        <OvertimeModal 
          assignedOrders={assignedOrders} 
          onClose={() => setOvertimeOpen(false)} 
          onSubmit={(req) => {
            setOvertimeOpen(false);
            const newRequest = {
              id: `ot-${Date.now()}`,
              userId: currentAccount.id,
              userDisplayName: currentAccount.displayName,
              ...req,
              status: "approved",
              createdAt: new Date().toISOString()
            };
            setOvertimeRequests(current => [newRequest, ...current]);
            setToast(`Đã đăng ký tăng ca thành công ${req.hours} giờ cho đơn ${req.orderCode || "chung"}.`);
          }} 
        />
      ) : null}
    </main>
  );
}

function SidebarClock({ onOvertime }: { onOvertime: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [timeStr, setTimeStr] = useState("07:30:00");
  const [dateStr, setDateStr] = useState("Thứ 6, 24/05/2024");

  useEffect(() => {
    setMounted(true);
    function updateClock() {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      setTimeStr(`${hours}:${minutes}:${seconds}`);
      
      const daysOfWeek = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
      const dayName = daysOfWeek[now.getDay()];
      const day = String(now.getDate()).padStart(2, "0");
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const year = now.getFullYear();
      setDateStr(`${dayName}, ${day}/${month}/${year}`);
    }
    
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return (
      <div className="mt-auto p-4">
        <div className="rounded-lg border border-white/15 bg-white/5 p-4 text-center animate-pulse">
          <div className="h-8 bg-white/10 rounded w-3/4 mx-auto mb-2"></div>
          <div className="h-4 bg-white/10 rounded w-1/2 mx-auto mb-4"></div>
          <div className="h-12 bg-white/10 rounded w-full mb-2"></div>
          <div className="h-10 bg-white/10 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-auto p-4">
      <div className="rounded-lg border border-white/15 bg-white/5 p-4 text-center">
        <div className="text-3xl font-black text-orange-400">{timeStr}</div>
        <div className="mt-1 text-sm text-slate-300">{dateStr}</div>
        <button className="mt-4 min-h-10 w-full rounded-lg border border-orange-400 font-bold text-orange-200 hover:bg-white/5 transition" onClick={onOvertime} type="button">Đăng ký tăng ca</button>
      </div>
    </div>
  );
}

function WorkerTopBar({
  account,
  allowedPositions,
  positionName,
  positionId,
  onPositionChange,
  onLogout
}: {
  account: UserAccount;
  allowedPositions: typeof positions;
  positionName: string;
  positionId: string;
  onPositionChange: (value: string) => void;
  onLogout: () => void;
}) {
  return (
    <header className="flex min-h-20 items-center justify-between bg-slate-950 px-4 text-white md:px-7">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500 font-black">G</div>
          <div className="text-2xl font-black tracking-wide text-orange-500">GOMITA</div>
        </div>
        <div className="hidden items-center gap-3 text-xl font-black md:flex">
          <CalendarCheck className="h-7 w-7 text-orange-500" />
          {positionName}
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-8">
        <div className="hidden text-xs font-bold text-blue-100 md:block">Chấm công trên điện thoại</div>
        <RoleSelect dark allowedPositions={allowedPositions} value={positionId} onChange={onPositionChange} />
        <div className="hidden items-center gap-3 md:flex">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-200"><UserCircle className="h-9 w-9 text-slate-500" /></div>
          <div className="font-black">{account.displayName}</div>
        </div>
        <button className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10" onClick={onLogout} type="button" aria-label="Đăng xuất"><LogOut className="h-5 w-5 text-white" /></button>
      </div>
    </header>
  );
}

function WorkerBottomNav({ activeModule, onChange }: { activeModule: string; onChange: (value: string) => void }) {
  const items = [
    { id: "orders", label: "Đơn hàng", icon: BriefcaseBusiness },
    { id: "profile", label: "Tài khoản", icon: UserCircle }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 grid h-16 grid-cols-2 border-t border-slate-200 bg-white">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.id === activeModule;
        return (
          <button key={item.id} className={`flex items-center justify-center gap-2 font-bold ${active ? "text-orange-500" : "text-slate-500"}`} onClick={() => onChange(item.id)} type="button">
            <Icon className="h-5 w-5" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function RoleSelect({ value, onChange, allowedPositions, dark = false }: { value: string; onChange: (value: string) => void; allowedPositions: typeof positions; dark?: boolean }) {
  return (
    <select className={`h-10 rounded-lg border px-3 text-sm font-bold outline-none ${dark ? "border-white/20 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`} value={value} onChange={(event) => onChange(event.target.value)}>
      {allowedPositions.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}
    </select>
  );
}

function OvertimeModal({ 
  assignedOrders, 
  onClose, 
  onSubmit 
}: { 
  assignedOrders: Order[]; 
  onClose: () => void; 
  onSubmit: (request: { from: string; to: string; reason: string; orderCode: string; hours: number }) => void 
}) {
  const [from, setFrom] = useState("18:00");
  const [to, setTo] = useState("20:00");
  const [reason, setReason] = useState("");
  const [selectedOrderCode, setSelectedOrderCode] = useState(assignedOrders[0]?.code ?? "");

  function calculateHours(fromStr: string, toStr: string) {
    const [fh, fm] = fromStr.split(":").map(Number);
    const [th, tm] = toStr.split(":").map(Number);
    let diff = (th * 60 + tm) - (fh * 60 + fm);
    if (diff < 0) diff += 24 * 60; // Qua đêm
    return diff / 60;
  }

  function submit() {
    onSubmit({
      from,
      to,
      reason: reason.trim(),
      orderCode: selectedOrderCode,
      hours: calculateHours(from, to)
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl text-slate-900">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">Đăng ký tăng ca hôm nay</h2>
          <button className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100" onClick={onClose} type="button"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm font-bold">
            Chọn đơn hàng tăng ca
            <select 
              className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-500 font-normal bg-white" 
              value={selectedOrderCode} 
              onChange={(e) => setSelectedOrderCode(e.target.value)}
            >
              {assignedOrders.length === 0 ? (
                <option value="">Tăng ca chung (Không chọn đơn)</option>
              ) : (
                assignedOrders.map(order => (
                  <option key={order.id} value={order.code}>{order.code} - {order.customerName}</option>
                ))
              )}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold">Từ giờ<input className="h-11 rounded-lg border border-slate-200 px-3 font-normal" type="time" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="grid gap-1 text-sm font-bold">Đến giờ<input className="h-11 rounded-lg border border-slate-200 px-3 font-normal" type="time" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label className="grid gap-1 text-sm font-bold">Lý do<textarea className="min-h-24 rounded-lg border border-slate-200 p-3 font-normal" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập lý do nếu cần" /></label>
          <button className="min-h-12 rounded-lg bg-orange-500 font-black text-white" onClick={submit} type="button">Gửi đăng ký tăng ca</button>
        </div>
      </section>
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mt-2 text-slate-500">Module đã được tách riêng trong kiến trúc và sẵn sàng nối Supabase.</p>
    </section>
  );
}
