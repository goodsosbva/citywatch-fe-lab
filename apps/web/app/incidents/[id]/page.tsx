import { IncidentDetailView } from "../incident-detail-view";

export default async function IncidentDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IncidentDetailView incidentId={id} />;
}
