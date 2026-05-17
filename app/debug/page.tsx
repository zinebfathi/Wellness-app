"use client";

import { useState } from "react";
import CalendarDebugPanel from "@/components/CalendarDebugPanel";
import type { CalendarEvent } from "@/types";

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

export default function DebugPage() {
  const [week, setWeek] = useState(getMondayOfWeek(new Date()));
  const [source, setSource] = useState<"mock" | "google">("mock");
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawPlan, setRawPlan] = useState<any>(null);
  const [planLoading, setPlanLoading] = useState(false);

  async function fetchCalendar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar?week=${week}&source=${source}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setEvents(data.events.map((e: any) => ({
        ...e,
        start: new Date(e.start),
        end: new Date(e.end),
      })));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function fetchPlanRaw() {
    setPlanLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStartDate: week, dataSource: source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setRawPlan(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setPlanLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-lg font-semibold">Debug Panel</h1>
        <p className="text-sm text-gray-500">Inspect raw API responses to test backend logic</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Week start (Monday)</label>
          <input
            type="date"
            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data source</label>
          <select
            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            value={source}
            onChange={(e) => setSource(e.target.value as "mock" | "google")}
          >
            <option value="mock">Mock</option>
            <option value="google">Google Calendar</option>
          </select>
        </div>
        <button
          onClick={fetchCalendar}
          disabled={loading}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Fetch Calendar Events"}
        </button>
        <button
          onClick={fetchPlanRaw}
          disabled={planLoading}
          className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
        >
          {planLoading ? "Loading..." : "Generate Plan (raw JSON)"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Calendar events */}
      {events && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Calendar Events ({events.length})</h2>
          <CalendarDebugPanel events={events} />
        </div>
      )}

      {/* Raw plan JSON */}
      {rawPlan && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Raw Plan JSON</h2>
          <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded overflow-auto max-h-[500px]">
            {JSON.stringify(rawPlan, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
