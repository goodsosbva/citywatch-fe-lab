import type { ApiError, CreateIncidentInput, IncidentDetailResponse, IncidentListQuery, IncidentListResponse, UpdateIncidentStatusInput } from "@citywatch/api-types";

export class IncidentApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "IncidentApiError";
  }
}

export async function fetchIncidents(query: IncidentListQuery = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.severity) params.set("severity", query.severity);
  if (query.status) params.set("status", query.status);
  if (query.regionId) params.set("regionId", query.regionId);

  const suffix = params.size ? `?${params.toString()}` : "";
  const data = await requestJson<IncidentListResponse>(`/api/incidents${suffix}`);
  return data.incidents;
}

export async function fetchPerformanceIncidents(size: number) {
  const data = await requestJson<IncidentListResponse>(
    `/api/incidents/many-data?size=${encodeURIComponent(size)}`,
  );
  return data.incidents;
}

export async function fetchIncident(id: string) {
  const data = await requestJson<IncidentDetailResponse>(`/api/incidents/${encodeURIComponent(id)}`);
  return data.incident;
}

export async function createIncident(input: CreateIncidentInput) {
  const data = await requestJson<IncidentDetailResponse>("/api/incidents", {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return data.incident;
}

export async function changeIncidentStatus(input: UpdateIncidentStatusInput) {
  const data = await requestJson<IncidentDetailResponse>(`/api/incidents/${encodeURIComponent(input.incidentId)}/status`, {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  return data.incident;
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = isApiError(data) ? data : { code: "HTTP_ERROR", message: "요청 처리 중 오류가 발생했습니다." };
    throw new IncidentApiError(response.status, error.code, error.message);
  }

  return data as T;
}

function isApiError(value: unknown): value is ApiError {
  return typeof value === "object" && value !== null && "code" in value && "message" in value;
}
