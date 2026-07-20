"use client";

import type { Incident } from "@citywatch/api-types";
import { Badge, XRayBox } from "@citywatch/ui";
import { useEffect, useState } from "react";

type AnalyticsSnapshot = {
  averageAffectedPeople: number;
  highRisk: number;
  resolutionRate: number;
  total: number;
};

type AnalyticsModule = {
  calculateIncidentAnalytics: (incidents: readonly Incident[]) => unknown;
};

type AnalyticsState =
  | { status: "loading" }
  | { message: string; status: "error" }
  | { snapshot: AnalyticsSnapshot; status: "ready" };

type FederationRuntime = {
  loadRemote: <T>(id: string) => Promise<T | null>;
};

const remoteManifestUrl =
  process.env.NEXT_PUBLIC_ANALYTICS_REMOTE_URL ??
  "http://127.0.0.1:3002/mf-manifest.json";

let runtimePromise: Promise<FederationRuntime> | undefined;
let analyticsModulePromise: Promise<AnalyticsModule> | undefined;

export function AnalyticsRemotePanel({
  incidents,
  xray,
}: {
  incidents: Incident[];
  xray: boolean;
}) {
  const [loadRun, setLoadRun] = useState(0);
  const [state, setState] = useState<AnalyticsState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    setState({ status: "loading" });

    void loadAnalyticsModule()
      .then((remoteModule) => remoteModule.calculateIncidentAnalytics(incidents))
      .then((snapshot) => {
        if (!isAnalyticsSnapshot(snapshot)) {
          throw new Error("Remote analytics result shape is invalid.");
        }
        if (active) setState({ snapshot, status: "ready" });
      })
      .catch((reason) => {
        if (active) setState({ message: getErrorMessage(reason), status: "error" });
      });

    return () => {
      active = false;
    };
  }, [incidents, loadRun]);

  return (
    <XRayBox
      enabled={xray}
      label="remote/analytics/CalculateIncidentAnalytics"
      layer="remote"
      packageName="apps/analytics-remote"
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

        {state.status === "ready" ? (
          <div className="metric-grid">
            <AnalyticsMetric title="분석 대상" value={state.snapshot.total} />
            <AnalyticsMetric title="고위험 사고" tone="danger" value={state.snapshot.highRisk} />
            <AnalyticsMetric title="해결률" tone="success" unit="%" value={state.snapshot.resolutionRate} />
            <AnalyticsMetric
              title="평균 영향 인원"
              tone="info"
              unit="명"
              value={state.snapshot.averageAffectedPeople}
            />
          </div>
        ) : null}
      </section>
    </XRayBox>
  );
}

function AnalyticsMetric({
  title,
  tone = "neutral",
  unit,
  value,
}: {
  title: string;
  tone?: "neutral" | "info" | "success" | "danger";
  unit?: string;
  value: number;
}) {
  return (
    <article className={`metric metric--${tone}`}>
      <span>{title}</span>
      <strong>
        {value}
        {unit}
      </strong>
    </article>
  );
}

function loadAnalyticsModule() {
  if (!analyticsModulePromise) {
    analyticsModulePromise = getFederationRuntime()
      .then((runtime) =>
        runtime.loadRemote<unknown>("citywatch_analytics/incident-analytics"),
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
      }),
  );

  return runtimePromise;
}

function isAnalyticsModule(value: unknown): value is AnalyticsModule {
  return (
    typeof value === "object" &&
    value !== null &&
    "calculateIncidentAnalytics" in value &&
    typeof value.calculateIncidentAnalytics === "function"
  );
}

function isAnalyticsSnapshot(value: unknown): value is AnalyticsSnapshot {
  if (typeof value !== "object" || value === null) return false;

  return ["averageAffectedPeople", "highRisk", "resolutionRate", "total"].every(
    (key) => key in value && typeof value[key as keyof typeof value] === "number",
  );
}

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Unknown remote load error";
}
