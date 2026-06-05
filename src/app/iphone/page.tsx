"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleDollarSign } from "lucide-react";
import { attendanceSlots, isSlotOpen } from "@/modules/attendance/compensationRules";
import type { AttendanceSlot } from "@/modules/attendance/types";
import type { UserAccount } from "@/modules/hr/accounts";

type RuntimeData = {
  account?: UserAccount;
  accounts?: UserAccount[];
  attendance?: Record<string, string>;
  holidayDates?: string[];
  usernameDirectory?: Array<{ id: string; username: string }>;
  orders?: any[];
  warrantyTasks?: any[];
  workerAllowances?: Record<string, any>;
  overtimeRequests?: any[];
  attendanceCompensationState?: Record<string, any>;
};

const sessionStorageKey = "gomita_iphone_web_session_v1";

const slots = ["07:30", "11:30", "13:30", "17:30"];
const overtimeHiddenPositionIds = [
  "director",
  "admin",
  "sale_manager",
  "design_manager",
  "hr_manager",
  "accountant_manager",
  "supervisor_lead",
  "workshop_manager"
];

const defaultAllowanceRates = {
  lunchDailyRate: 30000,
  siteFuelDailyRate: 40000,
  siteWaterDailyRate: 10000,
  siteLunchDailyRate: 40000,
  otherAllowance: 0
};

const siteWorkSteps = ["Lắp đặt", "Nghiệm thu", "Bảo hành"] as const;

const toMonthKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;

const toPreviousMonthKey = (monthKey: string) => {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
  return toMonthKey(new Date(year, month - 2, 1));
};

const toNumericOrUndefined = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : undefined;

const resolveAllowanceConfig = (userId: string, monthKey: string, workerAllowances: Record<string, any>) => {
  let cursor = monthKey;
  for (let index = 0; index < 24; index += 1) {
    const entry = workerAllowances[`${userId}-${cursor}`];
    if (entry) {
      return {
        sourceMonth: cursor,
        lunchDailyRate: toNumericOrUndefined(entry.lunchDailyRate) ?? defaultAllowanceRates.lunchDailyRate,
        siteFuelDailyRate: toNumericOrUndefined(entry.siteFuelDailyRate) ?? defaultAllowanceRates.siteFuelDailyRate,
        siteWaterDailyRate: toNumericOrUndefined(entry.siteWaterDailyRate) ?? defaultAllowanceRates.siteWaterDailyRate,
        siteLunchDailyRate: toNumericOrUndefined(entry.siteLunchDailyRate) ?? defaultAllowanceRates.siteLunchDailyRate,
        otherAllowance: toNumericOrUndefined(entry.otherAllowance) ?? toNumericOrUndefined(entry.responsibilityAllowanceOverride) ?? defaultAllowanceRates.otherAllowance
      };
    }
    cursor = toPreviousMonthKey(cursor);
  }

  return {
    sourceMonth: null as string | null,
    ...defaultAllowanceRates
  };
};

const getOrderAssigneesForStep = (order: any, step: string) => {
  if (["Lắp đặt", "Nghiệm thu", "Bảo hành"].includes(step)) {
    return ((order.installerNames?.length ? order.installerNames : [order.installerName]) as string[]).filter(Boolean);
  }
  if (step === "Sản xuất") {
    return ((order.productionWorkerNames?.length ? order.productionWorkerNames : [order.productionWorkerName]) as string[]).filter(Boolean);
  }
  if (step === "Ra file") {
    return ((order.fileOperatorNames?.length ? order.fileOperatorNames : [order.fileOperatorName]) as string[]).filter(Boolean);
  }
  if (step === "Thiết kế") {
    return ((order.designerNames?.length ? order.designerNames : [order.designerName]) as string[]).filter(Boolean);
  }
  return (order.saleName || "").split(",").map((item: string) => item.trim()).filter(Boolean);
};

