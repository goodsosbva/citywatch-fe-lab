"use client";

import type { Incident } from "@citywatch/api-types";
import { Badge, XRayBox } from "@citywatch/ui";
import { useEffect, useMemo, useState } from "react";
import { useXRay } from "../xray-selector";
import { fetchPerformanceIncidents } from "../incidents/incident-api";
import { RiskZoneScene } from "../risk-3d/risk-zone-scene";
import { ClusteredPerformanceMap } from "./clustered-performance-map";
import {
  performanceScenarioSizes,
  type PerformanceScenarioSize,
} from "./performance-fixture";
import { VirtualIncidentList } from "./virtual-incident-list";

type PerformanceViewMode = "2d" | "3d";

export default function PerformancePage() {
  const { enabled: xray, mode } = useXRay();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [scenarioSize, setScenarioSize] = useState<PerformanceScenarioSize>(10000);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>();
  const [viewMode, setViewMode] = useState<PerformanceViewMode>("2d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const selectedIncident = useMemo(
    () => incidents.find((incident) => incident.id === selectedIncidentId),
    [incidents, selectedIncidentId],
  );

  useEffect(() => {
    let active = true;

    async function loadPerformanceIncidents() {
      setLoading(true);

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
            enabled={xray || mode === "performance"}
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
                enabled={xray || (mode === "performance" && viewMode === "2d")}
                label={viewMode === "2d" ? "widget/ClusteredPerformanceMap" : "widget/RiskZoneScene"}
                packageName="apps/web"
                proofs={viewMode === "2d" ? ["fsd-style", "performance"] : ["fsd-style"]}
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
                  enabled={xray || mode === "performance"}
                  label="feature/performance/VirtualIncidentList"
                  packageName="apps/web"
                  proofs={["fsd-style", "performance"]}
                  stacks={["React", "Windowed rendering", "Accessibility"]}
                >
                  <section className="panel">
                    <VirtualIncidentList
                      incidents={incidents}
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

          {mode === "performance" ? (
            <XRayBox
              enabled
              label="feature/performance/LargeDataPipeline"
              packageName="apps/web"
              proofs={["performance"]}
              stacks={["OpenLayers Cluster", "Virtual Rendering", "REST API"]}
            >
              <PerformanceEvidencePanel
                error={error}
                incidentCount={incidents.length}
                loading={loading}
                scenarioSize={scenarioSize}
                viewMode={viewMode}
              />
            </XRayBox>
          ) : null}
        </section>
      </XRayBox>
    </main>
  );
}

function PerformanceEvidencePanel({
  error,
  incidentCount,
  loading,
  scenarioSize,
  viewMode,
}: {
  error?: string;
  incidentCount: number;
  loading: boolean;
  scenarioSize: PerformanceScenarioSize;
  viewMode: PerformanceViewMode;
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
        데이터 전체는 메모리에 유지하되, 지도는 가까운 점을 묶고 목록은 화면 주변 행만 DOM으로 만듭니다.
        현재 보기는 <strong>{viewMode === "2d" ? "2D 클러스터" : "3D 단일 사고"}</strong>입니다.
      </p>

      <ol className="technology-flow">
        <li><code>GET /api/incidents/many-data?size={scenarioSize}</code><span>검증된 크기의 사고 배열을 받습니다.</span></li>
        <li><code>Incident[] → VectorSource → Cluster(38)</code><span>가까운 지도 점을 하나의 숫자 마커로 묶습니다.</span></li>
        <li><code>scrollTop → getVisibleRange() → slice()</code><span>보이는 범위와 여유분만 React 요소로 만듭니다.</span></li>
        <li><code>row 76px · viewport 456px · overscan 6</code><span>1만 건이어도 목록 DOM은 현재 화면 주변만 유지합니다.</span></li>
      </ol>

      <dl className="technology-code">
        <div><dt>전체 데이터</dt><dd><code>{incidentCount.toLocaleString("ko-KR")} Incident objects</code></dd></div>
        <div><dt>지도 비용 절감</dt><dd><code>new Cluster(&#123; distance: 38, source &#125;)</code></dd></div>
        <div><dt>목록 비용 절감</dt><dd><code>incidents.slice(start, end)</code></dd></div>
        <div><dt>3D 비용 제한</dt><dd><code>RiskZoneScene incident=&#123;selectedIncident&#125;</code></dd></div>
      </dl>
    </aside>
  );
}

function getErrorMessage(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "성능 시나리오 데이터를 불러오지 못했습니다.";
}
