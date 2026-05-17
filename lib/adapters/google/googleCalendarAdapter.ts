import { google } from "googleapis";
import type { ICalendarAdapter } from "../types";
import type { CalendarEvent } from "@/types";

/**
 * Google Calendar adapter.
 * Requires a valid OAuth2 access token (from NextAuth session).
 */
export class GoogleCalendarAdapter implements ICalendarAdapter {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getEventsForWeek(weekStartDate: Date): Promise<CalendarEvent[]> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: this.accessToken });

    const calendar = google.calendar({ version: "v3", auth });

    const weekEnd = new Date(weekStartDate);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: weekStartDate.toISOString(),
      timeMax: weekEnd.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });

    const items = response.data.items ?? [];

    return items
      .filter((item) => item.start?.dateTime || item.start?.date)
      .map((item): CalendarEvent => {
        // All-day events
        if (item.start?.date && !item.start?.dateTime) {
          const start = new Date(item.start.date + "T00:00:00");
          const end = new Date((item.end?.date ?? item.start.date) + "T23:59:59");
          return {
            title: item.summary ?? "Busy",
            start,
            end,
            isBusy: true, // all-day blocks treated as busy
          };
        }

        const start = new Date(item.start!.dateTime!);
        const end = new Date(item.end!.dateTime!);

        // Determine if the event blocks the time
        const isBusy =
          item.transparency !== "transparent" &&
          item.status !== "cancelled";

        return {
          title: item.summary ?? "Busy",
          start,
          end,
          isBusy,
        };
      });
  }
}
