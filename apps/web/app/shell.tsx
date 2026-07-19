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
          <Link className="nav-link nav-link--strong" href="/map">
            지도 관제
          </Link>
          <Link className="nav-link nav-link--strong" href="/risk-3d">
            3D 위험 구역
          </Link>
          <Link className="nav-link nav-link--strong" href="/realtime">
            실시간 피드
          </Link>
          <Link className="nav-link nav-link--strong" href="/performance">
            대량 관제
          </Link>
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
              <Metric title="전체 사고" value={stats.total} />
              <Metric title="긴급 사고" value={stats.critical} tone="danger" />
              <Metric title="대응 중" value={stats.active} tone="warning" />
              <Metric title="영향 인원" value={stats.affectedPeople} tone="info" />
            </div>
          </XRayBox>

          <XRayBox enabled={xray} label="widget/RecentIncidents" packageName="apps/web" stacks={["React", "Shared Types"]}>
            <section className="panel incidents" aria-labelledby="recent-incidents-title" aria-busy={loading}>
              <div className="panel-title-row">
                <div>
                  <h2 id="recent-incidents-title">최근 사고</h2>
                  <Badge tone={error ? "danger" : loading ? "info" : "success"}>{error ? "REST error" : loading ? "loading" : "REST API"}</Badge>
                </div>
                <Link className="nav-link nav-link--strong" href="/incidents">
                  전체 보기
                </Link>
              </div>

              <XRayBox enabled={xray} label="feature/incident/FetchIncidentList" packageName="apps/web" stacks={["fetch", "REST API"]}>
                {loading ? <p className="state-message" role="status">REST API에서 사고 데이터를 불러오는 중입니다.</p> : null}
                {error ? <p className="state-message state-message--error" role="alert">{error}</p> : null}
                {!loading && !error ? (
                  <XRayBox enabled={xray} label="entity/incident/IncidentRows" packageName="packages/api-types" stacks={["TypeScript", "Shared Contract"]}>
                    <ul>
                      {incidents.map((incident) => (
                        <IncidentRow incident={incident} key={incident.id} />
                      ))}
                    </ul>
                  </XRayBox>
                ) : null}
              </XRayBox>
            </section>
          </XRayBox>
        </section>
      </XRayBox>
    </main>
  );
}

function Metric({ title, value, tone = "neutral" }: { title: string; value: number; tone?: "neutral" | "info" | "warning" | "danger" }) {
  return (
    <article className={`metric metric--${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

function IncidentRow({ incident }: { incident: Incident }) {
  return (
    <li>
      <div className="incident-row">
        <div>
          <Link className="incident-title-link" href={`/incidents/${incident.id}`}>
            {incident.title}
          </Link>
          <span className="incident-description">{incident.description}</span>
        </div>
        <SeverityBadge severity={incident.severity} />
      </div>
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
