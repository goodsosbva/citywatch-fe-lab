"use client";

import type { Incident } from "@citywatch/api-types";
import { Badge, XRayBox } from "@citywatch/ui";
import { useCallback, useEffect, useState, type ComponentType } from "react";
import * as React from "react";
import { useXRay } from "./xray-selector";

type AnalyticsModule = {
  AnalyticsMetrics: ComponentType<{ incidents: readonly Incident[] }>;
};

type AnalyticsState =
  | { status: "loading" }
  | { message: string; status: "error" }
  | { AnalyticsMetrics: AnalyticsModule["AnalyticsMetrics"]; status: "ready" };

type FederationRuntime = {
  loadRemote: <T>(id: string) => Promise<T | null>;
};

const remoteManifestUrl =
  process.env.NEXT_PUBLIC_ANALYTICS_REMOTE_URL ??
  "http://127.0.0.1:3002/mf-manifest.json";
const remoteModuleId = "citywatch_analytics/analytics-metrics";

let runtimePromise: Promise<FederationRuntime> | undefined;
let analyticsModulePromise: Promise<AnalyticsModule> | undefined;

export function AnalyticsRemotePanel({ incidents }: { incidents: Incident[] }) {
  const { enabled: xray, mode, practiceOpen, practicePreviewUrl, setPracticeFrameWindow } = useXRay(["module-federation", "monorepo"]);
  const [loadRun, setLoadRun] = useState(0);
  const [state, setState] = useState<AnalyticsState>({ status: "loading" });
  const setPracticeFrame = useCallback(
    (frame: HTMLIFrameElement | null) => setPracticeFrameWindow(frame?.contentWindow ?? undefined),
    [setPracticeFrameWindow],
  );

  useEffect(() => {
    let active = true;

    setState({ status: "loading" });

    void loadAnalyticsModule()
      .then((remoteModule) => {
        if (active) setState({ AnalyticsMetrics: remoteModule.AnalyticsMetrics, status: "ready" });
      })
      .catch((reason) => {
        if (active) setState({ message: getErrorMessage(reason), status: "error" });
      });

    return () => {
      active = false;
    };
  }, [incidents, loadRun]);

  const AnalyticsMetrics = state.status === "ready" ? state.AnalyticsMetrics : null;

  return (
    <XRayBox
      enabled={xray}
      label="host/analytics/AnalyticsRemotePanel"
      layer="app"
      packageName="apps/web"
      proofs={["module-federation", "monorepo"]}
      stacks={["Module Federation", "Vite Remote", "Runtime Manifest"]}
    >
      <section aria-labelledby="remote-analytics-title" className="panel">
        <div className="panel-title-row">
          <div>
            <h2 id="remote-analytics-title">원격 사고 분석</h2>
            <Badge tone={state.status === "ready" ? "success" : state.status === "error" ? "danger" : "info"}>
              {state.status === "ready" ? "Federated" : state.status === "error" ? "Remote error" : "Loading remote"}
            </Badge>
          </div>
          <span className="remote-source">Remote target · apps/analytics-remote</span>
        </div>

        {state.status === "loading" ? (
          <p className="state-message" role="status">
            Module Federation manifest와 분석 모듈을 불러오는 중입니다.
          </p>
        ) : null}

        {state.status === "error" ? (
          <div className="remote-error" role="alert">
            <p className="state-message state-message--error">
              analytics remote를 불러오지 못했습니다: {state.message}
            </p>
            <button
              className="secondary-button"
              onClick={() => setLoadRun((run) => run + 1)}
              type="button"
            >
              Remote 다시 불러오기
            </button>
          </div>
        ) : null}

        {practiceOpen ? (
          <section aria-label="Module Federation 실습 미리보기" className="mf-practice-preview">
            {practicePreviewUrl ? (
              <iframe
                allow="cross-origin-isolated"
                ref={setPracticeFrame}
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin"
                src={practicePreviewUrl}
                title="격리된 CityWatch Practice Host"
              />
            ) : (
              <div className="mf-practice-preview__empty" role="status">
                우측에서 Remote 파일을 확인하고 실행하면 실제 빌드 결과가 여기에 표시됩니다.
              </div>
            )}
          </section>
        ) : AnalyticsMetrics ? (
          <XRayBox
            enabled={mode === "module-federation" || mode === "monorepo"}
            label="remote/analytics/AnalyticsMetricsContent"
            layer="remote"
            packageName="apps/analytics-remote"
            proofs={["module-federation", "monorepo"]}
          >
            <AnalyticsMetrics incidents={incidents} />
          </XRayBox>
        ) : null}

        {mode === "module-federation" ? (
          <ModuleFederationEvidencePanel status={state.status} />
        ) : null}
      </section>
    </XRayBox>
  );
}

