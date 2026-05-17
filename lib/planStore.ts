import type { WeeklyPlanItem, WorkoutStatus, Workout } from "@/types";
import { parseLocalDate, toLocalDateStr } from "@/lib/dateUtils";

/**
 * In-memory plan store.
 * Keyed by weekStartDate ISO string → day ISO string → plan item.
 *
 * This is the swap point for Supabase persistence later.
 * The interface (get/set/update) maps 1-to-1 to DB operations.
 */

type PlanStore = Map<string, Map<string, WeeklyPlanItem>>;

// Module-level singleton — persists across requests in dev (hot reload resets it)
const store: PlanStore = new Map();

function weekKey(weekStartDate: string): string {
  return weekStartDate;
}

/**
 * Produces a YYYY-MM-DD key using LOCAL date parts.
 * String inputs are parsed as local dates (not UTC) to avoid day-shift bugs.
 */
function dayKey(date: Date | string): string {
  const d = typeof date === "string" ? parseLocalDate(date) : date;
  return toLocalDateStr(d);
}

export const planStore = {
  /** Store an entire week's plan */
  setWeek(weekStartDate: string, items: WeeklyPlanItem[]): void {
    const week = new Map<string, WeeklyPlanItem>();
    for (const item of items) {
      week.set(dayKey(item.date), item);
    }
    store.set(weekKey(weekStartDate), week);
  },

  /** Get a week's plan as an array */
  getWeek(weekStartDate: string): WeeklyPlanItem[] | null {
    const week = store.get(weekKey(weekStartDate));
    if (!week) return null;
    return Array.from(week.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  },

  /** Update a single day's status and optionally workout details */
  updateDay(
    weekStartDate: string,
    dateStr: string,
    status: WorkoutStatus,
    workoutOverride?: Partial<Workout>,
    reason?: string
  ): WeeklyPlanItem | null {
    const week = store.get(weekKey(weekStartDate));
    if (!week) return null;

    const key = dayKey(dateStr);
    const existing = week.get(key);
    if (!existing) return null;

    const updated: WeeklyPlanItem = {
      ...existing,
      status,
      reason: reason ?? existing.reason,
      workout:
        workoutOverride && existing.workout
          ? { ...existing.workout, ...workoutOverride }
          : existing.workout,
    };

    week.set(key, updated);
    return updated;
  },
};
