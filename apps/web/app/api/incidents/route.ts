import type { ApiError, IncidentDetailResponse, IncidentListQuery, IncidentListResponse } from "@citywatch/api-types";
import { isIncidentSeverity, isIncidentStatus, validateCreateIncidentInput } from "@citywatch/api-types";
import { NextResponse } from "next/server";
import { createIncident, listIncidents } from "./incident-store";

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

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "요청 본문은 JSON 객체여야 합니다.");
  }

  if (!isRecord(body)) {
    return apiError(400, "INVALID_JSON", "요청 본문은 JSON 객체여야 합니다.");
  }

  const result = validateCreateIncidentInput(body);

  if (!result.success) {
    const firstError = Object.entries(result.errors).find(([, message]) => Boolean(message));
    const field = firstError?.[0] ?? "form";
    const message = firstError?.[1] ?? "입력값을 확인해야 합니다.";
    return apiError(400, getCreateIncidentErrorCode(field), message);
  }

  const incident = createIncident(result.input);
  return NextResponse.json<IncidentDetailResponse>({ incident }, { status: 201 });
}

function apiError(status: number, code: string, message: string) {
  return NextResponse.json<ApiError>({ code, message }, { status });
}

function getCreateIncidentErrorCode(field: string) {
  switch (field) {
    case "title":
      return "INVALID_TITLE";
    case "description":
      return "INVALID_DESCRIPTION";
    case "category":
      return "INVALID_CATEGORY";
    case "severity":
      return "INVALID_SEVERITY";
    case "regionId":
      return "INVALID_REGION";
    case "latitude":
    case "longitude":
      return "INVALID_LOCATION";
    case "affectedPeople":
      return "INVALID_AFFECTED_PEOPLE";
    case "assignedTeam":
      return "INVALID_ASSIGNED_TEAM";
    default:
      return "INVALID_CREATE_INCIDENT";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}