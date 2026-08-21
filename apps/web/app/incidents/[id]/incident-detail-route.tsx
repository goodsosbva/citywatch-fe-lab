"use client";

import { IncidentDetailPage } from "@/pages/incident-detail";
import { XRayBox } from "@citywatch/ui";
import { useXRay } from "../../xray-selector";

export function IncidentDetailRoute({ incidentId }: { incidentId: string }) {
  const { enabled: xray } = useXRay();

  return (
    <XRayBox
      enabled={xray}
      label="app/incidents/[id]/IncidentDetailRoute"
      layer="app"
      packageName="apps/web"
      stacks={["Next Dynamic Route", "React"]}
    >
      <IncidentDetailPage incidentId={incidentId} xray={xray} />
    </XRayBox>
  );
}
