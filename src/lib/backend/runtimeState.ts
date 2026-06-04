import { demoAccounts } from "@/modules/hr/accounts";
import type { LeaveRequest } from "@/modules/hr/leave";
import { demoOrders, type Order } from "@/modules/orders/orderFlow";
import type { CashTransaction, CustomerDebt } from "@/modules/finance/types";
import { createSupabaseAdminClient } from "@/lib/backend/supabaseAdmin";
import type { LegacyJsonSnapshot, NotificationSubscription } from "@/lib/backend/types";
import { sendWebPushNotification } from "@/lib/backend/webPush";
import { canUseOvertime, positions } from "@/modules/hr/roles";
import { getRequiredApprovals } from "@/modules/attendance/compensationRules";

export type RuntimeState = LegacyJsonSnapshot & {
  schemaVersion: number;
};

export type RuntimePatch = Partial<Omit<RuntimeState, "schemaVersion">>;

const RUNTIME_STATE_KEY = "primary";
const CURRENT_SCHEMA_VERSION = 1;

export function buildDefaultRuntimeState(): RuntimeState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    accounts: demoAccounts,
    orders: demoOrders,
    overtimeRequests: [],
    compensationRequests: [],
    leaveRequests: [],
    cashTransactions: [],
    customerDebts: [],
    holidayDates: [],
    attendance: {},
    attendanceDetails: {},
    attendanceCompensationState: {},
    feedbackEntries: [],
    pushSubscriptions: []
  };
}

function mergeState(base: RuntimeState, patch: RuntimePatch): RuntimeState {
  const nextState = {
    ...base,
    ...patch,
    schemaVersion: CURRENT_SCHEMA_VERSION
  };

  if (Array.isArray(patch.accounts) && patch.accounts.length === 0 && Array.isArray(base.accounts) && base.accounts.length > 0) {
    nextState.accounts = base.accounts;
  }

  if (Array.isArray(patch.orders) && patch.orders.length === 0 && Array.isArray(base.orders) && base.orders.length > 0) {
    nextState.orders = base.orders;
  }

  if (Array.isArray(patch.accounts) && isSuspiciousCollectionShrink(base.accounts, patch.accounts, (item) => item.id || item.username)) {
    nextState.accounts = base.accounts;
  }

  if (Array.isArray(patch.orders) && isSuspiciousCollectionShrink(base.orders, patch.orders, (item) => item.id || item.code)) {
    nextState.orders = base.orders;
  }

  return nextState;
}

function isSuspiciousCollectionShrink<T>(
  baseItems: T[] | undefined,
  nextItems: T[] | undefined,
  getKey: (item: T) => string | undefined
) {
  if (!Array.isArray(baseItems) || !Array.isArray(nextItems)) return false;
  if (baseItems.length < 5) return false;
  if (nextItems.length >= baseItems.length) return false;
  if (nextItems.length === 0) return true;

  const shrinkRatio = nextItems.length / baseItems.length;
  const baseKeys = new Set(baseItems.map((item) => getKey(item)).filter(Boolean));
  const nextKeys = nextItems.map((item) => getKey(item)).filter(Boolean);
  const overlapCount = nextKeys.filter((key) => baseKeys.has(key)).length;
  const overlapRatio = nextKeys.length > 0 ? overlapCount / nextKeys.length : 0;

  return shrinkRatio < 0.5 || overlapRatio < 0.8;
}

function normalizeDisplayText(value: string | undefined) {
  return (value || "").trim().toLowerCase();
}

function getAccountByDisplayName(state: RuntimeState, displayName: string) {
  const normalized = normalizeDisplayText(displayName);
  if (!normalized) return null;
  return state.accounts.find((account) => normalizeDisplayText(account.displayName) === normalized) ?? null;
}

