"use client";

import {
  calculateIncidentRisk,
  incidentSeverities,
  incidentStatuses,
  type Incident,
  type IncidentListQuery,
} from "@citywatch/api-types";
import { Badge, SeverityBadge, XRayBox } from "@citywatch/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store-hooks";
import { useXRay } from "../xray-selector";
import {
  resetIncidentFilters,
  selectActiveIncidentFilterCount,
  selectIncidentFilters,
  selectIncidentListQuery,
  selectSelectedIncidentId,
  setRegionFilter,
  setSearchFilter,
  setSelectedIncidentId,
  setSeverityFilter,
  setStatusFilter,
  type IncidentFilters,
} from "./incident-control-slice";
import { fetchIncidents, getIncidentListUrl } from "./incident-api";
import {
  formatIncidentDate,
  getRegionName,
  getRiskTone,
  incidentCategoryLabels,
  incidentRiskLevelLabels,
  incidentSeverityLabels,
  incidentStatusLabels,
} from "./incident-format";

const regionFilterOptions = ["seocho", "seongsu", "junggu"] as const;

export default function IncidentsPage() {
  const dispatch = useAppDispatch();
  const { enabled: xray, mode } = useXRay();
  const restApiXray = mode === "rest-api";
  const reduxXray = mode === "redux";
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [requestUrl, setRequestUrl] = useState(getIncidentListUrl());
  const filters = useAppSelector(selectIncidentFilters);
  const query = useAppSelector(selectIncidentListQuery);
  const activeFilterCount = useAppSelector(selectActiveIncidentFilterCount);
  const selectedIncidentId = useAppSelector(selectSelectedIncidentId);
  const selectedIncident = useMemo(
    () => incidents.find((incident) => incident.id === selectedIncidentId),
    [incidents, selectedIncidentId],
  );
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
      setLoading(true);
      setRequestUrl(getIncidentListUrl(query));

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

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Incident Control</p>
          <h1>사고 목록 관제</h1>
        </div>
      </header>

      <XRayBox
        enabled={xray || restApiXray}
        label={
          restApiXray ? "rest/IncidentsClient" : "app/incidents/IncidentsPage"
        }
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
              <SummaryMetric title="조회 결과" value={incidents.length} />
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

          <IncidentFilterPanel
            activeFilterCount={activeFilterCount}
            filters={filters}
            onRegionChange={(value) => dispatch(setRegionFilter(value))}
            onReset={() => dispatch(resetIncidentFilters())}
            onSearchChange={(value) => dispatch(setSearchFilter(value))}
            onSeverityChange={(value) => dispatch(setSeverityFilter(value))}
            onStatusChange={(value) => dispatch(setStatusFilter(value))}
            reduxXray={reduxXray}
            selectedIncidentId={selectedIncidentId}
            selectedIncidentTitle={selectedIncident?.title}
            restApiXray={restApiXray}
            xray={xray}
          />

          <XRayBox
            enabled={xray}
            label="widget/IncidentList"
            packageName="apps/web"
            proofs={["fsd-style", "rest-api"]}
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
                proofs={["fsd-style", "rest-api"]}
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
                {!loading && !error && incidents.length === 0 ? (
                  <p className="state-message" role="status">
                    현재 필터 조건에 맞는 사고가 없습니다.
                  </p>
                ) : null}
                {!loading && !error && incidents.length > 0 ? (
                  <XRayBox
                    enabled={xray}
                    label="entity/incident/IncidentListItems"
                    packageName="apps/web"
                    proofs={["fsd-style", "rest-api"]}
                    stacks={["TypeScript", "Shared Contract", "@citywatch/ui"]}
                  >
                    <ul className="incident-list">
                      {incidents.map((incident) => (
                        <IncidentListItem
                          incident={incident}
                          key={incident.id}
                          onSelect={() =>
                            dispatch(setSelectedIncidentId(incident.id))
                          }
                          selected={incident.id === selectedIncidentId}
                        />
                      ))}
                    </ul>
                  </XRayBox>
                ) : null}
              </XRayBox>
            </section>
          </XRayBox>

          {restApiXray ? (
            <RestApiEvidencePanel
              error={error}
              incidentCount={incidents.length}
              loading={loading}
              query={query}
              requestUrl={requestUrl}
            />
          ) : null}

          {mode === "redux" ? (
            <XRayBox
              enabled
              label="feature/incident/ReduxFilterPipeline"
              packageName="apps/web"
              proofs={[mode]}
              stacks={["Redux Toolkit", "React Redux", "Memoized Selector"]}
            >
              <ReduxEvidencePanel
                activeFilterCount={activeFilterCount}
                error={error}
                filters={filters}
                incidentCount={incidents.length}
                loading={loading}
                selectedIncidentId={selectedIncidentId}
              />
            </XRayBox>
          ) : null}
        </section>
      </XRayBox>
    </main>
  );
}

