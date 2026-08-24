"use client";

import type { Incident, IncidentStatus } from "@citywatch/api-types";
import { calculateIncidentRisk, incidentStatuses } from "@citywatch/api-types";
import { Badge, SeverityBadge, XRayBox } from "@citywatch/ui";
import { FormEvent, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  selectSelectedIncidentId,
  setSelectedIncidentId,
} from "@/features/incident-control";
import {
  changeIncidentStatus,
  formatIncidentDate,
  getRegionName,
  getRiskTone,
  getStatusTone,
  incidentCategoryLabels,
  incidentRiskLevelLabels,
  incidentStatusLabels,
} from "@/entities/incident";

export function IncidentDetailView({
  initialIncident,
  serverRenderedAt,
  ssrXray,
  xray,
}: {
  initialIncident: Incident;
  serverRenderedAt: string;
  ssrXray: boolean;
  xray: boolean;
}) {
  const dispatch = useDispatch();
  const selectedIncidentId = useSelector(selectSelectedIncidentId);
  const [incident, setIncident] = useState(initialIncident);
  const [selectedStatus, setSelectedStatus] = useState<IncidentStatus>(initialIncident.status);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [saveMessage, setSaveMessage] = useState<string>();

  useEffect(() => {
    dispatch(setSelectedIncidentId(initialIncident.id));
  }, [dispatch, initialIncident.id]);

  const risk = calculateIncidentRisk(incident);

  async function handleStatusSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
    <main
      className="shell"
      data-ssr-incident-id={initialIncident.id}
      data-ssr-rendered-at={serverRenderedAt}
    >
      <header className="topbar">
        <div>
          <p className="eyebrow">Incident Detail</p>
          <h1>{incident?.title ?? "사고 상세 관제"}</h1>
        </div>
      </header>

      <XRayBox
        enabled={xray || ssrXray}
        label={ssrXray ? "browser/HydratedIncidentDetailView" : "widget/incident-detail/IncidentDetailView"}
        layer="widget"
        packageName="apps/web"
        proofs={ssrXray ? ["ssr"] : ["fsd-style"]}
        stacks={ssrXray ? ["React Hydration", "initial props"] : ["React", "TypeScript"]}
      >
        <section className="dashboard" aria-label="사고 상세 관제" aria-busy={saving}>
          {ssrXray ? (
            <SSREvidencePanel
              incident={initialIncident}
              serverRenderedAt={serverRenderedAt}
            />
          ) : null}

          {incident ? (
            <>
              <XRayBox enabled={xray} label="widget/incident-detail/IncidentDetailHeader" packageName="apps/web" stacks={["React", "Shared UI", "Redux Selected State", "Shared Risk Score"]}>
                <section className="panel detail-hero" aria-labelledby="incident-detail-title">
                  <div>
                    <p className="eyebrow">{incident.id}</p>
                    <h2 id="incident-detail-title">{incident.title}</h2>
                    <p>{incident.description}</p>
                  </div>
                  <div className="detail-badges" aria-label="사고 상태 요약">
                    <SeverityBadge severity={incident.severity} />
                    <Badge tone={getStatusTone(incident.status)}>{incidentStatusLabels[incident.status]}</Badge>
                    <Badge tone={selectedIncidentId === incident.id ? "info" : "warning"}>Redux 선택 {selectedIncidentId ?? "없음"}</Badge>
                    <Badge tone={getRiskTone(risk.level)}>위험도 {risk.score}</Badge>
                  </div>
                </section>
              </XRayBox>

              <XRayBox enabled={xray} label="widget/incident-detail/ChangeIncidentStatus" packageName="apps/web" stacks={["PATCH", "REST API", "Input Validation", "Accessibility"]}>
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

              <XRayBox enabled={xray} label="entity/incident/IncidentDetail" packageName="apps/web" stacks={["TypeScript", "Shared Contract"]}>
                <section className="panel" aria-labelledby="incident-detail-data-title">
                  <div className="panel-title-row">
                    <h2 id="incident-detail-data-title">상세 정보</h2>
                    <Badge tone="success">REST API</Badge>
                  </div>
                  <dl className="detail-grid">
                    <DetailItem label="상태" value={incidentStatusLabels[incident.status]} />
                    <DetailItem label="위험도" value={`${incidentRiskLevelLabels[risk.level]} ${risk.score}`} />
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

function SSREvidencePanel({
  incident,
  serverRenderedAt,
}: {
  incident: Incident;
  serverRenderedAt: string;
}) {
  return (
    <aside aria-labelledby="ssr-evidence-title" className="panel technology-evidence">
      <div className="panel-title-row">
        <h2 id="ssr-evidence-title">SSR / Hydration 실행 증거</h2>
        <Badge tone="success">서버 HTML 생성 완료</Badge>
      </div>
      <p>
        Server Component가 사고를 먼저 조회해 제목과 상세 정보가 포함된 HTML을 만들고,
        브라우저는 같은 초기 데이터를 이어받아 상태 변경 폼만 활성화합니다.
      </p>
      <ul className="technology-flow">
        <li><code>page.tsx</code><span>server query</span><code>getIncidentById({incident.id})</code></li>
        <li><code>Incident</code><span>serialize props</span><code>server HTML + RSC payload</code></li>
        <li><code>initialIncident</code><span>useState</span><code>hydrated React state</code></li>
        <li><code>status form</code><span>user submit</span><code>PATCH /api/incidents/{incident.id}/status</code></li>
      </ul>
      <dl className="technology-code">
        <div><dt>서버 렌더링 사고</dt><dd><code>{incident.id} · {incident.title}</code></dd></div>
        <div><dt>서버 렌더링 시각</dt><dd><code>{serverRenderedAt}</code></dd></div>
        <div><dt>최초 상세 API 요청</dt><dd><code>없음 · initialIncident 사용</code></dd></div>
        <div><dt>Hydration 이후 상호작용</dt><dd><code>Redux 선택 동기화 + PATCH 상태 변경</code></dd></div>
      </dl>
    </aside>
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
