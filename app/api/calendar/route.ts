import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdapters } from "@/lib/adapters";

/**
 * GET /api/calendar?week=YYYY-MM-DD&source=mock|google
 *
 * Returns raw calendar events for the given week.
 * Useful for debugging and visualising what the planner sees.
 */
export async function GET(req: NextRequest) {
  try {
    const week = req.nextUrl.searchParams.get("week");
    const source = (req.nextUrl.searchParams.get("source") ?? "mock") as "mock" | "google";

    if (!week) {
      return NextResponse.json(
        { error: "Missing ?week=YYYY-MM-DD query param" },
        { status: 400 }
      );
    }

    let accessToken: string | undefined;
    if (source === "google") {
      const session = await getServerSession(authOptions);
      accessToken = (session as any)?.accessToken;
      if (!accessToken) {
        return NextResponse.json(
          { error: "Not authenticated with Google." },
          { status: 401 }
        );
      }
    }

    const adapters = getAdapters(source, accessToken);
    const events = await adapters.calendar.getEventsForWeek(new Date(week));

    return NextResponse.json({ week, source, events });
  } catch (err) {
    console.error("[GET /api/calendar]", err);
    return NextResponse.json(
      { error: "Failed to fetch calendar events", detail: String(err) },
      { status: 500 }
    );
  }
}
