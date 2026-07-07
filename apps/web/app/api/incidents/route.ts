import type { ApiError, IncidentListQuery, IncidentListResponse } from "@citywatch/api-types";
import { isIncidentSeverity, isIncidentStatus } from "@citywatch/api-types";
import { NextResponse } from "next/server";
import { listIncidents } from "./incident-store";

const MAX_SEARCH_LENGTH = 80;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const severity = searchParams.get("severity")?.trim();
  const status = searchParams.get("status")?.trim();
  const regionId = searchParams.get("regionId")?.trim();

  if (search && search.length > MAX_SEARCH_LENGTH) {
    return apiError(400, "SEARCH_TOO_LONG", `검색어는 ${MAX_SEARCH_LENGTH}자 이하로 입력해야 합니다.`);
  }

  if (severity && !isIncidentSeverity(severity)) {
    return apiError(400, "INVALID_SEVERITY", "유효하지 않은 사고 심각도입니다.");
  }

  if (status && !isIncidentStatus(status)) {
    return apiError(400, "INVALID_STATUS", "유효하지 않은 사고 상태입니다.");
  }

  const query: IncidentListQuery = {};
  if (search) query.search = search;
  if (severity && isIncidentSeverity(severity)) query.severity = severity;
  if (status && isIncidentStatus(status)) query.status = status;
  if (regionId) query.regionId = regionId;

  return NextResponse.json<IncidentListResponse>({ incidents: listIncidents(query) });
}

function apiError(status: number, code: string, message: string) {
  return NextResponse.json<ApiError>({ code, message }, { status });
}