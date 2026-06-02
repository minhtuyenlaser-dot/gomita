"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { attendanceSlots, isSlotOpen } from "@/modules/attendance/compensationRules";
import type { AttendanceSlot } from "@/modules/attendance/types";
import type { UserAccount } from "@/modules/hr/accounts";

type RuntimeData = {
  accounts?: UserAccount[];
  attendance?: Record<string, string>;
  holidayDates?: string[];
};

const sessionStorageKey = "gomita_iphone_web_session_v1";

export default function IphoneClockinPage() {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [holidayDates, setHolidayDates] = useState<string[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentAccount, setCurrentAccount] = useState<UserAccount | null>(null);
  const [message, setMessage] = useState("Đăng nhập để chấm công và xem công.");
  const [submitting, setSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const activeSlot = useMemo(
    () => attendanceSlots.find((slot) => isSlotOpen(slot, currentTime)) ?? null,
    [currentTime]
  );

  const isHoliday = useMemo(() => {
    return currentTime.getDay() === 0 || holidayDates.includes(currentDateKey);
  }, [currentDateKey, currentTime, holidayDates]);

  const fetchRuntimeData = useCallback(async () => {
    const response = await fetch("/api/data", { cache: "no-store" });
    const data = (await response.json()) as RuntimeData;
    setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
    setAttendance(data.attendance || {});
    setHolidayDates(Array.isArray(data.holidayDates) ? data.holidayDates : []);
  }, []);

  useEffect(() => {
    void fetchRuntimeData();
  }, [fetchRuntimeData]);

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
  }, [currentAccount]);

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
      await fetchRuntimeData();
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
  }

  async function readPhoto(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Không đọc được ảnh."));
      reader.readAsDataURL(file);
    });
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
      const [photo, gps] = await Promise.all([readPhoto(file), getCurrentGpsText()]);
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
                      void submitClockin(file);
                    }
                  }}
                  ref={fileInputRef}
                  type="file"
                />
                <button
                  className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting || isHoliday || !activeSlot}
                  onClick={() => fileInputRef.current?.click()}
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
