"use client";

import type { Incident } from "@citywatch/api-types";
import { Badge, SeverityBadge, XRayBox } from "@citywatch/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnalyticsRemotePanel } from "./analytics-remote-panel";
import { fetchIncidents } from "./incidents/incident-api";
import { useXRay, XRaySelector } from "./xray-selector";

export function CityWatchShell() {
  const { enabled: xray } = useXRay();
  const { enabled: monorepoXray, mode } = useXRay(["monorepo"]);
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
          <XRaySelector />
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

          {mode === "monorepo" ? (
            <XRayBox
              enabled={monorepoXray}
              label="package/web/WorkspaceConsumer"
              layer="package"
              packageName="apps/web"
              proofs={["monorepo"]}
              stacks={["npm workspaces", "Local Package Imports"]}
            >
              <MonorepoEvidencePanel />
            </XRayBox>
          ) : null}

          {!loading && !error ? (
            <AnalyticsRemotePanel incidents={incidents} />
          ) : null}

          <XRayBox
            enabled={monorepoXray}
            label="package/ui/SharedComponents"
            layer="package"
            packageName="packages/ui"
            proofs={["monorepo"]}
            stacks={["@citywatch/ui", "Badge", "SeverityBadge", "XRayBox"]}
          >
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
                  <XRayBox
                    enabled={xray || monorepoXray}
                    label="entity/incident/IncidentRows"
                    packageName="packages/api-types"
                    proofs={["fsd-style", "monorepo"]}
                    stacks={["@citywatch/api-types", "TypeScript", "Shared Contract"]}
                  >
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
          </XRayBox>
        </section>
      </XRayBox>
    </main>
  );
}

function MonorepoEvidencePanel() {
  return (
    <aside aria-labelledby="monorepo-evidence-title" className="panel monorepo-evidence">
      <div className="panel-title-row">
        <h2 id="monorepo-evidence-title">Monorepo 증거</h2>
        <Badge tone="success">npm workspaces</Badge>
      </div>

      <p>하나의 저장소에서 실행 앱과 공유 패키지를 관리하고, 관계에 맞는 방식으로 연결합니다.</p>

      <ul className="monorepo-relations">
        <li><code>apps/web</code><span>imports</span><code>packages/api-types</code></li>
        <li><code>apps/web</code><span>imports</span><code>packages/ui</code></li>
        <li><code>apps/web</code><span>runtime remote</span><code>apps/analytics-remote</code></li>
        <li><code>apps/web</code><span>network</span><code>apps/realtime-server</code></li>
      </ul>

      <dl className="monorepo-code">
        <div>
          <dt>Workspace 설정</dt>
          <dd>
            <a
              href="https://github.com/goodsosbva/citywatch-fe-lab/blob/master/package.json#L5-L8"
              rel="noreferrer"
              target="_blank"
            >
              <code>package.json:5-8</code>
            </a>
            <code>workspaces: [&quot;apps/*&quot;, &quot;packages/*&quot;]</code>
          </dd>
        </div>
        <div>
          <dt>공유 타입 import</dt>
          <dd><code>import type &#123; Incident &#125; from &quot;@citywatch/api-types&quot;;</code></dd>
        </div>
        <div>
          <dt>공유 UI import</dt>
          <dd><code>import &#123; Badge, SeverityBadge, XRayBox &#125; from &quot;@citywatch/ui&quot;;</code></dd>
        </div>
      </dl>
    </aside>
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