function collectOrderAssigneeIds(state: RuntimeState, order: Order) {
  const names = new Set<string>();
  const addNames = (values?: string[]) => {
    (values || []).forEach((value) => {
      if (value?.trim()) names.add(value.trim());
    });
  };

  switch (order.step) {
    case "Tiếp nhận":
    case "Báo giá":
    case "Hoàn công":
      addNames([order.saleName]);
      break;
    case "Thiết kế":
      addNames(order.designerNames?.length ? order.designerNames : [order.designerName]);
      break;
    case "Ra file":
      addNames(order.fileOperatorNames?.length ? order.fileOperatorNames : [order.fileOperatorName]);
      break;
    case "Sản xuất":
      addNames(order.productionWorkerNames?.length ? order.productionWorkerNames : [order.productionWorkerName]);
      addNames([order.workshopManagerName]);
      break;
    case "Lắp đặt":
      addNames(order.installerNames?.length ? order.installerNames : [order.installerName]);
      addNames(order.supervisorNames?.length ? order.supervisorNames : [order.supervisorName]);
      break;
    case "Nghiệm thu":
      addNames(order.supervisorNames?.length ? order.supervisorNames : [order.supervisorName]);
      addNames(order.installerNames?.length ? order.installerNames : [order.installerName]);
      break;
  }

  return Array.from(names)
    .map((name) => getAccountByDisplayName(state, name)?.id ?? null)
    .filter((value): value is string => Boolean(value));
}

type PendingPushNotification = {
  userIds: string[];
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function getNormalizedRequestSlots(request: any) {
  return Array.isArray(request?.slots) ? [...request.slots].sort().join("|") : "";
}

function queuePushNotifications(prev: RuntimeState, next: RuntimeState) {
  const queue: PendingPushNotification[] = [];

  const prevOrders = new Map(prev.orders.map((order) => [order.id, order]));
  next.orders.forEach((order) => {
    const prevOrder = prevOrders.get(order.id);
    const nextUserIds = collectOrderAssigneeIds(next, order);
    const prevUserIds = prevOrder ? collectOrderAssigneeIds(prev, prevOrder) : [];
    const assignmentChanged =
      !prevOrder ||
      prevOrder.step !== order.step ||
      prevOrder.assignedTaskNote !== order.assignedTaskNote ||
      prevUserIds.join("|") !== nextUserIds.join("|");

    if (assignmentChanged && nextUserIds.length > 0) {
      queue.push({
        userIds: nextUserIds,
        title: "Đơn hàng mới được giao",
        body: `${order.code} • ${order.customerName} • Công đoạn ${order.step}`,
        url: "/iphone",
        tag: `order-${order.id}-${order.step}`
      });
    }
  });

  const prevOt = new Map(
    (prev.overtimeRequests || []).map((request: any) => [request.id || `${request.employeeId}-${request.date}-${request.from}-${request.to}`, request])
  );
  (next.overtimeRequests || []).forEach((request: any) => {
    const key = request.id || `${request.employeeId}-${request.date}-${request.from}-${request.to}`;
    const before = prevOt.get(key);
    if (request.status === "approved" && before?.status !== "approved" && request.employeeId) {
      queue.push({
        userIds: [request.employeeId],
        title: "Tăng ca đã được duyệt",
        body: `${request.date || "Ca tăng ca"} • ${request.from || ""}-${request.to || ""}`.trim(),
        url: "/iphone",
        tag: `ot-${key}`
      });
    }
  });

  const prevComp = new Map(
    (prev.compensationRequests || []).map((request: any) => [
      request.id || `${request.employeeId}-${request.date}-${getNormalizedRequestSlots(request)}`,
      request
    ])
  );
  (next.compensationRequests || []).forEach((request: any) => {
    const key = request.id || `${request.employeeId}-${request.date}-${getNormalizedRequestSlots(request)}`;
    const before = prevComp.get(key);
    if (request.status === "approved" && before?.status !== "approved" && request.employeeId) {
      queue.push({
        userIds: [request.employeeId],
        title: "Chấm công bù đã được duyệt",
        body: `${request.date || ""} • ${Array.isArray(request.slots) ? request.slots.join(", ") : ""}`.trim(),
        url: "/iphone",
        tag: `comp-${key}`
      });
    }
  });

  return queue;
}

async function deliverPushNotifications(state: RuntimeState, queue: PendingPushNotification[]) {
  const subscriptions = Array.isArray(state.pushSubscriptions) ? state.pushSubscriptions : [];
  if (queue.length === 0 || subscriptions.length === 0) return state;

  const invalidEndpoints = new Set<string>();

  for (const item of queue) {
    const targets = subscriptions.filter((subscription) => item.userIds.includes(subscription.userId));
    for (const subscription of targets) {
      try {
        await sendWebPushNotification(subscription, {
          title: item.title,
          body: item.body,
          url: item.url,
          tag: item.tag
        });
      } catch (error: any) {
        const statusCode = error?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          invalidEndpoints.add(subscription.endpoint);
        }
      }
    }
  }

  if (invalidEndpoints.size > 0) {
    state.pushSubscriptions = subscriptions.filter((subscription) => !invalidEndpoints.has(subscription.endpoint));
    await saveRuntimeState(state);
  }

  return state;
}

