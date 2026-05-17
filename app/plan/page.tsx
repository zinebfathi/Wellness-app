"use client";

import { useState, useCallback, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import type { WeeklyPlanItem, CalendarEvent, Workout, WorkoutStatus } from "@/types";
import WeeklyPlanGrid from "@/components/WeeklyPlanGrid";
import WeeklyCalendarView from "@/components/WeeklyCalendarView";

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type DataSource = "mock" | "supabase" | "google";

const SOURCE_LABELS: Record<DataSource, string> = {
  mock:     "Mock data",
  supabase: "Supabase calendar",
  google:   "Google Calendar",
};

export default function PlanPage() {
  const { data: session } = useSession();

  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [plan, setPlan] = useState<WeeklyPlanItem[] | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>("supabase");
  const [view, setView] = useState<"cards" | "calendar">("calendar");
  const [profileInfo, setProfileInfo] = useState<{
    name: string;
    cycleLength: number | null;
    frequencyGoal: number;
    lastCycle: string;
  } | null>(null);

  const weekStartStr = toDateStr(weekStart);

  const generatePlan = useCallback(async (source: DataSource, weekStr: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStartDate: weekStr, dataSource: source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");

      const rehydrated = (data.plan as any[]).map((item: any) => ({
        ...item,
        date: new Date(item.date),
        slot: item.slot
          ? {
              ...item.slot,
              date: new Date(item.slot.date),
              startTime: new Date(item.slot.startTime),
              endTime: new Date(item.slot.endTime),
            }
          : null,
      })) as WeeklyPlanItem[];

      setPlan(rehydrated);
      setProfileInfo(data.profile);
      if (data.calendarEvents) {
        setCalendarEvents(
          (data.calendarEvents as any[]).map((e) => ({
            ...e,
            start: new Date(e.start),
            end: new Date(e.end),
          }))
        );
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    generatePlan(dataSource, weekStartStr);
  }, [weekStartStr, dataSource, generatePlan]);

  const handleUpdate = useCallback(
    async (dateStr: string, status: WorkoutStatus, workout?: Partial<Workout>) => {
      setPlan((prev) =>
        prev
          ? prev.map((item) => {
              const d = new Date(item.date);
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, "0");
              const day = String(d.getDate()).padStart(2, "0");
              if (`${y}-${m}-${day}` !== dateStr) return item;
              return {
                ...item,
                status,
                workout: workout && item.workout ? { ...item.workout, ...workout } : item.workout,
              };
            })
          : prev
      );

      try {
        await fetch(`/api/plan/${dateStr}?week=${weekStartStr}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, workout }),
        });
      } catch (err) {
        console.error("Failed to persist update", err);
      }
    },
    [weekStartStr]
  );

  const prevWeek = () =>
    setWeekStart((d) => { const p = new Date(d); p.setDate(p.getDate() - 7); return p; });
  const nextWeek = () =>
    setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });

  // Workout/recovery/rest counts
  const workoutCount  = plan?.filter((d) => d.dayType === "workout").length ?? 0;
  const recoveryCount = plan?.filter((d) => d.dayType === "active_recovery").length ?? 0;
  const approvedCount = plan?.filter((d) => d.status === "approved").length ?? 0;

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Weekly Workout Plan</h1>
          {profileInfo && (
            <p className="text-sm text-gray-500">
              {profileInfo.name} · {profileInfo.frequencyGoal}x/week goal · {profileInfo.cycleLength ?? 28}-day cycle
            </p>
          )}
        </div>

        {/* Source selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex border border-gray-300 rounded overflow-hidden text-xs">
            {(["mock", "supabase", "google"] as DataSource[]).map((src) => (
              <button
                key={src}
                onClick={() => {
                  if (src === "google" && !session) { signIn("google"); return; }
                  setDataSource(src);
                }}
                className={`px-3 py-1.5 whitespace-nowrap ${
                  dataSource === src
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {SOURCE_LABELS[src]}
                {src === "google" && !session && (
                  <span className="ml-1 text-gray-400">(sign in)</span>
                )}
              </button>
            ))}
          </div>
          {session && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{session.user?.email}</span>
              <button onClick={() => signOut()} className="underline hover:text-gray-700">Sign out</button>
            </div>
          )}
        </div>
      </div>

      {/* Week nav */}
      <div className="flex items-center gap-3">
        <button onClick={prevWeek}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
          ← Prev
        </button>
        <input
          type="date"
          title="Jump to week"
          className="text-xs border border-gray-300 rounded px-2 py-1.5 text-gray-600"
          value={weekStartStr}
          onChange={(e) => {
            if (e.target.value) setWeekStart(getMondayOfWeek(new Date(e.target.value + "T00:00:00")));
          }}
        />
        <button onClick={nextWeek}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
          Next →
        </button>
        <div className="ml-auto flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-gray-300 rounded overflow-hidden text-xs">
            <button
              onClick={() => setView("calendar")}
              className={`px-3 py-1.5 ${view === "calendar" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              Calendar
            </button>
            <button
              onClick={() => setView("cards")}
              className={`px-3 py-1.5 ${view === "cards" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              Cards
            </button>
          </div>
          <button
            onClick={() => generatePlan(dataSource, weekStartStr)}
            disabled={loading}
            className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? "Generating..." : "Regenerate"}
          </button>
        </div>
      </div>

      {/* Source banner */}
      {dataSource === "mock" && (
        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded">
          Using <strong>mock calendar data</strong>. Switch to Supabase to plan against your real calendar.
        </div>
      )}
      {dataSource === "supabase" && (
        <div className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-2 rounded">
          Using <strong>Supabase calendar</strong> — your real calendar events from the database.
        </div>
      )}
      {dataSource === "google" && (
        <div className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded">
          Using <strong>Google Calendar</strong> — live events from your primary calendar.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Plan summary */}
      {!loading && plan && (
        <div className="flex gap-5 text-sm text-gray-600 border-b border-gray-200 pb-3">
          <span><strong>{workoutCount}</strong> workouts</span>
          <span className="text-blue-600"><strong>{recoveryCount}</strong> active recovery</span>
          <span><strong>{7 - workoutCount - recoveryCount}</strong> rest days</span>
          <span className="text-green-700 ml-auto"><strong>{approvedCount}</strong> approved</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-sm text-gray-400 py-16 text-center">Generating your plan...</div>
      )}

      {/* Calendar view */}
      {!loading && plan && view === "calendar" && (
        <WeeklyCalendarView
          plan={plan}
          calendarEvents={calendarEvents}
          weekStart={weekStartStr}
          onUpdate={handleUpdate}
        />
      )}

      {/* Cards view */}
      {!loading && plan && view === "cards" && (
        <WeeklyPlanGrid plan={plan} weekStart={weekStartStr} onUpdate={handleUpdate} />
      )}
    </div>
  );
}
