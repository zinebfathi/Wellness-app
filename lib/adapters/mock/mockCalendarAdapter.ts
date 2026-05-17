import type { ICalendarAdapter } from "../types";
import type { CalendarEvent } from "@/types";
import { getMockCalendarEvents } from "@/data/mockCalendar";

export class MockCalendarAdapter implements ICalendarAdapter {
  async getEventsForWeek(weekStartDate: Date): Promise<CalendarEvent[]> {
    return getMockCalendarEvents(weekStartDate);
  }
}
