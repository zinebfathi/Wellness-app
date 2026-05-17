"use client";

import { useMemo } from "react";
import type { WeeklyPlanItem, CalendarEvent, WorkoutStatus, Workout } from "@/types";

// ── Display constants ────────────────────────────────────────────────────────

const HOUR_START = 6;   // 6 AM
const HOUR_END   = 22;  // 10 PM
const TOTAL_HOURS = HOUR_END - HOUR_START;
const PX_PER_HOUR = 64;
const GRID_HEIGHT  = TOTAL_HOURS * PX_PER_HOUR; // 1024 px

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Time helpers ─────────────────────────────────────────────────────────────
//
// CalendarEvents from Supabase are stored as "UTC = local time" (no real TZ
// offset).  We read them with getUTCHours() so the display matches the stored
// value regardless of the browser's timezone.
//
// WorkoutSlot times are built by calendarAnalyzer using setHours() (local
// clock), so we read them with getHours().

function calH(d: Date)   { return d.getUTCHours(); }
function calM(d: Date)   { return d.getUTCMinutes(); }
function slotH(d: Date)  { return d.getHours(); }
function slotM(d: Date)  { return d.getMinutes(); }

function topPxCal(start: Date): number {
  const mins = (calH(start) - HOUR_START) * 60 + calM(start);
  return (mins / 60) * PX_PER_HOUR;
}

function heightPxCal(start: Date, end: Date): number {
  const durMin = (end.getTime() - start.getTime()) / 60_000;
  return Math.max((durMin / 60) * PX_PER_HOUR, 18);
}

function topPxSlot(start: Date): number {
  const mins = (slotH(start) - HOUR_START) * 60 + slotM(start);
  return (mins / 60) * PX_PER_HOUR;
}

function heightPxSlot(start: Date, end: Date): number {
  const durMin = (end.getTime() - start.getTime()) / 60_000;
  return Math.max((durMin / 60) * PX_PER_HOUR, 28);
}