export async function loadRuntimeState(): Promise<RuntimeState> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("app_runtime_state")
    .select("state")
    .eq("singleton_key", RUNTIME_STATE_KEY)
    .single();

  if (error) {
    throw new Error(`Không đọc được app_runtime_state: ${error.message}`);
  }

  const base = buildDefaultRuntimeState();
  const state = (data?.state ?? {}) as Partial<RuntimeState>;
  return mergeState(base, state);
}

export async function saveRuntimeState(state: RuntimeState) {
  const supabase = createSupabaseAdminClient();
  const payload = {
    singleton_key: RUNTIME_STATE_KEY,
    state,
    schema_version: CURRENT_SCHEMA_VERSION,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from("app_runtime_state").upsert(payload, {
    onConflict: "singleton_key"
  });

  if (error) {
    throw new Error(`Không ghi được app_runtime_state: ${error.message}`);
  }
}

export async function applyRuntimePatch(patch: RuntimePatch) {
  const state = await loadRuntimeState();
  const nextState = mergeState(state, patch);
  await saveRuntimeState(nextState);
  const pushQueue = queuePushNotifications(state, nextState);
  await deliverPushNotifications(nextState, pushQueue);
  return nextState;
}

export async function upsertPushSubscription(payload: {
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  deviceLabel?: string;
}) {
  const state = await loadRuntimeState();
  const current = Array.isArray(state.pushSubscriptions) ? state.pushSubscriptions : [];
  const now = new Date().toISOString();
  const existing = current.find((item) => item.endpoint === payload.endpoint);

  const nextItem: NotificationSubscription = existing
    ? {
        ...existing,
        userId: payload.userId,
        keys: payload.keys,
        deviceLabel: payload.deviceLabel || existing.deviceLabel,
        updatedAt: now
      }
    : {
        id: `push-${Date.now()}`,
        userId: payload.userId,
        endpoint: payload.endpoint,
        keys: payload.keys,
        deviceLabel: payload.deviceLabel || "",
        createdAt: now,
        updatedAt: now
      };

  state.pushSubscriptions = existing
    ? current.map((item) => (item.endpoint === payload.endpoint ? nextItem : item))
    : [nextItem, ...current];

  await saveRuntimeState(state);
  return state;
}

export async function removePushSubscription(endpoint: string) {
  const state = await loadRuntimeState();
  const current = Array.isArray(state.pushSubscriptions) ? state.pushSubscriptions : [];
  state.pushSubscriptions = current.filter((item) => item.endpoint !== endpoint);
  await saveRuntimeState(state);
  return state;
}

export function authenticateRuntimeAccount(state: RuntimeState, username: string, password: string) {
  const normUser = username.trim().toLowerCase();
  const normPass = password.trim().toLowerCase();

  return (
    state.accounts.find(
      (account) =>
        account.username.trim().toLowerCase() === normUser &&
        account.password.trim().toLowerCase() === normPass &&
        account.status === "active"
    ) ?? null
  );
}

function toCurrentLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isAttendanceBlockedDate(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  if (date.getDay() === 0) return true;
  return false;
}

function getAttendanceCompState(state: RuntimeState, userId: string) {
  state.attendanceCompensationState = state.attendanceCompensationState || {};
  const current = state.attendanceCompensationState[userId] as
    | { declineCount: number; lockedThroughDate: string | null; lastDeclinedAt: string | null }
    | undefined;

  if (!current) {
    state.attendanceCompensationState[userId] = {
      declineCount: 0,
      lockedThroughDate: null,
      lastDeclinedAt: null
    };
  }

  return state.attendanceCompensationState[userId] as {
    declineCount: number;
    lockedThroughDate: string | null;
    lastDeclinedAt: string | null;
  };
}

function toAttendanceKey(userId: string, item: { date?: string; day?: number; slot: string }) {
  const dateText = typeof item.date === "string" ? item.date : "";
  const parts = dateText.split("-");
  const dayToken = parts.length === 3 ? String(Number(parts[2])) : String(item.day ?? dateText);
  return `${userId}-${dayToken}-${item.slot}`;
}

function stripAttendancePhotos(details: RuntimeState["attendanceDetails"]) {
  return Object.fromEntries(
    Object.entries(details || {}).map(([key, value]) => [
      key,
      {
        ...value,
        photo: value?.photo ? "__deferred__" : ""
      }
    ])
  );
}

function getAccountById(state: RuntimeState, userId: string) {
  return state.accounts.find((account) => account.id === userId) ?? null;
}

function getAssignedOrdersForUser(state: RuntimeState, userId: string) {
  const account = getAccountById(state, userId);
  if (!account) return [];
  const name = account.displayName;
  return state.orders.filter((order) => {
    return (
      (Array.isArray(order.installerNames) && order.installerNames.includes(name)) ||
      (Array.isArray(order.productionWorkerNames) && order.productionWorkerNames.includes(name)) ||
      (Array.isArray(order.supervisorNames) && order.supervisorNames.includes(name)) ||
      (Array.isArray(order.designerNames) && order.designerNames.includes(name)) ||
      (Array.isArray(order.fileOperatorNames) && order.fileOperatorNames.includes(name)) ||
      (order.saleName || "").split(",").map((item) => item.trim()).includes(name)
    );
  });
}

export async function buildMobileBootstrap(userId: string) {
  const state = await loadRuntimeState();
  const account = getAccountById(state, userId);
  if (!account) {
    throw new Error("Không tìm thấy tài khoản.");
  }

  const attendance = Object.fromEntries(
    Object.entries(state.attendance || {}).filter(([key]) => key.startsWith(`${userId}-`))
  );
  const attendanceDetails = Object.fromEntries(
    Object.entries(stripAttendancePhotos(state.attendanceDetails || {})).filter(([key]) => key.startsWith(`${userId}-`))
  );

  return {
    account,
    usernameDirectory: state.accounts.map((item) => ({ id: item.id, username: item.username })),
    holidayDates: state.holidayDates || [],
    attendance,
    attendanceDetails,
    attendanceCompensationState: state.attendanceCompensationState ? { [userId]: state.attendanceCompensationState[userId] } : {},
    compensationRequests: (state.compensationRequests || []).filter((request: any) => request.employeeId === userId),
    overtimeRequests: (state.overtimeRequests || []).filter((request: any) => request.userId === userId),
    orders: getAssignedOrdersForUser(state, userId)
  };
}

function normalizeAttendanceTime(dayValue: string, rawTime?: string) {
  const localDateString = toCurrentLocalDateString();

  const buildLocalTimestamp = (year: number, month: number, day: number, hour: number, minute: number, second: number) => {
    const safeMonth = String(month).padStart(2, "0");
    const safeDay = String(day).padStart(2, "0");
    const safeHour = String(hour).padStart(2, "0");
    const safeMinute = String(minute).padStart(2, "0");
    const safeSecond = String(second).padStart(2, "0");
    return `${year}-${safeMonth}-${safeDay} ${safeHour}:${safeMinute}:${safeSecond}`;
  };

  if (rawTime) {
    const dateTimeMatch = rawTime.match(
      /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/
    );
    if (dateTimeMatch) {
      return buildLocalTimestamp(
        Number(dateTimeMatch[1]),
        Number(dateTimeMatch[2]),
        Number(dateTimeMatch[3]),
        Number(dateTimeMatch[4]),
        Number(dateTimeMatch[5]),
        Number(dateTimeMatch[6] || "0")
      );
    }

    const match = rawTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
      const parts = localDateString.split("-");
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(dayValue);
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      const second = Number(match[3] || "0");
      return buildLocalTimestamp(year, month, day, hour, minute, second);
    }

    const parsed = new Date(rawTime);
    if (!Number.isNaN(parsed.getTime())) {
      return buildLocalTimestamp(
        parsed.getFullYear(),
        parsed.getMonth() + 1,
        parsed.getDate(),
        parsed.getHours(),
        parsed.getMinutes(),
        parsed.getSeconds()
      );
    }
  }

  const now = new Date();
  return buildLocalTimestamp(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds()
  );
}