function ModuleFederationEvidencePanel({ status }: { status: AnalyticsState["status"] }) {
  const statusLabel =
    status === "ready" ? "원격 모듈 연결됨" : status === "error" ? "원격 로드 실패" : "원격 모듈 로드 중";

  return (
    <aside aria-labelledby="module-federation-evidence-title" className="module-federation-evidence">
      <div className="panel-title-row">
        <h3 id="module-federation-evidence-title">Module Federation 증거</h3>
        <Badge tone={status === "ready" ? "success" : status === "error" ? "danger" : "info"}>
          {statusLabel}
        </Badge>
      </div>

      <p>
        Next.js Host가 manifest를 통해 Vite Remote 모듈을 실행 중에 불러옵니다. 파란 경계는 Host가 소유한 상태 UI이고, 주황 경계는 로드에 성공했을 때만 생기는 실제 Remote React UI입니다.
      </p>

      <section aria-labelledby="module-federation-setup-title" className="module-federation-setup">
        <h4 id="module-federation-setup-title">설정부터 연결까지</h4>
        <ol>
          <li>
            <span>1 · Remote 공개</span>
            <strong>apps/analytics-remote/vite.config.ts</strong>
            <code>name: &quot;citywatch_analytics&quot;</code>
            <code>exposes: &quot;./analytics-metrics&quot; → &quot;./src/analytics-metrics.tsx&quot;</code>
            <code>manifest: true</code>
          </li>
          <li>
            <span>2 · Host 등록</span>
            <strong>apps/web/app/analytics-remote-panel.tsx</strong>
            <code>name: &quot;citywatch_analytics&quot;</code>
            <code>entry: {remoteManifestUrl}</code>
          </li>
          <li>
            <span>3 · 공개 모듈 요청</span>
            <strong>Remote name + expose key</strong>
            <code>loadRemote(&quot;{remoteModuleId}&quot;)</code>
          </li>
          <li>
            <span>4 · React 공유</span>
            <strong>Host React = Remote React</strong>
            <code>shared.react.singleton: true</code>
          </li>
        </ol>
      </section>

      <div className="module-federation-boundaries" aria-label="Module Federation Host와 Remote 경계">
        <div className="module-federation-boundary module-federation-boundary--host">
          <span>Host</span>
          <strong>apps/web</strong>
          <code>AnalyticsRemotePanel</code>
          <em>항상 렌더링</em>
        </div>
        <span aria-hidden="true" className="module-federation-arrow">loadRemote →</span>
        <div className={`module-federation-boundary module-federation-boundary--remote${status === "ready" ? "" : " module-federation-boundary--waiting"}`}>
          <span>Remote</span>
          <strong>apps/analytics-remote</strong>
          <code>AnalyticsMetrics</code>
          <em>{status === "ready" ? "현재 렌더링 중" : status === "error" ? "로드 실패" : "로드 대기 중"}</em>
        </div>
      </div>

      <ol className="module-federation-flow">
        <li>Host가 <code>remoteManifestUrl</code>을 Federation runtime에 등록합니다.</li>
        <li>runtime이 <code>mf-manifest.json</code>에서 remote entry와 asset 위치를 확인합니다.</li>
        <li><code>loadRemote(&quot;{remoteModuleId}&quot;)</code>가 공개된 모듈을 가져옵니다.</li>
        <li><code>isAnalyticsModule</code>이 <code>AnalyticsMetrics</code> export가 함수인지 검사합니다.</li>
        <li>검증된 Remote 컴포넌트가 사고 데이터를 계산하고 네 개 지표를 렌더링합니다.</li>
      </ol>

      <dl className="module-federation-code">
        <div>
          <dt>Manifest URL</dt>
          <dd><code>{remoteManifestUrl}</code></dd>
        </div>
        <div>
          <dt>Remote ID</dt>
          <dd><code>{remoteModuleId}</code></dd>
        </div>
        <div>
          <dt>Host 로더</dt>
          <dd><code>apps/web/app/analytics-remote-panel.tsx</code></dd>
        </div>
        <div>
          <dt>Remote 설정</dt>
          <dd><code>apps/analytics-remote/vite.config.ts</code></dd>
        </div>
        <div>
          <dt>Remote React UI</dt>
          <dd><code>apps/analytics-remote/src/analytics-metrics.tsx</code></dd>
        </div>
      </dl>

      <p className="module-federation-note">
        검증: remote가 중단되면 오류 상태와 재시도 동작이 나타납니다. 현재 범위는 원격 지표 UI이며, 전체 화면 단위의 remote 또는 SSR Federation은 포함하지 않습니다.
      </p>
    </aside>
  );
}

function loadAnalyticsModule() {
  if (!analyticsModulePromise) {
    analyticsModulePromise = getFederationRuntime()
      .then((runtime) =>
        runtime.loadRemote<unknown>(remoteModuleId),
      )
      .then((remoteModule) => {
        if (!isAnalyticsModule(remoteModule)) {
          throw new Error("Remote analytics module shape is invalid.");
        }
        return remoteModule;
      })
      .catch((reason) => {
        analyticsModulePromise = undefined;
        throw reason;
      });
  }

  return analyticsModulePromise;
}

function getFederationRuntime() {
  runtimePromise ??= import("@module-federation/runtime").then(
    ({ createInstance }) =>
      createInstance({
        name: "citywatch_web",
        remotes: [
          {
            entry: remoteManifestUrl,
            name: "citywatch_analytics",
          },
        ],
        shared: {
          react: {
            lib: () => React,
            scope: "default",
            shareConfig: {
              requiredVersion: React.version,
              singleton: true,
            },
            version: React.version,
          },
        },
      }),
  );

  return runtimePromise;
}

function isAnalyticsModule(value: unknown): value is AnalyticsModule {
  return (
    typeof value === "object" &&
    value !== null &&
    "AnalyticsMetrics" in value &&
    typeof value.AnalyticsMetrics === "function"
  );
}

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Unknown remote load error";
}
