import type { Incident } from "@citywatch/api-types";
import * as React from "react";
import { calculateIncidentAnalytics } from "./incident-analytics";

export function AnalyticsMetrics({ incidents }: { incidents: readonly Incident[] }) {
  const snapshot = calculateIncidentAnalytics(incidents);

  return (
    <div className="metric-grid">
      <article className="metric metric--neutral">
        <span>분석 대상</span>
        <strong>{snapshot.total}</strong>
      </article>
      <article className="metric metric--danger">
        <span>고위험 사고</span>
        <strong>{snapshot.highRisk}</strong>
      </article>
      <article className="metric metric--success">
        <span>해결률</span>
        <strong>{snapshot.resolutionRate}%</strong>
      </article>
      <article className="metric metric--info">
        <span>평균 영향 인원</span>
        <strong>{snapshot.averageAffectedPeople}명</strong>
      </article>
    </div>
  );
}
