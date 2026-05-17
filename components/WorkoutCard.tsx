"use client";

import { useState } from "react";
import type { WeeklyPlanItem, Workout, WorkoutStatus, DayType } from "@/types";
import { workoutCatalog } from "@/data/workoutCatalog";

interface Props {
  item: WeeklyPlanItem;
  weekStart: string;
  onUpdate: (dateStr: string, status: WorkoutStatus, workout?: Partial<Workout>) => void;
}

const DAY_TYPE_STYLES: Record<DayType, string> = {
  workout:         "bg-white border-gray-200",
  active_recovery: "bg-blue-50 border-blue-200",
  rest:            "bg-gray-50 border-gray-200 opacity-75",
};

const DAY_TYPE_LABEL: Record<DayType, string> = {
  workout:         "Workout",
  active_recovery: "Active Recovery",
  rest:            "Rest",
};

const DAY_TYPE_BADGE: Record<DayType, string> = {
  workout:         "bg-indigo-100 text-indigo-700",
  active_recovery: "bg-blue-100 text-blue-700",
  rest:            "bg-gray-100 text-gray-500",
};

const STATUS_BADGES: Record<WorkoutStatus, string> = {
  suggested: "bg-gray-100 text-gray-500",
  approved:  "bg-green-100 text-green-700",
  denied:    "bg-red-100 text-red-700",
  edited:    "bg-amber-100 text-amber-700",
};

const INTENSITY_STYLES: Record<string, { dot: string; label: string }> = {
  low:    { dot: "bg-green-400",  label: "Low" },
  medium: { dot: "bg-amber-400",  label: "Medium" },
  high:   { dot: "bg-red-400",    label: "High" },
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getDayIndex(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

function formatWindow(slot: WeeklyPlanItem["slot"]) {
  if (!slot) return null;
  const label = slot.windowType.charAt(0).toUpperCase() + slot.windowType.slice(1);
  const start = new Date(slot.startTime).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });
  return `${label} · ${start}`;
}

const OTHER_VALUE = "__other__";