const calculateUserAllowances = (
  userId: string,
  displayName: string,
  monthDays: Date[],
  attendance: Record<string, string>,
  orders: any[],
  warrantyTasks: any[],
  workerAllowances: Record<string, any>,
  isWorker: boolean
) => {
  const currentMonthStr = toMonthKey(monthDays[0] ?? new Date());
  let calcFullDays = 0;
  if (isWorker) {
    monthDays.forEach((day) => {
      const dayNum = day.getDate();
      let morningChecked = false;
      let afternoonChecked = false;
      slots.forEach((slot) => {
        const key = `${userId}-${dayNum}-${slot}`;
        if (attendance[key] === "normal" || attendance[key] === "compensated") {
          if (slot === "07:30" || slot === "11:30") morningChecked = true;
          if (slot === "13:30" || slot === "17:30") afternoonChecked = true;
        }
      });
      if (morningChecked && afternoonChecked) {
        calcFullDays += 1;
      }
    });
  }

  let calcSiteDays = 0;
  let calcSiteFullDays = 0;
  const siteDayDetails: Array<{
    date: string;
    label: string;
    workedSlots: number;
    isFullDay: boolean;
    isSiteFullDay: boolean;
    orders: string[];
    steps: string[];
  }> = [];

  if (isWorker) {
    monthDays.forEach((day) => {
      const dayNum = day.getDate();
      const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      let checkedCount = 0;
      let morningChecked = false;
      let afternoonChecked = false;
      slots.forEach((slot) => {
        const key = `${userId}-${dayNum}-${slot}`;
        if (attendance[key] === "normal" || attendance[key] === "compensated") {
          checkedCount += 1;
          if (slot === "07:30" || slot === "11:30") morningChecked = true;
          if (slot === "13:30" || slot === "17:30") afternoonChecked = true;
        }
      });
      if (checkedCount === 0) return;

      const matchedAssignments = orders.reduce<Array<{ code: string; step: string }>>((list, order) => {
        const currentStepIsSiteWork = siteWorkSteps.includes(order.step as (typeof siteWorkSteps)[number]) || !!order.isFieldWork;
        if (currentStepIsSiteWork) {
          const currentAssignees = getOrderAssigneesForStep(order, order.step);
          const assignedDate = order.assignedInstallerDate || order.deploymentStartTime?.slice(0, 10);
          const isFuture = order.deploymentStartTime && new Date(order.deploymentStartTime) > new Date();
          if (currentAssignees.includes(displayName) && assignedDate === dateStr && !isFuture) {
            list.push({ code: order.code, step: order.step });
          }
        }

        (order.historyLogs || []).forEach((log: any) => {
          const logIsSiteWork = siteWorkSteps.includes(log.step as (typeof siteWorkSteps)[number]) || !!order.isFieldWork;
          if (!logIsSiteWork) return;
          const assignees = getOrderAssigneesForStep(order, log.step);
          const finalAssignees = assignees.length ? assignees : [log.assignee].filter(Boolean);
          if (!finalAssignees.includes(displayName)) return;
          const start = log.acceptedAt || log.startedAt;
          if (!start) return;
          if (new Date(start) > new Date()) return;
          const startDateText = start.substring(0, 10);
          const endDateText = log.completedAt ? log.completedAt.substring(0, 10) : startDateText;
          if (dateStr >= startDateText && dateStr <= endDateText) {
            list.push({ code: order.code, step: log.step });
          }
        });

        return list;
      }, []);

      const matchedWarrantyTasks = warrantyTasks.filter((task: any) => {
        if (task.assigneeId !== userId && task.assigneeName !== displayName) return false;
        if (task.startAt && new Date(task.startAt) > new Date()) return false;
        return (task.startAt || "").slice(0, 10) === dateStr;
      });

      if (matchedAssignments.length === 0 && matchedWarrantyTasks.length === 0) return;

      const isSiteFullDay = morningChecked && afternoonChecked;
      calcSiteDays += 1;
      if (isSiteFullDay) {
        calcSiteFullDays += 1;
      }
      siteDayDetails.push({
        date: dateStr,
        label: `Ngày ${dayNum}/${day.getMonth() + 1}`,
        workedSlots: checkedCount,
        isFullDay: morningChecked && afternoonChecked,
        isSiteFullDay,
        orders: Array.from(new Set([
          ...matchedAssignments.map((item) => item.code),
          ...matchedWarrantyTasks.map((item: any) => item.code)
        ])),
        steps: Array.from(new Set([
          ...matchedAssignments.map((item) => item.step),
          ...matchedWarrantyTasks.map(() => "Bảo hành")
        ]))
      });
    });
  }

  const key = `${userId}-${currentMonthStr}`;
  const overrides = workerAllowances[key] || {};
  const resolvedConfig = resolveAllowanceConfig(userId, currentMonthStr, workerAllowances);
  const lunchDailyRate = toNumericOrUndefined(overrides.lunchDailyRate) ?? resolvedConfig.lunchDailyRate;
  const siteFuelDailyRate = toNumericOrUndefined(overrides.siteFuelDailyRate) ?? resolvedConfig.siteFuelDailyRate;
  const siteWaterDailyRate = toNumericOrUndefined(overrides.siteWaterDailyRate) ?? resolvedConfig.siteWaterDailyRate;
  const siteLunchDailyRate = toNumericOrUndefined(overrides.siteLunchDailyRate) ?? resolvedConfig.siteLunchDailyRate;
  const otherAllowance = toNumericOrUndefined(overrides.otherAllowance)
    ?? toNumericOrUndefined(overrides.responsibilityAllowanceOverride)
    ?? resolvedConfig.otherAllowance;

  const calcSiteHalfDays = Math.max(0, calcSiteDays - calcSiteFullDays);
  const calcMealAllowance = ((calcFullDays - calcSiteFullDays) * lunchDailyRate) + (calcSiteFullDays * siteLunchDailyRate);
  const siteFuelAllowance = calcSiteDays * siteFuelDailyRate;
  const siteWaterAllowance = calcSiteDays * siteWaterDailyRate;
  const mealAllowance = overrides.mealAllowanceOverride !== undefined ? Number(overrides.mealAllowanceOverride) : calcMealAllowance;
  const siteAllowance = overrides.siteAllowanceOverride !== undefined ? Number(overrides.siteAllowanceOverride) : (siteFuelAllowance + siteWaterAllowance);

  return {
    calcFullDays,
    calcSiteDays,
    calcSiteFullDays,
    calcSiteHalfDays,
    siteDays: calcSiteDays,
    siteFullDays: calcSiteFullDays,
    siteHalfDays: calcSiteHalfDays,
    fullDays: calcFullDays,
    siteDayDetails,
    lunchDailyRate,
    siteFuelDailyRate,
    siteWaterDailyRate,
    siteLunchDailyRate,
    mealAllowance,
    siteFuelAllowance,
    siteWaterAllowance,
    siteAllowance,
    otherAllowance,
    responsibilityAllowance: otherAllowance,
    totalAllowance: mealAllowance + siteAllowance + otherAllowance,
    configSourceMonth: resolvedConfig.sourceMonth,
    hasMealOverride: overrides.mealAllowanceOverride !== undefined,
    hasSiteOverride: overrides.siteAllowanceOverride !== undefined
  };
};

