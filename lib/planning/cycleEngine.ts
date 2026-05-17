import type { CyclePhase, CycleDayInfo } from "@/types";
import { parseLocalDate } from "@/lib/dateUtils";

/**
 * Returns the 1-based cycle day for a given target date.
 * Wraps correctly across multiple cycles.
 */
export function getCycleDayForDate(
  lastPeriodDate: Date,
  cycleLength: number,
  targetDate: Date
): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor(
    (targetDate.getTime() - lastPeriodDate.getTime()) / msPerDay
  );
  // Handle dates before last period
  if (diffDays < 0) {
    const wrappedDiff = ((diffDays % cycleLength) + cycleLength) % cycleLength;
    return wrappedDiff + 1;
  }
  return (diffDays % cycleLength) + 1;
}

/**
 * Maps a cycle day to a phase.
 * Standard 28-day model, scaled proportionally for other cycle lengths.
 *
 * Day 1–5   → menstrual  (~18% of cycle)
 * Day 6–13  → follicular (~29% of cycle)
 * Day 14–16 → ovulatory  (~11% of cycle)
 * Day 17–28 → luteal     (~43% of cycle)
 */
export function getCyclePhase(
  cycleDay: number,
  cycleLength: number
): CyclePhase {
  const menstrualEnd = Math.round(cycleLength * 0.18);           // ~day 5
  const follicularEnd = Math.round(cycleLength * 0.46);          // ~day 13
  const ovulatoryEnd = Math.round(cycleLength * 0.57);           // ~day 16

  if (cycleDay <= menstrualEnd) return "menstrual";
  if (cycleDay <= follicularEnd) return "follicular";
  if (cycleDay <= ovulatoryEnd) return "ovulatory";
  return "luteal";
}

/**
 * Returns cycle day and phase info for each day in a 7-day week.
 */
export function getCycleInfoForWeek(
  lastPeriodDateStr: string,
  cycleLengthDays: number,
  weekStartDate: Date
): CycleDayInfo[] {
  const lastPeriodDate = parseLocalDate(lastPeriodDateStr);

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStartDate);
    date.setDate(date.getDate() + i);
    date.setHours(0, 0, 0, 0);

    const cycleDay = getCycleDayForDate(lastPeriodDate, cycleLengthDays, date);
    const phase = getCyclePhase(cycleDay, cycleLengthDays);

    return { date, cycleDay, phase };
  });
}

/**
 * Human-readable phase descriptions for the UI.
 */
export const phaseDescriptions: Record<CyclePhase, string> = {
  menstrual: "Menstrual phase — lower energy, prioritise rest & gentle movement",
  follicular: "Follicular phase — energy building, great for strength & new challenges",
  ovulatory: "Ovulatory phase — peak energy & strength, push harder",
  luteal: "Luteal phase — steady energy, wind down intensity gradually",
};

export const phaseEmoji: Record<CyclePhase, string> = {
  menstrual: "🌑",
  follicular: "🌒",
  ovulatory: "🌕",
  luteal: "🌖",
};
