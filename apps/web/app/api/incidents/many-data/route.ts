import type { ApiError, IncidentListResponse } from "@citywatch/api-types";
import { NextResponse } from "next/server";
import {
  createPerformanceIncidents,
  isPerformanceScenarioSize,
} from "../../../performance/performance-fixture";
import { listIncidents } from "../incident-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const size = Number(new URL(request.url).searchParams.get("size"));

  if (!isPerformanceScenarioSize(size)) {
    return NextResponse.json<ApiError>(
      {
        code: "INVALID_PERFORMANCE_SIZE",
        message: "size는 5000 또는 10000이어야 합니다.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json<IncidentListResponse>({
    incidents: createPerformanceIncidents(listIncidents(), size),
  });
}
