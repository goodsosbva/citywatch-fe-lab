"use client";

import type { Incident } from "@citywatch/api-types";
import { Badge, SeverityBadge, XRayBox, XRayToggle } from "@citywatch/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchIncidents } from "./incidents/incident-api";

export function CityWatchShell() {
  const [xray, setXray] = useState(true);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const stats = useMemo(() => getStats(incidents), [incidents]);

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
          <p className="eyebrow">CityWatch FE Lab</p>
          <h1>도시 안전 관제 X-Ray Shell</h1>
        </div>
        <div className="topbar-actions">
          <Link className="nav-link" href="/incidents">
            사고 목록
          </Link>
          <XRayToggle enabled={xray} onChange={setXray} />
        </div>
      </header>

      <XRayBox enabled={xray} label="app/home/HomePage" layer="app" packageName="apps/web" stacks={["Next App Router", "React", "TypeScript"]}>
        <section className="dashboard" aria-label="도시 안전 관제 요약">
          <XRayBox enabled={xray} label="widget/SafetyOverview" packageName="apps/web" stacks={["React", "CSS Grid"]}>
            <div className="panel metric-grid">
              <Metric title="전체 사고" value={stats.total} xray={xray} />
              <Metric title="긴급 사고" value={stats.critical} tone="danger" xray={xray} />
              <Metric title="대응 중" value={stats.active} tone="warning" xray={xray} />
              <Metric title="영향 인원" value={stats.affectedPeople} tone="info" xray={xray} />
            </div>
          </XRayBox>

          <XRayBox enabled={xray} label="widget/RecentIncidents" packageName="apps/web" stacks={["React", "Shared Types"]}>
            <section className="panel incidents" aria-labelledby="recent-incidents-title" aria-busy={loading}>
              <div className="panel-title-row">
                <div>
                  <h2 id="recent-incidents-title">최근 사고</h2>
                  <Badge tone={error ? "danger" : loading ? "info" : "success"}>{error ? "REST error" : loading ? "loading" : "REST API"}</Badge>
                </div>
                <XRayBox enabled={xray} label="feature/incident/OpenIncidentList" packageName="apps/web" stacks={["Next Link"]}>
                  <Link className="nav-link nav-link--strong" href="/incidents">
                    전체 보기
                  </Link>
                </XRayBox>
              </div>

              <XRayBox enabled={xray} label="feature/incident/FetchIncidentList" packageName="apps/web" stacks={["fetch", "REST API"]}>
                {loading ? <p className="state-message" role="status">REST API에서 사고 데이터를 불러오는 중입니다.</p> : null}
                {error ? <p className="state-message state-message--error" role="alert">{error}</p> : null}
                {!loading && !error ? (
                  <ul>
                    {incidents.map((incident) => (
                      <IncidentRow incident={incident} key={incident.id} xray={xray} />
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

function Metric({ title, value, tone = "neutral", xray }: { title: string; value: number; tone?: "neutral" | "info" | "warning" | "danger"; xray: boolean }) {
  return (
    <XRayBox enabled={xray} label="entity/incident/IncidentMetric" packageName="packages/api-types" stacks={["TypeScript"]}>
      <article className={`metric metric--${tone}`}>
        <span>{title}</span>
        <strong>{value}</strong>
      </article>
    </XRayBox>
  );
}

function IncidentRow({ incident, xray }: { incident: Incident; xray: boolean }) {
  return (
    <li>
      <XRayBox enabled={xray} label="entity/incident/IncidentRow" packageName="packages/api-types" stacks={["TypeScript", "Shared Contract"]}>
        <div className="incident-row">
          <div>
            <Link className="incident-title-link" href={`/incidents/${incident.id}`}>
              {incident.title}
            </Link>
            <span className="incident-description">{incident.description}</span>
          </div>
          <XRayBox enabled={xray} label="shared/ui/SeverityBadge" packageName="packages/ui" stacks={["React", "Shared UI"]}>
            <SeverityBadge severity={incident.severity} />
          </XRayBox>
        </div>
      </XRayBox>
    </li>
  );
}

function getStats(source: Incident[]) {
  return {
    total: source.length,
    critical: source.filter((incident) => incident.severity === "critical").length,
    active: source.filter((incident) => incident.status === "dispatching" || incident.status === "in_progress").length,
    affectedPeople: source.reduce((sum, incident) => sum + incident.affectedPeople, 0),
  };
}

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "사고 데이터를 불러오지 못했습니다.";
}