"use client";

import {
  calculateIncidentRisk,
  incidentSeverities,
  incidentStatuses,
  type Incident,
} from "@citywatch/api-types";
import { Badge, SeverityBadge, XRayBox, XRayToggle } from "@citywatch/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store-hooks";
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
import { fetchIncidents } from "./incident-api";
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
  const [xray, setXray] = useState(true);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
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
        <div className="topbar-actions">
          <Link className="nav-link nav-link--strong" href="/incidents/new">
            사고 등록
          </Link>
          <Link className="nav-link nav-link--strong" href="/map">
            지도 관제
          </Link>
          <Link className="nav-link nav-link--strong" href="/risk-3d">
            3D 위험 구역
          </Link>
          <Link className="nav-link nav-link--strong" href="/realtime">
            실시간 피드
          </Link>
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
            selectedIncidentId={selectedIncidentId}
            selectedIncidentTitle={selectedIncident?.title}
            xray={xray}
          />

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
                {!loading && !error && incidents.length === 0 ? (
                  <p className="state-message" role="status">
                    현재 필터 조건에 맞는 사고가 없습니다.
                  </p>
                ) : null}
                {!loading && !error && incidents.length > 0 ? (
                  <ul className="incident-list">
                    {incidents.map((incident) => (
                      <IncidentListItem
                        incident={incident}
                        key={incident.id}
                        onSelect={() => dispatch(setSelectedIncidentId(incident.id))}
                        selected={incident.id === selectedIncidentId}
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

function IncidentFilterPanel({
  activeFilterCount,
  filters,
  onRegionChange,
  onReset,
  onSearchChange,
  onSeverityChange,
  onStatusChange,
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
      enabled={xray}
      label="feature/incident/ShareIncidentFilters"
      packageName="apps/web"
      stacks={["Redux Toolkit", "React Redux", "REST Query"]}
    >
      <section className="panel" aria-labelledby="incident-filter-title">
        <div className="panel-title-row">
          <h2 id="incident-filter-title">관제 필터</h2>
          <Badge tone="info">Redux {activeFilterCount}</Badge>
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
                onSeverityChange(event.target.value as IncidentFilters["severity"])
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
          <span>Redux 필터 {activeFilterCount}개 적용</span>
          <span>선택 사고 {selectedLabel}</span>
        </p>
      </section>
    </XRayBox>
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
  xray,
}: {
  incident: Incident;
  onSelect: () => void;
  selected: boolean;
  xray: boolean;
}) {
  const risk = calculateIncidentRisk(incident);

  return (
    <li>
      <XRayBox
        enabled={xray}
        label="entity/incident/IncidentListItem"
        packageName="packages/api-types"
        stacks={["TypeScript", "Shared Contract"]}
      >
        <article className={`incident-card${selected ? " incident-card--selected" : ""}`}>
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
              <XRayBox
                enabled={xray}
                label="feature/incident/CalculateRiskScore"
                packageName="packages/api-types"
                stacks={["Unit Test", "Pure Function"]}
              >
                <Badge tone={getRiskTone(risk.level)}>위험도 {risk.score}</Badge>
              </XRayBox>
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
            <XRayBox
              enabled={xray}
              label="feature/incident/ShareSelectedIncident"
              packageName="apps/web"
              stacks={["Redux Toolkit", "React Redux"]}
            >
              <button
                aria-pressed={selected}
                className="nav-link"
                onClick={onSelect}
                type="button"
              >
                {selected ? "선택됨" : "선택"}
              </button>
            </XRayBox>
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
          </div>
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
