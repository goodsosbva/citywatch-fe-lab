import { getIncidentById } from "@/entities/incident/server";
import { notFound } from "next/navigation";
import { IncidentDetailRoute } from "./incident-detail-route";

export const dynamic = "force-dynamic";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const incident = getIncidentById(id);

  if (!incident) notFound();

  return (
    <IncidentDetailRoute
      initialIncident={incident}
      serverRenderedAt={new Date().toISOString()}
    />
  );
}