async function uploadBase64PhotoToStorage(userId: string, date: string, slot: string, base64Data: string): Promise<string> {
  if (!base64Data) return "";
  if (base64Data.startsWith("http")) return base64Data;
  if (base64Data === "__deferred__") return base64Data;

  try {
    const supabase = createSupabaseAdminClient();
    let buffer: Buffer;
    let contentType = "image/jpeg";

    if (base64Data.startsWith("data:image")) {
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        contentType = matches[1];
        buffer = Buffer.from(matches[2], "base64");
      } else {
        buffer = Buffer.from(base64Data.split(",")[1] || base64Data, "base64");
      }
    } else {
      buffer = Buffer.from(base64Data, "base64");
    }

    const fileName = `${userId}/${date}_${slot.replace(":", "-")}.jpg`;

    const { error } = await supabase.storage
      .from("attendance-photos")
      .upload(fileName, buffer, {
        contentType: contentType,
        upsert: true
      });

    if (error) {
      console.error("Supabase Storage upload error:", error);
      return "";
    }

    const { data } = supabase.storage.from("attendance-photos").getPublicUrl(fileName);
    return data?.publicUrl || "";
  } catch (err) {
    console.error("Exception in uploadBase64PhotoToStorage:", err);
    return "";
  }
}

export async function applyClockIn(payload: {
  userId: string;
  date: string;
  slot: string;
  orderCode?: string;
  isCompleted?: boolean;
  photo?: string;
  gps?: string;
  gpsAddress?: string;
  gpsMeta?: unknown;
  time?: string;
}) {
  const state = await loadRuntimeState();
  const localDateString = toCurrentLocalDateString();
  const holidayDates = Array.isArray(state.holidayDates) ? state.holidayDates : [];
  if (isAttendanceBlockedDate(localDateString) || holidayDates.includes(localDateString)) {
    throw new Error("Hôm nay là ngày nghỉ hoặc ngày lễ, không được chấm công.");
  }

  const key = `${payload.userId}-${payload.date}-${payload.slot}`;
  state.attendance[key] = "normal";

  if (payload.photo || payload.gps) {
    const photoUrl = payload.photo ? await uploadBase64PhotoToStorage(payload.userId, payload.date, payload.slot, payload.photo) : "";
    state.attendanceDetails[key] = {
      photo: photoUrl,
      gps: payload.gps || "",
      gpsAddress: payload.gpsAddress || "",
      gpsMeta: payload.gpsMeta || null,
      time: normalizeAttendanceTime(String(payload.date), payload.time)
    };
  }

  if (payload.orderCode) {
    state.orders = state.orders.map((order) => {
      if (order.code !== payload.orderCode) return order;
      return {
        ...order,
        workStatus: payload.isCompleted ? "pending_confirmation" : "working",
        progressPercent: payload.isCompleted ? 100 : order.progressPercent
      };
    });
  }

  await saveRuntimeState(state);
  return state;
}

