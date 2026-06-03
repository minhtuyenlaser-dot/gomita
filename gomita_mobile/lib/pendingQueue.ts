import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "./api";

const storageKey = "gomita_mobile_pending_actions_v1";

export type PendingAction =
  | {
      id: string;
      type: "clockin_record";
      payload: {
        userId: string;
        date: number;
        slot: string;
        orderCode?: string | null;
        isCompleted?: boolean;
        gps?: string | null;
        gpsAddress?: string | null;
        gpsMeta?: { lat: number; lng: number; address: string } | null;
        time: string;
      };
    }
  | {
      id: string;
      type: "clockin_photo";
      payload: {
        userId: string;
        date: number;
        slot: string;
        photo: string;
      };
    }
  | {
      id: string;
      type: "account_update";
      payload: {
        userId: string;
        username: string;
        password: string;
      };
    }
  | {
      id: string;
      type: "overtime_request";
      payload: {
        userId: string;
        from: string;
        to: string;
        reason: string;
        orderCode?: string;
      };
    }
  | {
      id: string;
      type: "compensation_request";
      payload: {
        userId: string;
        reason: string;
        items: Array<{ date: string; slots: string[] }>;
      };
    };

async function readQueue() {
  const raw = await AsyncStorage.getItem(storageKey);
  if (!raw) return [] as PendingAction[];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingAction[]) : [];
  } catch {
    await AsyncStorage.removeItem(storageKey);
    return [] as PendingAction[];
  }
}

async function writeQueue(queue: PendingAction[]) {
  await AsyncStorage.setItem(storageKey, JSON.stringify(queue));
}

export async function enqueuePendingAction(action: PendingAction) {
  const queue = await readQueue();
  queue.push(action);
  await writeQueue(queue);
}

export async function getPendingActions() {
  return await readQueue();
}

export async function flushPendingActions(
  serverIp: string,
  callbacks?: {
    onClockinAccepted?: (payload: PendingAction["payload"] & { type: "clockin_record" }) => Promise<void> | void;
    onClockinPhotoAccepted?: (payload: PendingAction["payload"] & { type: "clockin_photo" }) => Promise<void> | void;
    onAccountUpdated?: () => Promise<void> | void;
    onOvertimeAccepted?: () => Promise<void> | void;
    onCompensationAccepted?: () => Promise<void> | void;
  }
) {
  const queue = await readQueue();
  if (!queue.length) {
    return { processed: 0, remaining: 0 };
  }

  const remaining: PendingAction[] = [];
  let processed = 0;

  for (const action of queue) {
    try {
      switch (action.type) {
        case "clockin_record": {
          const response = await fetch(getApiUrl(serverIp, "/api/clockin"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action.payload)
          });
          if (!response.ok) throw new Error("Clock-in metadata rejected");
          processed += 1;
          await callbacks?.onClockinAccepted?.({ ...action.payload, type: "clockin_record" });
          break;
        }
        case "clockin_photo": {
          const response = await fetch(getApiUrl(serverIp, "/api/clockin-photo"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action.payload)
          });
          if (!response.ok) throw new Error("Clock-in photo rejected");
          processed += 1;
          await callbacks?.onClockinPhotoAccepted?.({ ...action.payload, type: "clockin_photo" });
          break;
        }
        case "account_update": {
          const response = await fetch(getApiUrl(serverIp, "/api/account/self"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action.payload)
          });
          if (!response.ok) throw new Error("Account update rejected");
          processed += 1;
          await callbacks?.onAccountUpdated?.();
          break;
        }
        case "overtime_request": {
          const response = await fetch(getApiUrl(serverIp, "/api/overtime/request"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action.payload)
          });
          if (!response.ok) throw new Error("Overtime request rejected");
          processed += 1;
          await callbacks?.onOvertimeAccepted?.();
          break;
        }
        case "compensation_request": {
          const response = await fetch(getApiUrl(serverIp, "/api/compensation/request"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action.payload)
          });
          if (!response.ok) throw new Error("Compensation request rejected");
          processed += 1;
          await callbacks?.onCompensationAccepted?.();
          break;
        }
      }
    } catch {
      remaining.push(action);
    }
  }

  await writeQueue(remaining);
  return { processed, remaining: remaining.length };
}
