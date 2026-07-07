"use client";

import type { Incident } from "@citywatch/api-types";
import { Badge, SeverityBadge, XRayBox, XRayToggle } from "@citywatch/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchIncidents } from "./incident-api";
import {
  formatIncidentDate,
  getRegionName,
  incidentCategoryLabels,
  incidentStatusLabels,
} from "./incident-format";

export default function IncidentsPage() {
  const [xray, setXray] = useState(true);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const activeCount = useMemo(
    () =>
      incidents.filter(
        (incident) =>
          incident.status === "dispatching" ||
          incident.status === "in_progress",
      ).length,
    [incidents],
  );

  useEffect(() => {
    let active = true;

    async function loadIncidents() {
      try {
        const nextIncidents = await fetchIncidents();
        if (!active) return;
        setIncidents(nextIncidents);
        setError(undefined);
      } catch (reason) {
        if (!active) return;
        setError(getErrorMessage(reason));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadIncidents();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Incident Control</p>
          <h1>사고 목록 관제</h1>
        </div>
        <div className="topbar-actions">
          <Link className="nav-link" href="/">
            관제 홈
          </Link>
          <XRayToggle enabled={xray} onChange={setXray} />
        </div>
      </header>

      <XRayBox
        enabled={xray}
        label="app/incidents/IncidentsPage"
        layer="app"
        packageName="apps/web"
        stacks={["Next App Router", "React", "TypeScript"]}
      >
        <section className="dashboard" aria-label="사고 목록 관제">
          <XRayBox
            enabled={xray}
            label="widget/IncidentListSummary"
            packageName="apps/web"
            stacks={["React", "Shared Types"]}
          >
            <div className="panel metric-grid">
              <SummaryMetric title="전체 사고" value={incidents.length} />
              <SummaryMetric
                title="대응 필요"
                value={activeCount}
                tone="warning"
              />
              <SummaryMetric
                title="긴급"
                value={
                  incidents.filter(
                    (incident) => incident.severity === "critical",
                  ).length
                }
                tone="danger"
              />
              <SummaryMetric
                title="영향 인원"
                value={incidents.reduce(
                  (sum, incident) => sum + incident.affectedPeople,
                  0,
                )}
                tone="info"
              />
            </div>
          </XRayBox>

          <XRayBox
            enabled={xray}
            label="widget/IncidentList"
            packageName="apps/web"
            stacks={["Next Link", "Shared Types"]}
          >
            <section
              className="panel incident-list-panel"
              aria-labelledby="incident-list-title"
              aria-busy={loading}
            >
              <div className="panel-title-row">
                <h2 id="incident-list-title">사고 목록</h2>
                <Badge tone={error ? "danger" : loading ? "info" : "success"}>
                  {error ? "REST error" : loading ? "loading" : "REST API"}
                </Badge>
              </div>
              <XRayBox
                enabled={xray}
                label="feature/incident/FetchIncidentList"
                packageName="apps/web"
                stacks={["fetch", "REST API"]}
              >
                {loading ? (
                  <p className="state-message" role="status">
                    REST API에서 사고 목록을 불러오는 중입니다.
                  </p>
                ) : null}
                {error ? (
                  <p
                    className="state-message state-message--error"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
                {!loading && !error ? (
                  <ul className="incident-list">
                    {incidents.map((incident) => (
                      <IncidentListItem
                        incident={incident}
                        key={incident.id}
                        xray={xray}
                      />
                    ))}
                  </ul>
                ) : null}
              </XRayBox>
            </section>
          </XRayBox>
        </section>
      </XRayBox>
    </main>
  );
}

function SummaryMetric({
  title,
  value,
  tone = "neutral",
}: {
  title: string;
  value: number;
  tone?: "neutral" | "info" | "warning" | "danger";
}) {
  return (
    <article className={`metric metric--${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

function IncidentListItem({
  incident,
  xray,
}: {
  incident: Incident;
  xray: boolean;
}) {
  return (
    <li>
      <XRayBox
        enabled={xray}
        label="entity/incident/IncidentListItem"
        packageName="packages/api-types"
        stacks={["TypeScript", "Shared Contract"]}
      >
        <article className="incident-card">
          <div className="incident-card-main">
            <div className="incident-card-title-row">
              <Link
                className="incident-title-link"
                href={`/incidents/${incident.id}`}
              >
                {incident.title}
              </Link>
              <XRayBox
                enabled={xray}
                label="shared/ui/SeverityBadge"
                packageName="packages/ui"
                stacks={["React", "Shared UI"]}
              >
                <SeverityBadge severity={incident.severity} />
              </XRayBox>
            </div>
            <p>{incident.description}</p>
            <dl className="incident-meta">
              <MetaItem
                label="상태"
                value={incidentStatusLabels[incident.status]}
              />
              <MetaItem
                label="분류"
                value={incidentCategoryLabels[incident.category]}
              />
              <MetaItem label="지역" value={getRegionName(incident.regionId)} />
              <MetaItem
                label="접수"
                value={formatIncidentDate(incident.reportedAt)}
              />
            </dl>
          </div>
          <XRayBox
            enabled={xray}
            label="feature/incident/ViewIncidentDetail"
            packageName="apps/web"
            stacks={["Next Link", "Accessibility"]}
          >
            <Link
              className="nav-link nav-link--strong"
              href={`/incidents/${incident.id}`}
              aria-label={`${incident.title} 상세 보기`}
            >
              상세
            </Link>
          </XRayBox>
        </article>
      </XRayBox>
    </li>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function getErrorMessage(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "사고 목록을 불러오지 못했습니다.";
}
