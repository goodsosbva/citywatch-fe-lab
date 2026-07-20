import type { Incident } from "@citywatch/api-types";

export type IncidentAnalyticsInput = Pick<
  Incident,
  "affectedPeople" | "severity" | "status"
>;

export type IncidentAnalyticsSnapshot = {
  averageAffectedPeople: number;
  highRisk: number;
  resolutionRate: number;
  total: number;
};

export function calculateIncidentAnalytics(
  incidents: readonly IncidentAnalyticsInput[],
): IncidentAnalyticsSnapshot {
  const total = incidents.length;
  const resolved = incidents.filter((incident) => incident.status === "resolved").length;
  const highRisk = incidents.filter(
    (incident) => incident.severity === "high" || incident.severity === "critical",
  ).length;
  const affectedPeople = incidents.reduce(
    (sum, incident) => sum + incident.affectedPeople,
    0,
  );

  return {
    averageAffectedPeople: total ? Math.round(affectedPeople / total) : 0,
    highRisk,
    resolutionRate: total ? Math.round((resolved / total) * 100) : 0,
    total,
  };
}
