import type { CalendarEvent, UserProfile } from "@/types";

/**
 * Calendar data source — returns events for a given week.
 * Implement with mock data or Google Calendar API.
 */
export interface ICalendarAdapter {
  getEventsForWeek(weekStartDate: Date): Promise<CalendarEvent[]>;
}

/**
 * User profile data source.
 * Implement with mock data or Supabase.
 */
export interface IProfileAdapter {
  getProfile(): Promise<UserProfile>;
}

/**
 * Wearable/cycle data source.
 * Returns enough info for the cycle engine to compute phases.
 */
export interface IWearableAdapter {
  getLastPeriodDate(): Promise<string>; // ISO date string
  getCycleLength(): Promise<number>;
}
