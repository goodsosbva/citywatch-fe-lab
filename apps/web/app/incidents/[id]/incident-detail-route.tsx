"use client";

import { IncidentDetailView } from "@/widgets/incident-detail";
import type { Incident } from "@/entities/incident";
import { XRayBox } from "@citywatch/ui";
import { useXRay } from "../../xray-selector";

export function IncidentDetailRoute({
  initialIncident,
  serverRenderedAt,
}: {
  initialIncident: Incident;
  serverRenderedAt: string;
}) {
  const { enabled: xray, mode } = useXRay();
  const ssrXray = mode === "ssr";

  return (
    <XRayBox
      enabled={xray || ssrXray}
      label={ssrXray ? "ssr/IncidentDetailHydrationBoundary" : "app/incidents/[id]/IncidentDetailRoute"}
      layer="app"
      packageName="apps/web"
      proofs={ssrXray ? ["ssr"] : ["fsd-style"]}
      stacks={ssrXray ? ["Next Server Component", "React Hydration"] : ["Next Dynamic Route", "React"]}
    >
      <IncidentDetailView
        initialIncident={initialIncident}
        serverRenderedAt={serverRenderedAt}
        ssrXray={ssrXray}
        xray={xray}
      />
    </XRayBox>
  );
}
