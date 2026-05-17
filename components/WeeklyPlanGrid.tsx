"use client";

import type { WeeklyPlanItem, Workout, WorkoutStatus } from "@/types";
import WorkoutCard from "./WorkoutCard";

interface Props {
  plan: WeeklyPlanItem[];
  weekStart: string;
  onUpdate: (dateStr: string, status: WorkoutStatus, workout?: Partial<Workout>) => void;
}

export default function WeeklyPlanGrid({ plan, weekStart, onUpdate }: Props) {
  const approved = plan.filter((d) => d.status === "approved").length;
  const denied = plan.filter((d) => d.status === "denied").length;
  const workoutDays = plan.filter((d) => d.workout !== null).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="flex gap-6 text-sm text-gray-600 border-b border-gray-200 pb-3">
        <span>
          <strong>{workoutDays}</strong> workouts planned
        </span>
        <span className="text-green-700">
          <strong>{approved}</strong> approved
        </span>
        <span className="text-red-600">
          <strong>{denied}</strong> denied
        </span>
        <span className="text-gray-400">
          <strong>{plan.filter((d) => d.status === "suggested").length}</strong> pending review
        </span>
      </div>

      {/* 7-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {plan.map((item) => (
          <WorkoutCard
            key={new Date(item.date).toISOString()}
            item={item}
            weekStart={weekStart}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  );
}
