import type { ApiError, IncidentDetailResponse } from "@citywatch/api-types";
import { isIncidentStatus } from "@citywatch/api-types";
import { NextResponse } from "next/server";
import { getIncidentById, updateIncidentStatus } from "../../incident-store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);

  if (!isRecord(body)) {
    return apiError(400, "INVALID_JSON", "요청 본문은 JSON 객체여야 합니다.");
  }

  if (body.incidentId !== id) {
    return apiError(400, "INCIDENT_ID_MISMATCH", "URL의 사고 ID와 요청 본문의 사고 ID가 다릅니다.");
  }

  if (typeof body.status !== "string" || !isIncidentStatus(body.status)) {
    return apiError(400, "INVALID_STATUS", "유효하지 않은 사고 상태입니다.");
  }

  if (!getIncidentById(id)) {
    return apiError(404, "INCIDENT_NOT_FOUND", "사고를 찾을 수 없습니다.");
  }

  const incident = updateIncidentStatus(id, body.status);
  return NextResponse.json<IncidentDetailResponse>({ incident: incident! });
}

async function readBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function apiError(status: number, code: string, message: string) {
  return NextResponse.json<ApiError>({ code, message }, { status });
}