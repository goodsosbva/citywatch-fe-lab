import { z } from "zod";

export type ISODateTime = string;

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export const incidentSeverities = ["low", "medium", "high", "critical"] as const;
export type IncidentSeverity = (typeof incidentSeverities)[number];

export const incidentStatuses = ["reported", "dispatching", "in_progress", "resolved", "false_alarm"] as const;
export type IncidentStatus = (typeof incidentStatuses)[number];

export const incidentCategories = ["fire", "traffic", "flood", "crime", "facility", "medical", "weather"] as const;
export type IncidentCategory = (typeof incidentCategories)[number];

export function isIncidentSeverity(value: string): value is IncidentSeverity {
  return (incidentSeverities as readonly string[]).includes(value);
}

export function isIncidentStatus(value: string): value is IncidentStatus {
  return (incidentStatuses as readonly string[]).includes(value);
}

export function isIncidentCategory(value: string): value is IncidentCategory {
  return (incidentCategories as readonly string[]).includes(value);
}

export type Region = {
  id: string;
  name: string;
  center: Coordinates;
};

export type Incident = {
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  regionId: string;
  location: Coordinates;
  reportedAt: ISODateTime;
  updatedAt: ISODateTime;
  affectedPeople: number;
  assignedTeam?: string;
};

export type IncidentListQuery = {
  search?: string;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  regionId?: string;
};

const MAX_TITLE_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 300;
const MAX_REGION_LENGTH = 40;
const MAX_TEAM_LENGTH = 40;
const MAX_AFFECTED_PEOPLE = 100000;

const createIncidentTextSchema = (message: string, min: number, max: number) =>
  z.string().trim().min(min, message).max(max, message);

const emptyStringToNaN = (value: unknown) => (typeof value === "string" && value.trim() === "" ? Number.NaN : value);

export const createIncidentInputSchema = z
  .object({
    title: createIncidentTextSchema(`사고명은 4자 이상 ${MAX_TITLE_LENGTH}자 이하로 입력해야 합니다.`, 4, MAX_TITLE_LENGTH),
    description: createIncidentTextSchema(`상세 내용은 10자 이상 ${MAX_DESCRIPTION_LENGTH}자 이하로 입력해야 합니다.`, 10, MAX_DESCRIPTION_LENGTH),
    category: z
      .string()
      .trim()
      .refine(isIncidentCategory, "유효하지 않은 사고 분류입니다.")
      .transform((value) => value as IncidentCategory),
    severity: z
      .string()
      .trim()
      .refine(isIncidentSeverity, "유효하지 않은 사고 심각도입니다.")
      .transform((value) => value as IncidentSeverity),
    regionId: z.string().trim().min(1, "관제 지역을 선택해야 합니다.").max(MAX_REGION_LENGTH, "유효하지 않은 관제 지역입니다.").regex(/^[a-z0-9-]+$/, "유효하지 않은 관제 지역입니다."),
    location: z.object({
      latitude: z.preprocess(emptyStringToNaN, z.coerce.number("위도는 숫자여야 합니다.").min(-90, "위도는 -90~90 범위여야 합니다.").max(90, "위도는 -90~90 범위여야 합니다.")),
      longitude: z.preprocess(emptyStringToNaN, z.coerce.number("경도는 숫자여야 합니다.").min(-180, "경도는 -180~180 범위여야 합니다.").max(180, "경도는 -180~180 범위여야 합니다.")),
    }),
    affectedPeople: z.preprocess(
      emptyStringToNaN,
      z
        .coerce
        .number("영향 인원은 숫자여야 합니다.")
        .int(`영향 인원은 0명 이상 ${MAX_AFFECTED_PEOPLE}명 이하의 정수여야 합니다.`)
        .min(0, `영향 인원은 0명 이상 ${MAX_AFFECTED_PEOPLE}명 이하의 정수여야 합니다.`)
        .max(MAX_AFFECTED_PEOPLE, `영향 인원은 0명 이상 ${MAX_AFFECTED_PEOPLE}명 이하의 정수여야 합니다.`),
    ),
    assignedTeam: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(MAX_TEAM_LENGTH, `담당 팀은 ${MAX_TEAM_LENGTH}자 이하로 입력해야 합니다.`).optional(),
    ),
  })
  .transform(({ assignedTeam, ...input }) => ({
    ...input,
    ...(assignedTeam ? { assignedTeam } : {}),
  }));

export type CreateIncidentInput = z.infer<typeof createIncidentInputSchema>;

export type CreateIncidentInputField =
  | "title"
  | "description"
  | "category"
  | "severity"
  | "regionId"
  | "latitude"
  | "longitude"
  | "affectedPeople"
  | "assignedTeam";

export type CreateIncidentValidationErrors = Partial<Record<CreateIncidentInputField, string>>;

export type CreateIncidentValidationResult =
  | { success: true; input: CreateIncidentInput }
  | { success: false; errors: CreateIncidentValidationErrors };

export type UpdateIncidentStatusInput = {
  incidentId: string;
  status: IncidentStatus;
};

export type ApiError = {
  code: string;
  message: string;
};

export type IncidentListResponse = {
  incidents: Incident[];
};

export type IncidentDetailResponse = {
  incident: Incident;
};

