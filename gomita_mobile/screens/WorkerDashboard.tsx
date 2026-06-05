import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  Dimensions,
  ActivityIndicator,
  TextInput
} from "react-native";
import { CameraView, Camera as ExpoCamera } from "expo-camera";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as Location from "expo-location";
import {
  LogOut, 
  CheckCircle2, 
  Camera, 
  Clock, 
  Calendar, 
  CircleDollarSign, 
  Briefcase,
  MapPin,
  MapPinned,
  CheckCircle
} from "lucide-react-native";
import { getApiUrl } from "../lib/api";
import { enqueuePendingAction, flushPendingActions } from "../lib/pendingQueue";

const slots = ["07:30", "11:30", "13:30", "17:30"];
const screenWidth = Dimensions.get("window").width;
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
  if (["Lắp đặt", "Nghiệm thu", "Bảo hành"].includes(step)) {
    return normalized.includes("installer") || normalized.includes("supervisor_lead") || normalized.includes("site_supervisor");
  }
  return false;
};

const isUserAssignedToOrder = (order: any, user: any) => {
  const userPos = user.positionIds || [];
  const name = user.displayName;
  const isStepMatched = isStepMatchingUserPosition(order.step, userPos);
  if (!isStepMatched) return false;

  if (order.step === "Sản xuất") {
    return (order.productionWorkerNames || []).includes(name) || order.productionWorkerName === name;
  }
  if (order.step === "Lắp đặt" || order.step === "Bảo hành" || order.step === "Nghiệm thu") {
    return (order.installerNames || []).includes(name) || order.installerName === name;
  }
  if (order.step === "Thiết kế") {
    return (order.designerNames || []).includes(name) || order.designerName === name;
  }
  if (order.step === "Ra file") {
    return (order.fileOperatorNames || []).includes(name) || order.fileOperatorName === name;
  }
  if (["Tiếp nhận", "Báo giá", "Hoàn công"].includes(order.step)) {
    const sales = order.saleName ? order.saleName.split(",").map((s: any) => s.trim()) : [];
    return sales.includes(name);
  }
  if (order.step === "Nghiệm thu") {
    return (order.supervisorNames || []).includes(name) || order.supervisorName === name;
  }
  return false;
};

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
      let morningChecked = false;
      let afternoonChecked = false;
      const checkedSlots = slots.filter((slot) => {
        const key = `${userId}-${dayNum}-${slot}`;
        if (attendance[key] === "normal" || attendance[key] === "compensated") {
          if (slot === "07:30" || slot === "11:30") morningChecked = true;
          if (slot === "13:30" || slot === "17:30") afternoonChecked = true;
          return true;
        }
        return false;
      });
      if (checkedSlots.length === 0) return;
      const activeSiteSlots = new Set<string>();

      const matchedAssignments = orders.reduce<Array<{ code: string; step: string }>>((list, order) => {
        const currentStepIsSiteWork = siteWorkSteps.includes(order.step as (typeof siteWorkSteps)[number]) || !!order.isFieldWork;
        if (currentStepIsSiteWork) {
          const currentAssignees = getOrderAssigneesForStep(order, order.step);
          const assignedDate = order.assignedInstallerDate || order.deploymentStartTime?.slice(0, 10);
          if (currentAssignees.includes(displayName) && assignedDate && assignedDate <= dateStr) {
            list.push({ code: order.code, step: order.step });
            checkedSlots.forEach((slot) => {
              if (order.deploymentStartTime && dateStr === order.deploymentStartTime.slice(0, 10)) {
                const slotTime = new Date(`${dateStr}T${slot}:00`);
                if (slotTime < new Date(order.deploymentStartTime)) return;
              }
              activeSiteSlots.add(slot);
            });
          }
        }

        (order.historyLogs || []).forEach((log: any) => {
          if (
            order.step === log.step &&
            order.workStatus === "scheduled" &&
            order.deploymentStartTime &&
            new Date(order.deploymentStartTime) > new Date()
          ) {
            return;
          }
          const logIsSiteWork = siteWorkSteps.includes(log.step as (typeof siteWorkSteps)[number]) || !!order.isFieldWork;
          if (!logIsSiteWork) return;
          const assignees = getOrderAssigneesForStep(order, log.step);
          const finalAssignees = assignees.length ? assignees : [log.assignee].filter(Boolean);
          if (!finalAssignees.includes(displayName)) return;
          const start = log.acceptedAt || log.startedAt;
          if (!start) return;
          const startDateText = start.substring(0, 10);
          const endDateText = log.completedAt ? log.completedAt.substring(0, 10) : startDateText;
          if (dateStr >= startDateText && dateStr <= endDateText) {
            list.push({ code: order.code, step: log.step });
            checkedSlots.forEach((slot) => {
              const slotTime = new Date(`${dateStr}T${slot}:00`);
              if (dateStr === startDateText && slotTime < new Date(start)) return;
              if (log.completedAt && dateStr === endDateText && slotTime > new Date(log.completedAt)) return;
              activeSiteSlots.add(slot);
            });
          }
        });

        return list;
      }, []);

      const matchedWarrantyTasks = warrantyTasks.filter((task: any) => {
        if (task.assigneeId !== userId && task.assigneeName !== displayName) return false;
        const startDateText = (task.startAt || "").slice(0, 10);
        if (!startDateText || startDateText > dateStr) return false;
        checkedSlots.forEach((slot) => {
          const slotTime = new Date(`${dateStr}T${slot}:00`);
          if (task.startAt && dateStr === startDateText && slotTime < new Date(task.startAt)) return;
          activeSiteSlots.add(slot);
        });
        return true;
      });

      if (matchedAssignments.length === 0 && matchedWarrantyTasks.length === 0) return;

      if (activeSiteSlots.size === 0) return;

      const isSiteFullDay = ["07:30", "11:30"].some((slot) => activeSiteSlots.has(slot))
        && ["13:30", "17:30"].some((slot) => activeSiteSlots.has(slot));
      calcSiteDays += 1;
      if (isSiteFullDay) {
        calcSiteFullDays += 1;
      }
      siteDayDetails.push({
        date: dateStr,
        label: `Ngày ${dayNum}/${day.getMonth() + 1}`,
        workedSlots: checkedSlots.length,
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

export function WorkerDashboard({ 
  user, 
  serverIp, 
  apiData, 
  onLogout,
  onUserChange,
  onRefresh
}: { 
  user: any; 
  serverIp: string; 
  apiData: any; 
  onLogout: () => void;
  onUserChange: (user: any) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  
  // Camera & GPS State
  const [showCamera, setShowCamera] = useState(false);
  const [cameraType, setCameraType] = useState<any>(null);
  const [cameraRef, setCameraRef] = useState<any>(null);
  const [gpsCoords, setGpsCoords] = useState<string | null>(null);
  const [gpsAddress, setGpsAddress] = useState<string | null>(null);
  const [gpsMeta, setGpsMeta] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [attendanceOverrides, setAttendanceOverrides] = useState<Record<string, string>>({});

  // UX Hỏi tiến độ thông minh State
  const [askModalOpen, setAskModalOpen] = useState(false);
  const [activeJobToReport, setActiveJobToReport] = useState<any | null>(null);

  // Đồng hồ thời gian thực di động
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  // Lấy mốc giờ chấm công hiện tại
  const currentSlot = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentVal = currentHour * 60 + currentMin;

    if (currentVal >= 7 * 60 + 15 && currentVal <= 8 * 60 + 30) return "07:30";
    if (currentVal >= 11 * 60 + 15 && currentVal <= 12 * 60 + 30) return "11:30";
    if (currentVal >= 13 * 60 + 15 && currentVal <= 14 * 60 + 30) return "13:30";
    if (currentVal >= 17 * 60 + 15 && currentVal <= 18 * 60 + 30) return "17:30";
    return "07:30"; // Mặc định hiển thị mốc 07:30 nếu ngoài giờ
  }, [currentTime]);

  // Trạng thái Chấm công bù di động
  const [compOpen, setCompOpen] = useState(false);
  const [compReason, setCompReason] = useState("");
  const [selectedCompSlots, setSelectedCompSlots] = useState<Array<{ date: string; slot: string }>>([]);
  const [otOpen, setOtOpen] = useState(false);
  const [otFrom, setOtFrom] = useState("18:00");
  const [otTo, setOtTo] = useState("20:00");
  const [otReason, setOtReason] = useState("");
  const [selectedOrderCode, setSelectedOrderCode] = useState("");
  const [accountUsername, setAccountUsername] = useState(user.username || "");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState("");
  const [accountEditorOpen, setAccountEditorOpen] = useState(false);

  useEffect(() => {
    setAccountUsername(user.username || "");
  }, [user.username]);

  const primaryPositionId = user.positionIds?.[0] || "";
  const canUseOvertimeCurrent = !overtimeHiddenPositionIds.includes(primaryPositionId);

  const monthDays = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => new Date(now.getFullYear(), now.getMonth(), index + 1));
  }, []);

  const effectiveAttendance = useMemo(() => {
    return {
      ...(apiData?.attendance || {}),
      ...attendanceOverrides
    };
  }, [apiData, attendanceOverrides]);

  const flushPendingQueue = useCallback(async () => {
    try {
      const result = await flushPendingActions(serverIp);
      if (result.processed > 0) {
        await onRefresh();
      }
    } catch (error) {
      console.warn("Lỗi đồng bộ nền:", error);
    }
  }, [onRefresh, serverIp]);

  const compensationState = apiData?.attendanceCompensationState?.[user.id] || null;
  const lockedThroughDate = compensationState?.lockedThroughDate || null;

  const toDateString = useCallback((day: Date) => {
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  }, []);

  const hasPendingCompRequest = useCallback((date: string, slot: string) => {
    const requests = apiData?.compensationRequests || [];
    return requests.some((req: any) =>
      req.employeeId === user.id &&
      req.date === date &&
      Array.isArray(req.slots) &&
      req.slots.includes(slot) &&
      req.status !== "rejected"
    );
  }, [apiData, user.id]);

  const buildPromptableMissingSlots = useCallback((attendanceSource?: Record<string, string>) => {
    const source = attendanceSource || effectiveAttendance;
    const list: Array<{ date: string; slot: string; day: number; isIgnored: boolean }> = [];
    const currentDay = new Date().getDate();
    const currentSlotIndex = slots.indexOf(currentSlot);

    monthDays.forEach((day) => {
      const dayNum = day.getDate();
      if (day.getDay() === 0 || dayNum > currentDay) return;

      slots.forEach((slot) => {
        const date = toDateString(day);
        const slotIndex = slots.indexOf(slot);
        if (dayNum === currentDay && currentSlotIndex >= 0 && slotIndex >= currentSlotIndex) return;
        const key = `${user.id}-${dayNum}-${slot}`;
        const value = source[key];
        const isLocked = Boolean(lockedThroughDate && date <= lockedThroughDate);
        const isPending = hasPendingCompRequest(date, slot);

        if (value === "normal" || value === "compensated" || value === "leave_locked" || isPending) return;

        list.push({
          date,
          slot,
          day: dayNum,
          isIgnored: isLocked
        });
      });
    });

    return list;
  }, [currentSlot, effectiveAttendance, hasPendingCompRequest, lockedThroughDate, monthDays, toDateString, user.id]);

  const missingSlots = useMemo(() => buildPromptableMissingSlots(), [buildPromptableMissingSlots]);

  useEffect(() => {
    void flushPendingQueue();
    const timer = setInterval(() => {
      void flushPendingQueue();
    }, 12000);
    return () => clearInterval(timer);
  }, [flushPendingQueue]);

  const uniqueMissingDays = useMemo(() => {
    const daysMap = new Map<number, Date>();
    missingSlots.forEach((item) => {
      if (item.isIgnored) return;
      const day = monthDays.find((entry) => entry.getDate() === item.day);
      if (day) {
        daysMap.set(item.day, day);
      }
    });
    return Array.from(daysMap.values()).sort((a, b) => a.getDate() - b.getDate());
  }, [missingSlots, monthDays]);

  // Hàm gửi đơn chấm công bù lên GOMITA API Server từ di động
  const submitCompensations = async () => {
    if (selectedCompSlots.length === 0 || !compReason.trim()) return;

    setLoading(true);
    try {
      const grouped: Record<string, string[]> = {};
      selectedCompSlots.forEach(item => {
        if (!grouped[item.date]) {
          grouped[item.date] = [];
        }
        grouped[item.date].push(item.slot);
      });

      const submissionSize = selectedCompSlots.length;
      let requiredApprovals = ["hr"];
      if (submissionSize > 8) {
        requiredApprovals = ["hr", "department_manager", "director"];
      } else if (submissionSize >= 4) {
        requiredApprovals = ["hr", "department_manager"];
      }

      const groupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const existingReqs = apiData && apiData.compensationRequests ? apiData.compensationRequests : [];

      const newRequests = Object.entries(grouped).map(([date, slots], idx) => {
        return {
          id: `comp-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
          groupId,
          employeeId: user.id,
          employeeName: user.displayName,
          employeePositionLevel: user.positionIds.includes("hr") ? "department_head" : "staff",
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

      const url = getApiUrl(serverIp, "/api/sync");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compensationRequests: [...newRequests, ...existingReqs]
        })
      });

      const resJson = await res.json();
      if (resJson.success) {
        await fetch(getApiUrl(serverIp, "/api/attendance-compensation-response"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            decision: "reset"
          })
        }).catch(() => {});

        setCompOpen(false);
        setSelectedCompSlots([]);
        setCompReason("");
        await onRefresh();

        let approvalText = "Nhân sự xác nhận";
        if (submissionSize > 8) {
          approvalText = "Nhân sự, Quản lý và Giám đốc xác nhận";
        } else if (submissionSize >= 4) {
          approvalText = "Nhân sự và Quản lý xác nhận";
        }

        Alert.alert(
          "Gửi đơn chấm công bù thành công! 🎉",
          `● Số mốc đăng ký bù: ${submissionSize} mốc\n` +
          `● Cấp phê duyệt cần thiết: ${approvalText}\n\n` +
          `Yêu cầu đã được gửi lên hệ thống và đang chờ phê duyệt.`
        );
      } else {
        Alert.alert("Lỗi", "Gửi yêu cầu chấm công bù thất bại!");
      }
    } catch (err) {
      console.warn("Lỗi gửi chấm công bù:", err);
      Alert.alert("Lỗi kết nối", "Không thể kết nối API Server để lưu yêu cầu chấm công bù!");
    } finally {
      setLoading(false);
    }
  };

  const saveAccountCredentials = async () => {
    const nextUsername = accountUsername.trim().toLowerCase();
    const nextPassword = accountPassword.trim();
    const confirmPassword = accountPasswordConfirm.trim();

    if (!nextUsername) {
      Alert.alert("Thiếu thông tin", "Tên đăng nhập không được để trống.");
      return;
    }

    if (!nextPassword) {
      Alert.alert("Thiếu thông tin", "Mật khẩu mới không được để trống.");
      return;
    }

    if (nextPassword !== confirmPassword) {
      Alert.alert("Không khớp", "Mật khẩu nhập lại không khớp.");
      return;
    }

    const accounts = Array.isArray(apiData?.accounts) ? apiData.accounts : [];
    const hasDuplicate = accounts.some(
      (account: any) => account.id !== user.id && String(account.username || "").trim().toLowerCase() === nextUsername
    );

    if (hasDuplicate) {
      Alert.alert("Trùng tên đăng nhập", "Tên đăng nhập này đã có người dùng khác.");
      return;
    }

    setLoading(true);
    try {
      const nextAccounts = accounts.map((account: any) =>
        account.id === user.id
          ? { ...account, username: nextUsername, password: nextPassword }
          : account
      );

      const response = await fetch(getApiUrl(serverIp, "/api/sync"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts: nextAccounts })
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        Alert.alert("Lỗi", result?.error || "Không lưu được tài khoản.");
        return;
      }

      const nextUser = nextAccounts.find((account: any) => account.id === user.id) || {
        ...user,
        username: nextUsername,
        password: nextPassword
      };

      await onUserChange(nextUser);
      setAccountPassword("");
      setAccountPasswordConfirm("");
      Alert.alert("Thành công", "Đã cập nhật tên đăng nhập và mật khẩu.");
    } catch (error) {
      Alert.alert("Lỗi kết nối", error instanceof Error ? error.message : "Không lưu được tài khoản.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Xin quyền Camera và Định vị
    async function requestPermissions() {
      const cameraStatus = await ExpoCamera.requestCameraPermissionsAsync();
      setCameraPermission(cameraStatus.status === "granted");
      setCameraType("front");

      const locationStatus = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(locationStatus.status === "granted");
    }
    requestPermissions();

    // Chạy đồng hồ
    function updateTime() {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      setCurrentTime(`${hh}:${mm}:${ss}`);

      const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
      const dd = String(now.getDate()).padStart(2, "0");
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const yr = now.getFullYear();
      setCurrentDate(`${days[now.getDay()]}, ${dd}/${mo}/${yr}`);
    }
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);



  const todayDateString = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, [currentDate]);

  const isAttendanceBlockedDay = useMemo(() => {
    const now = new Date();
    if (now.getDay() === 0) return true;
    const blockedDates = Array.isArray(apiData?.holidayDates) ? apiData.holidayDates : [];
    return blockedDates.includes(todayDateString);
  }, [apiData, todayDateString]);

  const isSlotCurrentlyOpen = useMemo(() => {
    if (isAttendanceBlockedDay) return false;
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentVal = currentHour * 60 + currentMin;

    if (currentVal >= 7 * 60 + 15 && currentVal <= 8 * 60 + 30) return true;
    if (currentVal >= 11 * 60 + 15 && currentVal <= 12 * 60 + 30) return true;
    if (currentVal >= 13 * 60 + 15 && currentVal <= 14 * 60 + 30) return true;
    if (currentVal >= 17 * 60 + 15 && currentVal <= 18 * 60 + 30) return true;
    return false;
  }, [currentTime, isAttendanceBlockedDay]);

  const today = new Date().getDate();

  // Tính toán Ngày công, OT và Lương di động
  const userAttendanceKeys = useMemo(() => {
    return Object.keys(effectiveAttendance).filter(k => k.startsWith(user.id + "-"));
  }, [effectiveAttendance, user.id]);

  const hasClockedInCurrentSlot = useMemo(() => {
    const key = `${user.id}-${today}-${currentSlot}`;
    return effectiveAttendance[key] === "normal" || effectiveAttendance[key] === "compensated";
  }, [effectiveAttendance, user.id, today, currentSlot]);

  const maxWorkDays = useMemo(() => {
    return monthDays.filter((day) => day.getDay() !== 0).length;
  }, [monthDays]);

  const expectedDays = useMemo(() => {
    return monthDays.filter((day) => day.getDay() !== 0 && day.getDate() <= today).length;
  }, [monthDays, today]);

  const workDays = useMemo(() => {
    let total = 0;
    monthDays.forEach((day) => {
      if (day.getDay() === 0 || day.getDate() > today) return;
      const dayNum = day.getDate();
      let checkedCount = 0;
      slots.forEach((slot) => {
        const key = `${user.id}-${dayNum}-${slot}`;
        if (effectiveAttendance[key] === "normal" || effectiveAttendance[key] === "compensated") {
          checkedCount++;
        }
      });
      if (checkedCount === 4) total += 1.0;
      else if (checkedCount >= 2) total += 0.5;
    });
    return total;
  }, [effectiveAttendance, monthDays, user.id, today]);

  const otHours = useMemo(() => {
    if (!canUseOvertimeCurrent || !apiData || !apiData.overtimeRequests) return 0;
    const now = new Date();
    return apiData.overtimeRequests
      .filter((req: any) => 
        req.userId === user.id && 
        req.status === "approved" &&
        new Date(req.createdAt).getMonth() === now.getMonth()
      )
      .reduce((sum: number, req: any) => sum + (Number(req.hours) || 0), 0);
  }, [apiData, canUseOvertimeCurrent, user.id]);

  const salaryType = user.salaryType ?? "daily";
  const salaryValue = user.salaryValue ?? (user.positionIds.includes("hr") ? 420000 : user.positionIds.includes("accountant") ? 400000 : 350000);

  const isWorker = useMemo(() => {
    return (user.positionIds || []).some((p: string) => ["production_worker", "installer"].includes(p));
  }, [user.positionIds]);

  const allowances = useMemo(() => {
    return calculateUserAllowances(
      user.id, 
      user.displayName, 
      monthDays, 
      effectiveAttendance, 
      apiData?.orders || [], 
      apiData?.warrantyTasks || [],
      apiData?.workerAllowances || {},
      isWorker
    );
  }, [isWorker, user.id, user.displayName, monthDays, effectiveAttendance, apiData?.orders, apiData?.warrantyTasks, apiData?.workerAllowances]);

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

  const otPay = useMemo(() => {
    return otHours * 1.5 * hourlySalaryRate;
  }, [hourlySalaryRate, otHours]);

  const estimatedIncome = useMemo(() => {
    return basePay + otPay + allowances.totalAllowance;
  }, [basePay, otPay, allowances]);

  // Lọc công việc đang được giao của thợ hôm nay
  const activeJobs = useMemo(() => {
    const orderJobs = (apiData?.orders || []).filter((order: any) => {
      return isUserAssignedToOrder(order, user) && order.workStatus === "working";
    });
    const warrantyJobs = (apiData?.warrantyTasks || []).filter((task: any) =>
      task.assigneeId === user.id && ["assigned", "working", "pending_confirmation"].includes(task.status)
    );
    return [...warrantyJobs, ...orderJobs];
  }, [apiData, user]);

  const assignedOrders = useMemo(() => {
    const orderJobs = (apiData?.orders || []).filter((order: any) => {
      return isUserAssignedToOrder(order, user);
    });
    const warrantyJobs = (apiData?.warrantyTasks || []).filter((task: any) => task.assigneeId === user.id);
    return [...warrantyJobs, ...orderJobs];
  }, [apiData, user]);

  useEffect(() => {
    const overtimeEligibleOrders = assignedOrders.filter((item: any) => item.kind !== "warranty_task");
    if (!selectedOrderCode && overtimeEligibleOrders.length > 0) {
      setSelectedOrderCode(overtimeEligibleOrders[0].code || "");
    }
  }, [assignedOrders, selectedOrderCode]);

  const handleDeclineCompensation = useCallback(async (pendingSlots: Array<{ date: string; slot: string; day: number; isIgnored: boolean }>) => {
    try {
      const response = await fetch(getApiUrl(serverIp, "/api/attendance-compensation-response"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          decision: "decline",
          pendingSlots: pendingSlots.map((item) => ({
            date: item.date,
            slot: item.slot,
            day: item.day
          }))
        })
      });

      const payload = await response.json();
      await onRefresh();

      if (payload?.locked) {
        Alert.alert("Đã khóa các mốc thiếu công", "Các mốc cần chấm công bù trước đó đã được chốt là nghỉ. Bộ đếm cho đợt thiếu công tiếp theo đã được làm mới.");
        return;
      }

      const nextDeclineCount = payload?.state?.declineCount || 0;
      Alert.alert("Đã ghi nhận", `Hệ thống đã lưu lựa chọn không chấm công bù. Lần từ chối hiện tại: ${nextDeclineCount}/5.`);
    } catch (error) {
      console.warn("Lỗi lưu từ chối chấm công bù:", error);
      Alert.alert("Lỗi kết nối", "Không thể lưu lựa chọn không chấm công bù.");
    }
  }, [onRefresh, serverIp, user.id]);

  const promptCompensationIfNeeded = useCallback((attendanceSource?: Record<string, string>) => {
    const pendingSlots = buildPromptableMissingSlots(attendanceSource).filter((item) => !item.isIgnored);
    if (pendingSlots.length === 0) return;

    Alert.alert(
      "Thiếu công cần xử lý",
      `Bạn đang còn ${pendingSlots.length} mốc thiếu công. Bạn có muốn đăng ký chấm công bù không?`,
      [
        {
          text: "Không",
          style: "cancel",
          onPress: () => {
            void handleDeclineCompensation(pendingSlots);
          }
        },
        {
          text: "Có",
          onPress: () => {
            setSelectedCompSlots([]);
            setCompOpen(true);
          }
        }
      ]
    );
  }, [buildPromptableMissingSlots, handleDeclineCompensation]);

  const showClockinResult = useCallback((title: string, message: string, attendanceSource?: Record<string, string>) => {
    const pendingSlots = buildPromptableMissingSlots(attendanceSource).filter((item) => !item.isIgnored);
    if (pendingSlots.length === 0) {
      Alert.alert(title, message);
      return;
    }

    Alert.alert(
      title,
      `${message}\n\nBạn đang còn ${pendingSlots.length} mốc thiếu công. Bạn có muốn đăng ký chấm công bù không?`,
      [
        {
          text: "Không",
          style: "cancel",
          onPress: () => {
            void handleDeclineCompensation(pendingSlots);
          }
        },
        {
          text: "Có",
          onPress: () => {
            setSelectedCompSlots([]);
            setCompOpen(true);
          }
        }
      ]
    );
  }, [buildPromptableMissingSlots, handleDeclineCompensation]);

  const submitOvertimeRequest = useCallback(async () => {
    const [fromHour, fromMinute] = otFrom.split(":").map(Number);
    const [toHour, toMinute] = otTo.split(":").map(Number);
    let diffMinutes = (toHour * 60 + toMinute) - (fromHour * 60 + fromMinute);
    if (diffMinutes < 0) diffMinutes += 24 * 60;
    const hours = diffMinutes / 60;

    if (!otReason.trim()) {
      Alert.alert("Thiếu thông tin", "Bạn cần nhập lý do tăng ca.");
      return;
    }
    if (!selectedOrderCode) {
      Alert.alert("Thiếu đơn hàng", "Bạn cần chọn đơn hàng tăng ca.");
      return;
    }

    setLoading(true);
    try {
      const existingRequests = apiData?.overtimeRequests || [];
      const nextRequest = {
        id: `ot-${Date.now()}`,
        userId: user.id,
        userDisplayName: user.displayName,
        from: otFrom,
        to: otTo,
        hours,
        orderCode: selectedOrderCode,
        reason: otReason.trim(),
        status: "approved",
        createdAt: new Date().toISOString()
      };

      const response = await fetch(getApiUrl(serverIp, "/api/sync"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overtimeRequests: [nextRequest, ...existingRequests]
        })
      });

      const payload = await response.json();
      if (!payload?.success) {
        Alert.alert("Lỗi", "Không gửi được đăng ký tăng ca.");
        return;
      }

      setOtOpen(false);
      setOtReason("");
      setOtFrom("18:00");
      setOtTo("20:00");
      await onRefresh();
      Alert.alert("Đăng ký thành công", `Đã đăng ký tăng ca ${hours} giờ.`);
    } catch (error) {
      console.warn("Lỗi đăng ký tăng ca:", error);
      Alert.alert("Lỗi kết nối", "Không thể gửi đăng ký tăng ca.");
    } finally {
      setLoading(false);
    }
  }, [apiData, onRefresh, otFrom, otReason, otTo, selectedOrderCode, serverIp, user.displayName, user.id]);

  // NÚT CHẤM CÔNG DUY NHẤT CLICK
  const handleClockInPress = async () => {
    if (isAttendanceBlockedDay) {
      Alert.alert("Không thể chấm công", "Hôm nay là Chủ nhật hoặc ngày lễ/tết. Bạn chỉ có thể đăng ký tăng ca.");
      return;
    }

    if (hasClockedInCurrentSlot) {
      Alert.alert("Thông báo", `Bạn đã chấm công mốc ${currentSlot} hôm nay thành công rồi!`);
      return;
    }

    if (cameraPermission === false || locationPermission === false) {
      Alert.alert("Lỗi phân quyền", "Vui lòng cấp quyền Camera và GPS định vị trong cài đặt điện thoại để chấm công!");
      return;
    }

    const isFutureAssignedJob = (order: any) => Boolean(order.deploymentStartTime && new Date(order.deploymentStartTime) > new Date());

    const assignedOrders = (apiData?.orders || []).filter((order: any) => {
      return isUserAssignedToOrder(order, user) && !isFutureAssignedJob(order);
    });

    const unconfirmedJobs = assignedOrders.filter((o: any) => o.workStatus === "unconfirmed");
    const workingJobs = assignedOrders.filter((o: any) => o.workStatus === "working");

    let needSync = false;
    let nextOrders = [...(apiData?.orders || [])];

    const askUnconfirmed = async (index: number): Promise<void> => {
      if (index >= unconfirmedJobs.length) return;
      const job = unconfirmedJobs[index];
      return new Promise<void>((resolve) => {
        Alert.alert(
          "Tiếp nhận công việc",
          `Bạn có muốn tiếp nhận việc cho đơn hàng ${job.code} không?`,
          [
            {
              text: "Không",
              onPress: () => resolve(askUnconfirmed(index + 1))
            },
            {
              text: "Có",
              onPress: () => {
                needSync = true;
                const nowStr = new Date().toISOString();
                nextOrders = nextOrders.map((o: any) => {
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
                resolve(askUnconfirmed(index + 1));
              }
            }
          ]
        );
      });
    };

    const askWorking = async (index: number): Promise<void> => {
      if (index >= workingJobs.length) return;
      const job = workingJobs[index];
      return new Promise<void>((resolve) => {
        Alert.alert(
          "Hoàn thành công việc",
          `Bạn đã hoàn thành công việc của đơn hàng ${job.code} chưa?`,
          [
            {
              text: "Chưa",
              onPress: () => resolve(askWorking(index + 1))
            },
            {
              text: "Rồi",
              onPress: () => {
                needSync = true;
                const nowStr = new Date().toISOString();
                nextOrders = nextOrders.map((o: any) => {
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
                resolve(askWorking(index + 1));
              }
            }
          ]
        );
      });
    };

    await askUnconfirmed(0);
    await askWorking(0);

    if (needSync) {
      setLoading(true);
      try {
        const response = await fetch(getApiUrl(serverIp, "/api/sync"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orders: nextOrders })
        });
        if (response.ok) {
          await onRefresh();
        }
      } catch (err) {
        console.warn("Lỗi đồng bộ nhận/hoàn thành việc:", err);
      } finally {
        setLoading(false);
      }
    }

    await startCameraAndGps();
  };

  const startCameraAndGps = async () => {
    setLoading(true);
    try {
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coordsText = `${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)}`;
      let addressText = "Chưa xác định được địa chỉ";

      try {
        const geocoded = await Location.reverseGeocodeAsync(location.coords);
        const firstResult = geocoded[0];
        if (firstResult) {
          addressText = [
            firstResult.street,
            firstResult.district,
            firstResult.subregion,
            firstResult.region
          ].filter(Boolean).join(", ");
        }
      } catch (error) {
        console.warn("Lỗi đổi GPS sang địa chỉ:", error);
      }

      setGpsCoords(coordsText);
      setGpsAddress(addressText);
      setGpsMeta({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        address: addressText
      });
      setShowCamera(true);
    } catch (err) {
      console.warn("Lỗi GPS:", err);
      setGpsCoords("0.00000, 0.00000");
      setGpsAddress("Không lấy được địa chỉ GPS");
      setGpsMeta({
        lat: 0,
        lng: 0,
        address: "Không lấy được địa chỉ GPS"
      });
      setShowCamera(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerCompletion = async (isCompleted: boolean) => {
    setAskModalOpen(false);
    if (!activeJobToReport) return;

    setLoading(true);
    try {
      // Bật camera & lấy GPS
      await startCameraAndGps();
    } catch (err) {
      Alert.alert("Lỗi", "Không thể khởi động camera!");
    } finally {
      setLoading(false);
    }
  };

  const captureAndClockin = async () => {
    if (!cameraRef) return;
    setLoading(true);

    try {
      // Chụp ảnh selfie với tỉ lệ nén tối ưu (25%) để truyền tải dữ liệu nhanh và tiết kiệm dung lượng
      const photo = await cameraRef.takePictureAsync({ quality: 0.3, base64: false, skipProcessing: true });
      const compressedPhoto = await manipulateAsync(
        photo.uri,
        [{ resize: { width: 720 } }],
        { compress: 0.2, format: SaveFormat.JPEG, base64: true }
      );
      
      // Gửi chấm công lên API Server
      const url = getApiUrl(serverIp, "/api/clockin");
      const isCompleted = activeJobToReport && !askModalOpen; 
      
      const payload = {
        userId: user.id,
        date: today,
        slot: currentSlot,
        orderCode: activeJobToReport ? activeJobToReport.code : null,
        isCompleted: isCompleted, // Nếu có hỏi tiến độ
        photo: compressedPhoto.base64 ? `data:image/jpeg;base64,${compressedPhoto.base64}` : null,
        gps: gpsCoords,
        gpsAddress,
        gpsMeta,
        time: new Date().toISOString()
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const resJson = await res.json();
      if (resJson.success) {
        const currentKey = `${user.id}-${today}-${currentSlot}`;
        const nextAttendance = {
          ...effectiveAttendance,
          [currentKey]: "normal"
        };

        setAttendanceOverrides((current) => ({
          ...current,
          [currentKey]: "normal"
        }));
        setShowCamera(false);
        setActiveJobToReport(null);
        await onRefresh();
        Alert.alert(
          "Chấm công thành công! 🎉",
          `Hệ thống đã ghi nhận mốc ${currentSlot} ngày hôm nay lúc ${currentTime} của bạn.\n` +
          `● Vị trí GPS: ${gpsCoords}\n` +
          `● Khu vực: ${gpsAddress || "Chưa xác định"}\n` +
          `● Tiền lương tháng tạm tính đã được cập nhật!`
        );
        setTimeout(() => {
          promptCompensationIfNeeded(nextAttendance);
        }, 250);
      } else {
        Alert.alert("Lỗi", "Gửi dữ liệu chấm công thất bại!");
      }
    } catch (err) {
      console.warn("Lỗi chấm công:", err);
      Alert.alert("Lỗi kết nối", "Không thể kết nối đến máy chủ GOMITA API để lưu chấm công!");
    } finally {
      setLoading(false);
    }
  };

  // NÚT BÁO CÁO HOÀN THÀNH ĐỘC LẬP CLICK
  const submitCompensationsLean = async () => {
    if (selectedCompSlots.length === 0 || !compReason.trim()) return;

    const grouped: Record<string, string[]> = {};
    selectedCompSlots.forEach((item) => {
      if (!grouped[item.date]) grouped[item.date] = [];
      grouped[item.date].push(item.slot);
    });

    const payload = {
      userId: user.id,
      reason: compReason.trim(),
      items: Object.entries(grouped).map(([date, slotList]) => ({ date, slots: slotList }))
    };

    setLoading(true);
    try {
      const response = await fetch(getApiUrl(serverIp, "/api/compensation/request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Không gửi được yêu cầu chấm công bù.");
      }

      await fetch(getApiUrl(serverIp, "/api/attendance-compensation-response"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, decision: "reset" })
      }).catch(() => {});

      setCompOpen(false);
      setSelectedCompSlots([]);
      setCompReason("");
      await onRefresh();
      Alert.alert("Thành công", "Đã gửi yêu cầu chấm công bù.");
    } catch (error) {
      console.warn("Lỗi gửi chấm công bù:", error);
      await enqueuePendingAction({
        id: `pending-comp-${Date.now()}`,
        type: "compensation_request",
        payload
      });
      setCompOpen(false);
      setSelectedCompSlots([]);
      setCompReason("");
      Alert.alert("Đã lưu tạm", "Yêu cầu chấm công bù đã được lưu trên thiết bị để đồng bộ nền.");
    } finally {
      setLoading(false);
    }
  };

  const saveAccountCredentialsLean = async () => {
    const nextUsername = accountUsername.trim().toLowerCase();
    const nextPassword = accountPassword.trim();
    const confirmPassword = accountPasswordConfirm.trim();

    if (!nextUsername) {
      Alert.alert("Thiếu thông tin", "Tên đăng nhập không được để trống.");
      return;
    }
    if (!nextPassword) {
      Alert.alert("Thiếu thông tin", "Mật khẩu mới không được để trống.");
      return;
    }
    if (nextPassword !== confirmPassword) {
      Alert.alert("Không khớp", "Mật khẩu nhập lại không khớp.");
      return;
    }

    const usernameDirectory = Array.isArray(apiData?.usernameDirectory) ? apiData.usernameDirectory : [];
    const hasDuplicate = usernameDirectory.some(
      (account: any) => account.id !== user.id && String(account.username || "").trim().toLowerCase() === nextUsername
    );
    if (hasDuplicate) {
      Alert.alert("Trùng tên đăng nhập", "Tên đăng nhập này đã có người dùng khác.");
      return;
    }

    const payload = {
      userId: user.id,
      username: nextUsername,
      password: nextPassword
    };

    setLoading(true);
    try {
      const response = await fetch(getApiUrl(serverIp, "/api/account/self"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result?.account) {
        throw new Error(result?.error || "Không lưu được tài khoản.");
      }

      await onUserChange(result.account);
      setAccountPassword("");
      setAccountPasswordConfirm("");
      Alert.alert("Thành công", "Đã cập nhật tên đăng nhập và mật khẩu.");
    } catch (error) {
      console.warn("Lỗi cập nhật tài khoản:", error);
      await enqueuePendingAction({
        id: `pending-account-${Date.now()}`,
        type: "account_update",
        payload
      });
      setAccountPassword("");
      setAccountPasswordConfirm("");
      await onUserChange({ ...user, username: nextUsername, password: nextPassword });
      Alert.alert("Đã lưu tạm", "Thay đổi tài khoản đã được lưu trên thiết bị và sẽ tự đồng bộ lại.");
    } finally {
      setLoading(false);
    }
  };

  const submitOvertimeRequestLean = async () => {
    if (!canUseOvertimeCurrent) {
      Alert.alert("Không áp dụng", "Nhóm trưởng bộ phận không sử dụng chức năng tăng ca.");
      return;
    }
    if (!otReason.trim()) {
      Alert.alert("Thiếu thông tin", "Bạn cần nhập lý do tăng ca.");
      return;
    }
    if (!selectedOrderCode) {
      Alert.alert("Thiếu đơn hàng", "Bạn cần chọn đơn hàng tăng ca.");
      return;
    }

    const payload = {
      userId: user.id,
      from: otFrom,
      to: otTo,
      reason: otReason.trim(),
      orderCode: selectedOrderCode
    };

    setLoading(true);
    try {
      const response = await fetch(getApiUrl(serverIp, "/api/overtime/request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result?.request) {
        throw new Error(result?.error || "Không gửi được đăng ký tăng ca.");
      }

      setOtOpen(false);
      setOtReason("");
      setOtFrom("18:00");
      setOtTo("20:00");
      await onRefresh();
      Alert.alert("Đăng ký thành công", `Đã đăng ký tăng ca ${result.request.hours} giờ.`);
    } catch (error) {
      console.warn("Lỗi đăng ký tăng ca:", error);
      await enqueuePendingAction({
        id: `pending-ot-${Date.now()}`,
        type: "overtime_request",
        payload
      });
      setOtOpen(false);
      setOtReason("");
      setOtFrom("18:00");
      setOtTo("20:00");
      Alert.alert("Đã lưu tạm", "Đăng ký tăng ca đã được lưu trên thiết bị để đồng bộ nền.");
    } finally {
      setLoading(false);
    }
  };

  const captureAndClockinLean = useCallback(async () => {
    if (!cameraRef) return;
    setLoading(true);

    try {
      const photo = await cameraRef.takePictureAsync({ quality: 0.4, base64: false, skipProcessing: true });
      const compressedPhoto = await manipulateAsync(
        photo.uri,
        [{ resize: { width: 960 } }],
        { compress: 0.3, format: SaveFormat.JPEG, base64: true }
      );

      const photoData = compressedPhoto.base64 ? `data:image/jpeg;base64,${compressedPhoto.base64}` : "";
      const metadataPayload = {
        userId: user.id,
        date: today,
        slot: currentSlot,
        orderCode: activeJobToReport ? activeJobToReport.code : null,
        isCompleted: Boolean(activeJobToReport && !askModalOpen),
        gps: gpsCoords,
        gpsAddress,
        gpsMeta,
        time: new Date().toISOString()
      };

      const currentKey = `${user.id}-${today}-${currentSlot}`;
      const nextAttendance = { ...effectiveAttendance, [currentKey]: "normal" };
      const applyLocalClockin = async () => {
        setAttendanceOverrides((current) => ({ ...current, [currentKey]: "normal" }));
        setShowCamera(false);
        setActiveJobToReport(null);
      };

      try {
        const response = await fetch(getApiUrl(serverIp, "/api/clockin"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(metadataPayload)
        });
        const result = await response.json();
        if (!response.ok || !result?.success) {
          throw new Error(result?.error || "Không gửi được chấm công.");
        }

        await applyLocalClockin();
        if (photoData) {
          fetch(getApiUrl(serverIp, "/api/clockin-photo"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              date: today,
              slot: currentSlot,
              photo: photoData
            })
          }).catch(async () => {
            await enqueuePendingAction({
              id: `pending-photo-${Date.now()}`,
              type: "clockin_photo",
              payload: { userId: user.id, date: today, slot: currentSlot, photo: photoData }
            });
          });
        }
        await onRefresh();
        showClockinResult("Chấm công thành công", `Đã ghi nhận mốc ${currentSlot} lúc ${currentTime}.`, nextAttendance);
      } catch (error) {
        await enqueuePendingAction({
          id: `pending-clockin-${Date.now()}`,
          type: "clockin_record",
          payload: metadataPayload
        });
        if (photoData) {
          await enqueuePendingAction({
            id: `pending-photo-${Date.now()}-2`,
            type: "clockin_photo",
            payload: { userId: user.id, date: today, slot: currentSlot, photo: photoData }
          });
        }
        await applyLocalClockin();
        showClockinResult("Đã lưu tạm", "Chấm công đã được lưu trên thiết bị và sẽ tự đồng bộ lại khi server ổn định.", nextAttendance);
      }
    } catch (error) {
      console.warn("Lỗi chấm công:", error);
      Alert.alert("Lỗi", error instanceof Error ? error.message : "Không thể chụp ảnh chấm công.");
    } finally {
      setLoading(false);
    }
  }, [activeJobToReport, cameraRef, currentSlot, currentTime, effectiveAttendance, gpsAddress, gpsCoords, gpsMeta, onRefresh, serverIp, showClockinResult, today, user.id]);

  const handleReportDoneIndependent = async (job: any) => {
    Alert.alert(
      "Xác nhận báo xong",
      `Bạn có chắc chắn muốn báo cáo hoàn thành đơn hàng ${job.code} không?`,
      [
        { text: "Hủy bỏ", style: "cancel" },
        { 
          text: "Đồng ý", 
          onPress: async () => {
            setLoading(true);
            try {
              const url = getApiUrl(serverIp, "/api/report-done");
              const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                  job.kind === "warranty_task"
                    ? {
                        warrantyTaskId: job.id,
                        workerName: user.displayName
                      }
                    : {
                        orderCode: job.code,
                        workerName: user.displayName
                      }
                )
              });
              const resJson = await response.json();
              if (resJson.success) {
                await onRefresh();
                Alert.alert("Thành công!", `Đã báo cáo xong đơn ${job.code}. Đang chờ Giám sát hoặc Quản lý duyệt.`);
              } else {
                Alert.alert("Lỗi", "Báo cáo công việc thất bại!");
              }
            } catch (err) {
              Alert.alert("Lỗi kết nối", "Không thể kết nối API để cập nhật công việc.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.helloText}>Xin chào, {user.displayName} 👋</Text>
          <Text style={styles.positionText}>Bộ phận: {user.department}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <LogOut size={18} color="#f8fafc" />
        </TouchableOpacity>
      </View>

      {/* Realtime Clock Widget */}
      <View style={styles.clockCard}>
        <Text style={styles.clockTime}>{currentTime || "07:30:00"}</Text>
        <Text style={styles.clockDate}>{currentDate || "Đang kết nối..."}</Text>
        <View style={styles.shiftBadge}>
          <Clock size={14} color="#f97316" />
          <Text style={styles.shiftBadgeText}>Mốc chấm hiện tại: {currentSlot}</Text>
        </View>
        {canUseOvertimeCurrent ? (
          <TouchableOpacity style={styles.overtimeActionBtn} onPress={() => setOtOpen(true)}>
            <Text style={styles.overtimeActionText}>Đăng ký tăng ca</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* DUY NHẤT 1 NÚT CHẤM CÔNG LỚN */}
      <View style={styles.clockInCenter}>
        {isSlotCurrentlyOpen ? (
          hasClockedInCurrentSlot ? (
            <View style={styles.clockedInSuccessBadge}>
              <CheckCircle size={48} color="#22c55e" />
              <Text style={styles.clockedInSuccessText}>ĐÃ HOÀN THÀNH CHẤM CÔNG</Text>
              <Text style={styles.clockedInSuccessSub}>Chúc bạn một ngày làm việc vui vẻ và hiệu quả!</Text>
              
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.clockInButton, styles.clockInBtnBg]}
              onPress={handleClockInPress}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="large" color="#ffffff" />
              ) : (
                <View style={styles.centerBtnContent}>
                  <Camera size={44} color="#ffffff" />
                  <Text style={styles.clockInBtnText}>BẤM CHẤM CÔNG</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        ) : (
          <View style={styles.outsideSlotCard}>
            <Clock size={36} color="#94a3b8" />
            <Text style={styles.outsideSlotTitle}>{isAttendanceBlockedDay ? "Ngày nghỉ / ngày lễ" : "Ngoài khung giờ chấm công"}</Text>
            <Text style={styles.outsideSlotDesc}>
              {isAttendanceBlockedDay
                ? "Hôm nay không được chấm công. Bạn chỉ có thể đăng ký tăng ca nếu có làm việc."
                : `Mốc quy định: 07:30 · 11:30 · 13:30 · 17:30 \n(Mở trước 15 phút, đóng sau mốc 1 tiếng)`}
            </Text>
          </View>
        )}
        <Text style={styles.clockInHelp}>
          {isAttendanceBlockedDay
            ? "Hôm nay là ngày nghỉ tiêu chuẩn. Không mở chấm công."
            : hasClockedInCurrentSlot 
            ? `Cảm ơn bạn. Hệ thống đã ghi nhận chấm công mốc ${currentSlot} thành công.` 
            : isSlotCurrentlyOpen
              ? `Mở camera chụp ảnh selfie + gửi GPS định vị mốc ${currentSlot}`
              : `Vui lòng quay lại đúng khung giờ quy định.`}
        </Text>
      </View>

      {/* BẢNG LƯƠNG TẠM TÍNH CARD */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <LogOut size={20} color="#f97316" />
          <Text style={styles.sectionTitle}>Tài khoản</Text>
        </View>
        <Text style={styles.accountHint}>Không hiện form đổi mật khẩu liên tục. Bấm nút bên dưới khi cần thay đổi.</Text>
        <TouchableOpacity onPress={() => setAccountEditorOpen((current) => !current)} style={styles.accountToggleBtn}>
          <Text style={styles.accountToggleBtnText}>
            {accountEditorOpen ? "Ẩn đổi tài khoản" : "Đổi tên đăng nhập / mật khẩu"}
          </Text>
        </TouchableOpacity>
        {accountEditorOpen ? (
          <View style={styles.accountEditorWrap}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setAccountUsername}
              placeholder="Tên đăng nhập mới"
              placeholderTextColor="#64748b"
              style={styles.accountInput}
              value={accountUsername}
            />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setAccountPassword}
              placeholder="Mật khẩu mới"
              placeholderTextColor="#64748b"
              secureTextEntry
              style={styles.accountInput}
              value={accountPassword}
            />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setAccountPasswordConfirm}
              placeholder="Nhập lại mật khẩu mới"
              placeholderTextColor="#64748b"
              secureTextEntry
              style={styles.accountInput}
              value={accountPasswordConfirm}
            />
            <TouchableOpacity
              disabled={loading || !accountUsername.trim() || !accountPassword.trim() || !accountPasswordConfirm.trim()}
              onPress={saveAccountCredentialsLean}
              style={[styles.accountSaveBtn, (loading || !accountUsername.trim() || !accountPassword.trim() || !accountPasswordConfirm.trim()) && styles.accountSaveBtnDisabled]}
            >
              <Text style={styles.accountSaveBtnText}>Lưu tài khoản</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <CircleDollarSign size={20} color="#f97316" />
          <Text style={styles.sectionTitle}>Tổng thu nhập dự tính trong tháng</Text>
        </View>

        <View style={styles.salaryWidget}>
          <Text style={styles.mainSalaryValue}>
            {Math.round(estimatedIncome).toLocaleString("vi-VN")} đ
          </Text>
          <Text style={styles.salaryHelp}>
            {salaryType === "monthly" ? "Lương tháng cố định" : "Cập nhật theo ngày công và phụ cấp thực tế"}
          </Text>

          <View style={styles.breakdownContainer}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Lương cứng ({workDays} ngày):</Text>
              <Text style={styles.breakdownValue}>{Math.round(basePay).toLocaleString("vi-VN")} đ</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Phụ cấp = tổng phụ cấp:</Text>
              <Text style={styles.breakdownValue}>{Math.round(allowances.totalAllowance).toLocaleString("vi-VN")} đ</Text>
            </View>
            <View style={[styles.breakdownRow, { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#f8fafc", borderRadius: 6 }]}>
              <Text style={[styles.breakdownLabel, { color: "#475569", fontSize: 11 }]}>
                • Đi công trình cả ngày: {allowances.calcSiteFullDays} ngày × {(allowances.siteFuelDailyRate + allowances.siteWaterDailyRate).toLocaleString("vi-VN")}đ
              </Text>
            </View>
            <View style={[styles.breakdownRow, { paddingHorizontal: 8 }]}>
              <Text style={[styles.breakdownLabel, { color: "#475569", fontSize: 11 }]}>
                • Đi công trình cả ngày thêm cơm: {allowances.calcSiteFullDays} ngày × {(allowances.siteLunchDailyRate - allowances.lunchDailyRate).toLocaleString("vi-VN")}đ
              </Text>
            </View>
            <View style={[styles.breakdownRow, { paddingHorizontal: 8 }]}>
              <Text style={[styles.breakdownLabel, { color: "#475569", fontSize: 11 }]}>
                • Đi công trình nửa ngày: {allowances.calcSiteHalfDays} ngày × {(allowances.siteFuelDailyRate + allowances.siteWaterDailyRate).toLocaleString("vi-VN")}đ
              </Text>
            </View>
            <View style={[styles.breakdownRow, { paddingHorizontal: 8 }]}>
              <Text style={[styles.breakdownLabel, { color: "#475569", fontSize: 11 }]}>
                • Ở xưởng: {Math.max(allowances.calcFullDays - allowances.calcSiteFullDays, 0)} ngày × {allowances.lunchDailyRate.toLocaleString("vi-VN")}đ
              </Text>
            </View>
            {allowances.otherAllowance > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Phụ cấp khác:</Text>
                <Text style={styles.breakdownValue}>{Math.round(allowances.otherAllowance).toLocaleString("vi-VN")} đ</Text>
              </View>
            )}
            {otPay > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Tăng ca ({otHours} giờ):</Text>
                <Text style={styles.breakdownValue}>{Math.round(otPay).toLocaleString("vi-VN")} đ</Text>
              </View>
            )}
          </View>

          <View style={styles.salaryMetrics}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Ngày công tích lũy</Text>
              <Text style={styles.metricValue}>{workDays} ngày</Text>
            </View>
            <View style={styles.dividerLine} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Số giờ tăng ca (OT)</Text>
              <Text style={styles.metricValue}>{otHours} giờ</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MapPinned size={20} color="#f97316" />
          <Text style={styles.sectionTitle}>Ngày Đi Công Trình</Text>
        </View>

        <View style={styles.salaryMetrics}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Cả ngày</Text>
            <Text style={styles.metricValue}>{allowances.siteFullDays || 0} ngày</Text>
          </View>
          <View style={styles.dividerLine} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Nửa ngày</Text>
            <Text style={styles.metricValue}>{allowances.siteHalfDays || 0} ngày</Text>
          </View>
          <View style={styles.dividerLine} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Tổng ngày CT</Text>
            <Text style={styles.metricValue}>{allowances.siteDays || 0} ngày</Text>
          </View>
        </View>

        {allowances.siteDayDetails?.length ? (
          <View style={styles.siteDayList}>
            {allowances.siteDayDetails.map((item: any) => (
              <View key={item.day} style={styles.siteDayRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.siteDayDate}>Ngày {item.day}</Text>
                  <Text style={styles.siteDayMeta}>
                    {item.isSiteFullDay ? "Đi công trình cả ngày" : "Đi công trình nửa ngày"}
                  </Text>
                  <Text style={styles.siteDayMeta}>
                    {item.steps?.length ? item.steps.join(", ") : "Công trình"}
                  </Text>
                </View>
                <Text style={styles.siteDayValue}>
                  {item.isSiteFullDay 
                    ? `Ăn trưa CT: ${(allowances.siteLunchDailyRate).toLocaleString("vi-VN")}đ` 
                    : item.isFullDay 
                      ? `Ăn trưa xưởng: ${(allowances.lunchDailyRate).toLocaleString("vi-VN")}đ`
                      : "Không phụ cấp ăn (nửa ngày)"}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.salaryHelp}>Tháng này chưa có ngày nào được ghi nhận là đi công trình.</Text>
        )}
      </View>

      {/* BẢNG LƯỚI CHẤM CÔNG THÁNG CUỘN NGANG */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Calendar size={20} color="#f97316" />
          <Text style={styles.sectionTitle}>Bảng Chấm Công Tháng {new Date().getMonth() + 1}</Text>
        </View>
        
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, styles.dotGreen]} />
            <Text style={styles.legendLabel}>Đã chấm</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, styles.dotBlue]} />
            <Text style={styles.legendLabel}>Công bù</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, styles.dotGray]} />
            <Text style={styles.legendLabel}>Chưa chấm</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gridScroll}>
          <View style={styles.gridTable}>
            {/* Header hàng ngày */}
            <View style={styles.gridHeaderRow}>
              <Text style={[styles.gridCellHeader, styles.cellWidthLabel]}>Mốc giờ</Text>
              {monthDays.map(day => (
                <Text key={day.getDate()} style={[styles.gridCellHeader, styles.cellWidthDot]}>{day.getDate()}</Text>
              ))}
            </View>

            {/* Các hàng mốc giờ */}
            {slots.map(slot => (
              <View key={slot} style={styles.gridRow}>
                <Text style={[styles.gridCellLabel, styles.cellWidthLabel]}>{slot}</Text>
                {monthDays.map(day => {
                  const dayNum = day.getDate();
                  const key = `${user.id}-${dayNum}-${slot}`;
                  const val = effectiveAttendance[key] || null;
                  return (
                    <View key={dayNum} style={[styles.gridCellDotArea, styles.cellWidthDot]}>
                      <View 
                        style={[
                          styles.attendanceDot,
                          val === "normal" ? styles.dotGreen : val === "compensated" ? styles.dotBlue : styles.dotGray
                        ]} 
                      />
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* DANH SÁCH VIỆC ĐANG LÀM & NÚT HOÀN THÀNH ĐỘC LẬP */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Briefcase size={20} color="#f97316" />
          <Text style={styles.sectionTitle}>Công Việc Giao Phụ Trách</Text>
        </View>

        {activeJobs.length === 0 ? (
          <View style={styles.emptyJobsCard}>
            <Text style={styles.emptyJobsText}>Hiện tại bạn không có công việc nào đang dang dở. 🌟</Text>
          </View>
        ) : (
          activeJobs.map((job: any) => {
            const isFuture = job.deploymentStartTime && new Date(job.deploymentStartTime) > new Date();
            return (
              <View key={job.id} style={styles.jobItemCard}>
                <View style={styles.jobItemHeader}>
                  <Text style={styles.jobCode}>{job.code}</Text>
                  <View style={[
                    styles.jobStatusBadge,
                    isFuture && { backgroundColor: "#dbeafe" }
                  ]}>
                    <Text style={[
                      styles.jobStatusText,
                      isFuture && { color: "#1e40af" }
                    ]}>
                      {isFuture ? "Chờ giờ hẹn" : "Đang làm"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.jobDetail}>Khách hàng: {job.customerName}</Text>
                <Text style={styles.jobDetail}>Địa chỉ: {job.address}</Text>
                <Text style={styles.jobDetail}>
                  Công việc: {job.kind === "warranty_task" ? "Bảo hành công trình" : job.step === "Sản xuất" ? "Sản xuất tủ" : job.step === "Bảo hành" ? "Bảo hành công trình" : "Lắp đặt nội thất"}
                </Text>
                {job.deploymentStartTime ? (
                  <Text style={[styles.jobDetail, { color: "#2563eb", fontWeight: "bold", marginTop: 4 }]}>
                    Giờ hẹn: {new Date(job.deploymentStartTime).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                  </Text>
                ) : null}

                {/* Nút Hoàn thành Độc lập */}
                {isFuture ? (
                  <View style={[styles.doneIndependentBtn, { backgroundColor: "#cbd5e1" }]}>
                    <Clock size={16} color="#475569" />
                    <Text style={[styles.doneIndependentBtnText, { color: "#475569" }]}>CHỜ ĐẾN GIỜ HẸN</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.doneIndependentBtn}
                    onPress={() => handleReportDoneIndependent(job)}
                  >
                    <CheckCircle2 size={16} color="#ffffff" />
                    <Text style={styles.doneIndependentBtnText}>BÁO CÁO HOÀN THÀNH CÔNG VIỆC</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* POPUP CÂU HỎI THÔNG MINH KHI CLICK CHẤM CÔNG */}
      {askModalOpen && activeJobToReport && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Xác nhận trạng thái công việc</Text>
            <Text style={styles.modalDesc}>
              Đơn hàng <Text style={styles.highlightText}>{activeJobToReport.code}</Text> mà bạn đang thực hiện đã hoàn thành chưa?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnGreen]}
                onPress={() => handleAnswerCompletion(true)}
              >
                <CheckCircle2 size={18} color="#ffffff" />
                <Text style={styles.modalBtnText}>Đã hoàn thành</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnOrange]}
                onPress={() => handleAnswerCompletion(false)}
              >
                <Text style={styles.modalBtnText}>Chưa hoàn thành</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* MODAL ĐĂNG KÝ CHẤM CÔNG BÙ TRÊN DI ĐỘNG */}
      {compOpen && (
        <View style={styles.modalOverlay}>
          <View style={styles.compModalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.compModalTitle}>Đăng ký chấm công bù</Text>
              <TouchableOpacity onPress={() => {
                setCompOpen(false);
                setSelectedCompSlots([]);
                setCompReason("");
              }}>
                <Text style={styles.closeModalText}>Đóng</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalWarningBox}>
              <Text style={styles.modalWarningText}>
                ⚠️ Hệ thống chỉ hỏi khi còn thiếu công đang treo. Nếu bạn chọn không đủ 5 lần cho cùng một đợt thiếu công, các mốc cũ sẽ tự chốt là nghỉ.
              </Text>
            </View>

            <Text style={styles.gridSectionLabel}>
              Chọn trực tiếp trên bảng (Hàng: mốc, Cột: ngày)
            </Text>

            {uniqueMissingDays.length === 0 ? (
              <View style={styles.emptyGridArea}>
                <Text style={styles.emptyGridText}>Tuyệt vời! Bạn không thiếu mốc chấm công nào.</Text>
              </View>
            ) : (
              <View style={styles.gridTableBorder}>
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={true}
                  style={{ flexGrow: 0 }}
                  contentContainerStyle={{ paddingBottom: 4 }}
                >
                  <View style={[styles.modalTable, { width: 70 + uniqueMissingDays.length * 80 }]}>
                    {/* Header Row */}
                    <View style={styles.modalTableHeader}>
                      <View style={styles.colHeaderSlot}>
                        <Text style={styles.colHeaderLabelText}>Mốc giờ</Text>
                      </View>
                      {uniqueMissingDays.map((day) => (
                        <View key={day.toISOString()} style={styles.colHeaderDay}>
                          <Text style={styles.colHeaderDayText}>{day.getDate()}/{day.getMonth() + 1}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Slot Rows */}
                    {["07:30", "11:30", "13:30", "17:30"].map((slot) => (
                      <View key={slot} style={styles.modalTableRow}>
                        <View style={styles.cellSlotLabel}>
                          <Text style={styles.cellSlotLabelText}>{slot}</Text>
                        </View>
                        {uniqueMissingDays.map((day) => {
                          const dayNum = day.getDate();
                          const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                          const key = `${user.id}-${dayNum}-${slot}`;
                          const val = effectiveAttendance[key] || null;
                          const isLocked = Boolean(lockedThroughDate && dateStr <= lockedThroughDate);

                          if (val === "normal" || val === "compensated") {
                            return (
                              <View key={dayNum} style={styles.cellWrapper}>
                                <View style={[styles.statusBadge, styles.badgeGreen]}>
                                  <Text style={styles.badgeTextGreen}>Đã chấm</Text>
                                </View>
                              </View>
                            );
                          }

                          if (isLocked) {
                            return (
                              <View key={dayNum} style={styles.cellWrapper}>
                                <View style={[styles.statusBadge, styles.badgeRed]}>
                                  <Text style={styles.badgeTextRed}>Khóa</Text>
                                </View>
                              </View>
                            );
                          }

                          // Selectable Cell
                          const isChecked = selectedCompSlots.some(s => s.date === dateStr && s.slot === slot);
                          return (
                            <View key={dayNum} style={styles.cellWrapper}>
                              <TouchableOpacity
                                style={[
                                  styles.selectBtn,
                                  isChecked ? styles.selectBtnActive : styles.selectBtnNormal
                                ]}
                                onPress={() => {
                                  if (isChecked) {
                                    setSelectedCompSlots(curr => curr.filter(s => !(s.date === dateStr && s.slot === slot)));
                                  } else {
                                    setSelectedCompSlots(curr => [...curr, { date: dateStr, slot }]);
                                  }
                                }}
                              >
                                <Text style={[styles.selectBtnText, isChecked ? styles.textWhite : styles.textOrange]}>
                                  {isChecked ? "✓ Chọn" : "Bù"}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            <Text style={styles.fieldLabel}>Lý do thiếu công *</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Ví dụ: Quên điện thoại, Đi công trình ngoài..."
              placeholderTextColor="#94a3b8"
              value={compReason}
              onChangeText={setCompReason}
              multiline
            />

            <TouchableOpacity
              style={[
                styles.submitCompBtn,
                (selectedCompSlots.length === 0 || !compReason.trim()) ? styles.btnDisabled : styles.btnActive
              ]}
              onPress={submitCompensationsLean}
              disabled={selectedCompSlots.length === 0 || !compReason.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitCompBtnText}>GỬI YÊU CẦU CHẤM CÔNG BÙ</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {otOpen && (
        <View style={styles.modalOverlay}>
          <View style={styles.whiteModalContent}>
            <Text style={styles.modalTitle}>Đăng ký tăng ca</Text>
            <Text style={styles.modalDesc}>Nhập khoảng thời gian tăng ca và lý do để lưu vào hệ thống.</Text>

            <Text style={styles.whiteFieldLabel}>Đơn hàng tăng ca</Text>
            <View style={styles.orderList}>
              {assignedOrders.map((order: any) => (
                <TouchableOpacity
                  key={order.id}
                  style={[styles.orderChip, selectedOrderCode === order.code ? styles.orderChipActive : null]}
                  onPress={() => setSelectedOrderCode(order.code)}
                >
                  <Text style={[styles.orderChipText, selectedOrderCode === order.code ? styles.orderChipTextActive : null]}>{order.code}</Text>
                </TouchableOpacity>
                ))}
            </View>
            {assignedOrders.length === 0 ? (
              <Text style={styles.helperText}>Bạn cần được giao đơn hàng trước khi đăng ký tăng ca.</Text>
            ) : null}

            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Text style={styles.whiteFieldLabel}>Từ giờ</Text>
                <TextInput style={styles.inlineInput} value={otFrom} onChangeText={setOtFrom} placeholder="18:00" placeholderTextColor="#94a3b8" />
              </View>
              <View style={styles.timeField}>
                <Text style={styles.whiteFieldLabel}>Đến giờ</Text>
                <TextInput style={styles.inlineInput} value={otTo} onChangeText={setOtTo} placeholder="20:00" placeholderTextColor="#94a3b8" />
              </View>
            </View>

            <Text style={styles.whiteFieldLabel}>Lý do</Text>
            <TextInput
              style={styles.whiteReasonInput}
              value={otReason}
              onChangeText={setOtReason}
              placeholder="Nhập lý do tăng ca"
              placeholderTextColor="#94a3b8"
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnOrange]} onPress={() => setOtOpen(false)}>
                <Text style={styles.modalBtnText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGreen, (!selectedOrderCode || assignedOrders.length === 0) ? styles.modalBtnDisabled : null]} onPress={submitOvertimeRequestLean} disabled={loading || !selectedOrderCode || assignedOrders.length === 0}>
                {loading ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.modalBtnText}>Gửi đăng ký</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      </ScrollView>

      {/* SCREEN CAMERA NATIVE HIỂN THỊ KHI CHẤM CÔNG */}
      {showCamera && (
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraHeaderText}>Mốc chấm công: {currentSlot}</Text>
            <Text style={styles.cameraHeaderSub}>Vị trí GPS: {gpsCoords}</Text>
            <Text style={styles.cameraHeaderSub}>{gpsAddress || "Đang lấy địa chỉ khu vực..."}</Text>
          </View>

          <View style={styles.cameraFrame}>
            <CameraView 
              style={styles.cameraNative} 
              facing="front" 
              ref={(ref: any) => setCameraRef(ref)}
            />
          </View>

          <View style={styles.cameraFooter}>
            <TouchableOpacity 
              style={styles.captureCircleBtn}
              onPress={captureAndClockinLean}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="large" color="#f97316" />
              ) : (
                <View style={styles.captureInnerCircle} />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.closeCameraBtn}
              onPress={() => {
                setShowCamera(false);
                setActiveJobToReport(null);
              }}
            >
              <Text style={styles.closeCameraBtnText}>HỦY BỎ</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071a38",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 10,
  },
  helloText: {
    fontSize: 20,
    color: "#f8fafc",
    fontWeight: "900",
  },
  outsideSlotCard: {
    width: screenWidth - 32,
    backgroundColor: "#0f2547",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e3a66",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  outsideSlotTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 10,
  },
  outsideSlotDesc: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 16,
  },
  positionText: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
    fontWeight: "600",
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
    borderColor: "#334155",
    borderWidth: 1,
  },
  clockCard: {
    backgroundColor: "#0f2547",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e3a66",
    padding: 20,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 24,
  },
  clockTime: {
    fontSize: 42,
    color: "#f97316",
    fontWeight: "900",
    letterSpacing: 2,
  },
  clockDate: {
    fontSize: 14,
    color: "#cbd5e1",
    fontWeight: "700",
    marginTop: 4,
  },
  shiftBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#071a38",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e3a66",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    marginTop: 14,
  },
  shiftBadgeText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "800",
  },
  overtimeActionBtn: {
    marginTop: 14,
    width: "100%",
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fb923c",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9731615",
  },
  overtimeActionText: {
    color: "#fdba74",
    fontSize: 14,
    fontWeight: "900",
  },
  clockInCenter: {
    alignItems: "center",
    marginBottom: 24,
  },
  clockInButton: {
    width: 172,
    height: 172,
    borderRadius: 86,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 8,
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  clockInBtnBg: {
    backgroundColor: "#22c55e",
    borderColor: "#15803d",
  },
  clockedInBtnBg: {
    backgroundColor: "#16a34a",
    borderColor: "#166534",
  },
  centerBtnContent: {
    alignItems: "center",
    gap: 8,
  },
  clockInBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },
  clockInHelp: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 14,
    paddingHorizontal: 20,
    lineHeight: 16,
  },
  sectionCard: {
    backgroundColor: "#0f2547",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e3a66",
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e3a66",
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    color: "#f8fafc",
    fontWeight: "900",
  },
  accountHint: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 12,
  },
  accountToggleBtn: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e3a66",
    backgroundColor: "#0f274d",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  accountToggleBtnText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "900",
  },
  accountEditorWrap: {
    marginTop: 12,
  },
  accountInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e3a66",
    backgroundColor: "#071a38",
    color: "#f8fafc",
    paddingHorizontal: 14,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: "700",
  },
  accountSaveBtn: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#f97316",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  accountSaveBtnDisabled: {
    opacity: 0.55,
  },
  accountSaveBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  salaryWidget: {
    alignItems: "center",
  },
  mainSalaryValue: {
    fontSize: 32,
    color: "#22c55e",
    fontWeight: "900",
  },
  salaryHelp: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "bold",
    marginTop: 4,
    textAlign: "center",
  },
  salaryMetrics: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#071a38",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e3a66",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    width: "100%",
    justifyContent: "space-between",
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "bold",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    color: "#f8fafc",
    fontWeight: "900",
  },
  dividerLine: {
    width: 1,
    height: 24,
    backgroundColor: "#1e3a66",
  },
  legendRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotGreen: {
    backgroundColor: "#22c55e",
  },
  dotBlue: {
    backgroundColor: "#3b82f6",
  },
  dotGray: {
    backgroundColor: "#475569",
  },
  gridScroll: {
    marginTop: 8,
  },
  gridTable: {
    flexDirection: "column",
  },
  gridHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#071a38",
    borderBottomWidth: 1,
    borderBottomColor: "#1e3a66",
    paddingVertical: 8,
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1e3a66",
    paddingVertical: 10,
    alignItems: "center",
  },
  gridCellHeader: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  gridCellLabel: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "900",
  },
  gridCellDotArea: {
    justifyContent: "center",
    alignItems: "center",
  },
  attendanceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  cellWidthLabel: {
    width: 68,
    paddingLeft: 8,
  },
  cellWidthDot: {
    width: 32,
    textAlign: "center",
  },
  emptyJobsCard: {
    backgroundColor: "#071a38",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e3a66",
    padding: 24,
    alignItems: "center",
  },
  emptyJobsText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
  },
  jobItemCard: {
    backgroundColor: "#071a38",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e3a66",
    padding: 16,
    marginBottom: 12,
  },
  jobItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  jobCode: {
    fontSize: 16,
    color: "#f97316",
    fontWeight: "900",
  },
  jobStatusBadge: {
    backgroundColor: "#166534",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  jobStatusText: {
    color: "#22c55e",
    fontSize: 10,
    fontWeight: "bold",
  },
  jobDetail: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  doneIndependentBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f97316",
    borderRadius: 10,
    height: 44,
    marginTop: 16,
    gap: 8,
  },
  doneIndependentBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  modalContent: {
    width: screenWidth - 48,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  whiteModalContent: {
    width: screenWidth - 32,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    maxHeight: "85%",
  },
  whiteFieldLabel: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 6,
    marginTop: 10,
  },
  orderList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  orderChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
  },
  orderChipActive: {
    backgroundColor: "#f97316",
    borderColor: "#f97316",
  },
  orderChipText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
  },
  orderChipTextActive: {
    color: "#ffffff",
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#b45309",
  },
  timeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  timeField: {
    flex: 1,
  },
  inlineInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    color: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "700",
  },
  whiteReasonInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    color: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 84,
    textAlignVertical: "top",
  },
  modalTitle: {
    fontSize: 18,
    color: "#0f172a",
    fontWeight: "900",
    marginBottom: 12,
  },
  modalDesc: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  highlightText: {
    fontWeight: "900",
    color: "#f97316",
  },
  modalButtons: {
    flexDirection: "column",
    width: "100%",
    gap: 12,
  },
  modalBtn: {
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  modalBtnGreen: {
    backgroundColor: "#16a34a",
  },
  modalBtnDisabled: {
    backgroundColor: "#94a3b8",
  },
  modalBtnOrange: {
    backgroundColor: "#f97316",
  },
  modalBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  cameraOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#071a38",
    zIndex: 200,
    justifyContent: "space-around",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 24,
  },
  cameraHeader: {
    alignItems: "center",
    marginTop: 6,
  },
  cameraHeaderText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  cameraHeaderSub: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 4,
    textAlign: "center",
  },
  cameraFrame: {
    width: screenWidth * 0.82,
    height: screenWidth * 0.82 * 1.33,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#f97316",
    alignSelf: "center",
    marginVertical: 16,
  },
  cameraNative: {
    flex: 1,
  },
  cameraFooter: {
    alignItems: "center",
    gap: 12,
    marginBottom: 0,
  },
  captureCircleBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureInnerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ffffff",
  },
  closeCameraBtn: {
    paddingVertical: 8,
  },
  closeCameraBtnText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },
  clockedInSuccessBadge: {
    width: screenWidth - 32,
    backgroundColor: "#16a34a15",
    borderColor: "#22c55e",
    borderWidth: 2,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  clockedInSuccessText: {
    color: "#22c55e",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center",
  },
  clockedInSuccessSub: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 16,
  },
  mobileCompBtn: {
    marginTop: 14,
    backgroundColor: "#1d4ed8",
    borderColor: "#3b82f6",
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  mobileCompBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  compModalContent: {
    width: screenWidth - 24,
    backgroundColor: "#0f2547",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#1e3a66",
    padding: 20,
    maxHeight: "85%",
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  compModalTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  closeModalText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "900",
  },
  modalWarningBox: {
    backgroundColor: "#1e3a8a30",
    borderColor: "#3b82f6",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  modalWarningText: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
  },
  gridSectionLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 8,
  },
  emptyGridArea: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyGridText: {
    color: "#94a3b8",
    fontStyle: "italic",
    fontSize: 13,
  },
  gridTableBorder: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e3a66",
    backgroundColor: "#071a38",
    overflow: "hidden",
    marginBottom: 12,
  },
  modalTable: {
    padding: 6,
    minWidth: 420,
  },
  modalTableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1e3a66",
    paddingBottom: 6,
    marginBottom: 6,
  },
  colHeaderSlot: {
    width: 70,
    justifyContent: "center",
  },
  colHeaderLabelText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "900",
  },
  colHeaderDay: {
    width: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  colHeaderDayText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "900",
  },
  modalTableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1e3a6680",
  },
  cellSlotLabel: {
    width: 70,
    justifyContent: "center",
  },
  cellSlotLabelText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  cellWrapper: {
    width: 80,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  badgeGreen: {
    backgroundColor: "#22c55e20",
  },
  badgeRed: {
    backgroundColor: "#ef444420",
  },
  badgeTextGreen: {
    color: "#22c55e",
    fontSize: 9,
    fontWeight: "900",
  },
  badgeTextRed: {
    color: "#ef4444",
    fontSize: 9,
    fontWeight: "900",
  },
  selectBtn: {
    width: "100%",
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  selectBtnActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  selectBtnNormal: {
    backgroundColor: "#f9731615",
    borderColor: "#f9731640",
  },
  selectBtnText: {
    fontSize: 10,
    fontWeight: "900",
  },
  textWhite: {
    color: "#ffffff",
  },
  textOrange: {
    color: "#f97316",
  },
  fieldLabel: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 6,
    marginTop: 6,
  },
  reasonInput: {
    backgroundColor: "#071a38",
    borderColor: "#1e3a66",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    color: "#ffffff",
    fontSize: 12,
    minHeight: 60,
    textAlignVertical: "top",
    marginBottom: 14,
  },
  submitCompBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnActive: {
    backgroundColor: "#16a34a",
  },
  btnDisabled: {
    backgroundColor: "#1e293b",
  },
  submitCompBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  breakdownContainer: {
    width: "100%",
    backgroundColor: "#0b2041",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e3a66",
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownLabel: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  breakdownValue: {
    fontSize: 12,
    color: "#f8fafc",
    fontWeight: "700",
  },
  siteDayList: {
    marginTop: 12,
    gap: 10,
  },
  siteDayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#0b2041",
    borderWidth: 1,
    borderColor: "#1e3a66",
  },
  siteDayDate: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  siteDayMeta: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
  },
  siteDayValue: {
    color: "#f97316",
    fontSize: 11,
    fontWeight: "800",
  }
});
