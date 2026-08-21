import { IncidentDetailRoute } from "./incident-detail-route";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IncidentDetailRoute incidentId={id} />;
}