function IncidentFilterPanel({
  activeFilterCount,
  filters,
  onRegionChange,
  onReset,
  onSearchChange,
  onSeverityChange,
  onStatusChange,
  restApiXray,
  reduxXray,
  selectedIncidentId,
  selectedIncidentTitle,
  xray,
}: {
  activeFilterCount: number;
  filters: IncidentFilters;
  onRegionChange: (value: string) => void;
  onReset: () => void;
  onSearchChange: (value: string) => void;
  onSeverityChange: (value: IncidentFilters["severity"]) => void;
  onStatusChange: (value: IncidentFilters["status"]) => void;
  restApiXray: boolean;
  reduxXray: boolean;
  selectedIncidentId?: string;
  selectedIncidentTitle?: string;
  xray: boolean;
}) {
  const selectedLabel = selectedIncidentId
    ? selectedIncidentTitle
      ? `${selectedIncidentId} ${selectedIncidentTitle}`
      : `${selectedIncidentId} (현재 필터 결과 밖)`
    : "없음";

  return (
    <XRayBox
      enabled={xray || reduxXray}
      label={
        reduxXray
          ? "redux/IncidentControlConsumer"
          : "feature/incident/ShareIncidentFilters"
      }
      packageName="apps/web"
      proofs={reduxXray ? ["redux"] : ["fsd-style", "rest-api"]}
      stacks={
        reduxXray
          ? ["Redux Toolkit", "React Redux", "useAppSelector"]
          : ["Redux Toolkit", "React Redux", "REST Query"]
      }
    >
      <section className="panel" aria-labelledby="incident-filter-title">
        <div className="panel-title-row">
          <h2 id="incident-filter-title">관제 필터</h2>
          <Badge tone="info">
            {restApiXray ? "REST query" : "Redux"} {activeFilterCount}
          </Badge>
        </div>
        <div className="filter-grid">
          <div className="form-field">
            <label htmlFor="incident-search">검색</label>
            <input
              className="text-input"
              id="incident-search"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="사고명, ID, 담당 팀"
              type="search"
              value={filters.search}
            />
          </div>
          <div className="form-field">
            <label htmlFor="incident-severity-filter">심각도</label>
            <select
              className="select-input"
              id="incident-severity-filter"
              onChange={(event) =>
                onSeverityChange(
                  event.target.value as IncidentFilters["severity"],
                )
              }
              value={filters.severity}
            >
              <option value="all">전체 심각도</option>
              {incidentSeverities.map((severity) => (
                <option key={severity} value={severity}>
                  {incidentSeverityLabels[severity]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="incident-status-filter">상태</label>
            <select
              className="select-input"
              id="incident-status-filter"
              onChange={(event) =>
                onStatusChange(event.target.value as IncidentFilters["status"])
              }
              value={filters.status}
            >
              <option value="all">전체 상태</option>
              {incidentStatuses.map((status) => (
                <option key={status} value={status}>
                  {incidentStatusLabels[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="incident-region-filter">지역</label>
            <select
              className="select-input"
              id="incident-region-filter"
              onChange={(event) => onRegionChange(event.target.value)}
              value={filters.regionId}
            >
              <option value="all">전체 지역</option>
              {regionFilterOptions.map((regionId) => (
                <option key={regionId} value={regionId}>
                  {getRegionName(regionId)}
                </option>
              ))}
            </select>
          </div>
          <button
            className="secondary-button"
            disabled={activeFilterCount === 0}
            onClick={onReset}
            type="button"
          >
            초기화
          </button>
        </div>
        <p className="redux-proof" aria-live="polite">
          <span>
            {restApiXray ? "REST 조회 조건" : "Redux 필터"} {activeFilterCount}
            개 적용
          </span>
          <span>선택 사고 {selectedLabel}</span>
        </p>
      </section>
    </XRayBox>
  );
}

function RestApiEvidencePanel({
  error,
  incidentCount,
  loading,
  query,
  requestUrl,
}: {
  error?: string;
  incidentCount: number;
  loading: boolean;
  query: IncidentListQuery;
  requestUrl: string;
}) {
  return (
    <aside
      aria-labelledby="rest-api-evidence-title"
      className="panel technology-evidence"
    >
      <div className="panel-title-row">
        <h2 id="rest-api-evidence-title">REST API 실행 증거</h2>
        <Badge tone={error ? "danger" : loading ? "info" : "success"}>
          {error
            ? "응답 오류"
            : loading
              ? "요청 중"
              : `${incidentCount}건 검증 완료`}
        </Badge>
      </div>

      <p>
        필터 선택으로 조회 조건이 바뀌면 브라우저가 실제 GET 요청을 보내고,
        Route Handler가 검증한 query로 저장소를 조회합니다. 브라우저는 응답
        계약을 다시 검사한 뒤에만 React 목록 상태를 바꿉니다.
      </p>

      <ul className="technology-flow">
        <li>
          <code>filter onChange</code>
          <span>changes</span>
          <code>IncidentListQuery</code>
        </li>
        <li>
          <code>fetchIncidents(query)</code>
          <span>GET</span>
          <code>{requestUrl}</code>
        </li>
        <li>
          <code>route.ts GET</code>
          <span>validates + calls</span>
          <code>listIncidents(query)</code>
        </li>
        <li>
          <code>isIncidentListResponse(data)</code>
          <span>allows</span>
          <code>setIncidents({incidentCount}건)</code>
        </li>
      </ul>

      <dl className="technology-code">
        <div>
          <dt>현재 실제 요청</dt>
          <dd>
            <code>GET {requestUrl}</code>
          </dd>
        </div>
        <div>
          <dt>Route Handler → store</dt>
          <dd>
            <code>GET → listIncidents(query)</code>
          </dd>
        </div>
        <div>
          <dt>현재 요청 상태</dt>
          <dd>
            <code>
              {error
                ? `error: ${error}`
                : loading
                  ? "fetch pending"
                  : `validated response: ${incidentCount} incidents`}
            </code>
          </dd>
        </div>
        <div>
          <dt>공유 계약</dt>
          <dd>
            <code>{JSON.stringify(query)} → IncidentListResponse</code>
          </dd>
        </div>
      </dl>
    </aside>
  );
}

function ReduxEvidencePanel({
  activeFilterCount,
  error,
  filters,
  incidentCount,
  loading,
  selectedIncidentId,
}: {
  activeFilterCount: number;
  error?: string;
  filters: IncidentFilters;
  incidentCount: number;
  loading: boolean;
  selectedIncidentId?: string;
}) {
  return (
    <aside
      aria-labelledby="incident-data-evidence-title"
      className="panel technology-evidence"
    >
      <div className="panel-title-row">
        <h2 id="incident-data-evidence-title">Redux 증거</h2>
        <Badge tone="success">{activeFilterCount}개 필터</Badge>
      </div>

      <p>
        입력 변경이 action, reducer, store, selector 구독을 지나 같은 화면과 다른
        관제 화면을 다시 렌더링합니다.
      </p>

      <ul className="technology-flow">
        <li>
          <code>input / select onChange(value)</code>
          <span>calls</span>
          <code>dispatch(set*Filter(value))</code>
        </li>
        <li>
          <code>incidentControlSlice.actions</code>
          <span>creates</span>
          <code>{`{ type, payload }`}</code>
        </li>
        <li>
          <code>incidentControlReducer</code>
          <span>updates</span>
          <code>store.incidentControl</code>
        </li>
        <li>
          <code>useAppSelector(selector)</code>
          <span>subscribes</span>
          <code>filters / count / selected ID</code>
        </li>
        <li>
          <code>selector result changed</code>
          <span>re-renders</span>
          <code>IncidentsPage → IncidentFilterPanel</code>
        </li>
      </ul>

      <dl className="technology-code">
          <div>
            <dt>Redux 전역 공유 상태 · store.incidentControl</dt>
            <dd>
              <code>
                {JSON.stringify({
                  filters,
                  selectedIncidentId: selectedIncidentId ?? null,
                })}
              </code>
            </dd>
          </div>
          <div>
            <dt>현재 selector 반환값</dt>
            <dd>
              <code>
                {JSON.stringify({
                  activeFilterCount,
                  selectedIncidentId: selectedIncidentId ?? null,
                })}
              </code>
            </dd>
          </div>
          <div>
            <dt>createSlice가 생성한 실제 action type</dt>
            <dd>
              <code>
                incidentControl/setSearchFilter · setSeverityFilter ·
                setStatusFilter · setRegionFilter · resetIncidentFilters ·
                setSelectedIncidentId
              </code>
            </dd>
          </div>
          <div>
            <dt>React 지역 상태 · Redux에 저장하지 않음</dt>
            <dd>
              <code>
                {JSON.stringify({
                  error: error ?? null,
                  incidentCount,
                  loading,
                })}
              </code>
            </dd>
          </div>
          <div>
            <dt>같은 store를 구독하는 화면</dt>
            <dd>
              <code>/incidents · /map · /risk-3d · /incidents/[id]</code>
            </dd>
          </div>
      </dl>
    </aside>
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
  onSelect,
  selected,
}: {
  incident: Incident;
  onSelect: () => void;
  selected: boolean;
}) {
  const risk = calculateIncidentRisk(incident);

  return (
    <li>
      <article
        className={`incident-card${selected ? " incident-card--selected" : ""}`}
      >
        <div className="incident-card-main">
          <div className="incident-card-title-row">
            <Link
              className="incident-title-link"
              href={`/incidents/${incident.id}`}
            >
              {incident.title}
            </Link>
            <SeverityBadge severity={incident.severity} />
            <Badge tone={getRiskTone(risk.level)}>위험도 {risk.score}</Badge>
          </div>
          <p>{incident.description}</p>
          <dl className="incident-meta">
            <MetaItem
              label="상태"
              value={incidentStatusLabels[incident.status]}
            />
            <MetaItem
              label="위험도"
              value={`${incidentRiskLevelLabels[risk.level]} ${risk.score}`}
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
        <div className="incident-actions">
          <button
            aria-pressed={selected}
            className="nav-link"
            onClick={onSelect}
            type="button"
          >
            {selected ? "선택됨" : "선택"}
          </button>
          <Link
            className="nav-link nav-link--strong"
            href={`/incidents/${incident.id}`}
            aria-label={`${incident.title} 상세 보기`}
          >
            상세
          </Link>
        </div>
      </article>
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
