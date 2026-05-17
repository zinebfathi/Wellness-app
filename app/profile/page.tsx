"use client";

import { useEffect, useState } from "react";
import type { UserProfile } from "@/types";
import { mockProfile } from "@/data/mockProfile";
import { getCyclePhase, getCycleDayForDate, phaseDescriptions, phaseEmoji } from "@/lib/planning/cycleEngine";

export default function ProfilePage() {
  const profile: UserProfile = mockProfile;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastPeriod = new Date(profile.date_of_last_cycle);
  const cycleLength = profile.cycle_length_days ?? 28;
  const cycleDay = getCycleDayForDate(lastPeriod, cycleLength, today);
  const phase = getCyclePhase(cycleDay, cycleLength);

  const nextPeriodDays = cycleLength - cycleDay;
  const nextPeriodDate = new Date(today);
  nextPeriodDate.setDate(nextPeriodDate.getDate() + nextPeriodDays);

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">User Profile</h1>
        <p className="text-sm text-gray-500">Mock data — source of truth for plan generation</p>
      </div>

      {/* Cycle status */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
          Cycle Status — Today
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{phaseEmoji[phase]}</span>
          <div>
            <p className="font-medium capitalize">
              {phase} phase · Day {cycleDay}
            </p>
            <p className="text-xs text-gray-500">{phaseDescriptions[phase]}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Next period predicted in <strong>{nextPeriodDays}</strong> days (around{" "}
          {nextPeriodDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })})
        </p>
      </div>

      {/* Profile fields */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
          Profile
        </h2>

        <Row label="Name" value={profile.name} />
        <Row label="Age" value={String(profile.age)} />
        <Row label="Location" value={profile.location} />
        <Row label="Cycle length" value={`${profile.cycle_length_days ?? "Unknown"} days`} />
        <Row label="Last cycle" value={profile.date_of_last_cycle} />
        <Row label="Monthly budget" value={`$${profile.budget_monthly_usd}`} />
        <Row label="Workout goal" value={`${profile.frequency_per_week_goal}x per week`} />
        <Row label="Wearable" value={profile.wearable ?? "None"} />
        <Row label="Liked workouts" value={profile.workout_types_liked.join(", ")} />
        <Row label="Disliked workouts" value={profile.workout_types_disliked.join(", ")} />
        <Row label="Preferred windows" value={profile.workout_preferences.join(", ")} />
        <Row label="Motivation" value={profile.motivation.join(", ")} />
        <Row label="Memberships" value={profile.memberships.join(", ")} />
        <Row label="Tracking" value={profile.tracking_preferences.join(", ")} />
        {profile.medical_notes && (
          <Row label="Medical notes" value={profile.medical_notes} />
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 text-sm">
      <span className="w-36 text-gray-400 flex-shrink-0">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}
