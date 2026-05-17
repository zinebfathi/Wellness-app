// ─── Cycle ───────────────────────────────────────────────────────────────────

export type CyclePhase = "menstrual" | "follicular" | "ovulatory" | "luteal";

export interface CycleDayInfo {
  date: Date;
  cycleDay: number;
  phase: CyclePhase;
}

// ─── Calendar ────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  isBusy: boolean;
  category?: string; // work | social | travel | personal | wellness
}

export type WindowType = "morning" | "lunch" | "evening";

export interface AvailabilityWindow {
  type: WindowType;
  startTime: Date;
  endTime: Date;
  freeMinutes: number;        // unblocked minutes within the window
  qualityScore: number;       // 0-10: higher = better for working out
}

export interface WorkoutSlot {
  date: Date;
  windowType: WindowType;
  startTime: Date;
  endTime: Date;
}

// ─── Calendar Analysis ───────────────────────────────────────────────────────

export type DayLoad = "free" | "light" | "moderate" | "heavy" | "blocked";

export interface DayAnalysis {
  date: Date;
  totalBusyMinutes: number;
  eventCount: number;
  load: DayLoad;
  isTravel: boolean;
  isConference: boolean;         // 4+ hour single event or conference category
  hasEveningCommitment: boolean; // event starting >= 17:00
  availableWindows: AvailabilityWindow[];
  bestWindow: AvailabilityWindow | null;
}

export interface WeekPattern {
  days: DayAnalysis[];
  travelDays: number[];          // day offsets (0=Mon) that are travel
  conferenceDays: number[];
  overloadedDays: number[];      // days where load = heavy/blocked
  lightDays: number[];           // days where load = free/light
  workoutCandidateDays: number[]; // ranked by suitability
}

// ─── Day Plan ─────────────────────────────────────────────────────────────────

export type DayType = "workout" | "active_recovery" | "rest";

// ─── Workout ─────────────────────────────────────────────────────────────────

export type Intensity = "low" | "medium" | "high";
export type WorkoutStatus = "suggested" | "approved" | "denied" | "edited";

export interface Workout {
  id: string;
  type: string;
  intensity: Intensity;
  durationMinutes: number;
  location: string;
  cost: number;
  cycleFit: string;
  motivationFit: string;
}

// ─── Weekly Plan ──────────────────────────────────────────────────────────────

export interface WeeklyPlanItem {
  date: Date;
  dayType: DayType;
  slot: WorkoutSlot | null;
  workout: Workout | null;
  status: WorkoutStatus;
  reason: string;              // why this workout, or why rest/recovery
}

export type WeeklyPlan = WeeklyPlanItem[];

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  age: number;
  location: string;
  cycle_length_days: number | null;
  cycle_variability_days: number | null;
  date_of_last_cycle: string; // ISO date string "YYYY-MM-DD"
  budget_monthly_usd: number;
  workout_preferences: string[]; // e.g. ["morning", "evening"]
  motivation: string[];
  workout_types_liked: string[];
  workout_types_disliked: string[];
  frequency_per_week_goal: number;
  wearable: string | null;
  tracking_preferences: string[];
  memberships: string[];
  medical_notes: string | null;
}

// ─── API Payloads ─────────────────────────────────────────────────────────────

export interface GeneratePlanRequest {
  weekStartDate: string;
  dataSource?: "mock" | "google" | "supabase";
}

export interface UpdatePlanItemRequest {
  status: WorkoutStatus;
  workout?: Partial<Workout>;
  reason?: string;
}
