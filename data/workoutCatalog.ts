import type { Intensity } from "@/types";

export interface WorkoutTemplate {
  type: string;
  intensity: Intensity;
  durationMinutes: number;
  location: string;
  cost: number;
  tags: string[]; // used for matching phase recommendations
}

export const workoutCatalog: WorkoutTemplate[] = [
  {
    type: "Yoga",
    intensity: "low",
    durationMinutes: 60,
    location: "Studio / Home",
    cost: 25,
    tags: ["yoga", "mobility", "stress-relief", "menstrual", "follicular", "luteal"],
  },
  {
    type: "Pilates",
    intensity: "low",
    durationMinutes: 50,
    location: "Studio",
    cost: 35,
    tags: ["pilates", "core", "menstrual", "follicular", "luteal", "ovulatory"],
  },
  {
    type: "Barre",
    intensity: "medium",
    durationMinutes: 50,
    location: "Studio",
    cost: 35,
    tags: ["barre", "strength", "follicular", "luteal", "ovulatory"],
  },
  {
    type: "Strength Training",
    intensity: "medium",
    durationMinutes: 60,
    location: "Gym",
    cost: 0,
    tags: ["strength", "follicular", "ovulatory", "luteal"],
  },
  {
    type: "Running",
    intensity: "medium",
    durationMinutes: 45,
    location: "Outdoor",
    cost: 0,
    tags: ["running", "cardio", "follicular", "ovulatory"],
  },
  {
    type: "HIIT",
    intensity: "high",
    durationMinutes: 45,
    location: "Gym / Studio",
    cost: 30,
    tags: ["HIIT", "cardio", "ovulatory"],
  },
  {
    type: "SoulCycle",
    intensity: "high",
    durationMinutes: 45,
    location: "SoulCycle Studio",
    cost: 40,
    tags: ["SoulCycle", "cycling", "cardio", "ovulatory", "follicular"],
  },
  {
    type: "Barry's Bootcamp",
    intensity: "high",
    durationMinutes: 60,
    location: "Barry's Studio",
    cost: 45,
    tags: ["Barry's", "HIIT", "strength", "cardio", "ovulatory"],
  },
  {
    type: "Walking",
    intensity: "low",
    durationMinutes: 45,
    location: "Outdoor",
    cost: 0,
    tags: ["walking", "mobility", "recovery", "menstrual", "luteal"],
  },
  {
    type: "Mobility & Stretching",
    intensity: "low",
    durationMinutes: 30,
    location: "Home",
    cost: 0,
    tags: ["mobility", "stretching", "recovery", "menstrual", "luteal"],
  },
  {
    type: "Breathwork",
    intensity: "low",
    durationMinutes: 30,
    location: "Home / Studio",
    cost: 10,
    tags: ["breathwork", "recovery", "menstrual"],
  },
  {
    type: "Zone 2 Cardio",
    intensity: "low",
    durationMinutes: 45,
    location: "Gym / Outdoor",
    cost: 0,
    tags: ["zone2", "cardio", "luteal", "recovery"],
  },
  {
    type: "Dance Class",
    intensity: "medium",
    durationMinutes: 60,
    location: "Studio",
    cost: 30,
    tags: ["dance", "cardio", "follicular", "ovulatory"],
  },
];
