import { NextRequest, NextResponse } from "next/server";
import { planStore } from "@/lib/planStore";
import type { UpdatePlanItemRequest } from "@/types";

/**
 * PATCH /api/plan/[date]?week=YYYY-MM-DD
 *
 * Update a single day in the plan: approve, deny, or edit.
 * The week query param identifies which week's store to update.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { date: string } }
) {
  try {
    const { date } = params;
    const week = req.nextUrl.searchParams.get("week");

    if (!week) {
      return NextResponse.json(
        { error: "Missing ?week=YYYY-MM-DD query param" },
        { status: 400 }
      );
    }

    const body = (await req.json()) as UpdatePlanItemRequest;
    const { status, workout, reason } = body;

    if (!status) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 }
      );
    }

    const updated = planStore.updateDay(week, date, status, workout, reason);

    if (!updated) {
      return NextResponse.json(
        { error: "Plan item not found. Generate the plan first." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      date,
      status: updated.status,
      workout: updated.workout,
      reason: updated.reason,
    });
  } catch (err) {
    console.error("[PATCH /api/plan/[date]]", err);
    return NextResponse.json(
      { error: "Failed to update plan item", detail: String(err) },
      { status: 500 }
    );
  }
}