export async function attachAttendancePhoto(payload: {
  userId: string;
  date: string;
  slot: string;
  photo: string;
}) {
  const state = await loadRuntimeState();
  const key = `${payload.userId}-${payload.date}-${payload.slot}`;
  const current = state.attendanceDetails[key] || {
    gps: "",
    gpsAddress: "",
    gpsMeta: null,
    time: normalizeAttendanceTime(String(payload.date))
  };
  const photoUrl = payload.photo ? await uploadBase64PhotoToStorage(payload.userId, payload.date, payload.slot, payload.photo) : "";
  state.attendanceDetails[key] = {
    ...current,
    photo: photoUrl
  };
  await saveRuntimeState(state);
  return state.attendanceDetails[key];
}


export async function updateOwnRuntimeAccount(payload: {
  userId: string;
  username: string;
  password: string;
}) {
  const state = await loadRuntimeState();
  const nextUsername = payload.username.trim().toLowerCase();
  const nextPassword = payload.password.trim();
  if (!nextUsername) throw new Error("Tên đăng nhập không được để trống.");
  if (!nextPassword) throw new Error("Mật khẩu không được để trống.");

  const duplicate = state.accounts.some(
    (account) => account.id !== payload.userId && account.username.trim().toLowerCase() === nextUsername
  );
  if (duplicate) {
    throw new Error("Tên đăng nhập này đã tồn tại.");
  }

  let updatedAccount = null as RuntimeState["accounts"][number] | null;
  state.accounts = state.accounts.map((account) => {
    if (account.id !== payload.userId) return account;
    updatedAccount = {
      ...account,
      username: nextUsername,
      password: nextPassword
    };
    return updatedAccount;
  });

  if (!updatedAccount) {
    throw new Error("Không tìm thấy tài khoản.");
  }

  await saveRuntimeState(state);
  return updatedAccount;
}

