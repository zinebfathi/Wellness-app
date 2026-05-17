import type {
  CycleDayInfo,
  DayAnalysis,
  DayType,
  Intensity,
  UserProfile,
  WeeklyPlanItem,
  WeekPattern,
  WorkoutSlot,
} from "@/types";
import { selectWorkout } from "./workoutSelector";
import { phaseDescriptions } from "./cycleEngine";

// Active recovery workout types (don't count toward workout goal, low bar)
const ACTIVE_RECOVERY_TYPES = ["Walking", "Mobility & Stretching"];

// Workouts that are low impact enough to place on recovery-adjacent days
const LOW_IMPACT_TYPES = ["Yoga", "Pilates", "Walking", "Mobility & Stretching", "Zone 2 Cardio"];

// ─── Intensity helpers ───────────────────────────────────────────────────────

const INTENSITY_ORDER: Record<Intensity, number> = { low: 0, medium: 1, high: 2 };

function intensityOf(item: WeeklyPlanItem): number {
  if (!item.workout) return -1;
  return INTENSITY_ORDER[item.workout.intensity];
}

/** Returns true if placing a workout of given intensity on dayIndex would
 *  create a back-to-back high/medium intensity sequence. */
function wouldStackIntensity(
  plan: (WeeklyPlanItem | null)[],
  dayIndex: number,
  proposedIntensity: Intensity
): boolean {
  const proposed = INTENSITY_ORDER[proposedIntensity];
  if (proposed === 0) return false; // low intensity never stacks badly

  const prev = dayIndex > 0 ? plan[dayIndex - 1] : null;
  const next = dayIndex < 6 ? plan[dayIndex + 1] : null;

  const prevIntensity = prev ? intensityOf(prev) : -1;
  const nextIntensity = next ? intensityOf(next) : -1;

  // Two consecutive medium/high days → stacking
  if (prevIntensity >= 1 && proposed >= 1) return true;
  if (nextIntensity >= 1 && proposed >= 1) return true;

  return false;
}

/** Returns true if the previous day was a workout day (of any intensity). */
function prevDayIsWorkout(plan: (WeeklyPlanItem | null)[], dayIndex: number): boolean {
  if (dayIndex === 0) return false;
  const prev = plan[dayIndex - 1];
  return !!prev && prev.dayType === "workout";
}

/** Returns true if the next day is already assigned as a workout. */
function nextDayIsWorkout(plan: (WeeklyPlanItem | null)[], dayIndex: number): boolean {
  if (dayIndex >= 6) return false;
  const next = plan[dayIndex + 1];
  return !!next && next.dayType === "workout";
}

// ─── Slot builder ────────────────────────────────────────────────────────────

function buildSlot(day: DayAnalysis, preferredWindows: string[]): WorkoutSlot | null {
  if (!day.bestWindow) return null;

  // If user has window preferences, try to match
  const preferred = day.availableWindows.find((w) =>
    preferredWindows.length === 0 || preferredWindows.includes(w.type)
  );
  const window = preferred ?? day.bestWindow;

  return {
    date: day.date,
    windowType: window.type,
    startTime: window.startTime,
    endTime: window.endTime,
  };
}

// ─── Spread algorithm ────────────────────────────────────────────────────────

/**
 * Select N workout days from the ranked candidate list, enforcing:
 * 1. No consecutive workout days (prefer gaps of at least 1 day)
 * 2. Spread across the week (not all clustered Mon–Wed)
 * 3. Preferred patterns for common frequency goals
 */
function selectWorkoutDays(
  candidates: number[],   // day offsets ranked by suitability
  count: number,
  weekPattern: WeekPattern
): number[] {
  if (candidates.length === 0 || count === 0) return [];

  // For common frequencies, apply preferred spacing templates first
  const templates = getSpacingTemplates(count, weekPattern);
  for (const template of templates) {
    // Check if all days in the template are among candidates (not blocked)
    const blocked = new Set([
      ...weekPattern.travelDays,
      ...weekPattern.conferenceDays,
    ]);
    if (template.every((d) => !blocked.has(d))) {
      return template;
    }
  }

  // Fallback: greedy selection respecting minimum gap
  const selected: number[] = [];
  const usedDays = new Set<number>();

  for (const day of candidates) {
    if (selected.length >= count) break;

    // Enforce minimum 1-day gap between workout days
    const tooClose = selected.some((s) => Math.abs(s - day) === 1);
    if (tooClose && selected.length < count) {
      // Allow consecutive only if we have no other options
      const remainingCandidates = candidates.filter(
        (c) => !usedDays.has(c) && !selected.some((s) => Math.abs(s - c) === 1)
      );
      if (remainingCandidates.length >= count - selected.length) continue;
    }

    if (!usedDays.has(day)) {
      selected.push(day);
      usedDays.add(day);
    }
  }

  return selected.sort((a, b) => a - b);
}

