import type { CreateIncidentInput, Incident, IncidentListQuery, IncidentStatus } from "@citywatch/api-types";

const initialIncidents: Incident[] = [
  {
    id: "INC-001",
    title: "강남역 지하 보행로 침수 감지",
    description: "배수 센서 수위가 기준치를 초과했습니다.",
    category: "flood",
    severity: "critical",
    status: "in_progress",
    regionId: "seocho",
    location: { latitude: 37.4979, longitude: 127.0276 },
    reportedAt: "2026-07-06T09:12:00+09:00",
    updatedAt: "2026-07-06T09:18:00+09:00",
    affectedPeople: 42,
    assignedTeam: "Drainage-2",
  },
  {
    id: "INC-002",
    title: "성수대교 북단 교통 정체",
    description: "추돌 사고 신고 후 2개 차로 통제 중입니다.",
    category: "traffic",
    severity: "high",
    status: "dispatching",
    regionId: "seongsu",
    location: { latitude: 37.5467, longitude: 127.0448 },
    reportedAt: "2026-07-06T09:20:00+09:00",
    updatedAt: "2026-07-06T09:21:00+09:00",
    affectedPeople: 18,
    assignedTeam: "Traffic-4",
  },
  {
    id: "INC-003",
    title: "시청역 출입구 연기 신고",
    description: "현장 확인 결과 환기 설비 이상으로 추정됩니다.",
    category: "facility",
    severity: "medium",
    status: "reported",
    regionId: "junggu",
    location: { latitude: 37.5657, longitude: 126.9769 },
    reportedAt: "2026-07-06T09:27:00+09:00",
    updatedAt: "2026-07-06T09:27:00+09:00",
    affectedPeople: 7,
  },
];

const incidents = new Map(initialIncidents.map((incident) => [incident.id, incident]));
let nextIncidentNumber = initialIncidents.reduce((max, incident) => {
  const match = /^INC-(\d+)$/.exec(incident.id);
  return match ? Math.max(max, Number(match[1])) : max;
}, 0) + 1;

export function listIncidents(query: IncidentListQuery = {}) {
  const search = query.search?.trim().toLowerCase();

  return [...incidents.values()].filter((incident) => {
    if (query.severity && incident.severity !== query.severity) return false;
    if (query.status && incident.status !== query.status) return false;
    if (query.regionId && incident.regionId !== query.regionId) return false;
    if (!search) return true;

    return [incident.id, incident.title, incident.description, incident.assignedTeam ?? ""].some((value) => value.toLowerCase().includes(search));
  });
}

export function createIncident(input: CreateIncidentInput) {
  const now = new Date().toISOString();
  const id = `INC-${String(nextIncidentNumber).padStart(3, "0")}`;
  nextIncidentNumber += 1;

  const incident: Incident = {
    ...input,
    id,
    status: "reported",
    reportedAt: now,
    updatedAt: now,
  };

  incidents.set(id, incident);
  return incident;
}

export function getIncidentById(id: string) {
  return incidents.get(id);
}

export function getIncidentIds() {
  return [...incidents.keys()];
}

export function updateIncidentStatus(id: string, status: IncidentStatus) {
  const incident = incidents.get(id);

  if (!incident) {
    return undefined;
  }

  const updated: Incident = {
    ...incident,
    status,
    updatedAt: new Date().toISOString(),
  };
  incidents.set(id, updated);
  return updated;
}