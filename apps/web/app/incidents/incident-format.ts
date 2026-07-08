import type { IncidentCategory, IncidentSeverity, IncidentStatus } from "@citywatch/api-types";

export const incidentCategoryLabels: Record<IncidentCategory, string> = {
  fire: "화재",
  traffic: "교통",
  flood: "침수",
  crime: "치안",
  facility: "시설",
  medical: "의료",
  weather: "기상",
};

export const incidentSeverityLabels: Record<IncidentSeverity, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
  critical: "긴급",
};

export const incidentStatusLabels: Record<IncidentStatus, string> = {
  reported: "접수",
  dispatching: "출동",
  in_progress: "대응 중",
  resolved: "종결",
  false_alarm: "오인 신고",
};

const regionLabels: Record<string, string> = {
  seocho: "서초구",
  seongsu: "성동구",
  junggu: "중구",
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

export function getRegionName(regionId: string) {
  return regionLabels[regionId] ?? regionId;
}

export function formatIncidentDate(value: string) {
  return dateFormatter.format(new Date(value));
}

export function getStatusTone(status: IncidentStatus) {
  if (status === "resolved") return "success";
  if (status === "dispatching" || status === "in_progress") return "warning";
  if (status === "false_alarm") return "neutral";
  return "info";
}