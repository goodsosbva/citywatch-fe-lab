import { IncidentDetailView } from "../incident-detail-view";
import { getIncidentIds } from "../../api/incidents/incident-store";

export function generateStaticParams() {
  return getIncidentIds().map((id) => ({ id }));
}

export default async function IncidentDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IncidentDetailView incidentId={id} />;
}