function roundOvertimeHours(from: string, to: string) {
  const [fromHour, fromMinute] = from.split(":").map(Number);
  const [toHour, toMinute] = to.split(":").map(Number);
  let diffMinutes = (toHour * 60 + toMinute) - (fromHour * 60 + fromMinute);
  if (diffMinutes < 0) diffMinutes += 24 * 60;
  const roundedQuarterHours = Math.floor(diffMinutes / 15);
  return roundedQuarterHours * 0.25;
}

export async function createOvertimeRequest(payload: {
  userId: string;
  from: string;
  to: string;
  reason: string;
  orderCode?: string;
}) {
  const state = await loadRuntimeState();
  const account = getAccountById(state, payload.userId);
  if (!account) throw new Error("Không tìm thấy nhân sự.");
  const primaryPosition = account.positionIds[0] || "";
  if (!canUseOvertime(primaryPosition)) {
    throw new Error("Vị trí hiện tại không được đăng ký tăng ca.");
  }
  if (!payload.reason.trim()) throw new Error("Bạn cần nhập lý do tăng ca.");
  if (!payload.orderCode?.trim()) {
    throw new Error("Bạn cần chọn đơn hàng tăng ca.");
  }

  const matchedOrder = (state.orders || []).find((order: any) => order.code === payload.orderCode?.trim());
  if (!matchedOrder) {
    throw new Error("Không tìm thấy đơn hàng tăng ca.");
  }

  const hours = roundOvertimeHours(payload.from, payload.to);
  if (hours <= 0) {
    throw new Error("Tăng ca chưa đủ 15 phút nên không được tính.");
  }

  const nextRequest = {
    id: `ot-${Date.now()}`,
    userId: payload.userId,
    userDisplayName: account.displayName,
    from: payload.from,
    to: payload.to,
    hours,
    orderCode: matchedOrder.code,
    reason: payload.reason.trim(),
    status: "approved",
    createdAt: new Date().toISOString()
  };

  state.overtimeRequests = [nextRequest, ...(state.overtimeRequests || [])];
  await saveRuntimeState(state);
  return nextRequest;
}

