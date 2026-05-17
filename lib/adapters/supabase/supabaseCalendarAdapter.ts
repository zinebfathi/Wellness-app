import { createClient } from "@supabase/supabase-js";
import type { ICalendarAdapter } from "../types";
import type { CalendarEvent } from "@/types";
import { toLocalDateStr } from "@/lib/dateUtils";

/**
 * Supabase calendar adapter.
 *
 * Reads from the `calendar_events` table.
 * Schema:
 *   id          text  PK
 *   summary     text  (event title)
 *   start_dt    timestamptz  (stored as local time with +00 offset)
 *   end_dt      timestamptz
 *   start_date  date  (for all-day events)
 *   end_date    date
 *   all_day     boolean
 *   location    text
 *   description text
 *   category    text  (work | social | travel | personal | wellness)
 *   profile_id  uuid
 *
 * NOTE: times are stored without real TZ offset (local times labelled as UTC).
 * We treat the stored hour values as the user's local time directly.
 *
 * Deduplication: rows ending with "@oura-sim" are synthetic duplicates — excluded.
 */
export class SupabaseCalendarAdapter implements ICalendarAdapter {
  private supabase;

  constructor() {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !key) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
      );
    }
    this.supabase = createClient(url, key);
  }

  async getEventsForWeek(weekStartDate: Date): Promise<CalendarEvent[]> {
    const weekEnd = new Date(weekStartDate);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const startStr = toLocalDateStr(weekStartDate);
    const endStr   = toLocalDateStr(weekEnd);

    const { data, error } = await this.supabase
      .from("calendar_events")
      .select("id, summary, start_dt, end_dt, start_date, end_date, all_day, category")
      // Filter to events that overlap the week
      .or(
        `and(start_dt.gte.${weekStartDate.toISOString()},start_dt.lt.${weekEnd.toISOString()}),` +
        `and(start_date.gte.${startStr},start_date.lt.${endStr})`
      )
      // Exclude @oura-sim duplicates
      .not("id", "like", "%@oura-sim")
      .order("start_dt", { ascending: true });

    if (error) {
      throw new Error(`Supabase calendar fetch failed: ${error.message}`);
    }

    return (data ?? []).map((row): CalendarEvent => {
      // All-day events
      if (row.all_day || (!row.start_dt && row.start_date)) {
        const start = new Date(row.start_date + "T00:00:00");
        const end   = new Date((row.end_date ?? row.start_date) + "T23:59:59");
        return {
          title: row.summary ?? "Event",
          start,
          end,
          isBusy: true,
          category: row.category ?? undefined,
        };
      }

      // Timed events — treat stored UTC timestamp as local time
      // (the data was inserted without timezone conversion)
      const start = new Date(row.start_dt);
      const end   = new Date(row.end_dt);

      // All calendar events in this dataset are busy (no transparency field)
      const isBusy = true;

      return {
        title: row.summary ?? "Event",
        start,
        end,
        isBusy,
        category: row.category ?? undefined,
      };
    });
  }
}
