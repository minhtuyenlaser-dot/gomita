"use client";

import { BriefcaseBusiness, Camera, Clock3, Download, FileText, IdCard, Lock, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { UserAccount } from "../accounts";
import type { Position } from "../roles";

type AttendanceKind = "normal" | "compensated";
type Slot = "07:30" | "11:30" | "13:30" | "17:30";

const slots: Slot[] = ["07:30", "11:30", "13:30", "17:30"];

export function ProfileDashboard({ account, position }: { account: UserAccount; accounts: UserAccount[]; position: Position }) {
  const monthDays = useMemo(() => getCurrentMonthDays(), []);
  const [accountOpen, setAccountOpen] = useState(false);
  const [username, setUsername] = useState(account.username);
  const [password, setPassword] = useState(account.password);
  const [attendance, setAttendance] = useState<Record<string, AttendanceKind>>(() => buildInitialAttendance(monthDays));
  const [message, setMessage] = useState("");
  const today = new Date().getDate();
  const expectedDays = monthDays.filter((day) => day.getDay() !== 0 && day.getDate() <= today).length;
  const workDays = countCompleteDays(monthDays, attendance);
  const missing = findMissingSlot(monthDays, attendance);
  const totalHours = workDays * 8;
  const overtime = position.id === "hr" ? 12.5 : 8;
  const workRate = expectedDays ? Math.round((workDays / expectedDays) * 100) : 0;

  function clockIn(slot: Slot) {
    const key = `${today}-${slot}`;
    setAttendance((current) => ({ ...current, [key]: "normal" }));
    setMessage(`Đã chấm công mốc ${slot} hôm nay và cập nhật vào bảng công.`);
  }

  function compensate() {
    if (!missing) return;
    setAttendance((current) => ({ ...current, [`${missing.day}-${missing.slot}`]: "compensated" }));
    setMessage(`Đã gửi chấm công bù ngày ${missing.day}, mốc ${missing.slot}.`);
  }

  return (
    <section className="grid gap-5">
      {message ? <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700">{message}</div> : null}

      <div>
        <h2 className="text-2xl font-black">Xin chào, {account.displayName}</h2>
        <p className="mt-1 text-sm text-slate-500">Chúc bạn một ngày làm việc hiệu quả.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,1.4fr)_repeat(4,minmax(170px,1fr))]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full bg-slate-100">
              <UserRound className="h-14 w-14 text-slate-500" />
              <span className="absolute bottom-1 right-1 grid h-8 w-8 place-items-center rounded-full bg-orange-500 text-white"><Camera className="h-4 w-4" /></span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-black">{account.displayName}</h3>
                <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-black text-orange-600">{position.name}</span>
              </div>
              <InfoLine icon={<BriefcaseBusiness className="h-4 w-4" />} text="Nhân viên chính thức" />
              <InfoLine icon={<IdCard className="h-4 w-4" />} text="CCCD: 0310 1234 5678" />
              <InfoLine icon={<FileText className="h-4 w-4" />} text="HĐLĐ: 12 tháng, hiệu lực 01/01/2026" />
            </div>
          </div>
          <button className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 font-black" onClick={() => setAccountOpen(true)} type="button">
            <Lock className="h-4 w-4" />
            Quản lý tài khoản
          </button>
        </div>

        <Metric title="Tổng công trong tháng" value={`${workDays} / ${expectedDays}`} sub={`${workRate}%`} tone="green" />
        <Metric title="Số giờ làm việc" value={totalHours.toString()} sub="giờ" tone="violet" />
        <Metric title="Tăng ca" value={overtime.toString()} sub="giờ" tone="orange" />
        <Metric title="Nghỉ phép" value="1" sub="ngày" tone="blue" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-black">Bảng chấm công tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}</h2>
            <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
              <Legend color="bg-green-500" label="Đã chấm" />
              <Legend color="bg-blue-500" label="Chấm công bù" />
              <Legend color="bg-slate-300" label="Chưa chấm" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => (
              <button key={slot} className="min-h-10 rounded-lg bg-orange-500 px-3 text-sm font-black text-white" onClick={() => clockIn(slot)} type="button">
                Chấm {slot}
              </button>
            ))}
            {missing ? <button className="min-h-10 rounded-lg border border-blue-300 bg-blue-50 px-3 text-sm font-black text-blue-700" onClick={compensate} type="button">Chấm công bù</button> : null}
            <button className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-black" type="button"><Download className="h-4 w-4" />Tải bảng công</button>
          </div>
        </div>
        <AttendanceGrid monthDays={monthDays} attendance={attendance} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
          <Metric title="Ngày làm việc" value={`${workDays}`} sub="ngày" tone="green" compact />
          <Metric title="Ngày thiếu" value={`${Math.max(0, expectedDays - workDays)}`} sub="ngày" tone="orange" compact />
          <Metric title="Tổng giờ làm" value={`${totalHours}`} sub="giờ" tone="violet" compact />
          <Metric title="Tổng tăng ca" value={`${overtime}`} sub="giờ" tone="blue" compact />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-center shadow-sm">
          <div className="mx-auto grid h-28 w-28 place-items-center rounded-full border-[14px] border-green-500 text-xl font-black">{workRate}%</div>
          <div className="mt-3 text-sm font-bold text-slate-600">Tỷ lệ chấm công</div>
        </div>
      </div>

      {accountOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <section className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h2 className="text-xl font-black">Quản lý tài khoản</h2>
            <div className="mt-4 grid gap-3">
              <TextInput label="Tên đăng nhập" value={username} onChange={setUsername} />
              <TextInput label="Mật khẩu" value={password} onChange={setPassword} type="password" />
              <button className="min-h-12 rounded-lg bg-orange-500 font-black text-white" onClick={() => {
                account.username = username.trim();
                account.password = password.trim();
                setAccountOpen(false);
                setMessage("Đã cập nhật tên đăng nhập và mật khẩu trong phiên hiện tại.");
              }} type="button">Lưu thay đổi</button>
              <button className="min-h-11 rounded-lg border border-slate-200 font-bold" onClick={() => setAccountOpen(false)} type="button">Đóng</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export function CompanyPayrollDashboard({ accounts }: { accounts: UserAccount[] }) {
  const monthDays = getCurrentMonthDays();
  const rows = accounts.filter((account) => account.status === "active" && !account.positionIds.includes("director")).map((account, index) => {
    const marks = monthDays.map((day) => day.getDay() === 0 ? "" : (day.getDate() + index) % 7 === 0 ? "/" : "X");
    const work = marks.reduce((total, mark) => total + (mark === "X" ? 1 : mark === "/" ? 0.5 : 0), 0);
    const daySalary = account.positionIds.includes("hr") ? 420000 : account.positionIds.includes("accountant") ? 400000 : 350000;
    return { account, marks, work, daySalary, salary: work * daySalary };
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-xl font-black">Bảng lương công ty</h2>
        <p className="text-sm text-slate-500">Công từng ngày, tổng công, lương ngày và lương tháng của toàn công ty.</p>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[1480px]">
          <div className="grid bg-slate-50 px-4 py-3 text-sm font-black text-slate-600" style={{ gridTemplateColumns: `180px 140px repeat(${monthDays.length}, 38px) 80px 120px 140px` }}>
            <div>Nhân sự</div>
            <div>Bộ phận</div>
            {monthDays.map((day) => <div key={day.toISOString()} className="text-center">{day.getDate()}</div>)}
            <div className="text-center">Công</div>
            <div className="text-right">Lương ngày</div>
            <div className="text-right">Lương tháng</div>
          </div>
          {rows.map((row) => (
            <div key={row.account.id} className="grid items-center border-t border-slate-200 px-4 py-3 text-sm" style={{ gridTemplateColumns: `180px 140px repeat(${monthDays.length}, 38px) 80px 120px 140px` }}>
              <div className="font-black">{row.account.displayName}</div>
              <div className="text-slate-500">{row.account.department}</div>
              {row.marks.map((mark, index) => <div key={`${row.account.id}-${index}`} className="text-center font-black">{mark}</div>)}
              <div className="text-center font-bold">{row.work}</div>
              <div className="text-right font-bold">{row.daySalary.toLocaleString("vi-VN")} đ</div>
              <div className="text-right font-black">{row.salary.toLocaleString("vi-VN")} đ</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AttendanceGrid({ monthDays, attendance }: { monthDays: Date[]; attendance: Record<string, AttendanceKind> }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1240px]">
        <div className="grid border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-600" style={{ gridTemplateColumns: `110px repeat(${monthDays.length}, 36px)` }}>
          <div>Mốc giờ</div>
          {monthDays.map((day) => <div key={day.toISOString()} className="text-center">{day.getDate()}</div>)}
        </div>
        {slots.map((slot) => (
          <div key={slot} className="grid items-center border-b border-slate-100 px-4 py-3 text-sm" style={{ gridTemplateColumns: `110px repeat(${monthDays.length}, 36px)` }}>
            <div className="font-black">{slot}</div>
            {monthDays.map((day) => {
              const kind = attendance[`${day.getDate()}-${slot}`];
              return <div key={`${day.toISOString()}-${slot}`} className="grid place-items-center"><span className={`h-3 w-3 rounded-full ${kind === "normal" ? "bg-green-500" : kind === "compensated" ? "bg-blue-500" : "bg-slate-300"}`} /></div>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function buildInitialAttendance(days: Date[]) {
  const data: Record<string, AttendanceKind> = {};
  const today = new Date().getDate();
  days.forEach((day) => {
    if (day.getDay() === 0 || day.getDate() > today) return;
    slots.forEach((slot) => {
      if ((day.getDate() + slot.length) % 9 !== 0) data[`${day.getDate()}-${slot}`] = "normal";
    });
  });
  return data;
}

function countCompleteDays(days: Date[], attendance: Record<string, AttendanceKind>) {
  return days.filter((day) => day.getDay() !== 0 && day.getDate() <= new Date().getDate() && slots.every((slot) => attendance[`${day.getDate()}-${slot}`])).length;
}

function findMissingSlot(days: Date[], attendance: Record<string, AttendanceKind>) {
  const today = new Date().getDate();
  for (const day of days) {
    if (day.getDay() === 0 || day.getDate() > today) continue;
    for (const slot of slots) {
      if (!attendance[`${day.getDate()}-${slot}`]) return { day: day.getDate(), slot };
    }
  }
  return null;
}

function getCurrentMonthDays() {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => new Date(now.getFullYear(), now.getMonth(), index + 1));
}

function InfoLine({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">{icon}{text}</div>;
}

function Metric({ title, value, sub, tone, compact = false }: { title: string; value: string; sub: string; tone: "green" | "violet" | "orange" | "blue"; compact?: boolean }) {
  const colors = { green: "text-green-600 bg-green-50", violet: "text-violet-600 bg-violet-50", orange: "text-orange-600 bg-orange-50", blue: "text-blue-600 bg-blue-50" };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-4 grid h-10 w-10 place-items-center rounded-full ${colors[tone]}`}><Clock3 className="h-5 w-5" /></div>
      <div className="text-sm font-bold text-slate-500">{title}</div>
      <div className={`${compact ? "text-2xl" : "text-3xl"} mt-2 font-black`}>{value}</div>
      <div className="mt-1 text-sm font-bold text-slate-500">{sub}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span>;
}

function TextInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="grid gap-1 text-sm font-bold">{label}<input className="h-11 rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-orange-400" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
