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

export type CreateIncidentInput = Omit<Incident, "id" | "status" | "reportedAt" | "updatedAt">;

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

export function isIncidentSeverity(value: string): value is IncidentSeverity {
  return (incidentSeverities as readonly string[]).includes(value);
}

export function isIncidentStatus(value: string): value is IncidentStatus {
  return (incidentStatuses as readonly string[]).includes(value);
}

export function isIncidentCategory(value: string): value is IncidentCategory {
  return (incidentCategories as readonly string[]).includes(value);
}