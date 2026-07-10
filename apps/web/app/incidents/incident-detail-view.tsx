"use client";

import type { Incident, IncidentStatus } from "@citywatch/api-types";
import { calculateIncidentRisk, incidentStatuses } from "@citywatch/api-types";
import { Badge, SeverityBadge, XRayBox, XRayToggle } from "@citywatch/ui";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store-hooks";
import {
  selectSelectedIncidentId,
  setSelectedIncidentId,
} from "./incident-control-slice";
import { changeIncidentStatus, fetchIncident } from "./incident-api";
import {
  formatIncidentDate,
  getRegionName,
  getRiskTone,
  getStatusTone,
  incidentCategoryLabels,
  incidentRiskLevelLabels,
  incidentStatusLabels,
} from "./incident-format";

export function IncidentDetailView({ incidentId }: { incidentId: string }) {
  const dispatch = useAppDispatch();
  const selectedIncidentId = useAppSelector(selectSelectedIncidentId);
  const [xray, setXray] = useState(true);
  const [incident, setIncident] = useState<Incident>();
  const [selectedStatus, setSelectedStatus] = useState<IncidentStatus>("reported");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [saveMessage, setSaveMessage] = useState<string>();

  useEffect(() => {
    dispatch(setSelectedIncidentId(incidentId));
  }, [dispatch, incidentId]);

  useEffect(() => {
    let active = true;

    async function loadIncident() {
      try {
        const nextIncident = await fetchIncident(incidentId);
        if (!active) return;
        setIncident(nextIncident);
        setSelectedStatus(nextIncident.status);
        setLoadError(undefined);
      } catch (reason) {
        if (!active) return;
        setLoadError(getErrorMessage(reason));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadIncident();

    return () => {
      active = false;
    };
  }, [incidentId]);

  const risk = incident ? calculateIncidentRisk(incident) : undefined;

  async function handleStatusSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!incident) return;

    setSaving(true);
    setSaveError(undefined);
    setSaveMessage(undefined);

    try {
      const updated = await changeIncidentStatus({ incidentId: incident.id, status: selectedStatus });
      setIncident(updated);
      setSelectedStatus(updated.status);
      setSaveMessage(`상태가 ${incidentStatusLabels[updated.status]}(으)로 변경됐습니다.`);
    } catch (reason) {
      setSaveError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Incident Detail</p>
          <h1>{incident?.title ?? "사고 상세 관제"}</h1>
        </div>
        <div className="topbar-actions">
          <Link className="nav-link" href="/incidents">
            사고 목록
          </Link>
          <XRayToggle enabled={xray} onChange={setXray} />
        </div>
      </header>

      <XRayBox enabled={xray} label="app/incidents/IncidentDetailPage" layer="app" packageName="apps/web" stacks={["Next Dynamic Route", "React", "TypeScript"]}>
        <section className="dashboard" aria-label="사고 상세 관제" aria-busy={loading || saving}>
          <XRayBox enabled={xray} label="feature/incident/FetchIncidentDetail" packageName="apps/web" stacks={["fetch", "REST API"]}>
            {loading ? <p className="state-message" role="status">REST API에서 사고 상세를 불러오는 중입니다.</p> : null}
            {loadError ? <p className="state-message state-message--error" role="alert">{loadError}</p> : null}
          </XRayBox>

          {incident ? (
            <>
              <XRayBox enabled={xray} label="widget/IncidentDetailHeader" packageName="apps/web" stacks={["React", "Shared UI"]}>
                <section className="panel detail-hero" aria-labelledby="incident-detail-title">
                  <div>
                    <p className="eyebrow">{incident.id}</p>
                    <h2 id="incident-detail-title">{incident.title}</h2>
                    <p>{incident.description}</p>
                  </div>
                  <div className="detail-badges" aria-label="사고 상태 요약">
                    <XRayBox enabled={xray} label="shared/ui/SeverityBadge" packageName="packages/ui" stacks={["React", "Shared UI"]}>
                      <SeverityBadge severity={incident.severity} />
                    </XRayBox>
                    <Badge tone={getStatusTone(incident.status)}>{incidentStatusLabels[incident.status]}</Badge>
                    <XRayBox enabled={xray} label="feature/incident/ShareSelectedIncident" packageName="apps/web" stacks={["Redux Toolkit", "React Redux"]}>
                      <Badge tone={selectedIncidentId === incident.id ? "info" : "warning"}>Redux 선택 {selectedIncidentId ?? "없음"}</Badge>
                    </XRayBox>
                    {risk ? (
                      <XRayBox enabled={xray} label="feature/incident/CalculateRiskScore" packageName="packages/api-types" stacks={["Unit Test", "Pure Function"]}>
                        <Badge tone={getRiskTone(risk.level)}>위험도 {risk.score}</Badge>
                      </XRayBox>
                    ) : null}
                  </div>
                </section>
              </XRayBox>

              <XRayBox enabled={xray} label="feature/incident/ChangeIncidentStatus" packageName="apps/web" stacks={["PATCH", "REST API", "Input Validation", "Accessibility"]}>
                <section className="panel" aria-labelledby="incident-status-title">
                  <div className="panel-title-row">
                    <h2 id="incident-status-title">상태 변경</h2>
                    <Badge tone="info">PATCH</Badge>
                  </div>
                  <form className="status-form" onSubmit={handleStatusSubmit} aria-busy={saving}>
                    <div className="form-field">
                      <label htmlFor="incident-status">대응 상태</label>
                      <select
                        className="select-input"
                        disabled={saving}
                        id="incident-status"
                        onChange={(event) => setSelectedStatus(event.target.value as IncidentStatus)}
                        value={selectedStatus}
                      >
                        {incidentStatuses.map((status) => (
                          <option key={status} value={status}>
                            {incidentStatusLabels[status]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button className="primary-button" disabled={saving || selectedStatus === incident.status} type="submit">
                      {saving ? "변경 중" : "상태 변경"}
                    </button>
                  </form>
                  {saveMessage ? <p className="state-message state-message--success" role="status">{saveMessage}</p> : null}
                  {saveError ? <p className="state-message state-message--error" role="alert">{saveError}</p> : null}
                </section>
              </XRayBox>

              <XRayBox enabled={xray} label="entity/incident/IncidentDetail" packageName="packages/api-types" stacks={["TypeScript", "Shared Contract"]}>
                <section className="panel" aria-labelledby="incident-detail-data-title">
                  <div className="panel-title-row">
                    <h2 id="incident-detail-data-title">상세 정보</h2>
                    <Badge tone="success">REST API</Badge>
                  </div>
                  <dl className="detail-grid">
                    <DetailItem label="상태" value={incidentStatusLabels[incident.status]} />
                    {risk ? <DetailItem label="위험도" value={`${incidentRiskLevelLabels[risk.level]} ${risk.score}`} /> : null}
                    <DetailItem label="분류" value={incidentCategoryLabels[incident.category]} />
                    <DetailItem label="지역" value={getRegionName(incident.regionId)} />
                    <DetailItem label="영향 인원" value={`${incident.affectedPeople}명`} />
                    <DetailItem label="담당 팀" value={incident.assignedTeam ?? "미배정"} />
                    <DetailItem label="좌표" value={`${incident.location.latitude}, ${incident.location.longitude}`} />
                    <DetailItem label="접수 시각" value={formatIncidentDate(incident.reportedAt)} />
                    <DetailItem label="갱신 시각" value={formatIncidentDate(incident.updatedAt)} />
                  </dl>
                </section>
              </XRayBox>
            </>
          ) : null}
        </section>
      </XRayBox>
    </main>
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

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "요청 처리 중 오류가 발생했습니다.";
}
