import type {
  CalendarEvent,
  UserProfile,
  WeeklyPlan,
} from "@/types";
import { getCycleInfoForWeek } from "./cycleEngine";
import { analyseCalendarPatterns } from "./calendarAnalyzer";
import { generateWeeklyDistribution } from "./workoutDistributor";

/**
 * Main entry point for weekly plan generation.
 *
 * Pipeline:
 * 1. Compute cycle phase for each day of the week
 * 2. Analyse calendar patterns → WeekPattern (load, availability, flags)
 * 3. Distribute workout / active_recovery / rest days with spread + intensity rules
 * 4. Return a 7-item WeeklyPlan
 *
 * @param profile        User profile (cycle data, preferences, goals)
 * @param calendarEvents Week's events (from Supabase, Google, or mock)
 * @param weekStartDate  Monday of the target week (local midnight)
 */
export function generateWeeklyPlan(
  profile: UserProfile,
  calendarEvents: CalendarEvent[],
  weekStartDate: Date
): WeeklyPlan {
  const cycleLength = profile.cycle_length_days ?? 28;

  // Step 1: Cycle info for every day
  const cycleInfoByDay = getCycleInfoForWeek(
    profile.date_of_last_cycle,
    cycleLength,
    weekStartDate
  );

  // Step 2: Calendar intelligence
  const weekPattern = analyseCalendarPatterns(weekStartDate, calendarEvents);

  // Step 3: Smart distribution (workout / recovery / rest + workout selection)
  const plan = generateWeeklyDistribution(weekPattern, cycleInfoByDay, profile);

  return plan;
}

/**
 * Serialise a WeeklyPlan to a JSON-safe format (Date → ISO string).
 */
export function serialisePlan(plan: WeeklyPlan): object[] {
  return plan.map((item) => ({
    ...item,
    date: item.date.toISOString(),
    slot: item.slot
      ? {
          ...item.slot,
          date: item.slot.date.toISOString(),
          startTime: item.slot.startTime.toISOString(),
          endTime: item.slot.endTime.toISOString(),
        }
      : null,
  }));
}