/**
 * Preferred weekly patterns based on frequency goal.
 * Returns a list of candidate patterns (day offsets, 0=Mon … 6=Sun)
 * ordered by preference. The first non-blocked one wins.
 */
function getSpacingTemplates(count: number, weekPattern: WeekPattern): number[][] {
  const { lightDays } = weekPattern;

  switch (count) {
    case 2:
      return [
        [0, 3], // Mon + Thu
        [1, 4], // Tue + Fri
        [0, 4], // Mon + Fri
        [2, 5], // Wed + Sat
        [1, 5], // Tue + Sat
      ];
    case 3:
      return [
        [0, 2, 4], // Mon + Wed + Fri
        [0, 2, 5], // Mon + Wed + Sat
        [1, 3, 5], // Tue + Thu + Sat
        [0, 3, 5], // Mon + Thu + Sat
        [1, 3, 6], // Tue + Thu + Sun
      ];
    case 4:
      return [
        [0, 2, 4, 6], // Mon + Wed + Fri + Sun
        [0, 2, 3, 5], // Mon + Wed + Thu + Sat
        [1, 3, 5, 0], // Tue + Thu + Sat + Mon (wraps)
        [0, 2, 4, 5], // Mon + Wed + Fri + Sat
        [1, 3, 4, 6], // Tue + Thu + Fri + Sun
      ];
    case 5:
      return [
        [0, 1, 3, 4, 6], // Mon + Tue + Thu + Fri + Sun
        [0, 2, 3, 5, 6], // Mon + Wed + Thu + Sat + Sun
        [1, 2, 4, 5, 6], // Tue + Wed + Fri + Sat + Sun
      ];
    default:
      return [];
  }
}

// ─── Active recovery days ────────────────────────────────────────────────────

/**
 * Select up to 2 active recovery days from days that are not workout days
 * and are not blocked/travel. Prefer days adjacent to workout days.
 */
function selectRecoveryDays(
  workoutDaySet: Set<number>,
  weekPattern: WeekPattern
): number[] {
  const blockedSet = new Set([
    ...weekPattern.travelDays,
    ...weekPattern.conferenceDays,
  ]);

  const candidates = weekPattern.days
    .map((d, i) => ({ i, day: d }))
    .filter(({ i }) => !workoutDaySet.has(i) && !blockedSet.has(i))
    .filter(({ day }) => day.load !== "blocked")
    // Prefer days adjacent to a workout day
    .sort((a, b) => {
      const aAdjacentToWorkout =
        workoutDaySet.has(a.i - 1) || workoutDaySet.has(a.i + 1) ? 1 : 0;
      const bAdjacentToWorkout =
        workoutDaySet.has(b.i - 1) || workoutDaySet.has(b.i + 1) ? 1 : 0;
      return bAdjacentToWorkout - aAdjacentToWorkout;
    });

  return candidates.slice(0, 2).map((c) => c.i);
}

// ─── Rest reasons ────────────────────────────────────────────────────────────

function buildRestReason(
  dayIndex: number,
  day: DayAnalysis,
  workoutDaySet: Set<number>,
  cycleInfo: CycleDayInfo
): string {
  if (day.isTravel) {
    return `Travel day — rest and recovery. ${phaseDescriptions[cycleInfo.phase]}`;
  }
  if (day.isConference) {
    return `Conference/offsite day — mentally demanding, keeping this a rest day. ${phaseDescriptions[cycleInfo.phase]}`;
  }
  if (day.load === "heavy") {
    return `Heavy calendar day (${Math.round(day.totalBusyMinutes / 60)}h of meetings) — rest to avoid overloading. ${phaseDescriptions[cycleInfo.phase]}`;
  }
  // Adjacent to workout days?
  const prevIsWorkout = workoutDaySet.has(dayIndex - 1);
  const nextIsWorkout = workoutDaySet.has(dayIndex + 1);
  if (prevIsWorkout && nextIsWorkout) {
    return `Rest day between workout days — recovery is part of the plan. ${phaseDescriptions[cycleInfo.phase]}`;
  }
  if (prevIsWorkout) {
    return `Rest day after yesterday's workout — allowing muscles to recover. ${phaseDescriptions[cycleInfo.phase]}`;
  }
  if (nextIsWorkout) {
    return `Rest day before tomorrow's workout — arrive fresh. ${phaseDescriptions[cycleInfo.phase]}`;
  }
  return `Rest day — keeping to your ${cycleInfo.cycleDay > 0 ? "weekly goal" : "schedule"}. ${phaseDescriptions[cycleInfo.phase]}`;
}

