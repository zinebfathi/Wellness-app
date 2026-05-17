import type {
  CalendarEvent,
  AvailabilityWindow,
  DayAnalysis,
  DayLoad,
  WeekPattern,
  WindowType,
} from "@/types";
import { toLocalDateStr } from "@/lib/dateUtils";

// ─── Window definitions (local hours) ────────────────────────────────────────

interface WindowDef {
  type: WindowType;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
}

const WINDOWS: WindowDef[] = [
  { type: "morning", startHour: 7, startMin: 0, endHour: 9,  endMin: 0  }, // 120 min
  { type: "lunch",   startHour: 12, startMin: 0, endHour: 14, endMin: 0 }, // 120 min
  { type: "evening", startHour: 17, startMin: 0, endHour: 20, endMin: 0 }, // 180 min
];

// Keywords that flag a day as travel
const TRAVEL_KEYWORDS = ["flight", "✈", "train", "hotel", "check-in", "airport"];

// Keywords that flag a day as a conference / all-day work event
const CONFERENCE_KEYWORDS = [
  "summit", "conference", "offsite", "off-site", "all-hands",
  "workshop", "keynote", "day 1", "day 2",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setHM(base: Date, h: number, m: number): Date {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Minutes of overlap between [aS,aE) and [bS,bE) */
function overlapMinutes(aS: Date, aE: Date, bS: Date, bE: Date): number {
  const start = Math.max(aS.getTime(), bS.getTime());
  const end   = Math.min(aE.getTime(), bE.getTime());
  return Math.max(0, (end - start) / 60_000);
}

function windowTotalMinutes(w: WindowDef): number {
  return (w.endHour * 60 + w.endMin) - (w.startHour * 60 + w.startMin);
}

function titleContains(title: string, keywords: string[]): boolean {
  const lower = title.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

// ─── Per-day analysis ────────────────────────────────────────────────────────

/**
 * Analyse a single calendar day and return its DayAnalysis.
 * Events are filtered to those that touch this day.
 */
export function analyseDayEvents(
  date: Date,
  events: CalendarEvent[]
): DayAnalysis {
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999);

  // Events that overlap this calendar day and are busy
  const dayEvents = events.filter((e) => {
    const s = new Date(e.start);
    const en = new Date(e.end);
    return e.isBusy && s < dayEnd && en > dayStart;
  });

  // Flags
  const isTravel = dayEvents.some((e) =>
    titleContains(e.title, TRAVEL_KEYWORDS)
  );

  const isConference = dayEvents.some((e) => {
    const durationH = (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3_600_000;
    return (
      titleContains(e.title, CONFERENCE_KEYWORDS) ||
      durationH >= 5 ||
      e.category === "travel"
    );
  });

  const hasEveningCommitment = dayEvents.some((e) => {
    const startH = new Date(e.start).getHours();
    return startH >= 17;
  });

  // Total busy minutes (clamped to day boundaries)
  const totalBusyMinutes = dayEvents.reduce((sum, e) => {
    const s  = new Date(Math.max(new Date(e.start).getTime(), dayStart.getTime()));
    const en = new Date(Math.min(new Date(e.end).getTime(),   dayEnd.getTime()));
    return sum + Math.max(0, (en.getTime() - s.getTime()) / 60_000);
  }, 0);

  // Load classification
  let load: DayLoad;
  if (isTravel || isConference || totalBusyMinutes >= 480) {
    load = "blocked";
  } else if (totalBusyMinutes >= 300) {
    load = "heavy";
  } else if (totalBusyMinutes >= 150) {
    load = "moderate";
  } else if (totalBusyMinutes >= 60) {
    load = "light";
  } else {
    load = "free";
  }

  // Available windows
  const availableWindows: AvailabilityWindow[] = [];

  for (const wd of WINDOWS) {
    const winStart = setHM(date, wd.startHour, wd.startMin);
    const winEnd   = setHM(date, wd.endHour,   wd.endMin);
    const total    = windowTotalMinutes(wd);

    const blockedMin = dayEvents.reduce((sum, e) => {
      return sum + overlapMinutes(winStart, winEnd, new Date(e.start), new Date(e.end));
    }, 0);

    const freeMinutes = Math.max(0, total - blockedMin);

    // Quality score: free time ratio + window preference bonuses
    let quality = (freeMinutes / total) * 7; // up to 7 points for free time

    // Bonus: morning pre-standup is highest quality (consistent, low fatigue)
    if (wd.type === "morning" && freeMinutes >= 45) quality += 2;
    // Bonus: lunch on light/free days
    if (wd.type === "lunch" && load === "light" && freeMinutes >= 60) quality += 1;
    // Penalise evening if evening commitment exists
    if (wd.type === "evening" && hasEveningCommitment) quality -= 3;

    quality = Math.max(0, Math.min(10, quality));

    if (freeMinutes >= 30) {
      availableWindows.push({
        type: wd.type,
        startTime: winStart,
        endTime: winEnd,
        freeMinutes,
        qualityScore: Math.round(quality * 10) / 10,
      });
    }
  }

  availableWindows.sort((a, b) => b.qualityScore - a.qualityScore);

  return {
    date,
    totalBusyMinutes,
    eventCount: dayEvents.length,
    load,
    isTravel,
    isConference,
    hasEveningCommitment,
    availableWindows,
    bestWindow: availableWindows[0] ?? null,
  };
}

// ─── Week pattern ─────────────────────────────────────────────────────────────

/**
 * Analyse the full week and produce a WorkoutWeekPattern with ranked candidate
 * days for workout scheduling.
 */
export function analyseCalendarPatterns(
  weekStartDate: Date,
  events: CalendarEvent[]
): WeekPattern {
  const days: DayAnalysis[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push(analyseDayEvents(d, events));
  }

  const travelDays     = days.map((d, i) => d.isTravel      ? i : -1).filter((i) => i >= 0);
  const conferenceDays = days.map((d, i) => d.isConference   ? i : -1).filter((i) => i >= 0);
  const overloadedDays = days.map((d, i) =>
    (d.load === "heavy" || d.load === "blocked") ? i : -1
  ).filter((i) => i >= 0);
  const lightDays      = days.map((d, i) =>
    (d.load === "free" || d.load === "light") ? i : -1
  ).filter((i) => i >= 0);

  // Score each day for workout suitability (0–100)
  const scores = days.map((day, i) => ({
    i,
    score: scoreDaySuitability(day, i),
  }));

  const workoutCandidateDays = scores
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.i);

  return { days, travelDays, conferenceDays, overloadedDays, lightDays, workoutCandidateDays };
}

/**
 * Score a day 0–100 for workout suitability.
 * Higher = better candidate for a workout day.
 */
export function scoreDaySuitability(day: DayAnalysis, dayOffset: number): number {
  if (day.isTravel) return 0;
  if (day.load === "blocked") return 0;

  let score = 50;

  // Load factor
  const loadBonus: Record<DayLoad, number> = {
    free:     +25,
    light:    +15,
    moderate:  0,
    heavy:   -20,
    blocked: -50,
  };
  score += loadBonus[day.load];

  // Best window quality
  if (day.bestWindow) score += day.bestWindow.qualityScore * 2;

  // Evening commitment reduces score (less energy for evening workout)
  if (day.hasEveningCommitment) score -= 10;

  // Conference days shouldn't have intense workouts
  if (day.isConference) score -= 30;

  // Slight preference for mid-week and weekend
  // Saturday (6) and Thursday (4) historically lightest
  if (dayOffset === 3 || dayOffset === 5) score += 5; // Thu / Sat
  if (dayOffset === 1) score -= 5; // Tuesday historically heaviest

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Score a day specifically for active recovery (lower bar than a workout).
 */
export function scoreRecoverySuitability(day: DayAnalysis): number {
  if (day.isTravel && day.load === "blocked") return 0;
  // Active recovery (walk/stretch) can happen even on heavy days —
  // just needs a 20-min window somewhere
  const hasAnyWindow = day.availableWindows.some((w) => w.freeMinutes >= 20);
  if (!hasAnyWindow) return 0;
  return day.load === "blocked" ? 10 : 50;
}
