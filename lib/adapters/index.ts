import type { ICalendarAdapter, IProfileAdapter, IWearableAdapter } from "./types";
import { MockCalendarAdapter } from "./mock/mockCalendarAdapter";
import { MockProfileAdapter } from "./mock/mockProfileAdapter";
import { MockWearableAdapter } from "./mock/mockWearableAdapter";
import { GoogleCalendarAdapter } from "./google/googleCalendarAdapter";
import { SupabaseCalendarAdapter } from "./supabase/supabaseCalendarAdapter";

export type DataSource = "mock" | "google" | "supabase";

/**
 * Returns the active adapter set.
 *
 * - "mock"     → local mock data, no auth needed
 * - "supabase" → Supabase calendar_events table (SUPABASE_URL + SERVICE_ROLE_KEY)
 * - "google"   → Google Calendar API (requires OAuth access token)
 */
export function getAdapters(
  dataSource: DataSource,
  googleAccessToken?: string
): {
  calendar: ICalendarAdapter;
  profile: IProfileAdapter;
  wearable: IWearableAdapter;
} {
  let calendar: ICalendarAdapter;

  if (dataSource === "google" && googleAccessToken) {
    calendar = new GoogleCalendarAdapter(googleAccessToken);
  } else if (dataSource === "supabase") {
    calendar = new SupabaseCalendarAdapter();
  } else {
    calendar = new MockCalendarAdapter();
  }

  return {
    calendar,
    profile: new MockProfileAdapter(),
    wearable: new MockWearableAdapter(),
  };
}

export { MockCalendarAdapter, MockProfileAdapter, MockWearableAdapter };
export { GoogleCalendarAdapter };
export { SupabaseCalendarAdapter };
