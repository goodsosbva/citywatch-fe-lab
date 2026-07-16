"use client";

import {
  calculateIncidentRisk,
  type Incident,
  type IncidentRiskLevel,
} from "@citywatch/api-types";
import { Badge, SeverityBadge, XRayBox, XRayToggle } from "@citywatch/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchIncidents } from "../incidents/incident-api";
import {
  getRegionName,
  getRiskTone,
  getStatusTone,
  incidentRiskLevelColors,
  incidentRiskLevelLabels,
  incidentStatusLabels,
} from "../incidents/incident-format";
import {
  selectActiveIncidentFilterCount,
  selectIncidentListQuery,
  selectSelectedIncidentId,
  setSelectedIncidentId,
} from "../incidents/incident-control-slice";
import { useAppDispatch, useAppSelector } from "../store-hooks";
import { OpenLayersIncidentMap } from "../map/openlayers-incident-map";
import { RiskZoneScene } from "./risk-zone-scene";

const riskLevels: IncidentRiskLevel[] = ["severe", "elevated", "guarded", "low"];
type RiskViewMode = "2d" | "3d";

export default function Risk3DPage() {
  const dispatch = useAppDispatch();
  const [xray, setXray] = useState(true);
  const [viewMode, setViewMode] = useState<RiskViewMode>("2d");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const activeFilterCount = useAppSelector(selectActiveIncidentFilterCount);
  const query = useAppSelector(selectIncidentListQuery);
  const selectedIncidentId = useAppSelector(selectSelectedIncidentId);
  const selectedIncident = useMemo(
    () => incidents.find((incident) => incident.id === selectedIncidentId),
    [incidents, selectedIncidentId],
  );
  const stats = useMemo(() => getRiskStats(incidents), [incidents]);

  useEffect(() => {
    let active = true;

    async function loadIncidents() {
      setLoading(true);

      try {
        const nextIncidents = await fetchIncidents(query);
        if (!active) return;
        setIncidents(nextIncidents);
        if (
          nextIncidents.length > 0 &&
          !nextIncidents.some((incident) => incident.id === selectedIncidentId)
        ) {
          dispatch(setSelectedIncidentId(getHighestRiskIncidentId(nextIncidents)));
        }
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
  }, [query]);

  function selectIncident(incidentId: string) {
    dispatch(setSelectedIncidentId(incidentId));
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">3D Risk Control</p>
          <h1>3D 위험 구역 관제</h1>
        </div>
        <div className="topbar-actions">
          <Link className="nav-link nav-link--strong" href="/map">
            지도 관제
          </Link>
          <Link className="nav-link" href="/realtime">
            실시간 피드
          </Link>
          <Link className="nav-link" href="/incidents">
            사고 목록
          </Link>
          <Link className="nav-link" href="/">
            관제 홈
          </Link>
          <XRayToggle enabled={xray} onChange={setXray} />
        </div>
      </header>

      <XRayBox
        enabled={xray}
        label="app/risk-3d/Risk3DPage"
        layer="app"
        packageName="apps/web"
        stacks={["Next App Router", "React", "TypeScript"]}
      >
        <section aria-busy={loading} aria-label="3D 위험 구역 관제" className="dashboard">
          <XRayBox
            enabled={xray}
            label="widget/RiskZoneSummary"
            packageName="apps/web"
            stacks={["React", "Shared Risk Score"]}
          >
            <div className="panel metric-grid">
              <RiskMetric title="표시 사고" value={incidents.length} />
              <RiskMetric title="심각 구역" tone="danger" value={stats.severe} />
              <RiskMetric title="최고 점수" tone="warning" value={stats.peak} />
              <RiskMetric title="선택 구역" tone="info" value={selectedIncidentId ?? "-"} />
            </div>
          </XRayBox>

          <section aria-labelledby="risk-3d-scene-title" className="risk-3d-workspace">
            <div className="risk-3d-heading">
              <div>
                <h2 id="risk-3d-scene-title">
                  {viewMode === "2d" ? "전체 사고 위치" : "선택 사고 3D 상세"}
                </h2>
                <p>
                  {viewMode === "2d"
                    ? "전체 위치를 먼저 확인한 뒤 사고를 선택해 3D 상세로 좁혀 봅니다."
                    : "선택한 사고 지점 주변을 확대해 기둥 바닥과 실제 도로 위치를 함께 확인합니다."}
                </p>
              </div>
              <div className="risk-view-actions">
                <div aria-label="위험 구역 지도 모드" className="risk-view-mode" role="group">
                  <button
                    aria-pressed={viewMode === "2d"}
                    onClick={() => setViewMode("2d")}
                    type="button"
                  >
                    2D 전체 위치
                  </button>
                  <button
                    aria-pressed={viewMode === "3d"}
                    disabled={!selectedIncident}
                    onClick={() => setViewMode("3d")}
                    type="button"
                  >
                    3D 선택 지점
                  </button>
                </div>
                <div className="detail-badges">
                  <Badge tone={error ? "danger" : loading ? "info" : "success"}>
                    {error ? "REST error" : loading ? "loading" : viewMode === "2d" ? "OpenLayers" : "WebGL"}
                  </Badge>
                  <Badge tone="info">Redux 필터 {activeFilterCount}</Badge>
                </div>
              </div>
            </div>

            {loading ? (
              <p className="state-message" role="status">
                REST API에서 3D 위험 구역 데이터를 불러오는 중입니다.
              </p>
            ) : null}
            {error ? (
              <p className="state-message state-message--error" role="alert">
                {error}
              </p>
            ) : null}
            {!loading && !error && incidents.length === 0 ? (
              <p className="state-message" role="status">
                현재 필터 조건에 맞는 3D 위험 구역이 없습니다.
              </p>
            ) : null}

            {!loading && !error && incidents.length > 0 ? (
              <>
                <XRayBox
                  className="risk-3d-xray-scene"
                  enabled={xray}
                  label={viewMode === "2d" ? "widget/OpenLayersIncidentMap" : "widget/RiskZoneScene"}
                  packageName="apps/web"
                  stacks={viewMode === "2d" ? ["OpenLayers", "OpenStreetMap"] : ["React Three Fiber", "Three.js", "OpenStreetMap"]}
                >
                  {viewMode === "2d" ? (
                    <OpenLayersIncidentMap
                      incidents={incidents}
                      onSelectIncident={selectIncident}
                      selectedIncidentId={selectedIncidentId}
                    />
                  ) : selectedIncident ? (
                    <RiskZoneScene
                      incidents={[selectedIncident]}
                      onSelectIncident={selectIncident}
                      selectedIncidentId={selectedIncidentId}
                    />
                  ) : null}
                </XRayBox>

                <ul aria-label="위험 단계 색상" className="risk-3d-legend">
                  {riskLevels.map((level) => (
                    <li key={level}>
                      <span
                        aria-hidden="true"
                        className="risk-level-swatch"
                        style={{ backgroundColor: incidentRiskLevelColors[level] }}
                      />
                      {incidentRiskLevelLabels[level]}
                    </li>
                  ))}
                  {viewMode === "3d" ? (
                    <li>
                      <span aria-hidden="true" className="risk-impact-legend" />
                      링 크기: 영향 인원
                    </li>
                  ) : null}
                </ul>
                {viewMode === "3d" ? (
                  <p className="risk-3d-scale-note">
                    기둥 바닥은 사고 좌표이며, 링은 실제 피해 반경이 아닌 영향 인원 비교 표시입니다.
                  </p>
                ) : null}
              </>
            ) : null}
          </section>

          <div className="risk-3d-detail-layout">
            <XRayBox
              enabled={xray}
              label="feature/risk-3d/SelectRiskZone"
              packageName="apps/web"
              stacks={["R3F pointer events", "Redux Toolkit", "Accessibility"]}
            >
              <section aria-labelledby="risk-zone-list-title" className="panel risk-zone-list-panel">
                <div className="panel-title-row">
                  <h2 id="risk-zone-list-title">위험 구역 선택</h2>
                  <Badge tone="neutral">키보드 선택 지원</Badge>
                </div>
                <div aria-label="3D 위험 구역 사고 목록" className="risk-zone-button-list">
                  {incidents.map((incident) => (
                    <RiskZoneButton
                      incident={incident}
                      key={incident.id}
                      onSelect={selectIncident}
                      selected={incident.id === selectedIncidentId}
                    />
                  ))}
                </div>
              </section>
            </XRayBox>

            <XRayBox
              enabled={xray}
              label="entity/incident/SelectedRiskZone"
              packageName="packages/api-types"
              stacks={["Incident", "IncidentRisk"]}
            >
              <aside aria-labelledby="selected-risk-zone-title" className="panel risk-zone-detail-panel">
                <h2 id="selected-risk-zone-title">선택 위험 구역</h2>
                {selectedIncident ? (
                  <SelectedRiskZone incident={selectedIncident} />
                ) : (
                  <p className="state-message" role="status">
                    3D 기둥이나 사고 버튼을 선택하면 위험 구역 상세가 표시됩니다.
                  </p>
                )}
              </aside>
            </XRayBox>
          </div>
        </section>
      </XRayBox>
    </main>
  );
}

function RiskMetric({
  title,
  tone = "neutral",
  value,
}: {
  title: string;
  tone?: "neutral" | "info" | "warning" | "danger";
  value: number | string;
}) {
  return (
    <article className={`metric metric--${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

function RiskZoneButton({
  incident,
  onSelect,
  selected,
}: {
  incident: Incident;
  onSelect: (incidentId: string) => void;
  selected: boolean;
}) {
  const risk = calculateIncidentRisk(incident);

  return (
    <button
      aria-pressed={selected}
      className={`risk-zone-button${selected ? " risk-zone-button--selected" : ""}`}
      onClick={() => onSelect(incident.id)}
      type="button"
    >
      <span className="risk-zone-button-title">
        <span
          aria-hidden="true"
          className="risk-level-swatch"
          style={{ backgroundColor: incidentRiskLevelColors[risk.level] }}
        />
        <strong>{incident.title}</strong>
      </span>
      <span>
        {incident.id} · {getRegionName(incident.regionId)} · 위험 {risk.score}
      </span>
    </button>
  );
}

function SelectedRiskZone({ incident }: { incident: Incident }) {
  const risk = calculateIncidentRisk(incident);

  return (
    <div className="risk-zone-detail-content">
      <div className="incident-card-title-row">
        <strong>{incident.title}</strong>
        <SeverityBadge severity={incident.severity} />
      </div>
      <dl className="detail-grid map-detail-grid">
        <DetailItem label="사고 ID" value={incident.id} />
        <DetailItem label="지역" value={getRegionName(incident.regionId)} />
        <DetailItem label="위험도" value={`${incidentRiskLevelLabels[risk.level]} ${risk.score}`} />
        <DetailItem label="상태" value={incidentStatusLabels[incident.status]} />
        <DetailItem label="영향 인원" value={`${incident.affectedPeople}명`} />
        <DetailItem
          label="좌표"
          value={`${incident.location.latitude.toFixed(4)}, ${incident.location.longitude.toFixed(4)}`}
        />
      </dl>
      <div className="detail-badges">
        <Badge tone={getRiskTone(risk.level)}>위험 {risk.score}</Badge>
        <Badge tone={getStatusTone(incident.status)}>{incidentStatusLabels[incident.status]}</Badge>
        <Link className="nav-link nav-link--strong" href={`/incidents/${incident.id}`}>
          상세 보기
        </Link>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function getRiskStats(incidents: Incident[]) {
  const risks = incidents.map(calculateIncidentRisk);

  return {
    peak: risks.reduce((highest, risk) => Math.max(highest, risk.score), 0),
    severe: risks.filter((risk) => risk.level === "severe").length,
  };
}

function getHighestRiskIncidentId(incidents: Incident[]) {
  return incidents.reduce((highest, incident) =>
    calculateIncidentRisk(incident).score > calculateIncidentRisk(highest).score
      ? incident
      : highest,
  ).id;
}

function getErrorMessage(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "3D 위험 구역 데이터를 불러오지 못했습니다.";
}
