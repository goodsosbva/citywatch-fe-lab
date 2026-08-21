"use client";

import type { Incident } from "@citywatch/api-types";
import { Badge, XRayBox } from "@citywatch/ui";
import { useEffect, useMemo, useState } from "react";
import { useXRay } from "../xray-selector";
import { fetchPerformanceIncidents } from "../incidents/incident-api";
import { RiskZoneScene } from "../risk-3d/risk-zone-scene";
import { ClusteredPerformanceMap, type ClusterStats } from "./clustered-performance-map";
import {
  performanceScenarioSizes,
  type PerformanceScenarioSize,
} from "./performance-fixture";
import { VirtualIncidentList, type VirtualRange } from "./virtual-incident-list";

type PerformanceViewMode = "2d" | "3d";

export default function PerformancePage() {
  const { enabled: xray, mode } = useXRay();
  const performanceXray = mode === "performance";
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [clusterStats, setClusterStats] = useState<ClusterStats>();
  const [scenarioSize, setScenarioSize] = useState<PerformanceScenarioSize>(10000);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>();
  const [viewMode, setViewMode] = useState<PerformanceViewMode>("2d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [virtualRange, setVirtualRange] = useState<VirtualRange>();
  const selectedIncident = useMemo(
    () => incidents.find((incident) => incident.id === selectedIncidentId),
    [incidents, selectedIncidentId],
  );

  useEffect(() => {
    let active = true;

    async function loadPerformanceIncidents() {
      setLoading(true);
      setClusterStats(undefined);
      setVirtualRange(undefined);

      try {
        const nextIncidents = await fetchPerformanceIncidents(scenarioSize);
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

    void loadPerformanceIncidents();

    return () => {
      active = false;
    };
  }, [scenarioSize]);

  useEffect(() => {
    setSelectedIncidentId((current) =>
      incidents.some((incident) => incident.id === current)
        ? current
        : incidents[0]?.id,
    );
  }, [incidents]);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Performance Control</p>
          <h1>대량 사고 관제</h1>
        </div>
      </header>

      <XRayBox
        enabled={xray}
        label="app/performance/PerformancePage"
        layer="app"
        packageName="apps/web"
        stacks={["Next App Router", "React", "TypeScript"]}
      >
        <section aria-busy={loading} aria-label="대량 사고 성능 관제" className="dashboard">
          <XRayBox
            enabled={xray}
            label="widget/PerformanceScenarioSummary"
            packageName="apps/web"
            proofs={["fsd-style", "performance"]}
            stacks={["REST API", "Server fixture", "JSON response"]}
          >
            <div className="panel performance-summary">
              <div>
                <h2>성능 시나리오</h2>
                <p>
                  서버가 생성해 반환한 성능 테스트 데이터입니다. 실제 API 저장소와 Redux 선택 상태는 변경하지 않습니다.
                </p>
              </div>
              <label className="form-field performance-size-control" htmlFor="performance-size">
                <span>사고 수</span>
                <select
                  className="select-input"
                  id="performance-size"
                  onChange={(event) =>
                    setScenarioSize(Number(event.target.value) as PerformanceScenarioSize)
                  }
                  value={scenarioSize}
                >
                  {performanceScenarioSizes.map((size) => (
                    <option key={size} value={size}>
                      {size.toLocaleString("ko-KR")}건
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </XRayBox>

          {loading ? (
            <p className="state-message" role="status">
              REST API에서 {scenarioSize.toLocaleString("ko-KR")}건 성능 시나리오를 불러오는 중입니다.
            </p>
          ) : null}
          {error ? (
            <p className="state-message state-message--error" role="alert">
              {error}
            </p>
          ) : null}

          {!loading && !error && incidents.length > 0 ? (
            <>
              <XRayBox
                enabled={xray || performanceXray}
                label={performanceXray
                  ? viewMode === "2d"
                    ? "performance/2d/OpenLayersCluster"
                    : "performance/3d/SingleIncidentScene"
                  : viewMode === "2d"
                    ? "widget/ClusteredPerformanceMap"
                    : "widget/RiskZoneScene"}
                packageName={performanceXray ? (viewMode === "2d" ? "ol" : "@react-three/fiber") : "apps/web"}
                proofs={performanceXray ? ["performance"] : ["fsd-style"]}
                stacks={viewMode === "2d" ? ["OpenLayers", "VectorSource", "Cluster"] : ["React Three Fiber", "Three.js", "OpenStreetMap"]}
              >
                <section className="panel performance-map-panel" aria-labelledby="performance-map-title">
                  <div className="panel-title-row">
                    <div>
                      <h2 id="performance-map-title">
                        {viewMode === "2d" ? "2D 클러스터 지도" : "3D 선택 사고 상세"}
                      </h2>
                      <Badge tone="info">
                        {viewMode === "2d"
                          ? `Source ${incidents.length.toLocaleString("ko-KR")}`
                          : selectedIncident?.id ?? "선택 없음"}
                      </Badge>
                    </div>
                    <div className="performance-visual-actions">
                      <div aria-label="성능 시나리오 지도 모드" className="performance-view-mode" role="group">
                        <button
                          aria-pressed={viewMode === "2d"}
                          onClick={() => setViewMode("2d")}
                          type="button"
                        >
                          2D 전체 분포
                        </button>
                        <button
                          aria-pressed={viewMode === "3d"}
                          disabled={!selectedIncident}
                          onClick={() => setViewMode("3d")}
                          type="button"
                        >
                          3D 선택 사고
                        </button>
                      </div>
                      <span className="performance-hint">
                        {viewMode === "2d"
                          ? "숫자 마커를 누르면 해당 범위로 확대합니다."
                          : "전체 분포는 2D에서 고른 뒤, 한 사고의 위치와 위험도를 3D로 확인합니다."}
                      </span>
                    </div>
                  </div>
                  {viewMode === "2d" ? (
                    <ClusteredPerformanceMap
                      incidents={incidents}
                      onClusterStatsChange={setClusterStats}
                      onSelectIncident={setSelectedIncidentId}
                    />
                  ) : selectedIncident ? (
                    <RiskZoneScene incident={selectedIncident} />
                  ) : null}
                  {viewMode === "3d" ? (
                    <p className="performance-3d-note">
                      기둥 바닥은 선택한 사고의 좌표이고, 높이와 색상은 위험 점수, 바깥 링은 영향 인원 비교 표시입니다.
                    </p>
                  ) : null}
                </section>
              </XRayBox>

              <div className="performance-lower-layout">
                <XRayBox
                  enabled={xray || performanceXray}
                  label={performanceXray ? "performance/virtual-list/RenderedRows" : "feature/performance/VirtualIncidentList"}
                  packageName="apps/web"
                  proofs={performanceXray ? ["performance"] : ["fsd-style"]}
                  stacks={["React", "Windowed rendering", "Accessibility"]}
                >
                  <section className="panel">
                    <VirtualIncidentList
                      incidents={incidents}
                      onVisibleRangeChange={setVirtualRange}
                      onSelectIncident={setSelectedIncidentId}
                      selectedIncidentId={selectedIncidentId}
                    />
                  </section>
                </XRayBox>

                <XRayBox
                  enabled={xray}
                  label="entity/incident/PerformanceScenarioSelection"
                  packageName="apps/web"
                  stacks={["Incident", "Local selection"]}
                >
                  <aside className="panel performance-selection" aria-labelledby="performance-selection-title">
                    <h2 id="performance-selection-title">선택 시나리오</h2>
                    {selectedIncident ? (
                      <>
                        <strong>{selectedIncident.title}</strong>
                        <span>{selectedIncident.id}</span>
                        <span>
                          좌표 {selectedIncident.location.latitude.toFixed(4)}, {selectedIncident.location.longitude.toFixed(4)}
                        </span>
                      </>
                    ) : (
                      <p className="state-message" role="status">
                        지도 또는 목록에서 사고를 선택합니다.
                      </p>
                    )}
                  </aside>
                </XRayBox>
              </div>
            </>
          ) : null}

          {performanceXray ? (
            <PerformanceEvidencePanel
              clusterStats={clusterStats}
              error={error}
              incidentCount={incidents.length}
              loading={loading}
              scenarioSize={scenarioSize}
              viewMode={viewMode}
              virtualRange={virtualRange}
            />
          ) : null}
        </section>
      </XRayBox>
    </main>
  );
}

function PerformanceEvidencePanel({
  clusterStats,
  error,
  incidentCount,
  loading,
  scenarioSize,
  viewMode,
  virtualRange,
}: {
  clusterStats?: ClusterStats;
  error?: string;
  incidentCount: number;
  loading: boolean;
  scenarioSize: PerformanceScenarioSize;
  viewMode: PerformanceViewMode;
  virtualRange?: VirtualRange;
}) {
  return (
    <aside aria-labelledby="performance-evidence-title" className="panel technology-evidence">
      <div className="panel-title-row">
        <h2 id="performance-evidence-title">Large Data Performance 증거</h2>
        <Badge tone={error ? "danger" : loading ? "info" : "success"}>
          {error
            ? "load error"
            : loading
              ? `${scenarioSize.toLocaleString("ko-KR")} loading`
              : `${incidentCount.toLocaleString("ko-KR")} loaded`}
        </Badge>
      </div>

      <p>
        설정값이나 추정 시간이 아니라 현재 컴포넌트가 계산한 개수만 표시합니다.
        현재 보기는 <strong>{viewMode === "2d" ? "2D 클러스터" : "3D 단일 사고"}</strong>입니다.
      </p>

      <ol className="technology-flow">
        <li><code>GET /api/incidents/many-data?size={scenarioSize}</code><span>검증된 크기의 사고 배열을 받습니다.</span></li>
        <li><code>Incident[] → VectorSource → Cluster(38)</code><span>원본 점을 유지한 채 현재 해상도에서 가까운 점만 묶습니다.</span></li>
        <li><code>scrollTop → getVisibleRange() → slice()</code><span>계산된 시작·끝 범위의 행만 DOM으로 만듭니다.</span></li>
        <li><code>2D 전체 → 3D 선택 1건</code><span>전체 분포와 단일 사고 상세의 렌더링 경계를 분리합니다.</span></li>
      </ol>

      <dl className="technology-code">
        <div><dt>원본 데이터</dt><dd><code>{incidentCount.toLocaleString("ko-KR")} Incident objects</code></dd></div>
        <div><dt>2D 원본 marker</dt><dd><code>{clusterStats?.sourceMarkerCount.toLocaleString("ko-KR") ?? "계산 중"} source features</code></dd></div>
        <div><dt>2D 현재 marker</dt><dd><code>{clusterStats ? `${clusterStats.renderedMarkerCount.toLocaleString("ko-KR")} total = ${clusterStats.clusterMarkerCount.toLocaleString("ko-KR")} clusters + ${clusterStats.singleMarkerCount.toLocaleString("ko-KR")} singles` : "계산 중"}</code></dd></div>
        <div><dt>가상화 계산 범위</dt><dd><code>{virtualRange ? `${virtualRange.start + 1}-${virtualRange.end} / ${virtualRange.total.toLocaleString("ko-KR")}` : "계산 중"}</code></dd></div>
        <div><dt>실제 목록 DOM</dt><dd><code>{virtualRange ? `${virtualRange.renderedCount} rows` : "계산 중"}</code></dd></div>
        <div><dt>3D 입력 범위</dt><dd><code>{viewMode === "3d" ? "1 selected Incident" : "not mounted"}</code></dd></div>
      </dl>
    </aside>
  );
}

function getErrorMessage(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "성능 시나리오 데이터를 불러오지 못했습니다.";
}
