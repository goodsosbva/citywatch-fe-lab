export type ISODateTime = string;

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export type IncidentStatus =
  | "reported"
  | "dispatching"
  | "in_progress"
  | "resolved"
  | "false_alarm";

export type IncidentCategory =
  | "fire"
  | "traffic"
  | "flood"
  | "crime"
  | "facility"
  | "medical"
  | "weather";

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

export type CreateIncidentInput = Omit<
  Incident,
  "id" | "status" | "reportedAt" | "updatedAt"
>;

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
