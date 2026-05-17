"use client";

import type { CalendarEvent } from "@/types";

interface Props {
  events: CalendarEvent[];
}

function formatTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function CalendarDebugPanel({ events }: Props) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No calendar events this week.</p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {events.map((event, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 text-sm px-3 py-2 rounded ${
            event.isBusy ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"
          }`}
        >
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${event.isBusy ? "bg-red-400" : "bg-green-400"}`} />
          <span className="w-28 text-xs text-gray-500">{formatDay(event.start)}</span>
          <span className="text-xs text-gray-500">
            {formatTime(event.start)} – {formatTime(event.end)}
          </span>
          <span className="font-medium">{event.title}</span>
          <span className={`ml-auto text-xs ${event.isBusy ? "text-red-500" : "text-green-500"}`}>
            {event.isBusy ? "busy" : "free"}
          </span>
        </div>
      ))}
    </div>
  );
}
