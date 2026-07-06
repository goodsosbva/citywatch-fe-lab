import type { IncidentSeverity } from "@citywatch/api-types";
import { Badge, type BadgeTone } from "./badge";

const severityTone: Record<IncidentSeverity, BadgeTone> = {
  low: "info",
  medium: "warning",
  high: "danger",
  critical: "danger",
};

const severityLabel: Record<IncidentSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export type SeverityBadgeProps = {
  severity: IncidentSeverity;
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return <Badge tone={severityTone[severity]}>{severityLabel[severity]}</Badge>;
}