export default function WorkoutCard({ item, weekStart, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState(item.workout?.type ?? "");
  const [customType, setCustomType] = useState("");
  const [editIntensity, setEditIntensity] = useState<"low" | "medium" | "high">(
    item.workout?.intensity ?? "medium"
  );
  const [editDuration, setEditDuration] = useState(item.workout?.durationMinutes ?? 45);

  const dateStr = new Date(item.date).toISOString().split("T")[0];
  const dayIndex = getDayIndex(item.date);
  const isUsingOther = editType === OTHER_VALUE;

  const handleApprove = () => onUpdate(dateStr, "approved");
  const handleDeny    = () => onUpdate(dateStr, "denied");

  const handleSaveEdit = () => {
    const resolvedType = isUsingOther ? customType.trim() : editType;
    if (!resolvedType) return;
    onUpdate(dateStr, "edited", {
      type: resolvedType,
      intensity: editIntensity,
      durationMinutes: editDuration,
    });
    setEditing(false);
  };

  const handleStartEdit = () => {
    setEditType(item.workout?.type ?? workoutCatalog[0].type);
    setCustomType("");
    setEditIntensity(item.workout?.intensity ?? "medium");
    setEditDuration(item.workout?.durationMinutes ?? 45);
    setEditing(true);
  };

  const isRest = item.dayType === "rest";
  const isRecovery = item.dayType === "active_recovery";

  return (
    <div className={`border rounded-lg p-4 flex flex-col gap-3 ${DAY_TYPE_STYLES[item.dayType]}`}>

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-semibold text-sm">{DAYS[dayIndex]}</span>
          <span className="text-gray-400 text-xs ml-2">{formatDate(item.date)}</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DAY_TYPE_BADGE[item.dayType]}`}>
            {DAY_TYPE_LABEL[item.dayType]}
          </span>
          {item.status !== "suggested" && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGES[item.status]}`}>
              {item.status}
            </span>
          )}
        </div>
      </div>

      {/* Slot */}
      {item.slot && (
        <p className="text-xs text-gray-400">{formatWindow(item.slot)}</p>
      )}

      {/* Rest day */}
      {isRest && !item.workout && (
        <p className="text-xs text-gray-500 italic leading-relaxed">{item.reason}</p>
      )}

      {/* Active recovery — show workout details too */}
      {isRecovery && !editing && item.workout && (
        <>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-blue-700">{item.workout.type}</span>
            <span className={`w-2 h-2 rounded-full ${INTENSITY_STYLES[item.workout.intensity].dot}`} />
          </div>
          <p className="text-xs text-blue-600 leading-relaxed">{item.reason}</p>
        </>
      )}

      {/* Workout details */}
      {item.dayType === "workout" && item.workout && !editing && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{item.workout.type}</span>
            <span
              className={`w-2 h-2 rounded-full ${INTENSITY_STYLES[item.workout.intensity].dot}`}
              title={INTENSITY_STYLES[item.workout.intensity].label}
            />
            <span className="text-xs text-gray-400">
              {INTENSITY_STYLES[item.workout.intensity].label} intensity
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-gray-500">
            <span>{item.workout.durationMinutes} min</span>
            <span>{item.workout.location}</span>
            <span>{item.workout.cost === 0 ? "Free" : `$${item.workout.cost}`}</span>
          </div>

          <p className="text-xs text-gray-600 leading-relaxed border-l-2 border-gray-200 pl-2">
            {item.workout.cycleFit}
          </p>

          <p className="text-xs text-gray-400">{item.workout.motivationFit}</p>
        </>
      )}

      {/* Edit form */}
      {editing && item.workout && (
        <div className="flex flex-col gap-2.5">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Workout type</label>
            <select
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              value={editType}
              onChange={(e) => {
                setEditType(e.target.value);
                if (e.target.value !== OTHER_VALUE) setCustomType("");
              }}
            >
              {workoutCatalog.map((w) => (
                <option key={w.type} value={w.type}>{w.type}</option>
              ))}
              <option disabled>──────────</option>
              <option value={OTHER_VALUE}>Other (type your own)</option>
            </select>
          </div>

          {isUsingOther && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Describe your workout</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                placeholder="e.g. Beach volleyball, Dance class..."
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 block mb-1">Intensity</label>
            <select
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              value={editIntensity}
              onChange={(e) => setEditIntensity(e.target.value as "low" | "medium" | "high")}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Duration (min)</label>
            <input
              type="number"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              value={editDuration}
              min={15} max={180} step={5}
              onChange={(e) => setEditDuration(Number(e.target.value))}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSaveEdit}
              disabled={isUsingOther && !customType.trim()}
              className="flex-1 bg-gray-900 text-white text-xs py-1.5 rounded hover:bg-gray-700 disabled:opacity-40"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex-1 bg-gray-100 text-gray-700 text-xs py-1.5 rounded hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!editing && item.workout && item.status === "suggested" && (
        <div className="flex gap-2 pt-1">
          <button onClick={handleApprove}
            className="flex-1 bg-green-600 text-white text-xs py-1.5 rounded hover:bg-green-700">
            Approve
          </button>
          <button onClick={handleStartEdit}
            className="flex-1 bg-gray-100 text-gray-700 text-xs py-1.5 rounded hover:bg-gray-200">
            Edit
          </button>
          <button onClick={handleDeny}
            className="flex-1 bg-red-100 text-red-700 text-xs py-1.5 rounded hover:bg-red-200">
            Deny
          </button>
        </div>
      )}

      {/* Re-edit if approved/edited */}
      {!editing && item.workout && (item.status === "approved" || item.status === "edited") && (
        <button onClick={handleStartEdit}
          className="w-full bg-gray-100 text-gray-600 text-xs py-1.5 rounded hover:bg-gray-200">
          Edit
        </button>
      )}

      {/* Undo deny */}
      {!editing && item.status === "denied" && (
        <button onClick={() => onUpdate(dateStr, "suggested")}
          className="w-full bg-gray-100 text-gray-600 text-xs py-1.5 rounded hover:bg-gray-200">
          Undo
        </button>
      )}
    </div>
  );
}
