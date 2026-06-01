"use client";

import { Lock, User } from "lucide-react";
import { useState } from "react";
import type { UserAccount } from "../accounts";
import { authenticate } from "../accounts";

export function LoginScreen({ accounts, onLogin }: { accounts: UserAccount[]; onLogin: (account: UserAccount) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submitLogin(inputUsername?: string, inputPassword?: string) {
    const effectiveUsername = (inputUsername ?? username).trim();
    const effectivePassword = inputPassword ?? password;
    const account = authenticate(accounts, effectiveUsername, effectivePassword);
    if (!account) {
      setError("Sai tên đăng nhập, mật khẩu hoặc tài khoản đang bị khóa/chưa được duyệt.");
      return;
    }

    setError("");
    onLogin(account);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-4">
      <section className="w-full max-w-xl rounded-xl border border-white/10 bg-white p-8 shadow-2xl md:p-10">
        <div className="mb-9 flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-xl bg-orange-500 text-3xl font-black text-white">G</div>
          <div>
            <div className="text-4xl font-black text-orange-500">GOMITA</div>
            <div className="mt-1 text-base text-slate-500">Đăng nhập phần mềm quản lý</div>
          </div>
        </div>

        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const submittedUsername = String(formData.get("username") ?? "");
            const submittedPassword = String(formData.get("password") ?? "");
            setUsername(submittedUsername);
            setPassword(submittedPassword);
            submitLogin(submittedUsername, submittedPassword);
          }}
        >
          <label className="grid gap-2 text-base font-bold">
            Tên đăng nhập
            <span className="relative">
              <User className="absolute left-4 top-4 h-6 w-6 text-slate-400" />
              <input autoComplete="username" autoFocus className="h-14 w-full rounded-lg border border-slate-200 pl-12 pr-3 text-lg outline-none focus:border-orange-400" name="username" value={username} onChange={(event) => setUsername(event.target.value)} />
            </span>
          </label>
          <label className="grid gap-2 text-base font-bold">
            Mật khẩu
            <span className="relative">
              <Lock className="absolute left-4 top-4 h-6 w-6 text-slate-400" />
              <input autoComplete="current-password" className="h-14 w-full rounded-lg border border-slate-200 pl-12 pr-3 text-lg outline-none focus:border-orange-400" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </span>
          </label>

          {error ? <div className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-600">{error}</div> : null}

          <button className="min-h-14 rounded-lg bg-orange-500 text-lg font-black text-white" type="submit">
            Đăng nhập
          </button>
        </form>
      </section>
    </main>
  );
}