export async function createCompensationBatch(payload: {
  userId: string;
  reason: string;
  items: Array<{ date: string; slots: string[] }>;
}) {
  const state = await loadRuntimeState();
  const account = getAccountById(state, payload.userId);
  if (!account) throw new Error("Không tìm thấy nhân sự.");
  if (!payload.reason.trim()) throw new Error("Bạn cần nhập lý do chấm công bù.");

  const primaryPosition = account.positionIds[0] || "";
  const level = positions.find((item) => item.id === primaryPosition)?.level ?? "staff";
  const submissionSize = payload.items.reduce((total, item) => total + item.slots.length, 0);
  const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const requests = payload.items.map((item, index) => ({
    id: `comp-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    groupId,
    employeeId: payload.userId,
    employeeName: account.displayName,
    employeePositionLevel: level,
    date: item.date,
    slots: item.slots,
    reason: payload.reason.trim(),
    missingCountInMonth: submissionSize,
    requiredApprovals: getRequiredApprovals(level, submissionSize),
    approvals: [],
    status: "pending",
    createdAt: new Date().toISOString()
  }));

  state.compensationRequests = [...requests, ...(state.compensationRequests || [])];
  await saveRuntimeState(state);
  return requests;
}

export async function applyReportDone(payload: { orderCode: string; workerName: string }) {
  const state = await loadRuntimeState();
  state.orders = state.orders.map((order) => {
    if (order.code !== payload.orderCode) return order;
    return {
      ...order,
      workStatus: "pending_confirmation",
      progressPercent: 100,
      finalNote: `Thợ ${payload.workerName} báo cáo hoàn thành qua Mobile App`
    };
  });
  await saveRuntimeState(state);
  return state;
}

export async function deleteRuntimeOrder(payload: { orderId: string }) {
  const state = await loadRuntimeState();
  const targetOrder = state.orders.find((order) => order.id === payload.orderId);
  if (!targetOrder) {
    throw new Error("Không tìm thấy đơn hàng cần xóa.");
  }

  state.orders = state.orders.filter((order) => order.id !== payload.orderId);
  state.customerDebts = (state.customerDebts || []).filter((item) => item.orderId !== payload.orderId);
  await saveRuntimeState(state);
  return { state, deletedOrder: targetOrder };
}

export async function applyAttendanceCompensationResponse(payload: {
  userId: string;
  decision: "decline" | "reset";
  pendingSlots?: Array<{ date?: string; day?: number; slot: string }>;
}) {
  const state = await loadRuntimeState();
  const compensationState = getAttendanceCompState(state, payload.userId);

  if (payload.decision === "reset") {
    compensationState.declineCount = 0;
    compensationState.lastDeclinedAt = null;
    await saveRuntimeState(state);
    return { locked: false, state };
  }

  compensationState.declineCount += 1;
  compensationState.lastDeclinedAt = new Date().toISOString();

  let locked = false;
  const pendingSlots = Array.isArray(payload.pendingSlots) ? payload.pendingSlots : [];
  if (compensationState.declineCount >= 5 && pendingSlots.length > 0) {
    pendingSlots.forEach((item) => {
      const attendanceKey = toAttendanceKey(payload.userId, item);
      if (!state.attendance[attendanceKey]) {
        state.attendance[attendanceKey] = "leave_locked";
      }
    });

    const sortedDates = pendingSlots
      .map((item) => item.date)
      .filter(Boolean)
      .sort((left, right) => String(left).localeCompare(String(right)));

    compensationState.lockedThroughDate =
      (sortedDates[sortedDates.length - 1] as string | undefined) ?? compensationState.lockedThroughDate ?? null;
    compensationState.declineCount = 0;
    locked = true;
  }

  await saveRuntimeState(state);
  return { locked, state };
}

export function buildJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
