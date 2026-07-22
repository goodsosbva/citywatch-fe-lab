"use client";

import type { Incident } from "@citywatch/api-types";
import { Badge, XRayBox } from "@citywatch/ui";
import { useEffect, useState, type ComponentType } from "react";
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

let runtimePromise: Promise<FederationRuntime> | undefined;
let analyticsModulePromise: Promise<AnalyticsModule> | undefined;

export function AnalyticsRemotePanel({ incidents }: { incidents: Incident[] }) {
  const { enabled: xray, mode } = useXRay(["module-federation"]);
  const [loadRun, setLoadRun] = useState(0);
  const [state, setState] = useState<AnalyticsState>({ status: "loading" });

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
      label="remote/analytics/AnalyticsMetrics"
      layer="remote"
      packageName="apps/analytics-remote"
      proofs={["module-federation"]}
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
          <span className="remote-source">apps/analytics-remote · 3002</span>
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

        {AnalyticsMetrics ? <AnalyticsMetrics incidents={incidents} /> : null}

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
        Next.js host가 Vite remote의 React 지표 컴포넌트를 실행 중에 불러와 렌더링합니다.
      </p>

      <ol className="module-federation-flow">
        <li><code>mf-manifest.json</code>에서 remote 진입점을 확인합니다.</li>
        <li><code>citywatch_analytics/analytics-metrics</code> 모듈을 불러옵니다.</li>
        <li>remote의 <code>AnalyticsMetrics</code>가 계산과 지표 렌더링을 담당합니다.</li>
      </ol>

      <dl className="module-federation-code">
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
        runtime.loadRemote<unknown>("citywatch_analytics/analytics-metrics"),
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
