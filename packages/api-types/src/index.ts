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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}