export type RealtimeMessage =
  | {
      type: "incident.created";
      incident: Incident;
      sentAt: ISODateTime;
    }
  | {
      type: "incident.updated";
      incident: Incident;
      sentAt: ISODateTime;
    }
  | {
      type: "incident.statusChanged";
      incidentId: string;
      status: IncidentStatus;
      sentAt: ISODateTime;
    }
  | {
      type: "heartbeat";
      sentAt: ISODateTime;
    };

export type RealtimeEvent = {
  id: number;
  message: RealtimeMessage;
};

export type RealtimeEventListResponse = {
  events: RealtimeEvent[];
  serverTime: ISODateTime;
};

export function isRealtimeEvent(value: unknown): value is RealtimeEvent {
  return isRecord(value) && typeof value.id === "number" && value.id > 0 && isRealtimeMessage(value.message);
}

export function isRealtimeEventListResponse(value: unknown): value is RealtimeEventListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.events) &&
    value.events.every(isRealtimeEvent) &&
    typeof value.serverTime === "string"
  );
}

export function isRealtimeMessage(value: unknown): value is RealtimeMessage {
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.sentAt !== "string") return false;
  if (value.type === "heartbeat") return true;

  if (value.type === "incident.statusChanged") {
    return typeof value.incidentId === "string" && typeof value.status === "string" && isIncidentStatus(value.status);
  }

  if (value.type === "incident.created" || value.type === "incident.updated") {
    return isIncident(value.incident);
  }

  return false;
}

export type IncidentRiskLevel = "low" | "guarded" | "elevated" | "severe";

export type IncidentRisk = {
  score: number;
  level: IncidentRiskLevel;
  reasons: string[];
};

export type IncidentRiskInput = Pick<
  Incident,
  "affectedPeople" | "category" | "severity" | "status"
>;

const severityRiskBase: Record<IncidentSeverity, number> = {
  low: 12,
  medium: 32,
  high: 60,
  critical: 80,
};

const statusRiskModifier: Record<IncidentStatus, number> = {
  reported: 5,
  dispatching: 12,
  in_progress: 10,
  resolved: -25,
  false_alarm: -45,
};

const categoryRiskModifier: Record<IncidentCategory, number> = {
  fire: 8,
  traffic: 3,
  flood: 8,
  crime: 8,
  facility: 4,
  medical: 7,
  weather: 6,
};

export function calculateIncidentRisk(incident: IncidentRiskInput): IncidentRisk {
  const affectedPeople = Math.max(0, incident.affectedPeople);
  const score = clampRiskScore(
    severityRiskBase[incident.severity] +
      statusRiskModifier[incident.status] +
      categoryRiskModifier[incident.category] +
      getAffectedPeopleRisk(affectedPeople),
  );

  return {
    score,
    level: getIncidentRiskLevel(score),
    reasons: getIncidentRiskReasons(incident, affectedPeople),
  };
}

function getAffectedPeopleRisk(affectedPeople: number) {
  if (affectedPeople >= 1000) return 25;
  if (affectedPeople >= 100) return 18;
  if (affectedPeople >= 30) return 10;
  if (affectedPeople >= 1) return 5;
  return 0;
}

function getIncidentRiskLevel(score: number): IncidentRiskLevel {
  if (score >= 80) return "severe";
  if (score >= 60) return "elevated";
  if (score >= 35) return "guarded";
  return "low";
}

function getIncidentRiskReasons(incident: IncidentRiskInput, affectedPeople: number) {
  const reasons = [
    `${incident.severity} severity`,
    `${incident.status} status`,
    `${incident.category} category`,
  ];
  if (affectedPeople > 0) reasons.push(`${affectedPeople} affected people`);
  return reasons;
}

function clampRiskScore(score: number) {
  return Math.min(100, Math.max(0, Math.round(score)));
}

export function validateCreateIncidentInput(value: unknown): CreateIncidentValidationResult {
  if (!isRecord(value)) {
    return { success: false, errors: { title: "요청 본문은 JSON 객체여야 합니다." } };
  }

  const result = createIncidentInputSchema.safeParse(value);

  if (result.success) {
    return { success: true, input: result.data };
  }

  const errors: CreateIncidentValidationErrors = {};

  for (const issue of result.error.issues) {
    const field = getCreateIncidentInputField(issue.path);
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }

  return {
    success: false,
    errors: Object.keys(errors).length ? errors : { title: "입력값을 확인해야 합니다." },
  };
}

function getCreateIncidentInputField(path: PropertyKey[]): CreateIncidentInputField | undefined {
  const [first, second] = path;

  if (first === "location" && second === "latitude") return "latitude";
  if (first === "location" && second === "longitude") return "longitude";
  if (typeof first !== "string") return undefined;
  if (["title", "description", "category", "severity", "regionId", "affectedPeople", "assignedTeam"].includes(first)) return first as CreateIncidentInputField;
  return undefined;
}

function isIncident(value: unknown): value is Incident {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.category === "string" &&
    isIncidentCategory(value.category) &&
    typeof value.severity === "string" &&
    isIncidentSeverity(value.severity) &&
    typeof value.status === "string" &&
    isIncidentStatus(value.status) &&
    typeof value.regionId === "string" &&
    isCoordinates(value.location) &&
    typeof value.reportedAt === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.affectedPeople === "number" &&
    Number.isFinite(value.affectedPeople) &&
    (value.assignedTeam === undefined || typeof value.assignedTeam === "string")
  );
}

function isCoordinates(value: unknown): value is Coordinates {
  return (
    isRecord(value) &&
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
