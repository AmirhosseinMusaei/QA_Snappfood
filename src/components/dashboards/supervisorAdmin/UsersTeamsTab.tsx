import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext.tsx";
import { api } from "../../../utils/api.ts";
const roles = [
  "agent",
  "team_lead",
  "manager",
  "qa_controller",
  "qa_supervisor",
  "admin",
];
export function UsersTeamsTab() {
  const { teams, agents, teamLeads, refreshData, updateAgent } = useApp();
  const [users, setUsers] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [user, setUser] = useState({
      username: "",
      name: "",
      password: "",
      role: "agent",
      department: "support",
    }),
    [team, setTeam] = useState({
      name: "",
      department: "support",
      lead_id: "",
    });
  const load = async () => {
    const r = await api("/api/users");
    setUsers(r.data);
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
      await refreshData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-bold">
        مدیریت کاربران، اتصال حساب‌ها و تیم‌ها
      </h2>
      {error && (
        <p role="alert" className="text-rose-600">
          {error}
        </p>
      )}
      <form
        className="flex flex-wrap gap-3 p-4 border rounded-2xl dark:border-slate-700"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api("/api/users", "POST", user);
            setUser({ ...user, username: "", name: "", password: "" });
          });
        }}
      >
        <h3 className="w-full font-bold">کاربر جدید</h3>
        {[
          ["username", "نام کاربری"],
          ["name", "نام کامل"],
          ["password", "رمز عبور جدید"],
        ].map(([key, label]) => (
          <input
            aria-label={label}
            key={key}
            className="border rounded p-2 bg-transparent"
            required
            minLength={key === "password" ? 10 : 1}
            type={key === "password" ? "password" : "text"}
            placeholder={label}
            value={(user as any)[key]}
            onChange={(e) => setUser({ ...user, [key]: e.target.value })}
          />
        ))}
        <select
          aria-label="نقش کاربر جدید"
          className="p-2 border rounded dark:bg-slate-800"
          value={user.role}
          onChange={(e) => setUser({ ...user, role: e.target.value })}
        >
          {roles.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select
          aria-label="واحد کاربر جدید"
          className="p-2 border rounded dark:bg-slate-800"
          value={user.department}
          onChange={(e) => setUser({ ...user, department: e.target.value })}
        >
          <option value="support">پشتیبانی</option>
          <option value="sales">فروش</option>
        </select>
        <button disabled={busy}>ایجاد کاربر</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-right">
          <thead>
            <tr>
              <th>نام / حساب</th>
              <th>نقش</th>
              <th>واحد</th>
              <th>وضعیت</th>
              <th>رمز</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t dark:border-slate-700">
                <td className="p-3">
                  {u.name} / {u.username}
                </td>
                <td>
                  <select
                    aria-label={"نقش " + u.username}
                    disabled={busy}
                    value={u.role}
                    className="p-2 dark:bg-slate-800"
                    onChange={(e) =>
                      run(() =>
                        api("/api/users/" + u.id, "PUT", {
                          role: e.target.value,
                        }),
                      )
                    }
                  >
                    {roles.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    aria-label={"واحد " + u.username}
                    disabled={busy}
                    value={u.department || ""}
                    className="p-2 dark:bg-slate-800"
                    onChange={(e) =>
                      run(() =>
                        api("/api/users/" + u.id, "PUT", {
                          department: e.target.value || null,
                        }),
                      )
                    }
                  >
                    <option value="">نامشخص</option>
                    <option value="support">پشتیبانی</option>
                    <option value="sales">فروش</option>
                  </select>
                </td>
                <td>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        api("/api/users/" + u.id, "PUT", { active: !u.active }),
                      )
                    }
                  >
                    {u.active ? "فعال؛ غیرفعال شود" : "غیرفعال؛ فعال شود"}
                  </button>
                </td>
                <td>
                  <button
                    disabled={busy}
                    onClick={() => {
                      const password = prompt(
                        "رمز جدید حداقل ۱۰ کاراکتر؛ رمز فعلی نمایش داده نمی‌شود",
                      );
                      if (password)
                        run(() =>
                          api("/api/users/" + u.id, "PUT", { password }),
                        );
                    }}
                  >
                    تغییر رمز
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="p-4 border rounded-2xl dark:border-slate-700">
        <h3 className="font-bold">اتصال حساب ورود کارشناس</h3>
        {agents.map((a) => (
          <label
            key={a.id}
            className="flex flex-wrap justify-between gap-3 py-2 text-sm"
          >
            {a.name} / {a.source_id}
            <select
              aria-label={"حساب " + a.source_id}
              disabled={busy}
              value={a.user_id || ""}
              className="border rounded p-2 dark:bg-slate-800"
              onChange={(e) =>
                run(() =>
                  updateAgent(a.id, { user_id: e.target.value || null }),
                )
              }
            >
              <option value="">بدون اتصال</option>
              {users
                .filter((u) => u.role === "agent")
                .map((u) => (
                  <option value={u.id} key={u.id}>
                    {u.name} / {u.username}
                  </option>
                ))}
            </select>
          </label>
        ))}
      </section>
      <form
        className="flex flex-wrap gap-3 p-4 border rounded-2xl dark:border-slate-700"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api("/api/teams", "POST", {
              ...team,
              lead_id: team.lead_id || null,
            });
            setTeam({ ...team, name: "" });
          });
        }}
      >
        <h3 className="w-full font-bold">تیم جدید</h3>
        <input
          aria-label="نام تیم جدید"
          required
          className="border rounded p-2 bg-transparent"
          value={team.name}
          onChange={(e) => setTeam({ ...team, name: e.target.value })}
        />
        <select
          aria-label="واحد تیم"
          className="border rounded p-2 dark:bg-slate-800"
          value={team.department}
          onChange={(e) => setTeam({ ...team, department: e.target.value })}
        >
          <option value="support">پشتیبانی</option>
          <option value="sales">فروش</option>
        </select>
        <select
          aria-label="لید تیم جدید"
          className="border rounded p-2 dark:bg-slate-800"
          value={team.lead_id}
          onChange={(e) => setTeam({ ...team, lead_id: e.target.value })}
        >
          <option value="">بدون لید</option>
          {teamLeads.map((l) => (
            <option value={l.id} key={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <button disabled={busy}>ایجاد تیم</button>
      </form>
      {teams.map((t) => (
        <div
          key={t.id}
          className="flex flex-wrap gap-4 items-center text-sm border-b dark:border-slate-700 p-3"
        >
          <strong>{t.name}</strong>
          <span>{t.department}</span>
          <select
            aria-label={"لید " + t.name}
            disabled={busy}
            value={t.lead_id || ""}
            className="border rounded p-2 dark:bg-slate-800"
            onChange={(e) =>
              run(() =>
                api("/api/teams/" + t.id, "PUT", {
                  lead_id: e.target.value || null,
                }),
              )
            }
          >
            <option value="">بدون لید</option>
            {teamLeads.map((l) => (
              <option value={l.id} key={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button
            disabled={busy}
            onClick={() => {
              const name = prompt("نام جدید تیم", t.name);
              if (name) run(() => api("/api/teams/" + t.id, "PUT", { name }));
            }}
          >
            تغییر نام
          </button>
          <button
            disabled={busy}
            onClick={() => {
              if (confirm("تیم بدون عضو و تاریخچه حذف شود؟"))
                run(() => api("/api/teams/" + t.id, "DELETE", {}));
            }}
          >
            حذف تیم خالی
          </button>
        </div>
      ))}
    </section>
  );
}
