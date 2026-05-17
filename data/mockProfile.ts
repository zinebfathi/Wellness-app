import type { UserProfile } from "@/types";

export const mockProfile: UserProfile = {
  name: "Younes",
  age: 29,
  location: "New York, NY",
  cycle_length_days: 28,
  cycle_variability_days: null,
  date_of_last_cycle: "2026-05-04", // ~13 days ago from May 17 → follicular phase
  budget_monthly_usd: 150,
  workout_preferences: ["morning", "evening"],
  motivation: ["feel strong", "reduce stress", "improve energy", "track progress"],
  workout_types_liked: [
    "yoga",
    "pilates",
    "strength",
    "running",
    "barre",
    "SoulCycle",
  ],
  workout_types_disliked: ["HIIT", "crossfit"],
  frequency_per_week_goal: 4,
  wearable: "Oura Ring",
  tracking_preferences: ["cycle", "sleep", "HRV", "steps"],
  memberships: ["Equinox", "ClassPass"],
  medical_notes: null,
};
