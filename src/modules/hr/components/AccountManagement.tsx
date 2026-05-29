"use client";

import { Edit3, Lock, Plus, Save, Trash2, UserRound, X, XCircle } from "lucide-react";
import { useState } from "react";
import type { UserAccount } from "../accounts";
import { hasDuplicateUsername, validateAccount } from "../accounts";
import { positions } from "../roles";

type Draft = Pick<UserAccount, "displayName" | "username" | "password" | "department" | "positionIds" | "salaryType" | "salaryValue">;

const departments = ["Giám đốc", "Phòng Sale", "Phòng Thiết kế", "Xưởng", "Giám sát", "Kế toán", "Nhân sự"];

const emptyDraft: Draft = {
  displayName: "",
  username: "",
  password: "",
  department: "Nhân sự",
  positionIds: [],
  salaryType: "daily",
  salaryValue: 350000
};

export function AccountManagement({
  accounts,
  currentAccountId,
  currentPositionId,
  onAccountsChange
}: {
  accounts: UserAccount[];
  currentAccountId: string;
  currentPositionId: string;
  onAccountsChange: (accounts: UserAccount[]) => void;
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const canApprove = currentPositionId === "director";
  const canEdit = currentPositionId === "hr" || currentPositionId === "director";

  function saveAccount() {
    const issues = validateAccount(draft);
    if (hasDuplicateUsername(accounts, draft.username, editingId)) {
      issues.push("Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác.");
    }
    if (draft.salaryValue === undefined || isNaN(draft.salaryValue) || draft.salaryValue <= 0) {
      issues.push("Mức lương phải là một số lớn hơn 0.");
    }
    if (issues.length) {
      setMessage(issues.join(" "));
      return;
    }

    const normalizedDraft = {
      ...draft,
      displayName: draft.displayName.trim(),
      username: draft.username.trim().toLowerCase(),
      password: draft.password.trim(),
      salaryValue: Number(draft.salaryValue)
    };

    if (editingId) {
      onAccountsChange(accounts.map((account) => account.id === editingId ? { ...account, ...normalizedDraft } : account));
      setEditingId(null);
      setMessage("Đã sửa tài khoản.");
    } else {
      const createdByDirector = currentPositionId === "director";
      onAccountsChange([
        {
          id: `u-${Date.now()}`,
          ...normalizedDraft,
          status: createdByDirector ? "active" : "pending_admin"
        },
        ...accounts
      ]);
      setMessage(createdByDirector ? "Giám đốc đã tạo tài khoản. Tài khoản được kích hoạt ngay." : "Nhân sự đã tạo tài khoản. Tài khoản đang chờ Giám đốc duyệt.");
    }

    setDraft(emptyDraft);
  }

  function startEdit(account: UserAccount) {
    setEditingId(account.id);
    setDraft({
      displayName: account.displayName,
      username: account.username,
      password: account.password,
      department: account.department,
      positionIds: account.positionIds,
      salaryType: account.salaryType ?? "daily",
      salaryValue: account.salaryValue ?? (account.positionIds.includes("hr") ? 420000 : account.positionIds.includes("accountant") ? 400000 : 350000)
    });
    setMessage(`Đang sửa tài khoản ${account.displayName}.`);
  }

  function deleteAccount(account: UserAccount) {
    if (account.positionIds.includes("director")) {
      setMessage("Không thể xóa tài khoản Giám đốc.");
      return;
    }
    if (account.id === currentAccountId) {
      setMessage("Nhân sự không được xóa tài khoản của chính mình.");
      return;
    }
    const ok = window.confirm(`Xóa tài khoản ${account.displayName}? Dữ liệu lịch sử nên được giữ ở backend khi nối Supabase.`);
    if (!ok) return;
    onAccountsChange(accounts.filter((item) => item.id !== account.id));
    setMessage(`Đã xóa tài khoản ${account.displayName}.`);
  }

  function toggleLock(accountId: string) {
    onAccountsChange(accounts.map((account) => {
      if (account.id !== accountId) return account;
      return { ...account, status: account.status === "locked" ? "active" : "locked" };
    }));
  }

  function approve(accountId: string) {
    onAccountsChange(accounts.map((account) => account.id === accountId ? { ...account, status: "active" } : account));
    setMessage("Giám đốc đã duyệt tài khoản.");
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <UserRound className="h-6 w-6 text-orange-500" />
          <div>
            <h2 className="text-xl font-black">Quản lý tài khoản nhân sự</h2>
            <p className="text-sm text-slate-500">Nhân sự tạo tài khoản cần Giám đốc duyệt. Giám đốc tạo tài khoản thì kích hoạt ngay.</p>
          </div>
        </div>

        {canEdit ? (
          <>
            <div className="grid gap-3 md:grid-cols-7">
              <input className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-400" placeholder="Tên hiển thị *" value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} />
              <input className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-400" placeholder="Tên đăng nhập *" value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} />
              <input className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-400" placeholder="Mật khẩu *" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} />
              <select className="h-11 rounded-lg border border-slate-200 px-3 bg-white" value={draft.department} onChange={(event) => setDraft({ ...draft, department: event.target.value })}>
                {departments.map((department) => <option key={department}>{department}</option>)}
              </select>
              <select className="h-11 rounded-lg border border-slate-200 px-3 bg-white font-bold text-slate-700" value={draft.salaryType || "daily"} onChange={(event) => setDraft({ ...draft, salaryType: event.target.value as "daily" | "monthly" })}>
                <option value="daily">Lương ngày</option>
                <option value="monthly">Lương tháng</option>
              </select>
              <input className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-orange-400 font-bold" type="number" placeholder="Mức lương (VNĐ) *" value={draft.salaryValue ?? ""} onChange={(event) => setDraft({ ...draft, salaryValue: event.target.value === "" ? undefined : Number(event.target.value) })} />
              <button className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 font-black text-white" onClick={saveAccount} type="button">
                {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? "Lưu sửa" : "Tạo tài khoản"}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {positions.filter((position) => position.id !== "admin").map((position) => {
                const active = draft.positionIds.includes(position.id);
                return (
                  <button key={position.id} className={`rounded-full border px-3 py-1 text-sm font-bold ${active ? "border-orange-500 bg-orange-50 text-orange-600" : "border-slate-200 text-slate-500"}`} onClick={() => {
                    setDraft((current) => ({
                      ...current,
                      positionIds: active ? current.positionIds.filter((id) => id !== position.id) : [...current.positionIds, position.id]
                    }));
                  }} type="button">
                    {position.name}
                  </button>
                );
              })}
            </div>

            {editingId ? (
              <button className="mt-3 flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 font-bold" onClick={() => {
                setEditingId(null);
                setDraft(emptyDraft);
                setMessage("");
              }} type="button">
                <X className="h-4 w-4" />
                Hủy sửa
              </button>
            ) : null}
          </>
        ) : (
          <div className="rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-600">Vị trí này chỉ được xem danh sách tài khoản.</div>
        )}

        {message ? <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700">{message}</div> : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="min-w-[920px]">
        <div className="grid grid-cols-[1.2fr_0.9fr_1.1fr_1.2fr_0.8fr_1.4fr] bg-slate-50 px-4 py-3 text-sm font-black text-slate-600">
          <div>Nhân sự</div>
          <div>Đăng nhập</div>
          <div>Lương</div>
          <div>Chức vụ</div>
          <div>Trạng thái</div>
          <div>Thao tác</div>
        </div>
        {accounts.map((account) => {
          const typeLabel = account.salaryType === "monthly" ? "Lương tháng" : "Lương ngày";
          const fallbackVal = account.salaryValue ?? (account.positionIds.includes("hr") ? 420000 : account.positionIds.includes("accountant") ? 400000 : 350000);
          return (
            <div key={account.id} className="grid grid-cols-[1.2fr_0.9fr_1.1fr_1.2fr_0.8fr_1.4fr] items-center border-t border-slate-200 px-4 py-4 text-sm">
              <div>
                <div className="font-black">{account.displayName}</div>
                <div className="text-slate-500">{account.department}</div>
              </div>
              <div>
                <div>{account.username}</div>
                <div className="text-slate-500">Mật khẩu có thể đổi</div>
              </div>
              <div>
                <div className="font-bold text-slate-900">{fallbackVal.toLocaleString("vi-VN")} đ</div>
                <div className="text-xs text-slate-500 font-bold">{typeLabel}</div>
              </div>
              <div>{account.positionIds.map((id) => positions.find((position) => position.id === id)?.name ?? id).join(", ")}</div>
              <div className="font-bold">{account.status === "active" ? "Hoạt động" : account.status === "locked" ? "Đã khóa" : "Chờ Giám đốc"}</div>
              <div className="flex flex-wrap gap-2">
                {account.status === "pending_admin" && canApprove ? (
                  <button className="flex min-h-10 items-center gap-2 rounded-lg border border-green-500 px-3 font-bold text-green-600" onClick={() => approve(account.id)} type="button">
                    <Save className="h-4 w-4" />
                    Duyệt
                  </button>
                ) : null}
                {canEdit ? (
                  <>
                    <button className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 font-bold" onClick={() => startEdit(account)} type="button">
                      <Edit3 className="h-4 w-4" />
                      Sửa
                    </button>
                    <button className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 font-bold" onClick={() => toggleLock(account.id)} type="button">
                      {account.status === "locked" ? <Lock className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {account.status === "locked" ? "Mở khóa" : "Khóa"}
                    </button>
                    <button className="flex min-h-10 items-center gap-2 rounded-lg border border-red-200 px-3 font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-50" disabled={account.id === currentAccountId || account.positionIds.includes("director")} onClick={() => deleteAccount(account)} type="button">
                      <Trash2 className="h-4 w-4" />
                      Xóa
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </section>
  );
}
