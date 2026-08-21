"use client";

import { calculateIncidentRisk, type Incident } from "@citywatch/api-types";
import { Badge, SeverityBadge, XRayBox } from "@citywatch/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchIncidents } from "@/entities/incident";
import {
  formatIncidentDate,
  getRegionName,
  getRiskTone,
  getStatusTone,
  incidentRiskLevelLabels,
  incidentStatusLabels,
} from "@/entities/incident";
import {
  selectActiveIncidentFilterCount,
  selectIncidentFilters,
  selectIncidentListQuery,
  selectSelectedIncidentId,
  setSelectedIncidentId,
} from "@/features/incident-control";
import { useAppDispatch, useAppSelector } from "../store-hooks";
import { useXRay } from "../xray-selector";
import { OpenLayersIncidentMap } from "./openlayers-incident-map";

export default function MapPage() {
  const dispatch = useAppDispatch();
  const { enabled: xray, mode } = useXRay();
  const openLayersXray = mode === "openlayers";
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const activeFilterCount = useAppSelector(selectActiveIncidentFilterCount);
  const filters = useAppSelector(selectIncidentFilters);
  const query = useAppSelector(selectIncidentListQuery);
  const selectedIncidentId = useAppSelector(selectSelectedIncidentId);
  const selectedIncident = useMemo(
    () => incidents.find((incident) => incident.id === selectedIncidentId),
    [incidents, selectedIncidentId],
  );
  const stats = useMemo(() => getMapStats(incidents), [incidents]);

  useEffect(() => {
    let active = true;

    async function loadIncidents() {
      setLoading(true);

      try {
        const nextIncidents = await fetchIncidents(query);
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
  }, [query]);

  function selectIncident(incidentId: string) {
    dispatch(setSelectedIncidentId(incidentId));
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Map Control</p>
          <h1>지도 사고 관제</h1>
        </div>
      </header>

      <XRayBox
        enabled={xray}
        label="app/map/MapPage"
        layer="app"
        packageName="apps/web"
        stacks={["Next App Router", "React", "TypeScript"]}
      >
        <section aria-label="지도 사고 관제" className="dashboard">
          <XRayBox
            enabled={xray}
            label="widget/MapControlSummary"
            packageName="apps/web"
            stacks={["React", "Shared Types"]}
          >
            <div className="panel metric-grid">
              <MapMetric title="지도 사고" value={incidents.length} />
              <MapMetric
                title="대응 필요"
                value={stats.active}
                tone="warning"
              />
              <MapMetric title="심각 위험" value={stats.severe} tone="danger" />
              <MapMetric
                title="영향 인원"
                value={stats.affectedPeople}
                tone="info"
              />
            </div>
          </XRayBox>

          <div className="map-layout">
            <XRayBox
              enabled={xray || openLayersXray}
              label={openLayersXray ? "react/map/IncidentMapBoard" : "widget/IncidentMapBoard"}
              layer={openLayersXray ? "app" : "widget"}
              packageName="apps/web"
              proofs={["fsd-style", "openlayers"]}
              stacks={["OpenLayers", "OpenStreetMap", "CSS"]}
            >
              <section
                aria-busy={loading}
                aria-labelledby="map-title"
                className="panel map-board"
              >
                <div className="panel-title-row">
                  <div>
                    <h2 id="map-title">사고 위치 지도</h2>
                    <Badge
                      tone={error ? "danger" : loading ? "info" : "success"}
                    >
                      {error ? "REST error" : loading ? "loading" : "REST API"}
                    </Badge>
                  </div>
                  <Badge tone="info">Redux 필터 {activeFilterCount}</Badge>
                </div>

                <p className="redux-proof" aria-live="polite">
                  <span>검색 {filters.search.trim() || "전체"}</span>
                  <span>심각도 {filters.severity}</span>
                  <span>상태 {filters.status}</span>
                  <span>지역 {filters.regionId}</span>
                </p>

                <XRayBox
                  enabled={xray}
                  label="feature/incident/FetchIncidentMapIncidents"
                  packageName="apps/web"
                  stacks={["fetch", "REST API", "Redux Query"]}
                >
                  {loading ? (
                    <p className="state-message" role="status">
                      REST API에서 지도 사고 데이터를 불러오는 중입니다.
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
                  {!loading && !error && incidents.length === 0 ? (
                    <p className="state-message" role="status">
                      현재 필터 조건에 맞는 지도 사고가 없습니다.
                    </p>
                  ) : null}
                </XRayBox>

                <XRayBox
                  enabled={xray || openLayersXray}
                  label={openLayersXray ? "openlayers/map/MapCanvas" : "feature/map/RenderIncidentMarkers"}
                  layer={openLayersXray ? "shared" : "feature"}
                  packageName={openLayersXray ? "ol" : "apps/web"}
                  proofs={["fsd-style", "openlayers"]}
                  stacks={["OpenLayers", "OpenStreetMap Tile", "Canvas"]}
                >
                  <OpenLayersIncidentMap
                    incidents={incidents}
                    onSelectIncident={selectIncident}
                    selectedIncidentId={selectedIncidentId}
                  />
                </XRayBox>
              </section>
            </XRayBox>

            <XRayBox
              enabled={xray}
              label="entity/incident/IncidentMapSelection"
              packageName="apps/web"
              stacks={["TypeScript", "Redux Selected State"]}
            >
              <aside
                aria-labelledby="map-selection-title"
                className="panel map-side-panel"
              >
                <div className="panel-title-row">
                  <h2 id="map-selection-title">선택 사고</h2>
                  <Badge tone={selectedIncident ? "info" : "neutral"}>
                    {selectedIncidentId ?? "선택 없음"}
                  </Badge>
                </div>

                {selectedIncident ? (
                  <SelectedIncidentCard incident={selectedIncident} />
                ) : (
                  <p className="state-message" role="status">
                    지도 마커나 아래 사고 버튼을 선택하면 상세 요약이
                    표시됩니다.
                  </p>
                )}

                <div
                  className="map-incident-list"
                  aria-label="지도 사고 선택 목록"
                >
                  {incidents.map((incident) => (
                    <button
                      className={`map-incident-button${incident.id === selectedIncidentId ? " map-incident-button--selected" : ""}`}
                      key={incident.id}
                      onClick={() => selectIncident(incident.id)}
                      type="button"
                    >
                      <span>{incident.id}</span>
                      <strong>{incident.title}</strong>
                    </button>
                  ))}
                </div>
              </aside>
            </XRayBox>
          </div>

          {mode === "openlayers" ? (
            <OpenLayersEvidencePanel
              incidentCount={incidents.length}
              selectedIncidentId={selectedIncidentId}
            />
          ) : null}
        </section>
      </XRayBox>
    </main>
  );
}

function OpenLayersEvidencePanel({
  incidentCount,
  selectedIncidentId,
}: {
  incidentCount: number;
  selectedIncidentId?: string;
}) {
  return (
    <aside
      aria-labelledby="openlayers-evidence-title"
      className="panel technology-evidence"
    >
      <div className="panel-title-row">
        <h2 id="openlayers-evidence-title">OpenLayers 증거</h2>
        <Badge tone="success">실제 지도 렌더링</Badge>
      </div>

      <p>
        React가 REST 사고 배열과 Redux 선택 상태를 전달하면 OpenLayers가 DOM target 안에 Canvas 지도와 벡터 마커를 직접 생성합니다.
      </p>

      <div className="openlayers-boundaries" aria-label="React에서 OpenLayers Canvas까지 렌더링 경계">
        <div className="openlayers-boundary openlayers-boundary--react">
          <span>React 입력</span>
          <strong>apps/web</strong>
          <code>incidents: {incidentCount}건</code>
          <code>selected: {selectedIncidentId ?? "없음"}</code>
        </div>
        <span aria-hidden="true" className="openlayers-arrow">props →</span>
        <div className="openlayers-boundary openlayers-boundary--engine">
          <span>OpenLayers 객체</span>
          <strong>ol</strong>
          <code>Feature → VectorSource → VectorLayer</code>
          <code>TileLayer + VectorLayer → Map</code>
        </div>
        <span aria-hidden="true" className="openlayers-arrow">render →</span>
        <div className="openlayers-boundary openlayers-boundary--canvas">
          <span>브라우저 출력</span>
          <strong>Canvas 지도</strong>
          <code>OSM tile + vector marker</code>
          <code>singleclick event</code>
        </div>
      </div>

      <ul className="technology-flow">
        <li>
          <code>fetchIncidents(query)</code>
          <span>returns</span>
          <code>Incident[] ({incidentCount})</code>
        </li>
        <li>
          <code>Incident.location</code>
          <span>fromLonLat →</span>
          <code>Feature&lt;Point&gt;</code>
        </li>
        <li>
          <code>Feature[]</code>
          <span>addFeatures →</span>
          <code>VectorSource → VectorLayer</code>
        </li>
        <li>
          <code>OSM TileLayer + VectorLayer</code>
          <span>Map target →</span>
          <code>Canvas</code>
        </li>
        <li>
          <code>singleclick → incidentId</code>
          <span>dispatch →</span>
          <code>Redux selectedIncidentId</code>
        </li>
        <li>
          <code>selectedIncidentId</code>
          <span>source.changed →</span>
          <code>선택 marker style 갱신</code>
        </li>
      </ul>

      <dl className="technology-code">
        <div>
          <dt>좌표 투영과 Feature 생성</dt>
          <dd>
            <code>new Point(fromLonLat([longitude, latitude]))</code>
          </dd>
        </div>
        <div>
          <dt>벡터 데이터 연결</dt>
          <dd>
            <code>source.addFeatures(features)</code>
          </dd>
        </div>
        <div>
          <dt>타일·벡터 합성</dt>
          <dd>
            <code>new Map(&#123; layers: [TileLayer, markerLayer], target &#125;)</code>
          </dd>
        </div>
        <div>
          <dt>지도 클릭 선택</dt>
          <dd>
            <code>map.on(&quot;singleclick&quot;, handler)</code>
          </dd>
        </div>
        <div>
          <dt>React 종료 정리</dt>
          <dd>
            <code>unByKey(clickKey); map.setTarget(undefined)</code>
          </dd>
        </div>
      </dl>
    </aside>
  );
}

function MapMetric({
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

function SelectedIncidentCard({ incident }: { incident: Incident }) {
  const risk = calculateIncidentRisk(incident);

  return (
    <article className="map-selected-card">
      <div className="incident-card-title-row">
        <Link
          className="incident-title-link"
          href={`/incidents/${incident.id}`}
        >
          {incident.title}
        </Link>
        <SeverityBadge severity={incident.severity} />
      </div>
      <p>{incident.description}</p>
      <dl className="detail-grid map-detail-grid">
        <MapDetailItem
          label="상태"
          value={incidentStatusLabels[incident.status]}
        />
        <MapDetailItem
          label="위험도"
          value={`${incidentRiskLevelLabels[risk.level]} ${risk.score}`}
        />
        <MapDetailItem label="지역" value={getRegionName(incident.regionId)} />
        <MapDetailItem
          label="접수"
          value={formatIncidentDate(incident.reportedAt)}
        />
      </dl>
      <div className="detail-badges">
        <Badge tone={getStatusTone(incident.status)}>
          {incidentStatusLabels[incident.status]}
        </Badge>
        <Badge tone={getRiskTone(risk.level)}>위험도 {risk.score}</Badge>
        <Link
          className="nav-link nav-link--strong"
          href={`/incidents/${incident.id}`}
        >
          상세 보기
        </Link>
      </div>
    </article>
  );
}

function MapDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function getMapStats(incidents: Incident[]) {
  return {
    active: incidents.filter(
      (incident) =>
        incident.status === "dispatching" || incident.status === "in_progress",
    ).length,
    affectedPeople: incidents.reduce(
      (sum, incident) => sum + incident.affectedPeople,
      0,
    ),
    severe: incidents.filter(
      (incident) => calculateIncidentRisk(incident).level === "severe",
    ).length,
  };
}

function getErrorMessage(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "지도 사고 데이터를 불러오지 못했습니다.";
}
