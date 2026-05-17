import type { CalendarEvent } from "@/types";

/**
 * Generates a realistic week of mock calendar events.
 * The weekStartDate should be a Monday.
 */
export function getMockCalendarEvents(weekStartDate: Date): CalendarEvent[] {
  const monday = new Date(weekStartDate);
  monday.setHours(0, 0, 0, 0);

  const day = (offset: number, h: number, m = 0) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + offset);
    d.setHours(h, m, 0, 0);
    return d;
  };

  return [
    // Monday: morning standup
    {
      title: "Team Standup",
      start: day(0, 9, 0),
      end: day(0, 9, 30),
      isBusy: true,
    },
    // Monday: lunch free, evening free
    // Tuesday: all-day offsite (busy morning)
    {
      title: "Offsite Workshop",
      start: day(1, 9, 0),
      end: day(1, 13, 0),
      isBusy: true,
    },
    // Tuesday: evening free
    // Wednesday: lunch blocked
    {
      title: "Lunch with client",
      start: day(2, 12, 0),
      end: day(2, 13, 30),
      isBusy: true,
    },
    // Wednesday: evening blocked (dinner)
    {
      title: "Dinner plans",
      start: day(2, 18, 30),
      end: day(2, 21, 0),
      isBusy: true,
    },
    // Thursday: free all day
    // Friday: morning meeting
    {
      title: "Weekly Review",
      start: day(4, 8, 0),
      end: day(4, 9, 0),
      isBusy: true,
    },
    // Saturday: busy afternoon
    {
      title: "Family lunch",
      start: day(5, 12, 0),
      end: day(5, 15, 0),
      isBusy: true,
    },
    // Sunday: free (recovery day typically)
  ];
}
