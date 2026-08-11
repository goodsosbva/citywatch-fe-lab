"use client";

import type { CreateIncidentValidationErrors } from "@citywatch/api-types";
import {
  incidentCategories,
  incidentSeverities,
  validateCreateIncidentInput,
} from "@citywatch/api-types";
import { Badge, XRayBox } from "@citywatch/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useXRay } from "../../xray-selector";
import { createIncident } from "../incident-api";
import {
  incidentCategoryLabels,
  incidentSeverityLabels,
} from "../incident-format";

type FormState = {
  title: string;
  description: string;
  category: string;
  severity: string;
  regionId: string;
  latitude: string;
  longitude: string;
  affectedPeople: string;
  assignedTeam: string;
};

const regionOptions = [
  { id: "seocho", label: "서초구" },
  { id: "seongsu", label: "성동구" },
  { id: "junggu", label: "중구" },
];

const initialForm: FormState = {
  title: "",
  description: "",
  category: "traffic",
  severity: "medium",
  regionId: "junggu",
  latitude: "37.5657",
  longitude: "126.9769",
  affectedPeople: "0",
  assignedTeam: "",
};

export default function NewIncidentPage() {
  const router = useRouter();
  const { enabled: xray, mode } = useXRay();
  const [form, setForm] = useState<FormState>(initialForm);
  const [fieldErrors, setFieldErrors] =
    useState<CreateIncidentValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setError(undefined);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = buildIncidentInput(form);
    if (!result.success) {
      setFieldErrors(result.errors);
      setError("입력값을 확인해야 합니다.");
      return;
    }

    setSaving(true);
    setFieldErrors({});
    setError(undefined);

    try {
      const incident = await createIncident(result.input);
      router.push(`/incidents/${incident.id}`);
    } catch (reason) {
      setError(getErrorMessage(reason));
      setSaving(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Incident Intake</p>
          <h1>사고 등록</h1>
        </div>
      </header>

      <XRayBox
        enabled={xray}
        label="app/incidents/CreateIncidentPage"
        layer="app"
        packageName="apps/web"
        stacks={["Next App Router", "React", "TypeScript"]}
      >
        <section className="dashboard" aria-label="사고 등록 관제">
          <XRayBox
            enabled={
              xray ||
              mode === "rest-api" ||
              mode === "zod"
            }
            label="widget/IncidentCreateForm"
            packageName="apps/web"
            proofs={["fsd-style", "rest-api", "zod"]}
            stacks={["React Form"]}
          >
            <section className="panel" aria-labelledby="incident-create-title">
              <div className="panel-title-row">
                <h2 id="incident-create-title">신규 사고 접수</h2>
                <Badge tone="info">POST</Badge>
              </div>

              <XRayBox
                enabled={
                  xray ||
                  mode === "rest-api" ||
                  mode === "zod"
                }
                label="feature/incident/CreateIncident"
                packageName="apps/web"
                proofs={["fsd-style", "rest-api", "zod"]}
                stacks={["REST API", "Schema Validation"]}
              >
                <form
                  className="create-form"
                  noValidate
                  onSubmit={handleSubmit}
                  aria-busy={saving}
                  aria-describedby={
                    error ? "create-incident-message" : undefined
                  }
                >
                  <XRayBox
                    enabled={
                      xray ||
                      mode === "rest-api" ||
                      mode === "zod"
                    }
                    label="entity/incident/CreateIncidentInput"
                    packageName="apps/web"
                    proofs={["fsd-style", "rest-api", "zod"]}
                    stacks={["TypeScript", "Shared Validation"]}
                  >
                    <div className="form-grid">
                      <div className="form-field form-field--wide">
                        <label htmlFor="incident-title">사고명</label>
                        <input
                          aria-describedby={
                            fieldErrors.title
                              ? "incident-title-error"
                              : undefined
                          }
                          aria-invalid={Boolean(fieldErrors.title)}
                          autoComplete="off"
                          className="text-input"
                          disabled={saving}
                          id="incident-title"
                          maxLength={80}
                          minLength={4}
                          onChange={(event) =>
                            updateField("title", event.target.value)
                          }
                          required
                          type="text"
                          value={form.title}
                        />
                        <FieldError
                          id="incident-title-error"
                          message={fieldErrors.title}
                        />
                      </div>

                      <div className="form-field form-field--wide">
                        <label htmlFor="incident-description">상세 내용</label>
                        <textarea
                          aria-describedby={
                            fieldErrors.description
                              ? "incident-description-error"
                              : undefined
                          }
                          aria-invalid={Boolean(fieldErrors.description)}
                          className="textarea-input"
                          disabled={saving}
                          id="incident-description"
                          maxLength={300}
                          minLength={10}
                          onChange={(event) =>
                            updateField("description", event.target.value)
                          }
                          required
                          rows={4}
                          value={form.description}
                        />
                        <FieldError
                          id="incident-description-error"
                          message={fieldErrors.description}
                        />
                      </div>

                      <div className="form-field">
                        <label htmlFor="incident-category">분류</label>
                        <select
                          aria-describedby={
                            fieldErrors.category
                              ? "incident-category-error"
                              : undefined
                          }
                          aria-invalid={Boolean(fieldErrors.category)}
                          className="select-input"
                          disabled={saving}
                          id="incident-category"
                          onChange={(event) =>
                            updateField("category", event.target.value)
                          }
                          value={form.category}
                        >
                          {incidentCategories.map((category) => (
                            <option key={category} value={category}>
                              {incidentCategoryLabels[category]}
                            </option>
                          ))}
                        </select>
                        <FieldError
                          id="incident-category-error"
                          message={fieldErrors.category}
                        />
                      </div>

                      <div className="form-field">
                        <label htmlFor="incident-severity">심각도</label>
                        <select
                          aria-describedby={
                            fieldErrors.severity
                              ? "incident-severity-error"
                              : undefined
                          }
                          aria-invalid={Boolean(fieldErrors.severity)}
                          className="select-input"
                          disabled={saving}
                          id="incident-severity"
                          onChange={(event) =>
                            updateField("severity", event.target.value)
                          }
                          value={form.severity}
                        >
                          {incidentSeverities.map((severity) => (
                            <option key={severity} value={severity}>
                              {incidentSeverityLabels[severity]}
                            </option>
                          ))}
                        </select>
                        <FieldError
                          id="incident-severity-error"
                          message={fieldErrors.severity}
                        />
                      </div>

                      <div className="form-field">
                        <label htmlFor="incident-region">관제 지역</label>
                        <select
                          aria-describedby={
                            fieldErrors.regionId
                              ? "incident-region-error"
                              : undefined
                          }
                          aria-invalid={Boolean(fieldErrors.regionId)}
                          className="select-input"
                          disabled={saving}
                          id="incident-region"
                          onChange={(event) =>
                            updateField("regionId", event.target.value)
                          }
                          value={form.regionId}
                        >
                          {regionOptions.map((region) => (
                            <option key={region.id} value={region.id}>
                              {region.label}
                            </option>
                          ))}
                        </select>
                        <FieldError
                          id="incident-region-error"
                          message={fieldErrors.regionId}
                        />
                      </div>

                      <div className="form-field">
                        <label htmlFor="incident-affected-people">
                          영향 인원
                        </label>
                        <input
                          aria-describedby={
                            fieldErrors.affectedPeople
                              ? "incident-affected-people-error"
                              : undefined
                          }
                          aria-invalid={Boolean(fieldErrors.affectedPeople)}
                          className="text-input"
                          disabled={saving}
                          id="incident-affected-people"
                          min={0}
                          onChange={(event) =>
                            updateField("affectedPeople", event.target.value)
                          }
                          required
                          step={1}
                          type="number"
                          value={form.affectedPeople}
                        />
                        <FieldError
                          id="incident-affected-people-error"
                          message={fieldErrors.affectedPeople}
                        />
                      </div>

                      <div className="form-field">
                        <label htmlFor="incident-latitude">위도</label>
                        <input
                          aria-describedby={
                            fieldErrors.latitude
                              ? "incident-latitude-error"
                              : undefined
                          }
                          aria-invalid={Boolean(fieldErrors.latitude)}
                          className="text-input"
                          disabled={saving}
                          id="incident-latitude"
                          max={90}
                          min={-90}
                          onChange={(event) =>
                            updateField("latitude", event.target.value)
                          }
                          required
                          step="0.0001"
                          type="number"
                          value={form.latitude}
                        />
                        <FieldError
                          id="incident-latitude-error"
                          message={fieldErrors.latitude}
                        />
                      </div>

                      <div className="form-field">
                        <label htmlFor="incident-longitude">경도</label>
                        <input
                          aria-describedby={
                            fieldErrors.longitude
                              ? "incident-longitude-error"
                              : undefined
                          }
                          aria-invalid={Boolean(fieldErrors.longitude)}
                          className="text-input"
                          disabled={saving}
                          id="incident-longitude"
                          max={180}
                          min={-180}
                          onChange={(event) =>
                            updateField("longitude", event.target.value)
                          }
                          required
                          step="0.0001"
                          type="number"
                          value={form.longitude}
                        />
                        <FieldError
                          id="incident-longitude-error"
                          message={fieldErrors.longitude}
                        />
                      </div>

                      <div className="form-field form-field--wide">
                        <label htmlFor="incident-assigned-team">담당 팀</label>
                        <input
                          aria-describedby={
                            fieldErrors.assignedTeam
                              ? "incident-assigned-team-error"
                              : undefined
                          }
                          aria-invalid={Boolean(fieldErrors.assignedTeam)}
                          autoComplete="off"
                          className="text-input"
                          disabled={saving}
                          id="incident-assigned-team"
                          maxLength={40}
                          onChange={(event) =>
                            updateField("assignedTeam", event.target.value)
                          }
                          type="text"
                          value={form.assignedTeam}
                        />
                        <FieldError
                          id="incident-assigned-team-error"
                          message={fieldErrors.assignedTeam}
                        />
                      </div>
                    </div>
                  </XRayBox>

                  <div className="form-actions">
                    <button
                      className="primary-button"
                      disabled={saving}
                      type="submit"
                    >
                      {saving ? "등록 중" : "사고 등록"}
                    </button>
                    <Link className="nav-link" href="/incidents">
                      취소
                    </Link>
                  </div>
                </form>
              </XRayBox>

              {saving ? (
                <p className="state-message" role="status">
                  사고를 등록하는 중입니다.
                </p>
              ) : null}
              {error ? (
                <p
                  className="state-message state-message--error"
                  id="create-incident-message"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
            </section>
          </XRayBox>

          {mode === "zod" ? (
            <XRayBox
              enabled
              label="feature/incident/ZodValidationPipeline"
              packageName="apps/web"
              proofs={["zod"]}
              stacks={["Zod", "safeParse", "Shared Validation"]}
            >
              <CreateIncidentEvidencePanel
                errorCount={Object.values(fieldErrors).filter(Boolean).length}
                saving={saving}
              />
            </XRayBox>
          ) : null}
        </section>
      </XRayBox>
    </main>
  );
}

function CreateIncidentEvidencePanel({
  errorCount,
  saving,
}: {
  errorCount: number;
  saving: boolean;
}) {
  return (
    <aside
      aria-labelledby="incident-create-evidence-title"
      className="panel technology-evidence"
    >
      <div className="panel-title-row">
        <h2 id="incident-create-evidence-title">
          Zod Validation 증거
        </h2>
        <Badge tone={errorCount ? "danger" : saving ? "info" : "success"}>
          {errorCount ? `오류 ${errorCount}개` : saving ? "등록 중" : "입력 대기"}
        </Badge>
      </div>

      <p>
        문자열로 수집한 폼 값을 공유 Zod schema로 변환·검증하고, 성공한 입력만 POST 요청에 사용합니다. 서버도 같은 validator로 다시 검사합니다.
      </p>

      <ul className="technology-flow">
        <li>
          <code>FormState strings</code>
          <span>mapped by</span>
          <code>buildIncidentInput</code>
        </li>
        <li>
          <code>unknown input</code>
          <span>safeParse</span>
          <code>createIncidentInputSchema</code>
        </li>
        <li>
          <code>Zod issues</code>
          <span>mapped to</span>
          <code>fieldErrors</code>
        </li>
        <li>
          <code>validated input</code>
          <span>POST</span>
          <code>/api/incidents</code>
        </li>
      </ul>

      <dl className="technology-code">
        <div>
          <dt>공유 검증 진입점</dt>
          <dd>
            <code>validateCreateIncidentInput(value)</code>
          </dd>
        </div>
        <div>
          <dt>신뢰 경계</dt>
          <dd>
            <code>createIncidentInputSchema.safeParse(value)</code>
          </dd>
        </div>
        <div>
          <dt>클라이언트와 서버</dt>
          <dd>
            <code>같은 validator를 양쪽에서 실행</code>
          </dd>
        </div>
        <div>
          <dt>현재 필드 오류</dt>
          <dd>
            <code>{errorCount}개</code>
          </dd>
        </div>
      </dl>
    </aside>
  );
}

function buildIncidentInput(form: FormState) {
  return validateCreateIncidentInput({
    title: form.title,
    description: form.description,
    category: form.category,
    severity: form.severity,
    regionId: form.regionId,
    location: {
      latitude: form.latitude,
      longitude: form.longitude,
    },
    affectedPeople: form.affectedPeople,
    assignedTeam: form.assignedTeam,
  });
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p className="field-error" id={id}>
      {message}
    </p>
  ) : null;
}

function getErrorMessage(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "사고 등록 중 오류가 발생했습니다.";
}
