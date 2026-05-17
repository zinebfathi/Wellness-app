import type { CalendarEvent, WorkoutSlot, WindowType } from "@/types";

interface TimeWindow {
  type: WindowType;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  durationMinutes: number;
}

const WINDOWS: TimeWindow[] = [
  { type: "morning", startHour: 7, startMinute: 0, endHour: 9, endMinute: 0, durationMinutes: 120 },
  { type: "lunch", startHour: 12, startMinute: 0, endHour: 14, endMinute: 0, durationMinutes: 120 },
  { type: "evening", startHour: 17, startMinute: 0, endHour: 20, endMinute: 0, durationMinutes: 180 },
];

function setTime(base: Date, hour: number, minute: number): Date {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function overlaps(
  windowStart: Date,
  windowEnd: Date,
  eventStart: Date,
  eventEnd: Date
): boolean {
  return windowStart < eventEnd && windowEnd > eventStart;
}

/**
 * Returns all available workout slots for the week.
 * Filters out windows that conflict with busy calendar events.
 * Respects the user's preferred workout windows (e.g. "morning", "evening").
 */
export function findWorkoutSlots(
  weekStartDate: Date,
  calendarEvents: CalendarEvent[],
  preferredWindows: string[],          // from profile.workout_preferences
  workoutDurationMinutes: number = 60  // how long the workout needs to be
): WorkoutSlot[] {
  const slots: WorkoutSlot[] = [];
  const busyEvents = calendarEvents.filter((e) => e.isBusy);

  // Determine which windows to include (respect preference; default to all)
  const windowsToCheck =
    preferredWindows.length > 0
      ? WINDOWS.filter((w) => preferredWindows.includes(w.type))
      : WINDOWS;

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(weekStartDate);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(0, 0, 0, 0);

    for (const window of windowsToCheck) {
      // The workout must fit within the window
      if (window.durationMinutes < workoutDurationMinutes) continue;

      const windowStart = setTime(date, window.startHour, window.startMinute);
      const windowEnd = setTime(date, window.endHour, window.endMinute);

      // Check for conflicts
      const hasConflict = busyEvents.some((event) => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return overlaps(windowStart, windowEnd, eventStart, eventEnd);
      });

      if (!hasConflict) {
        slots.push({
          date,
          windowType: window.type,
          startTime: windowStart,
          endTime: windowEnd,
        });
      }
    }
  }

  return slots;
}

/**
 * Select the best N slots for the week, distributing across different days.
 * Prefers preferred window types, avoids back-to-back days when possible.
 */
export function selectBestSlots(
  availableSlots: WorkoutSlot[],
  count: number,
  preferredWindows: string[]
): WorkoutSlot[] {
  if (availableSlots.length === 0) return [];

  // Sort: preferred windows first, then by date
  const sorted = [...availableSlots].sort((a, b) => {
    const aPreferred = preferredWindows.includes(a.windowType) ? 0 : 1;
    const bPreferred = preferredWindows.includes(b.windowType) ? 0 : 1;
    if (aPreferred !== bPreferred) return aPreferred - bPreferred;
    return a.date.getTime() - b.date.getTime();
  });

  const selected: WorkoutSlot[] = [];
  const usedDays = new Set<string>();

  // First pass: one slot per day, preferred windows first
  for (const slot of sorted) {
    if (selected.length >= count) break;
    const dayKey = slot.date.toDateString();
    if (!usedDays.has(dayKey)) {
      selected.push(slot);
      usedDays.add(dayKey);
    }
  }

  return selected;
}
