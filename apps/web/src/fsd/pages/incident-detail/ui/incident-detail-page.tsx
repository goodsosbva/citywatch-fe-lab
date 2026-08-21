import { IncidentDetailView } from "@/widgets/incident-detail";
import { XRayBox } from "@citywatch/ui";

export function IncidentDetailPage({ incidentId, xray }: { incidentId: string; xray: boolean }) {
  return (
    <XRayBox
      enabled={xray}
      label="page/incident-detail/IncidentDetailPage"
      layer="page"
      packageName="apps/web"
      stacks={["React", "FSD Page"]}
    >
      <IncidentDetailView incidentId={incidentId} xray={xray} />
    </XRayBox>
  );
}
