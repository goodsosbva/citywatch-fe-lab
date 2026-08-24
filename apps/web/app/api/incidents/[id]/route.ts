import type { ApiError, IncidentDetailResponse } from "@citywatch/api-types";
import { getIncidentById } from "@/entities/incident/server";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const incident = getIncidentById(id);

  if (!incident) {
    return apiError(404, "INCIDENT_NOT_FOUND", "사고를 찾을 수 없습니다.");
  }

  return NextResponse.json<IncidentDetailResponse>({ incident });
}

function apiError(status: number, code: string, message: string) {
  return NextResponse.json<ApiError>({ code, message }, { status });
}
