"use client";

import type { Incident } from "@citywatch/api-types";
import { Badge, SeverityBadge, XRayBox, XRayToggle } from "@citywatch/ui";
import { useMemo, useState } from "react";

const incidents: Incident[] = [
  {
    id: "INC-001",
    title: "강남역 지하 보행로 침수 감지",
    description: "배수 센서 수위가 기준치를 초과했습니다.",
    category: "flood",
    severity: "critical",
    status: "in_progress",
    regionId: "seocho",
    location: { latitude: 37.4979, longitude: 127.0276 },
    reportedAt: "2026-07-06T09:12:00+09:00",
    updatedAt: "2026-07-06T09:18:00+09:00",
    affectedPeople: 42,
    assignedTeam: "Drainage-2",
  },
  {
    id: "INC-002",
    title: "성수대교 북단 교통 정체",
    description: "추돌 사고 신고 후 2개 차로 통제 중입니다.",
    category: "traffic",
    severity: "high",
    status: "dispatching",
    regionId: "seongsu",
    location: { latitude: 37.5467, longitude: 127.0448 },
    reportedAt: "2026-07-06T09:20:00+09:00",
    updatedAt: "2026-07-06T09:21:00+09:00",
    affectedPeople: 18,
    assignedTeam: "Traffic-4",
  },
  {
    id: "INC-003",
    title: "시청역 출입구 연기 신고",
    description: "현장 확인 결과 환기 설비 이상으로 추정됩니다.",
    category: "facility",
    severity: "medium",
    status: "reported",
    regionId: "junggu",
    location: { latitude: 37.5657, longitude: 126.9769 },
    reportedAt: "2026-07-06T09:27:00+09:00",
    updatedAt: "2026-07-06T09:27:00+09:00",
    affectedPeople: 7,
  },
];

export function CityWatchShell() {
  const [xray, setXray] = useState(true);
  const stats = useMemo(() => getStats(incidents), []);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">CityWatch FE Lab</p>
          <h1>도시 안전 관제 X-Ray Shell</h1>
        </div>
        <XRayToggle enabled={xray} onChange={setXray} />
      </header>

      <XRayBox
        enabled={xray}
        label="app/home/HomePage"
        layer="app"
        packageName="apps/web"
        stacks={["Next App Router", "React", "TypeScript"]}
      >
        <section className="dashboard" aria-label="도시 안전 관제 요약">
          <XRayBox
            enabled={xray}
            label="widget/SafetyOverview"
            packageName="apps/web"
            stacks={["React", "CSS Grid"]}
          >
            <div className="panel metric-grid">
              <Metric title="전체 사고" value={stats.total} xray={xray} />
              <Metric title="긴급 사고" value={stats.critical} tone="danger" xray={xray} />
              <Metric title="대응 중" value={stats.active} tone="warning" xray={xray} />
              <Metric title="영향 인원" value={stats.affectedPeople} tone="info" xray={xray} />
            </div>
          </XRayBox>

          <XRayBox
            enabled={xray}
            label="widget/RecentIncidents"
            packageName="apps/web"
            stacks={["React", "Shared Types"]}
          >
            <section className="panel incidents" aria-labelledby="recent-incidents-title">
              <div className="panel-title-row">
                <h2 id="recent-incidents-title">최근 사고</h2>
                <Badge tone="neutral">mock data</Badge>
              </div>
              <ul>
                {incidents.map((incident) => (
                  <IncidentRow incident={incident} key={incident.id} xray={xray} />
                ))}
              </ul>
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
    <XRayBox
      enabled={xray}
      label="entity/incident/IncidentRow"
      packageName="packages/api-types"
      stacks={["TypeScript", "Shared Contract"]}
    >
      <li className="incident-row">
        <div>
          <strong>{incident.title}</strong>
          <span>{incident.description}</span>
        </div>
        <XRayBox enabled={xray} label="shared/ui/SeverityBadge" packageName="packages/ui" stacks={["React", "Shared UI"]}>
          <SeverityBadge severity={incident.severity} />
        </XRayBox>
      </li>
    </XRayBox>
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
