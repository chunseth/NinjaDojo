import { NextResponse } from "next/server";
import { fetchTodayDashboard } from "@/lib/server/dashboard";

export async function GET() {
  try {
    const data = await fetchTodayDashboard();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
