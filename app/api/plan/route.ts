import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdapters } from "@/lib/adapters";
import { generateWeeklyPlan, serialisePlan } from "@/lib/planning/planGenerator";
import { planStore } from "@/lib/planStore";
import { parseLocalDate } from "@/lib/dateUtils";
import type { GeneratePlanRequest } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GeneratePlanRequest;
    const { weekStartDate, dataSource = "mock" } = body;

    if (!weekStartDate) {
      return NextResponse.json(
        { error: "weekStartDate is required" },
        { status: 400 }
      );
    }

    // Get Google access token if using Google Calendar
    let accessToken: string | undefined;
    if (dataSource === "google") {
      const session = await getServerSession(authOptions);
      accessToken = (session as any)?.accessToken;
      if (!accessToken) {
        return NextResponse.json(
          { error: "Not authenticated with Google. Please sign in first." },
          { status: 401 }
        );
      }
    }

    // Validate Supabase env vars if using Supabase source
    if (dataSource === "supabase") {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json(
          { error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local to use the Supabase calendar source." },
          { status: 500 }
        );
      }
    }

    const adapters = getAdapters(dataSource as any, accessToken);
    const weekStartLocal = parseLocalDate(weekStartDate);

    // Fetch data in parallel
    const [profile, calendarEvents] = await Promise.all([
      adapters.profile.getProfile(),
      adapters.calendar.getEventsForWeek(weekStartLocal),
    ]);

    const plan = generateWeeklyPlan(profile, calendarEvents, weekStartLocal);

    // Cache the plan in the store so PATCH requests can update it
    planStore.setWeek(weekStartDate, plan);

    return NextResponse.json({
      weekStartDate,
      dataSource,
      profile: {
        name: profile.name,
        cycleLength: profile.cycle_length_days,
        frequencyGoal: profile.frequency_per_week_goal,
        lastCycle: profile.date_of_last_cycle,
      },
      plan: serialisePlan(plan),
      calendarEvents: calendarEvents.map((e) => ({
        title: e.title,
        start: e.start.toISOString(),
        end: e.end.toISOString(),
        isBusy: e.isBusy,
        category: e.category ?? null,
      })),
    });
  } catch (err) {
    console.error("[POST /api/plan]", err);
    return NextResponse.json(
      { error: "Failed to generate plan", detail: String(err) },
      { status: 500 }
    );
  }
}