function buildRecoveryReason(
  dayIndex: number,
  workoutDaySet: Set<number>,
  cycleInfo: CycleDayInfo
): string {
  const prevIsWorkout = workoutDaySet.has(dayIndex - 1);
  const nextIsWorkout = workoutDaySet.has(dayIndex + 1);

  if (prevIsWorkout) {
    return `Active recovery after yesterday's workout — a gentle walk or stretch supports muscle repair. ${phaseDescriptions[cycleInfo.phase]}`;
  }
  if (nextIsWorkout) {
    return `Light movement today to stay active before tomorrow's workout. ${phaseDescriptions[cycleInfo.phase]}`;
  }
  return `Active recovery day — low-impact movement to keep the body moving without stressing it. ${phaseDescriptions[cycleInfo.phase]}`;
}

// ─── Main distributor ────────────────────────────────────────────────────────

export interface DayDistribution {
  dayIndex: number;
  dayType: DayType;
  day: DayAnalysis;
  cycleInfo: CycleDayInfo;
}

/**
 * Main function: decide the day type (workout / active_recovery / rest) for
 * each of the 7 days, then build WorkoutPlanItem shells.
 *
 * The caller (planGenerator) fills in the actual Workout objects.
 */
export function generateWeeklyDistribution(
  weekPattern: WeekPattern,
  cycleInfoByDay: CycleDayInfo[],
  profile: UserProfile
): WeeklyPlanItem[] {
  const { days, workoutCandidateDays } = weekPattern;
  const preferredWindows = profile.workout_preferences.filter((p) =>
    ["morning", "lunch", "evening"].includes(p)
  );

  // 1. Select workout days
  const workoutDayOffsets = selectWorkoutDays(
    workoutCandidateDays,
    profile.frequency_per_week_goal,
    weekPattern
  );
  const workoutDaySet = new Set(workoutDayOffsets);

  // 2. Select active recovery days (from remaining non-blocked days)
  const recoveryDayOffsets = selectRecoveryDays(workoutDaySet, weekPattern);
  const recoveryDaySet = new Set(recoveryDayOffsets);

  // 3. Build the 7-day plan skeleton
  const plan: WeeklyPlanItem[] = [];
  const usedWorkoutTypes = new Set<string>();

  for (let i = 0; i < 7; i++) {
    const day = days[i];
    const cycleInfo = cycleInfoByDay[i];

    if (workoutDaySet.has(i)) {
      // Workout day
      const slot = buildSlot(day, preferredWindows);

      // Check if intensity would stack — if so, downgrade to low
      const baseWorkout = selectWorkout(
        cycleInfo.phase,
        cycleInfo.cycleDay,
        profile,
        usedWorkoutTypes
      );

      let workout = baseWorkout;
      if (
        workout &&
        wouldStackIntensity(plan, i, workout.intensity)
      ) {
        // Re-select with low-intensity override
        const lowIntensityProfile = {
          ...profile,
          workout_types_liked: profile.workout_types_liked.filter((t) =>
            LOW_IMPACT_TYPES.map((l) => l.toLowerCase()).includes(t.toLowerCase())
          ).concat(LOW_IMPACT_TYPES),
        };
        workout =
          selectWorkout(
            "luteal", // luteal = low/medium cap
            cycleInfo.cycleDay,
            lowIntensityProfile,
            usedWorkoutTypes
          ) ?? baseWorkout;
        if (workout) {
          workout = {
            ...workout,
            intensity: "low",
            cycleFit:
              workout.cycleFit +
              " (Intensity adjusted to avoid back-to-back high-intensity days.)",
          };
        }
      }

      if (workout) usedWorkoutTypes.add(workout.type);

      plan.push({
        date: day.date,
        dayType: "workout",
        slot,
        workout,
        status: "suggested",
        reason: workout?.cycleFit ?? "Workout day based on your calendar availability.",
      });
    } else if (recoveryDaySet.has(i)) {
      // Active recovery day — assign a low-intensity recovery workout
      const slot = buildSlot(day, preferredWindows);
      const recoveryWorkout = selectWorkout(
        "menstrual", // always picks lowest-intensity options
        cycleInfo.cycleDay,
        {
          ...profile,
          workout_types_liked: ACTIVE_RECOVERY_TYPES,
          workout_types_disliked: [
            ...profile.workout_types_disliked,
            "HIIT", "Strength Training", "Running", "SoulCycle", "Barry's Bootcamp",
          ],
        },
        new Set() // allow reuse of types for recovery days
      );

      plan.push({
        date: day.date,
        dayType: "active_recovery",
        slot: slot,
        workout: recoveryWorkout,
        status: "suggested",
        reason: buildRecoveryReason(i, workoutDaySet, cycleInfo),
      });
    } else {
      // Rest day
      plan.push({
        date: day.date,
        dayType: "rest",
        slot: null,
        workout: null,
        status: "suggested",
        reason: buildRestReason(i, day, workoutDaySet, cycleInfo),
      });
    }
  }

  return plan;
}
