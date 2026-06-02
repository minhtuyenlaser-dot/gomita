import { demoAccounts } from "@/modules/hr/accounts";
import type { LeaveRequest } from "@/modules/hr/leave";
import { demoOrders, type Order } from "@/modules/orders/orderFlow";
import type { CashTransaction, CustomerDebt } from "@/modules/finance/types";
import { createSupabaseAdminClient } from "@/lib/backend/supabaseAdmin";
import type { LegacyJsonSnapshot } from "@/lib/backend/types";

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
    feedbackEntries: []
  };
}

function mergeState(base: RuntimeState, patch: RuntimePatch): RuntimeState {
  return {
    ...base,
    ...patch,
    schemaVersion: CURRENT_SCHEMA_VERSION
  };
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
  return nextState;
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

function normalizeAttendanceTime(dayValue: string, rawTime?: string) {
  if (rawTime) {
    const parsed = new Date(rawTime);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }

    const match = rawTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
      const localDateString = toCurrentLocalDateString();
      const parts = localDateString.split("-");
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(dayValue);
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      const second = Number(match[3] || "0");
      const combined = new Date(year, month - 1, day, hour, minute, second);
      if (!Number.isNaN(combined.getTime())) {
        return combined.toISOString();
      }
    }
  }

  return new Date().toISOString();
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
    state.attendanceDetails[key] = {
      photo: payload.photo || "",
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