function fmt12(hour: number, minute: number): string {
  const p = hour >= 12 ? "pm" : "am";
  const h = hour % 12 || 12;
  const m = minute > 0 ? `:${String(minute).padStart(2, "0")}` : "";
  return `${h}${m}${p}`;
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function utcDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// ── Colours ──────────────────────────────────────────────────────────────────

const CAT_STYLE: Record<string, string> = {
  work:     "bg-blue-100   border-blue-400   text-blue-800",
  social:   "bg-purple-100 border-purple-400 text-purple-800",
  travel:   "bg-amber-100  border-amber-400  text-amber-800",
  personal: "bg-green-100  border-green-400  text-green-800",
  wellness: "bg-teal-100   border-teal-400   text-teal-800",
};
const DEFAULT_CAT_STYLE = "bg-gray-100 border-gray-300 text-gray-700";

const STATUS_STYLE: Record<string, string> = {
  suggested: "bg-orange-50  border-orange-400  text-orange-900",
  approved:  "bg-emerald-100 border-emerald-500 text-emerald-900",
  denied:    "bg-red-50     border-red-400     text-red-500 opacity-60",
  edited:    "bg-yellow-100 border-yellow-500  text-yellow-900",
};
const RECOVERY_STYLE = "bg-sky-100 border-sky-500 text-sky-900";

const DAY_TYPE_HEADER: Record<string, string> = {
  workout:          "text-indigo-600",
  active_recovery:  "text-sky-600",
  rest:             "text-gray-400",
};

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  plan: WeeklyPlanItem[];
  calendarEvents: CalendarEvent[];
  weekStart: string; // "YYYY-MM-DD"
  onUpdate: (dateStr: string, status: WorkoutStatus, workout?: Partial<Workout>) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeeklyCalendarView({ plan, calendarEvents, weekStart }: Props) {

  // Build week dates (Mon → Sun) from the local weekStart string
  const weekDates = useMemo(() => {
    const [y, m, d] = weekStart.split("-").map(Number);
    const monday = new Date(y, m - 1, d, 0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(date.getDate() + i);
      return date;
    });
  }, [weekStart]);

  // Index calendar events by UTC date (data stored as UTC=local)
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of calendarEvents) {
      const key = utcDateKey(new Date(ev.start));
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [calendarEvents]);

  // Index plan items by local date
  const planByDay = useMemo(() => {
    const map: Record<string, WeeklyPlanItem> = {};
    for (const item of plan) {
      map[localDateKey(new Date(item.date))] = item;
    }
    return map;
  }, [plan]);

  // Hour axis labels
  const hourLabels = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) =>
    fmt12(HOUR_START + i, 0)
  );

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <div className="min-w-[700px]">

        {/* ── Day header row ── */}
        <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
          <div className="border-r border-gray-100" /> {/* gutter */}
          {weekDates.map((date, i) => {
            const key   = localDateKey(date);
            const item  = planByDay[key];
            const col   = item ? DAY_TYPE_HEADER[item.dayType] : "text-gray-500";
            const label = item
              ? item.dayType === "workout"         ? (item.workout?.type ?? "Workout")
              : item.dayType === "active_recovery" ? "Recovery"
              : "Rest"
              : "";

            return (
              <div key={i} className="px-2 py-2.5 text-center border-l border-gray-100 first:border-l-0">
                <div className={`text-[11px] font-semibold uppercase tracking-wide ${col}`}>
                  {DAYS_SHORT[i]}
                </div>
                <div className="text-xl font-bold text-gray-800 leading-tight">{date.getDate()}</div>
                {label && (
                  <div className={`text-[10px] mt-0.5 truncate ${col}`}>{label}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── All-day event banners ── */}
        {(() => {
          const hasAllDay = weekDates.some((date) => {
            const key = utcDateKey(date);
            return (eventsByDay[key] ?? []).some((ev) => {
              const dur = (new Date(ev.end).getTime() - new Date(ev.start).getTime()) / 3_600_000;
              return dur >= 20;
            });
          });

          if (!hasAllDay) return null;

          return (
            <div
              className="grid border-b border-gray-200 bg-gray-50"
              style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}
            >
              <div className="text-[9px] text-gray-400 flex items-center justify-end pr-2 border-r border-gray-100">
                all day
              </div>
              {weekDates.map((date, i) => {
                const key = utcDateKey(date);
                const allDayEvents = (eventsByDay[key] ?? []).filter((ev) => {
                  const dur = (new Date(ev.end).getTime() - new Date(ev.start).getTime()) / 3_600_000;
                  return dur >= 20;
                });

                return (
                  <div key={i} className="border-l border-gray-100 p-0.5 min-h-[22px]">
                    {allDayEvents.map((ev, j) => (
                      <div
                        key={j}
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded truncate border-l-2 mb-0.5 ${CAT_STYLE[ev.category ?? ""] ?? DEFAULT_CAT_STYLE}`}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ── Time grid ── */}
        <div
          className="grid overflow-y-auto"
          style={{ gridTemplateColumns: "48px repeat(7, 1fr)", maxHeight: "600px" }}
        >
          {/* Hour labels */}
          <div className="relative border-r border-gray-100" style={{ height: GRID_HEIGHT }}>
            {hourLabels.map((label, i) => (
              <div
                key={i}
                className="absolute right-2 text-[10px] text-gray-400 leading-none select-none"
                style={{ top: i * PX_PER_HOUR - 6 }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((date, colIdx) => {
            const localKey = localDateKey(date);
            const utcKey   = utcDateKey(date);
            const planItem = planByDay[localKey];

            // Timed calendar events (not all-day)
            const timedEvents = (eventsByDay[utcKey] ?? []).filter((ev) => {
              const dur = (new Date(ev.end).getTime() - new Date(ev.start).getTime()) / 3_600_000;
              return dur < 20;
            });

            // Only show events that intersect the display range
            const visibleEvents = timedEvents.filter((ev) => {
              const sh = calH(new Date(ev.start));
              const eh = calH(new Date(ev.end));
              return sh < HOUR_END && eh > HOUR_START;
            });

            const isRest = planItem?.dayType === "rest";

            return (
              <div
                key={colIdx}
                className={`relative border-l border-gray-100 ${isRest ? "bg-gray-50/60" : ""}`}
                style={{ height: GRID_HEIGHT }}
              >
                {/* Hour grid lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-gray-100"
                    style={{ top: h * PX_PER_HOUR }}
                  />
                ))}

                {/* Half-hour tick marks */}
                {Array.from({ length: TOTAL_HOURS }, (_, h) => (
                  <div
                    key={`half-${h}`}
                    className="absolute left-0 right-0 border-t border-gray-50"
                    style={{ top: h * PX_PER_HOUR + PX_PER_HOUR / 2 }}
                  />
                ))}

                {/* Calendar events */}
                {visibleEvents.map((ev, evIdx) => {
                  const start = new Date(ev.start);
                  const end   = new Date(ev.end);

                  // Clamp to display range
                  const clampedTop = Math.max(topPxCal(start), 0);
                  const rawBottom  = topPxCal(start) + heightPxCal(start, end);
                  const clampedH   = Math.max(
                    Math.min(rawBottom, GRID_HEIGHT) - clampedTop,
                    18
                  );

                  const style = CAT_STYLE[ev.category ?? ""] ?? DEFAULT_CAT_STYLE;

                  return (
                    <div
                      key={evIdx}
                      className={`absolute left-0.5 right-0.5 rounded border-l-[3px] px-1 py-0.5 overflow-hidden leading-tight cursor-default ${style}`}
                      style={{ top: clampedTop, height: clampedH, zIndex: 1 }}
                      title={`${ev.title}\n${fmt12(calH(start), calM(start))} – ${fmt12(calH(end), calM(end))}`}
                    >
                      <div className="text-[10px] font-semibold truncate">{ev.title}</div>
                      {clampedH >= 28 && (
                        <div className="text-[9px] opacity-70">
                          {fmt12(calH(start), calM(start))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Workout / recovery slot */}
                {planItem?.slot && !isRest && (() => {
                  const slotStart = new Date(planItem.slot!.startTime);
                  // Use workout duration rather than the full availability window
                  const durationMin = planItem.workout?.durationMinutes ?? 60;
                  const slotEnd = new Date(slotStart.getTime() + durationMin * 60_000);
                  const top    = topPxSlot(slotStart);
                  const height = heightPxSlot(slotStart, slotEnd);

                  const colorStyle =
                    planItem.dayType === "active_recovery"
                      ? RECOVERY_STYLE
                      : STATUS_STYLE[planItem.status] ?? STATUS_STYLE.suggested;

                  const label =
                    planItem.dayType === "active_recovery"
                      ? (planItem.workout?.type ?? "Recovery")
                      : (planItem.workout?.type ?? "Workout");

                  const statusIcon =
                    planItem.status === "approved" ? " ✓"
                    : planItem.status === "denied"   ? " ✗"
                    : "";

                  return (
                    <div
                      className={`absolute left-0.5 right-0.5 rounded border-l-[4px] px-1.5 py-1 overflow-hidden leading-tight cursor-default shadow-sm ${colorStyle}`}
                      style={{ top, height, zIndex: 10 }}
                      title={`${label} · ${fmt12(slotH(slotStart), slotM(slotStart))} – ${fmt12(slotH(slotEnd), slotM(slotEnd))}`}
                    >
                      <div className="text-[11px] font-bold truncate">
                        {label}{statusIcon}
                      </div>
                      <div className="text-[10px] opacity-70">
                        {fmt12(slotH(slotStart), slotM(slotStart))} – {fmt12(slotH(slotEnd), slotM(slotEnd))}
                      </div>
                      {height >= 48 && planItem.workout?.intensity && (
                        <div className="text-[9px] opacity-60 mt-0.5 capitalize">
                          {planItem.workout.intensity} intensity
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* ── Legend ── */}
        <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50 text-[11px]">
          <span className="text-gray-500 font-medium self-center">Calendar:</span>
          {Object.entries(CAT_STYLE).map(([cat, cls]) => (
            <span key={cat} className={`px-2 py-0.5 rounded border-l-2 ${cls}`}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </span>
          ))}
          <span className="border-l border-gray-300 mx-1" />
          <span className="text-gray-500 font-medium self-center">Workouts:</span>
          <span className={`px-2 py-0.5 rounded border-l-2 ${STATUS_STYLE.suggested}`}>Suggested</span>
          <span className={`px-2 py-0.5 rounded border-l-2 ${STATUS_STYLE.approved}`}>Approved ✓</span>
          <span className={`px-2 py-0.5 rounded border-l-2 ${RECOVERY_STYLE}`}>Recovery</span>
          <span className={`px-2 py-0.5 rounded border-l-2 ${STATUS_STYLE.denied}`}>Denied ✗</span>
        </div>
      </div>
    </div>
  );
}