function base64UrlToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export default function IphoneClockinPage() {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [usernameDirectory, setUsernameDirectory] = useState<Array<{ id: string; username: string }>>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [holidayDates, setHolidayDates] = useState<string[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [warrantyTasks, setWarrantyTasks] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentAccount, setCurrentAccount] = useState<UserAccount | null>(null);
  const [message, setMessage] = useState("Đăng nhập để chấm công và xem công.");
  const [submitting, setSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [accountUsername, setAccountUsername] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState("");
  const [accountEditorOpen, setAccountEditorOpen] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const [workerAllowances, setWorkerAllowances] = useState<Record<string, any>>({});
  const [overtimeRequests, setOvertimeRequests] = useState<any[]>([]);
  const [attendanceCompensationState, setAttendanceCompensationState] = useState<Record<string, any>>({});

  const currentDateKey = useMemo(() => {
    const year = currentTime.getFullYear();
    const month = String(currentTime.getMonth() + 1).padStart(2, "0");
    const day = String(currentTime.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, [currentTime]);

  const monthDays = useMemo(() => {
    const year = currentTime.getFullYear();
    const month = currentTime.getMonth();
    const count = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [currentTime]);

  const monthDates = useMemo(() => {
    const year = currentTime.getFullYear();
    const month = currentTime.getMonth();
    const count = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: count }, (_, index) => new Date(year, month, index + 1));
  }, [currentTime]);

  const activeSlot = useMemo(
    () => attendanceSlots.find((slot) => isSlotOpen(slot, currentTime)) ?? null,
    [currentTime]
  );

  const isHoliday = useMemo(() => {
    return currentTime.getDay() === 0 || holidayDates.includes(currentDateKey);
  }, [currentDateKey, currentTime, holidayDates]);

  const fetchRuntimeData = useCallback(async (userId?: string) => {
    if (!userId) return;
    const response = await fetch(`/api/mobile/bootstrap?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
    const data = (await response.json()) as RuntimeData;
    setAccounts(data.account ? [data.account] : []);
    setAttendance(data.attendance || {});
    setHolidayDates(Array.isArray(data.holidayDates) ? data.holidayDates : []);
    setUsernameDirectory(Array.isArray(data.usernameDirectory) ? data.usernameDirectory : []);
    setOrders(data.orders || []);
    setWarrantyTasks(data.warrantyTasks || []);
    setWorkerAllowances(data.workerAllowances || {});
    setOvertimeRequests(data.overtimeRequests || []);
    setAttendanceCompensationState(data.attendanceCompensationState || {});
    if (data.account) {
      setCurrentAccount(data.account);
    }
  }, []);

  useEffect(() => {
    if (!currentAccount?.id) return;
    void fetchRuntimeData(currentAccount.id);
  }, [currentAccount?.id, fetchRuntimeData]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(sessionStorageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { account?: UserAccount };
      if (parsed?.account?.id) {
        setCurrentAccount(parsed.account);
      }
    } catch {
      window.sessionStorage.removeItem(sessionStorageKey);
    }
  }, []);

  useEffect(() => {
    if (!currentAccount) return;
    window.sessionStorage.setItem(sessionStorageKey, JSON.stringify({ account: currentAccount }));
    setAccountUsername(currentAccount.username || "");
  }, [currentAccount]);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setPushSupported(supported);
  }, []);

  const syncPushStatus = useCallback(async () => {
    if (!pushSupported || !currentAccount) return;
    const registration = await navigator.serviceWorker.register("/push-sw.js");
    const subscription = await registration.pushManager.getSubscription();
    setPushEnabled(Boolean(subscription));
  }, [currentAccount, pushSupported]);

  useEffect(() => {
    if (!currentAccount || !pushSupported) return;
    void syncPushStatus();
  }, [currentAccount, pushSupported, syncPushStatus]);

  const currentAttendanceStats = useMemo(() => {
    if (!currentAccount) return { workedSlots: 0, totalSlots: monthDays.length * attendanceSlots.length };
    const workedSlots = monthDays.reduce((total, day) => {
      return (
        total +
        attendanceSlots.filter((slot) => {
          const key = `${currentAccount.id}-${day}-${slot}`;
          return attendance[key] === "normal" || attendance[key] === "compensated";
        }).length
      );
    }, 0);
    return { workedSlots, totalSlots: monthDays.length * attendanceSlots.length };
  }, [attendance, currentAccount, monthDays]);

  const isWorker = useMemo(() => {
    if (!currentAccount) return false;
    return (currentAccount.positionIds || []).some((p: string) => ["production_worker", "installer"].includes(p));
  }, [currentAccount]);

  const allowances = useMemo(() => {
    if (!currentAccount) return null;
    return calculateUserAllowances(
      currentAccount.id,
      currentAccount.displayName,
      monthDates,
      attendance,
      orders,
      warrantyTasks,
      workerAllowances,
      isWorker
    );
  }, [currentAccount, monthDates, attendance, orders, warrantyTasks, workerAllowances, isWorker]);

  const todayNum = useMemo(() => {
    return currentTime.getDate();
  }, [currentTime]);

  const workDays = useMemo(() => {
    if (!currentAccount) return 0;
    let total = 0;
    monthDates.forEach((day) => {
      if (day.getDay() === 0 || day.getDate() > todayNum) return;
      const dayNum = day.getDate();
      let checkedCount = 0;
      attendanceSlots.forEach((slot) => {
        const key = `${currentAccount.id}-${dayNum}-${slot}`;
        if (attendance[key] === "normal" || attendance[key] === "compensated") {
          checkedCount++;
        }
      });
      if (checkedCount === 4) total += 1.0;
      else if (checkedCount >= 2) total += 0.5;
    });
    return total;
  }, [currentAccount, monthDates, attendance, todayNum]);

  const salaryType = currentAccount?.salaryType ?? "daily";
  const salaryValue = currentAccount?.salaryValue ?? (currentAccount?.positionIds?.includes("hr") ? 420000 : currentAccount?.positionIds?.includes("accountant") ? 400000 : 350000);

  const maxWorkDays = useMemo(() => {
    return monthDates.filter((day) => day.getDay() !== 0).length;
  }, [monthDates]);

  const basePay = useMemo(() => {
    if (salaryType === "monthly") {
      return maxWorkDays ? (salaryValue / maxWorkDays) * workDays : 0;
    }
    return workDays * salaryValue;
  }, [salaryType, salaryValue, workDays, maxWorkDays]);

  const hourlySalaryRate = useMemo(() => {
    if (salaryType === "monthly") {
      return maxWorkDays ? salaryValue / maxWorkDays / 8 : 0;
    }
    return salaryValue / 8;
  }, [maxWorkDays, salaryType, salaryValue]);

  const otHours = useMemo(() => {
    if (!currentAccount || !overtimeRequests) return 0;
    const nowMonth = currentTime.getMonth();
    const nowYear = currentTime.getFullYear();
    const primaryPositionId = currentAccount.positionIds?.[0] || "";
    const canUseOvertimeCurrent = !overtimeHiddenPositionIds.includes(primaryPositionId);
    if (!canUseOvertimeCurrent) return 0;

    return overtimeRequests
      .filter((req: any) => {
        const reqDate = new Date(req.createdAt);
        return (
          req.userId === currentAccount.id &&
          req.status === "approved" &&
          reqDate.getMonth() === nowMonth &&
          reqDate.getFullYear() === nowYear
        );
      })
      .reduce((sum: number, req: any) => sum + (Number(req.hours) || 0), 0);
  }, [currentAccount, overtimeRequests, currentTime]);

  const otPay = useMemo(() => {
    return otHours * 1.5 * hourlySalaryRate;
  }, [hourlySalaryRate, otHours]);

  const estimatedIncome = useMemo(() => {
    if (!allowances) return 0;
    return basePay + otPay + allowances.totalAllowance;
  }, [basePay, otPay, allowances]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("Đang đăng nhập...");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const result = await response.json();
      if (!response.ok || !result?.account) {
        setMessage(result?.error || "Không đăng nhập được.");
        return;
      }
      setCurrentAccount(result.account as UserAccount);
      setMessage("Đăng nhập thành công.");
      setPassword("");
      await fetchRuntimeData(result.account.id);
    } catch {
      setMessage("Không kết nối được máy chủ.");
    } finally {
      setSubmitting(false);
    }
  }

  function logout() {
    setCurrentAccount(null);
    window.sessionStorage.removeItem(sessionStorageKey);
    setMessage("Đã đăng xuất.");
    setPushEnabled(false);
  }

  async function saveAccountCredentials() {
    if (!currentAccount) return;
    const nextUsername = accountUsername.trim().toLowerCase();
    const nextPassword = accountPassword.trim();
    const confirmPassword = accountPasswordConfirm.trim();

    if (!nextUsername) {
      setMessage("Tên đăng nhập không được để trống.");
      return;
    }

    if (!nextPassword) {
      setMessage("Mật khẩu mới không được để trống.");
      return;
    }

    if (nextPassword !== confirmPassword) {
      setMessage("Mật khẩu nhập lại không khớp.");
      return;
    }

    const hasDuplicate = usernameDirectory.some(
      (account) => account.id !== currentAccount.id && account.username.trim().toLowerCase() === nextUsername
    );
    if (hasDuplicate) {
      setMessage("Tên đăng nhập này đã tồn tại.");
      return;
    }

    setSubmitting(true);
    setMessage("Đang lưu tài khoản...");
    try {
      const nextAccounts = accounts.map((account) =>
        account.id === currentAccount.id
          ? { ...account, username: nextUsername, password: nextPassword }
          : account
      );

      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts: nextAccounts })
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        setMessage(result?.error || "Không lưu được tài khoản.");
        return;
      }

      const nextUser = nextAccounts.find((account) => account.id === currentAccount.id) || currentAccount;
      setAccounts(nextAccounts);
      setCurrentAccount(nextUser);
      setAccountPassword("");
      setAccountPasswordConfirm("");
      setMessage("Đã cập nhật tên đăng nhập và mật khẩu.");
    } catch {
      setMessage("Không lưu được tài khoản.");
    } finally {
      setSubmitting(false);
    }
  }

  async function readPhoto(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Không đọc được ảnh."));
      reader.readAsDataURL(file);
    });
  }

  async function compressPhoto(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const ratio = image.width > 720 ? 720 / image.width : 1;
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * ratio));
          canvas.height = Math.max(1, Math.round(image.height * ratio));
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("Không khởi tạo được bộ nén ảnh."));
            return;
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.72));
        };
        image.onerror = () => reject(new Error("Không xử lý được ảnh chấm công."));
        image.src = String(reader.result || "");
      };
      reader.onerror = () => reject(new Error("Không đọc được ảnh."));
      reader.readAsDataURL(file);
    });
  }

  async function saveAccountCredentialsLean() {
    if (!currentAccount) return;
    const nextUsername = accountUsername.trim().toLowerCase();
    const nextPassword = accountPassword.trim();
    const confirmPassword = accountPasswordConfirm.trim();

    if (!nextUsername) {
      setMessage("Tên đăng nhập không được để trống.");
      return;
    }
    if (!nextPassword) {
      setMessage("Mật khẩu mới không được để trống.");
      return;
    }
    if (nextPassword !== confirmPassword) {
      setMessage("Mật khẩu nhập lại không khớp.");
      return;
    }

    const hasDuplicate = usernameDirectory.some(
      (account) => account.id !== currentAccount.id && account.username.trim().toLowerCase() === nextUsername
    );
    if (hasDuplicate) {
      setMessage("Tên đăng nhập này đã tồn tại.");
      return;
    }

    setSubmitting(true);
    setMessage("Đang lưu tài khoản...");
    try {
      const response = await fetch("/api/account/self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentAccount.id,
          username: nextUsername,
          password: nextPassword
        })
      });
      const result = await response.json();
      if (!response.ok || !result?.account) {
        setMessage(result?.error || "Không lưu được tài khoản.");
        return;
      }

      setAccounts([result.account]);
      setCurrentAccount(result.account);
      setAccountPassword("");
      setAccountPasswordConfirm("");
      setMessage("Đã cập nhật tên đăng nhập và mật khẩu.");
    } catch {
      setMessage("Không lưu được tài khoản.");
    } finally {
      setSubmitting(false);
    }
  }

  async function enablePushNotifications() {
    if (!currentAccount || !pushSupported) return;
    setPushBusy(true);
    try {
      const keyResponse = await fetch("/api/push/public-key", { cache: "no-store" });
      const keyPayload = await keyResponse.json();
      if (!keyResponse.ok || !keyPayload?.publicKey) {
        setMessage(keyPayload?.error || "Máy chủ chưa cấu hình thông báo.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Bạn chưa cấp quyền thông báo cho trình duyệt.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/push-sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(String(keyPayload.publicKey))
        }));

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentAccount.id,
          deviceLabel: "iphone-web",
          subscription: subscription.toJSON()
        })
      });

      setPushEnabled(true);
      setMessage("Đã bật thông báo cho thiết bị này.");
    } catch {
      setMessage("Không bật được thông báo trên thiết bị này.");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePushNotifications() {
    if (!pushSupported) return;
    setPushBusy(true);
    try {
      const registration = await navigator.serviceWorker.register("/push-sw.js");
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
      }
      setPushEnabled(false);
      setMessage("Đã tắt thông báo trên thiết bị này.");
    } catch {
      setMessage("Không tắt được thông báo trên thiết bị này.");
    } finally {
      setPushBusy(false);
    }
  }

  async function getCurrentGpsText() {
    return await new Promise<string>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Thiết bị không hỗ trợ GPS."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(5);
          const lng = position.coords.longitude.toFixed(5);
          resolve(`${lat}, ${lng}`);
        },
        () => reject(new Error("Không lấy được vị trí.")),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  }

  async function submitClockin(file: File) {
    if (!currentAccount || !activeSlot) return;
    setSubmitting(true);
    setMessage("Đang gửi chấm công...");
    try {
      const [photo, gps] = await Promise.all([compressPhoto(file), getCurrentGpsText()]);
      const response = await fetch("/api/clockin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentAccount.id,
          date: String(currentTime.getDate()),
          slot: activeSlot,
          photo,
          gps,
          time: `${String(currentTime.getHours()).padStart(2, "0")}:${String(currentTime.getMinutes()).padStart(2, "0")}:${String(currentTime.getSeconds()).padStart(2, "0")}`
        })
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result?.error || "Chấm công thất bại.");
        return;
      }
      setAttendance(result.attendance || {});
      setMessage(`Đã chấm công mốc ${activeSlot}.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chấm công thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitClockinLean(file: File) {
    if (!currentAccount || !activeSlot) return;
    setSubmitting(true);
    setMessage("Đang gửi chấm công...");
    try {
      const [photo, gps] = await Promise.all([readPhoto(file), getCurrentGpsText()]);
      const response = await fetch("/api/clockin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentAccount.id,
          date: currentDateKey,
          slot: activeSlot,
          gps,
          time: new Date().toISOString()
        })
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        setMessage(result?.error || "Chấm công thất bại.");
        return;
      }

      fetch("/api/clockin-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentAccount.id,
          date: currentDateKey,
          slot: activeSlot,
          photo
        })
      }).catch(() => {});

      await fetchRuntimeData(currentAccount.id);
      setMessage(`Đã chấm công mốc ${activeSlot}.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chấm công thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClockInButtonClick() {
    if (!currentAccount) return;

    const isStepMatchingUserPosition = (step: string, positionIds: string[]) => {
      const normalized = positionIds.map(p => p.trim().toLowerCase());
      if (normalized.includes("admin") || normalized.includes("director")) return true;

      if (["Tiếp nhận", "Báo giá", "Hoàn công"].includes(step)) {
        return normalized.includes("sale") || normalized.includes("sale_manager");
      }
      if (step === "Thiết kế") {
        return normalized.includes("designer") || normalized.includes("design_manager");
      }
      if (step === "Ra file") {
        return normalized.includes("file_operator") || normalized.includes("workshop_manager");
      }
      if (step === "Sản xuất") {
        return normalized.includes("production_worker") || normalized.includes("workshop_manager");
      }
      if (["Lắp đặt", "Nghiệm thu"].includes(step)) {
        return normalized.includes("installer") || normalized.includes("supervisor_lead") || normalized.includes("site_supervisor");
      }
      return false;
    };

    const isUserAssignedToCurrentStep = (order: any, userDisplayName: string, userPositionIds: string[]) => {
      if (!isStepMatchingUserPosition(order.step, userPositionIds)) return false;

      let stepAssignees: string[] = [];
      if (["Tiếp nhận", "Báo giá", "Hoàn công"].includes(order.step)) {
        stepAssignees = order.saleName ? order.saleName.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
      } else if (order.step === "Thiết kế") {
        stepAssignees = ((order.designerNames?.length ? order.designerNames : [order.designerName]) as string[]).filter(Boolean);
      } else if (order.step === "Ra file") {
        stepAssignees = ((order.fileOperatorNames?.length ? order.fileOperatorNames : [order.fileOperatorName]) as string[]).filter(Boolean);
      } else if (order.step === "Sản xuất") {
        stepAssignees = ((order.productionWorkerNames?.length ? order.productionWorkerNames : [order.productionWorkerName]) as string[]).filter(Boolean);
      } else if (order.step === "Lắp đặt") {
        stepAssignees = ((order.installerNames?.length ? order.installerNames : [order.installerName]) as string[]).filter(Boolean);
      } else if (order.step === "Nghiệm thu") {
        stepAssignees = ((order.supervisorNames?.length ? order.supervisorNames : [order.supervisorName]) as string[]).filter(Boolean);
      }
      return stepAssignees.includes(userDisplayName);
    };

    const assignedOrders = orders.filter(order => isUserAssignedToCurrentStep(order, currentAccount.displayName, currentAccount.positionIds || []));
    const assignedWarranty = warrantyTasks.filter((task) => task.assigneeId === currentAccount.id && task.status === "assigned");
    const workingWarranty = warrantyTasks.filter((task) => task.assigneeId === currentAccount.id && task.status === "working");
    const unconfirmedJobs = assignedOrders.filter(order => order.workStatus === "unconfirmed");
    const workingJobs = assignedOrders.filter(order => order.workStatus === "working");

    let needSync = false;
    let nextOrders = [...orders];
    let nextWarrantyTasks = [...warrantyTasks];

    for (const job of unconfirmedJobs) {
      const accept = window.confirm(`Bạn có muốn nhận việc đơn hàng ${job.code} không?`);
      if (accept) {
        needSync = true;
        const nowStr = new Date().toISOString();
        nextOrders = nextOrders.map(o => {
          if (o.id !== job.id) return o;
          const updatedLogs = (o.historyLogs || []).map((log: any) => 
            log.step === o.step ? { ...log, acceptedAt: nowStr } : log
          );
          return {
            ...o,
            workStatus: "working",
            historyLogs: updatedLogs
          };
        });
      }
    }

    for (const job of workingJobs) {
      const completed = window.confirm(`Bạn đã hoàn thành đơn hàng ${job.code} chưa?`);
      if (completed) {
        needSync = true;
        const nowStr = new Date().toISOString();
        nextOrders = nextOrders.map(o => {
          if (o.id !== job.id) return o;
          const updatedLogs = (o.historyLogs || []).map((log: any) => 
            log.step === o.step ? { ...log, completedAt: log.completedAt || nowStr } : log
          );
          return {
            ...o,
            workStatus: "pending_confirmation",
            progressPercent: 100,
            historyLogs: updatedLogs
          };
        });
      }
    }

    for (const task of assignedWarranty) {
      const accept = window.confirm(`Bạn có muốn nhận việc bảo hành ${task.code} không?`);
      if (accept) {
        needSync = true;
        nextWarrantyTasks = nextWarrantyTasks.map((item) => (item.id === task.id ? { ...item, status: "working" } : item));
      }
    }

    for (const task of workingWarranty) {
      const completed = window.confirm(`Bạn đã hoàn thành công việc bảo hành ${task.code} chưa?`);
      if (completed) {
        try {
          await fetch("/api/report-done", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ warrantyTaskId: task.id, workerName: currentAccount.displayName })
          });
          await fetchRuntimeData(currentAccount.id);
        } catch {}
      }
    }

    if (needSync) {
      setSubmitting(true);
      setMessage("Đang cập nhật trạng thái đơn hàng...");
      try {
        const response = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: nextOrders, warrantyTasks: nextWarrantyTasks })
      });
      if (response.ok) {
        setOrders(nextOrders);
        setWarrantyTasks(nextWarrantyTasks);
        setMessage("Đã cập nhật trạng thái đơn hàng thành công.");
        } else {
          setMessage("Không đồng bộ được trạng thái đơn hàng.");
        }
      } catch (err) {
        setMessage("Lỗi kết nối khi cập nhật đơn hàng.");
      } finally {
        setSubmitting(false);
      }
    }

    fileInputRef.current?.click();
  }

  const todayStatusText = useMemo(() => {
    if (!currentAccount) return "Chưa đăng nhập";
    return attendanceSlots
      .map((slot) => {
        const key = `${currentAccount.id}-${currentTime.getDate()}-${slot}`;
        const kind = attendance[key];
        if (kind === "normal") return `${slot}: Đã chấm`;
        if (kind === "compensated") return `${slot}: Công bù`;
        if (kind === "leave_locked") return `${slot}: Nghỉ`;
        return `${slot}: Chưa chấm`;
      })
      .join(" • ");
  }, [attendance, currentAccount, currentTime]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-5">
        <header className="rounded-2xl bg-slate-950 px-4 py-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-orange-300">GOMITA</div>
              <h1 className="mt-1 text-xl font-black">Web iPhone</h1>
            </div>
            {currentAccount ? (
              <button
                className="rounded-full border border-white/20 px-3 py-2 text-xs font-bold text-white"
                onClick={logout}
                type="button"
              >
                Đăng xuất
              </button>
            ) : null}
          </div>
          <div className="mt-4 text-3xl font-black">
            {currentTime.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <div className="mt-1 text-sm text-slate-300">
            {currentTime.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
          </div>
        </header>

        {!currentAccount ? (
          <form className="mt-4 rounded-2xl bg-white p-4 shadow-sm" onSubmit={handleLogin}>
            <h2 className="text-lg font-black">Đăng nhập chấm công</h2>
            <div className="mt-3 grid gap-3">
              <input
                autoCapitalize="none"
                autoComplete="username"
                className="h-12 rounded-xl border border-slate-200 px-4 outline-none focus:border-orange-400"
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Tên đăng nhập"
                value={username}
              />
              <input
                autoComplete="current-password"
                className="h-12 rounded-xl border border-slate-200 px-4 outline-none focus:border-orange-400"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mật khẩu"
                type="password"
                value={password}
              />
              <button
                className="h-12 rounded-xl bg-orange-500 font-black text-white disabled:opacity-60"
                disabled={submitting || !username.trim() || !password.trim()}
                type="submit"
              >
                {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-500">{message}</p>
          </form>
        ) : (
          <>
            <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Nhân sự</div>
                  <h2 className="mt-1 text-xl font-black">{currentAccount.displayName}</h2>
                  <div className="mt-1 text-sm font-semibold text-slate-500">
                    {currentAccount.employeeCode || "Chưa có mã NV"} • {currentAccount.department}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-100 px-3 py-2 text-right">
                  <div className="text-xs font-bold text-slate-500">Đã chấm</div>
                  <div className="text-lg font-black text-slate-900">
                    {currentAttendanceStats.workedSlots}/{currentAttendanceStats.totalSlots}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm font-black text-slate-800">
                  {isHoliday
                    ? "Hôm nay là ngày nghỉ hoặc ngày lễ. Chỉ dùng để xem công."
                    : activeSlot
                      ? `Đang trong giờ chấm công mốc ${activeSlot}.`
                      : "Hiện không nằm trong khung giờ chấm công."}
                </div>
                <div className="mt-2 text-xs font-semibold leading-5 text-slate-500">{todayStatusText}</div>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-800">Tài khoản</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      Đổi tên đăng nhập và mật khẩu của chính bạn khi cần.
                    </div>
                  </div>
                  <button
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"
                    onClick={() => setAccountEditorOpen((current) => !current)}
                    type="button"
                  >
                    {accountEditorOpen ? "Ẩn đổi mật khẩu" : "Đổi tài khoản"}
                  </button>
                </div>
                {accountEditorOpen ? (
                  <div className="mt-3 grid gap-3">
                    <input
                      autoCapitalize="none"
                      autoCorrect="off"
                      className="h-11 rounded-xl border border-slate-200 bg-white px-4 outline-none focus:border-orange-400"
                      onChange={(event) => setAccountUsername(event.target.value)}
                      placeholder="Tên đăng nhập mới"
                      value={accountUsername}
                    />
                    <input
                      autoCapitalize="none"
                      autoCorrect="off"
                      className="h-11 rounded-xl border border-slate-200 bg-white px-4 outline-none focus:border-orange-400"
                      onChange={(event) => setAccountPassword(event.target.value)}
                      placeholder="Mật khẩu mới"
                      type="password"
                      value={accountPassword}
                    />
                    <input
                      autoCapitalize="none"
                      autoCorrect="off"
                      className="h-11 rounded-xl border border-slate-200 bg-white px-4 outline-none focus:border-orange-400"
                      onChange={(event) => setAccountPasswordConfirm(event.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      type="password"
                      value={accountPasswordConfirm}
                    />
                    <button
                      className="h-11 rounded-xl bg-slate-900 font-black text-white disabled:opacity-60"
                      disabled={submitting || !accountUsername.trim() || !accountPassword.trim() || !accountPasswordConfirm.trim()}
                      onClick={saveAccountCredentialsLean}
                      type="button"
                    >
                      Lưu tài khoản
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-800">Thông báo</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      Nhận thông báo giao việc mới, duyệt tăng ca và chấm công bù ngay trên điện thoại.
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-black ${pushEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                    {pushEnabled ? "Đang bật" : "Chưa bật"}
                  </span>
                </div>
                <div className="mt-3 flex gap-3">
                  <button
                    className="h-11 flex-1 rounded-xl bg-orange-500 font-black text-white disabled:opacity-60"
                    disabled={!pushSupported || pushBusy || pushEnabled}
                    onClick={enablePushNotifications}
                    type="button"
                  >
                    {pushBusy && !pushEnabled ? "Đang bật..." : "Bật thông báo"}
                  </button>
                  <button
                    className="h-11 flex-1 rounded-xl border border-slate-200 bg-white font-black text-slate-700 disabled:opacity-60"
                    disabled={!pushSupported || pushBusy || !pushEnabled}
                    onClick={disablePushNotifications}
                    type="button"
                  >
                    {pushBusy && pushEnabled ? "Đang tắt..." : "Tắt thông báo"}
                  </button>
                </div>
                {!pushSupported ? (
                  <p className="mt-2 text-xs font-semibold text-amber-600">
                    Trình duyệt hiện tại chưa hỗ trợ Web Push. Dùng Safari đã thêm ra màn hình chính hoặc Chrome Android.
                  </p>
                ) : null}
              </div>
              <div className="mt-4">
                <label className="block text-sm font-black text-slate-800">Chụp ảnh chấm công</label>
                <input
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  disabled={submitting || isHoliday || !activeSlot}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void submitClockinLean(file);
                    }
                  }}
                  ref={fileInputRef}
                  type="file"
                />
                <button
                  className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting || isHoliday || !activeSlot}
                  onClick={handleClockInButtonClick}
                  type="button"
                >
                  {submitting ? "Đang gửi chấm công..." : "Chụp ảnh chấm công"}
                </button>
                <input
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-500"
                  disabled
                  type="text"
                  value={activeSlot ? `Sẵn sàng chụp cho mốc ${activeSlot}` : "Hiện không có mốc chấm công mở"}
                />
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  Dùng Safari trên iPhone để chụp ảnh trực tiếp. Hệ thống sẽ lấy GPS cùng lúc.
                </p>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-500">{message}</p>
            </section>

            {/* THU NHẬP DỰ TÍNH TRONG THÁNG */}
            <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <CircleDollarSign className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-black text-slate-800">Thu nhập dự tính trong tháng</h2>
              </div>

              <div className="mt-4 text-center">
                <div className="text-3xl font-black text-slate-900">
                  {Math.round(estimatedIncome).toLocaleString("vi-VN")} đ
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-400">
                  {salaryType === "monthly" ? "Lương tháng cố định" : "Cập nhật tăng tiền ngay lập tức khi chấm công thành công"}
                </div>
              </div>

              <div className="mt-5 space-y-3 text-sm border-t border-slate-50 pt-3">
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-500">Lương cứng ({workDays} ngày):</span>
                  <span className="text-slate-800">{Math.round(basePay).toLocaleString("vi-VN")} đ</span>
                </div>

                {allowances && (
                  <>
                    {/* Phụ cấp ăn trưa */}
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-500">Phụ cấp ăn trưa:</span>
                      <span className="text-slate-800">{Math.round(allowances.mealAllowance).toLocaleString("vi-VN")} đ</span>
                    </div>
                    {!allowances.hasMealOverride && (
                      <div className="pl-3 text-xs text-slate-500 space-y-1">
                        {allowances.calcFullDays - allowances.calcSiteFullDays > 0 && (
                          <div>• Ăn trưa xưởng: {allowances.calcFullDays - allowances.calcSiteFullDays} ngày × {allowances.lunchDailyRate.toLocaleString("vi-VN")}đ</div>
                        )}
                        {allowances.calcSiteFullDays > 0 && (
                          <div>• Ăn trưa công trình: {allowances.calcSiteFullDays} ngày × {allowances.siteLunchDailyRate.toLocaleString("vi-VN")}đ</div>
                        )}
                      </div>
                    )}

                    {/* Phụ cấp đi công trình */}
                    <div className="flex justify-between font-semibold mt-2">
                      <span className="text-slate-500">Phụ cấp đi công trình:</span>
                      <span className="text-slate-800">{Math.round(allowances.siteAllowance).toLocaleString("vi-VN")} đ</span>
                    </div>
                    {!allowances.hasSiteOverride && allowances.calcSiteDays > 0 && (
                      <div className="pl-3 text-xs text-slate-500 space-y-1">
                        <div>• Chi tiết: {allowances.calcSiteFullDays} ngày cả ca | {allowances.calcSiteHalfDays} ngày nửa ca</div>
                        <div>• Xăng xe: {allowances.calcSiteDays} ngày × {allowances.siteFuelDailyRate.toLocaleString("vi-VN")}đ</div>
                        <div>• Nước uống: {allowances.calcSiteDays} ngày × {allowances.siteWaterDailyRate.toLocaleString("vi-VN")}đ</div>
                      </div>
                    )}

                    {/* Phụ cấp trách nhiệm / Khác */}
                    {allowances.otherAllowance > 0 && (
                      <div className="flex justify-between font-semibold mt-2">
                        <span className="text-slate-500">Phụ cấp trách nhiệm / Khác:</span>
                        <span className="text-slate-800">{Math.round(allowances.otherAllowance).toLocaleString("vi-VN")} đ</span>
                      </div>
                    )}
                  </>
                )}

                {otPay > 0 && (
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-500">Tăng ca ({otHours} giờ):</span>
                    <span className="text-slate-800">{Math.round(otPay).toLocaleString("vi-VN")} đ</span>
                  </div>
                )}
              </div>
            </section>

            <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Bảng công tháng này</h2>
                <div className="text-xs font-bold text-slate-400">
                  Tháng {currentTime.getMonth() + 1}/{currentTime.getFullYear()}
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <div
                  className="grid min-w-[720px] border border-slate-200 bg-slate-50 text-xs font-bold text-slate-600"
                  style={{ gridTemplateColumns: `90px repeat(${monthDays.length}, 1fr)` }}
                >
                  <div className="border-b border-r border-slate-200 bg-white px-2 py-2">Mốc giờ</div>
                  {monthDays.map((day) => (
                    <div key={day} className="border-b border-r border-slate-200 px-1 py-2 text-center last:border-r-0">
                      {day}
                    </div>
                  ))}
                  {attendanceSlots.map((slot) => (
                    <>
                      <div key={`${slot}-label`} className="border-r border-slate-200 bg-white px-2 py-3 font-black text-slate-800">
                        {slot}
                      </div>
                      {monthDays.map((day) => {
                        const key = `${currentAccount.id}-${day}-${slot}`;
                        const kind = attendance[key];
                        const color =
                          kind === "normal"
                            ? "bg-emerald-500"
                            : kind === "compensated"
                              ? "bg-blue-500"
                              : kind === "leave_locked"
                                ? "bg-amber-400"
                                : "bg-slate-300";
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-center border-r border-t border-slate-200 px-1 py-3 last:border-r-0"
                          >
                            <span className={`h-3 w-3 rounded-full ${color}`} />
                          </div>
                        );
                      })}
                    </>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Đã chấm</span>
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-blue-500" /> Công bù</span>
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-400" /> Nghỉ</span>
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-slate-300" /> Chưa chấm</span>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
