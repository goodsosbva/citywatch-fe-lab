"use client";

import { calculateIncidentRisk, type Incident } from "@citywatch/api-types";
import { Badge, SeverityBadge } from "@citywatch/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getRiskTone,
  incidentRiskLevelLabels,
  incidentStatusLabels,
} from "../incidents/incident-format";

type VirtualIncidentListProps = {
  incidents: Incident[];
  onSelectIncident: (incidentId: string) => void;
  selectedIncidentId?: string;
};

const rowHeight = 76;
const viewportHeight = 456;
const overscan = 6;

export function VirtualIncidentList({
  incidents,
  onSelectIncident,
  selectedIncidentId,
}: VirtualIncidentListProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const range = useMemo(() => getVisibleRange(scrollTop, incidents.length), [incidents.length, scrollTop]);
  const visibleIncidents = incidents.slice(range.start, range.end);

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0 });
    setScrollTop(0);
  }, [incidents]);

  return (
    <section aria-labelledby="performance-list-title" className="performance-list">
      <div className="panel-title-row">
        <div>
          <h2 id="performance-list-title">가상 사고 목록</h2>
          <Badge tone="info">DOM {visibleIncidents.length}건</Badge>
        </div>
        <span className="performance-range" aria-live="polite">
          {range.start + 1}-{range.end} / {incidents.length.toLocaleString("ko-KR")}
        </span>
      </div>
      <div
        aria-label="가상화된 성능 시나리오 사고 목록"
        className="performance-list-viewport"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        ref={viewportRef}
        role="list"
        tabIndex={0}
      >
        <div style={{ height: incidents.length * rowHeight, position: "relative" }}>
          <ul
            className="performance-list-items"
            style={{ top: range.start * rowHeight }}
          >
            {visibleIncidents.map((incident, offset) => {
              const index = range.start + offset;
              return (
                <VirtualIncidentRow
                  incident={incident}
                  index={index}
                  key={incident.id}
                  onSelectIncident={onSelectIncident}
                  selected={incident.id === selectedIncidentId}
                  total={incidents.length}
                />
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function VirtualIncidentRow({
  incident,
  index,
  onSelectIncident,
  selected,
  total,
}: {
  incident: Incident;
  index: number;
  onSelectIncident: (incidentId: string) => void;
  selected: boolean;
  total: number;
}) {
  const risk = calculateIncidentRisk(incident);

  return (
    <li aria-posinset={index + 1} aria-setsize={total} role="listitem">
      <button
        aria-pressed={selected}
        className={`performance-list-row${selected ? " performance-list-row--selected" : ""}`}
        onClick={() => onSelectIncident(incident.id)}
        type="button"
      >
        <span className="performance-list-row__main">
          <strong>{incident.title}</strong>
          <span>{incident.id} · {incidentStatusLabels[incident.status]}</span>
        </span>
        <span className="performance-list-row__badges">
          <SeverityBadge severity={incident.severity} />
          <Badge tone={getRiskTone(risk.level)}>
            {incidentRiskLevelLabels[risk.level]} {risk.score}
          </Badge>
        </span>
      </button>
    </li>
  );
}

function getVisibleRange(scrollTop: number, total: number) {
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(
    total,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan,
  );

  return { end, start };
}
