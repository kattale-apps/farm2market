"use client";

import { useState, useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useOfflineQuery } from "@/app/hooks/useOfflineQuery";
import { useOfflineMutation } from "@/app/hooks/useOfflineMutation";
import Link from "next/link";

const BRAND = "#2e7d32";
const BRAND_BG = "#e8f5e9";
const FONT = '"Montserrat", sans-serif';

type Tab = "tasks" | "seasons" | "calendar";
type TaskStatus = "upcoming" | "done" | "skipped";
type Recurrence = "none" | "daily" | "weekly" | "monthly";

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });
}
function isoDate(ts: number) {
  return new Date(ts).toISOString().split("T")[0];
}

// ─── TASKS TAB ───────────────────────────────────────────────────────────────
function TasksTab({ userId }: { userId: Id<"users"> }) {
  const tasks = useOfflineQuery(
    (api as any).farmPlanner.listTasks,
    { farmerId: userId },
    `planner_tasks_${userId}`
  ) as any[] | undefined;

  const seasonPlans = useOfflineQuery(
    (api as any).farmPlanner.listSeasonPlans,
    { farmerId: userId },
    `planner_seasons_${userId}`
  ) as any[] | undefined;

  const createTask = useOfflineMutation<any>((api as any).farmPlanner.createTask);
  const completeTask = useOfflineMutation<any>((api as any).farmPlanner.completeTask);
  const skipTask = useOfflineMutation<any>((api as any).farmPlanner.skipTask);
  const deleteTask = useOfflineMutation<any>((api as any).farmPlanner.deleteTask);

  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "upcoming" | "done" | "skipped">("all");
  const [newTask, setNewTask] = useState({ title: "", emoji: "✅", dueDate: "", notes: "", recurrence: "none" as Recurrence, seasonPlanId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newTask.title.trim()) { setError("Task title is required"); return; }
    if (!newTask.dueDate) { setError("Due date is required"); return; }
    setSaving(true);
    try {
      await createTask({
        farmerId: userId,
        seasonPlanId: newTask.seasonPlanId ? newTask.seasonPlanId as Id<"farmSeasonPlans"> : undefined,
        title: newTask.title,
        emoji: newTask.emoji,
        dueDate: new Date(newTask.dueDate).getTime(),
        notes: newTask.notes || undefined,
        recurrence: newTask.recurrence,
      });
      setShowForm(false);
      setNewTask({ title: "", emoji: "✅", dueDate: "", notes: "", recurrence: "none", seasonPlanId: "" });
      setError(null);
    } catch (e: any) { setError(e.message ?? "Failed"); }
    setSaving(false);
  };

  const filteredTasks = (tasks ?? []).filter((t: any) => filter === "all" || t.status === filter);
  const overdueCount = (tasks ?? []).filter((t: any) => t.isOverdue).length;
  const upcomingCount = (tasks ?? []).filter((t: any) => t.status === "upcoming" && !t.isOverdue).length;
  const doneCount = (tasks ?? []).filter((t: any) => t.status === "done").length;

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.6rem", marginBottom: "1rem" }}>
        {[
          { label: "🔴 Overdue", count: overdueCount, bg: "#ffebee", color: "#c62828", filterVal: "upcoming" as const },
          { label: "🟡 Upcoming", count: upcomingCount, bg: "#fff8e1", color: "#f57f17", filterVal: "upcoming" as const },
          { label: "✅ Done", count: doneCount, bg: BRAND_BG, color: BRAND, filterVal: "done" as const },
        ].map((s) => (
          <button key={s.label} onClick={() => setFilter(filter === s.filterVal && s.label.includes("Done") ? "all" : filter === s.filterVal ? "all" : s.filterVal)}
            style={{ background: s.bg, border: "none", borderRadius: 10, padding: "0.65rem", textAlign: "center", cursor: "pointer", fontFamily: FONT }}>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: "0.68rem", color: s.color }}>{s.label}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", gap: "0.35rem" }}>
          {(["all", "upcoming", "done", "skipped"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: "0.25rem 0.6rem", background: filter === f ? BRAND : "#f5f5f5", color: filter === f ? "#fff" : "#666", border: "1px solid " + (filter === f ? BRAND : "#e0e0e0"), borderRadius: 6, cursor: "pointer", fontFamily: FONT, fontSize: "0.72rem", fontWeight: filter === f ? 700 : 400 }}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: "0.4rem 0.85rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.78rem", cursor: "pointer", fontFamily: FONT }}>
          {showForm ? "Cancel" : "➕ Task"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#fff", borderRadius: 12, padding: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
            <input value={newTask.emoji} onChange={(e) => setNewTask({ ...newTask, emoji: e.target.value })}
              style={{ width: 44, textAlign: "center", padding: "0.4rem", border: "1px solid #ddd", borderRadius: 8, fontSize: "1.2rem" }} />
            <input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Task title…"
              style={{ padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.88rem" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
              style={{ padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem" }} />
            <select value={newTask.recurrence} onChange={(e) => setNewTask({ ...newTask, recurrence: e.target.value as Recurrence })}
              style={{ padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.82rem" }}>
              <option value="none">No recurrence</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          {seasonPlans && seasonPlans.length > 0 && (
            <select value={newTask.seasonPlanId} onChange={(e) => setNewTask({ ...newTask, seasonPlanId: e.target.value })}
              style={{ width: "100%", padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.82rem", marginBottom: "0.5rem", boxSizing: "border-box" }}>
              <option value="">— Link to season plan (optional) —</option>
              {seasonPlans.map((sp: any) => <option key={sp._id} value={sp._id}>{sp.emoji ?? "🌾"} {sp.planName}</option>)}
            </select>
          )}
          <input value={newTask.notes} onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })} placeholder="Notes (optional)"
            style={{ width: "100%", padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.82rem", boxSizing: "border-box", marginBottom: "0.75rem" }} />
          {error && <p style={{ color: "#c62828", fontSize: "0.8rem", margin: "0 0 0.5rem" }}>⚠️ {error}</p>}
          <button onClick={handleCreate} disabled={saving}
            style={{ padding: "0.55rem 1.2rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONT, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : "💾 Create Task"}
          </button>
        </div>
      )}

      {tasks === undefined ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading tasks…</div>
      ) : filteredTasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2.5rem 1.5rem", background: "#fff", borderRadius: 12 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✅</div>
          <p style={{ color: "#888" }}>No tasks here. {filter === "all" ? "Create your first task!" : `No ${filter} tasks.`}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {filteredTasks.map((task: any) => (
            <div key={task._id} style={{ background: "#fff", borderRadius: 12, padding: "0.9rem 1rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: task.isOverdue ? "1.5px solid #ef9a9a" : "1px solid #f0f0f0" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem" }}>
                <span style={{ fontSize: "1.4rem", marginTop: 2 }}>{task.emoji || "✅"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem", color: task.status === "done" ? "#888" : "#1a1a1a", textDecoration: task.status === "done" ? "line-through" : "none" }}>
                    {task.title}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: task.isOverdue ? "#c62828" : "#888", marginTop: "0.15rem" }}>
                    {task.isOverdue ? "🔴 Overdue · " : "📅 "}{formatDate(task.dueDate)}
                    {task.recurrence !== "none" && <span style={{ marginLeft: "0.4rem", color: "#1565c0" }}>🔁 {task.recurrence}</span>}
                  </div>
                  {task.notes && <p style={{ margin: "0.3rem 0 0", fontSize: "0.73rem", color: "#666" }}>{task.notes}</p>}
                </div>
                <span style={{ fontSize: "0.68rem", padding: "0.2rem 0.5rem", borderRadius: 10, background: task.status === "done" ? BRAND_BG : task.status === "skipped" ? "#f5f5f5" : task.isOverdue ? "#ffebee" : "#fff8e1", color: task.status === "done" ? BRAND : task.status === "skipped" ? "#aaa" : task.isOverdue ? "#c62828" : "#f57f17" }}>
                  {task.status}
                </span>
              </div>
              {task.status === "upcoming" && (
                <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
                  <button onClick={async () => await completeTask({ taskId: task._id, requestingUserId: userId })}
                    style={{ padding: "0.3rem 0.7rem", background: BRAND_BG, border: `1px solid #a5d6a7`, borderRadius: 6, fontSize: "0.72rem", cursor: "pointer", color: BRAND, fontFamily: FONT, fontWeight: 600 }}>
                    ✅ Done
                  </button>
                  <button onClick={async () => await skipTask({ taskId: task._id, requestingUserId: userId })}
                    style={{ padding: "0.3rem 0.7rem", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: "0.72rem", cursor: "pointer", color: "#888", fontFamily: FONT }}>
                    Skip
                  </button>
                  <button onClick={async () => { if (!confirm("Delete this task?")) return; await deleteTask({ taskId: task._id, requestingUserId: userId }); }}
                    style={{ padding: "0.3rem 0.7rem", background: "#ffebee", border: "1px solid #ef9a9a", borderRadius: 6, fontSize: "0.72rem", cursor: "pointer", color: "#c62828", fontFamily: FONT }}>
                    🗑
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SEASON PLANS TAB ────────────────────────────────────────────────────────
function SeasonsTab({ userId }: { userId: Id<"users"> }) {
  const seasonPlans = useOfflineQuery(
    (api as any).farmPlanner.listSeasonPlans,
    { farmerId: userId },
    `planner_seasons_${userId}`
  ) as any[] | undefined;

  const cropTemplates = useOfflineQuery(
    (api as any).farmCostTemplates.listCropCostTemplates,
    { requestingUserId: userId },
    `cost_crop_${userId}`
  ) as any[] | undefined;

  const livestockTemplates = useOfflineQuery(
    (api as any).farmCostTemplates.listLivestockCostTemplates,
    { requestingUserId: userId },
    `cost_livestock_${userId}`
  ) as any[] | undefined;

  const createPlan = useOfflineMutation<any>((api as any).farmPlanner.createSeasonPlan);
  const updateStatus = useOfflineMutation<any>((api as any).farmPlanner.updateSeasonPlanStatus);
  const deletePlan = useOfflineMutation<any>((api as any).farmPlanner.deleteSeasonPlan);

  const [showForm, setShowForm] = useState(false);
  const [newPlan, setNewPlan] = useState({ planName: "", emoji: "🌾", cropType: "", startDate: "", endDate: "", linkedCropTemplate: "", linkedLivestockTemplate: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    planning: { bg: "#e3f2fd", color: "#1565c0" },
    active: { bg: BRAND_BG, color: BRAND },
    completed: { bg: "#f3e5f5", color: "#6a1b9a" },
    cancelled: { bg: "#ffebee", color: "#c62828" },
  };

  const handleCreate = async () => {
    if (!newPlan.planName.trim()) { setError("Plan name is required"); return; }
    if (!newPlan.startDate) { setError("Start date is required"); return; }
    setSaving(true);
    try {
      await createPlan({
        farmerId: userId,
        planName: newPlan.planName,
        emoji: newPlan.emoji,
        cropType: newPlan.cropType || undefined,
        startDate: new Date(newPlan.startDate).getTime(),
        endDate: newPlan.endDate ? new Date(newPlan.endDate).getTime() : undefined,
        linkedCostTemplateId: newPlan.linkedCropTemplate ? newPlan.linkedCropTemplate as Id<"cropCostTemplates"> : undefined,
        linkedLivestockCostTemplateId: newPlan.linkedLivestockTemplate ? newPlan.linkedLivestockTemplate as Id<"livestockCostTemplates"> : undefined,
        notes: newPlan.notes || undefined,
      });
      setShowForm(false);
      setNewPlan({ planName: "", emoji: "🌾", cropType: "", startDate: "", endDate: "", linkedCropTemplate: "", linkedLivestockTemplate: "", notes: "" });
      setError(null);
    } catch (e: any) { setError(e.message ?? "Failed"); }
    setSaving(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>🌾 Season Plans</h2>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: "0.4rem 0.85rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.78rem", cursor: "pointer", fontFamily: FONT }}>
          {showForm ? "Cancel" : "➕ New Plan"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#fff", borderRadius: 12, padding: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "end" }}>
            <input value={newPlan.emoji} onChange={(e) => setNewPlan({ ...newPlan, emoji: e.target.value })}
              style={{ width: 44, textAlign: "center", padding: "0.4rem", border: "1px solid #ddd", borderRadius: 8, fontSize: "1.2rem" }} />
            <input value={newPlan.planName} onChange={(e) => setNewPlan({ ...newPlan, planName: e.target.value })} placeholder="Plan name…"
              style={{ padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.88rem" }} />
            <input value={newPlan.cropType} onChange={(e) => setNewPlan({ ...newPlan, cropType: e.target.value })} placeholder="Crop/livestock type"
              style={{ padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <div>
              <div style={{ fontSize: "0.72rem", color: "#666", marginBottom: "0.2rem" }}>Start date *</div>
              <input type="date" value={newPlan.startDate} onChange={(e) => setNewPlan({ ...newPlan, startDate: e.target.value })}
                style={{ width: "100%", padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem", boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "#666", marginBottom: "0.2rem" }}>End date (optional)</div>
              <input type="date" value={newPlan.endDate} onChange={(e) => setNewPlan({ ...newPlan, endDate: e.target.value })}
                style={{ width: "100%", padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem", boxSizing: "border-box" }} />
            </div>
          </div>
          {cropTemplates && cropTemplates.length > 0 && (
            <select value={newPlan.linkedCropTemplate} onChange={(e) => setNewPlan({ ...newPlan, linkedCropTemplate: e.target.value })}
              style={{ width: "100%", padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.82rem", marginBottom: "0.5rem", boxSizing: "border-box" }}>
              <option value="">— Link crop cost template (auto-generate tasks) —</option>
              {cropTemplates.map((t: any) => <option key={t._id} value={t._id}>{t.emoji ?? "🌾"} {t.cropType}</option>)}
            </select>
          )}
          {livestockTemplates && livestockTemplates.length > 0 && (
            <select value={newPlan.linkedLivestockTemplate} onChange={(e) => setNewPlan({ ...newPlan, linkedLivestockTemplate: e.target.value })}
              style={{ width: "100%", padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.82rem", marginBottom: "0.5rem", boxSizing: "border-box" }}>
              <option value="">— Link livestock cost template (auto-generate tasks) —</option>
              {livestockTemplates.map((t: any) => <option key={t._id} value={t._id}>{t.emoji ?? "🐄"} {t.livestockType}</option>)}
            </select>
          )}
          <input value={newPlan.notes} onChange={(e) => setNewPlan({ ...newPlan, notes: e.target.value })} placeholder="Notes (optional)"
            style={{ width: "100%", padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.82rem", boxSizing: "border-box", marginBottom: "0.75rem" }} />
          {error && <p style={{ color: "#c62828", fontSize: "0.8rem", margin: "0 0 0.5rem" }}>⚠️ {error}</p>}
          <button onClick={handleCreate} disabled={saving}
            style={{ padding: "0.55rem 1.2rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONT, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : "💾 Create Plan"}
          </button>
        </div>
      )}

      {seasonPlans === undefined ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading…</div>
      ) : seasonPlans.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2.5rem 1.5rem", background: "#fff", borderRadius: 12 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🌾</div>
          <p style={{ color: "#888" }}>No season plans yet. Create your first planting season!</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {seasonPlans.map((plan: any) => {
            const sc = STATUS_COLORS[plan.status] ?? { bg: "#f5f5f5", color: "#666" };
            return (
              <div key={plan._id} style={{ background: "#fff", borderRadius: 12, padding: "1rem", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.4rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ fontSize: "1.6rem" }}>{plan.emoji ?? "🌾"}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{plan.planName}</div>
                      <div style={{ fontSize: "0.72rem", color: "#888" }}>
                        {formatDate(plan.startDate)}{plan.endDate ? ` → ${formatDate(plan.endDate)}` : ""}
                        {plan.cropType ? ` · ${plan.cropType}` : ""}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.7rem", padding: "0.2rem 0.6rem", borderRadius: 10, background: sc.bg, color: sc.color, fontWeight: 700 }}>
                    {plan.status}
                  </span>
                </div>
                {plan.notes && <p style={{ margin: "0.25rem 0 0.5rem", fontSize: "0.75rem", color: "#666" }}>{plan.notes}</p>}
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                  {plan.status === "planning" && (
                    <button onClick={async () => await updateStatus({ planId: plan._id, requestingUserId: userId, status: "active" })}
                      style={{ padding: "0.3rem 0.65rem", background: BRAND_BG, border: `1px solid #a5d6a7`, borderRadius: 6, fontSize: "0.72rem", cursor: "pointer", color: BRAND, fontFamily: FONT, fontWeight: 600 }}>
                      ▶ Activate
                    </button>
                  )}
                  {plan.status === "active" && (
                    <button onClick={async () => await updateStatus({ planId: plan._id, requestingUserId: userId, status: "completed" })}
                      style={{ padding: "0.3rem 0.65rem", background: "#f3e5f5", border: "1px solid #ce93d8", borderRadius: 6, fontSize: "0.72rem", cursor: "pointer", color: "#6a1b9a", fontFamily: FONT, fontWeight: 600 }}>
                      🏁 Complete
                    </button>
                  )}
                  <button onClick={async () => { if (!confirm("Delete this plan and its auto-generated tasks?")) return; await deletePlan({ planId: plan._id, requestingUserId: userId }); }}
                    style={{ padding: "0.3rem 0.65rem", background: "#ffebee", border: "1px solid #ef9a9a", borderRadius: 6, fontSize: "0.72rem", cursor: "pointer", color: "#c62828", fontFamily: FONT }}>
                    🗑 Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CALENDAR TAB ─────────────────────────────────────────────────────────────
function CalendarTab({ userId }: { userId: Id<"users"> }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);

  const calendarTasks = useOfflineQuery(
    (api as any).farmPlanner.getCalendarTasks,
    { farmerId: userId, fromDate: firstDay.getTime(), toDate: lastDay.getTime() },
    `planner_cal_${userId}_${viewYear}_${viewMonth}`
  ) as Record<string, any[]> | undefined;

  const monthLabel = firstDay.toLocaleDateString("en-UG", { month: "long", year: "numeric" });
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); };

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: startWeekday });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: BRAND }}>‹</button>
        <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>📅 {monthLabel}</h2>
        <button onClick={nextMonth} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: BRAND }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: "0.5rem" }}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: "0.7rem", fontWeight: 700, color: "#888", padding: "0.3rem 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {blanks.map((_, i) => <div key={`b${i}`} />)}
        {days.map((day) => {
          const dateKey = isoDate(new Date(viewYear, viewMonth, day).getTime());
          const dayTasks = calendarTasks?.[dateKey] ?? [];
          const isToday = today.getDate() === day && today.getMonth() === viewMonth && today.getFullYear() === viewYear;
          const hasOverdue = dayTasks.some((t: any) => t.isOverdue);
          return (
            <div key={day} style={{ minHeight: 52, padding: "0.25rem", borderRadius: 6, background: isToday ? "#e8f5e9" : "#fff", border: isToday ? `2px solid ${BRAND}` : "1px solid #f0f0f0" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: isToday ? 700 : 400, color: isToday ? BRAND : "#333", textAlign: "center" }}>{day}</div>
              {dayTasks.slice(0, 2).map((t: any, i: number) => (
                <div key={i} style={{ fontSize: "0.6rem", background: t.isOverdue ? "#ffebee" : BRAND_BG, color: t.isOverdue ? "#c62828" : BRAND, borderRadius: 3, padding: "0.1rem 0.2rem", marginTop: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {t.emoji || "✅"} {t.title}
                </div>
              ))}
              {dayTasks.length > 2 && <div style={{ fontSize: "0.58rem", color: "#888", textAlign: "center" }}>+{dayTasks.length - 2}</div>}
            </div>
          );
        })}
      </div>
      {calendarTasks !== undefined && Object.keys(calendarTasks).length === 0 && (
        <p style={{ textAlign: "center", color: "#888", fontSize: "0.85rem", marginTop: "1rem" }}>No tasks this month.</p>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function FarmPlannerPage() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("tasks");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pilot_user");
      if (stored) setUserId(JSON.parse(stored).userId as Id<"users">);
    } catch {}
  }, []);

  const tabs: { id: Tab; emoji: string; label: string }[] = [
    { id: "tasks",    emoji: "✅", label: "Tasks" },
    { id: "seasons",  emoji: "🌾", label: "Season Plans" },
    { id: "calendar", emoji: "📅", label: "Calendar" },
  ];

  return (
    <div style={{ fontFamily: FONT, minHeight: "100vh", background: "#f9fafb", paddingBottom: 80 }}>
      <div style={{ background: BRAND, padding: "clamp(1rem,4vw,1.5rem)", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(1.1rem,4vw,1.4rem)", fontWeight: 700 }}>🗓️ My Farm Planner</h1>
            <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.85 }}>Plan seasons · Schedule tasks · Never miss a step</p>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #e0e0e0" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ flex: 1, padding: "0.75rem 0.5rem", border: "none", borderBottom: activeTab === t.id ? `3px solid ${BRAND}` : "3px solid transparent", background: "transparent", cursor: "pointer", fontFamily: FONT, fontSize: "0.82rem", fontWeight: activeTab === t.id ? 700 : 400, color: activeTab === t.id ? BRAND : "#666" }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>
      <div style={{ padding: "clamp(1rem,4vw,1.25rem)", maxWidth: 680, margin: "0 auto" }}>
        {!userId ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading…</div>
        ) : activeTab === "tasks" ? (
          <TasksTab userId={userId} />
        ) : activeTab === "seasons" ? (
          <SeasonsTab userId={userId} />
        ) : (
          <CalendarTab userId={userId} />
        )}
      </div>
    </div>
  );
}

