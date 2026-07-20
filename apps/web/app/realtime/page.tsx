"use client";

import {
  isRealtimeEvent,
  isRealtimeEventListResponse,
  type RealtimeEvent,
  type RealtimeMessage,
} from "@citywatch/api-types";
import { Badge, XRayBox, XRayToggle, type BadgeTone } from "@citywatch/ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { incidentStatusLabels } from "../incidents/incident-format";

type ConnectionMode = "connecting" | "websocket" | "polling" | "offline";

type ConnectionState = {
  detail: string;
  mode: ConnectionMode;
};

type RealtimeUrls = {
  polling: string;
  websocket: string;
};

const maxVisibleEvents = 12;

export default function RealtimePage() {
  const [xray, setXray] = useState(true);
  const [connection, setConnection] = useState<ConnectionState>({
    detail: "실시간 서버 연결을 준비합니다.",
    mode: "connecting",
  });
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [error, setError] = useState<string>();
  const [urls, setUrls] = useState<RealtimeUrls>();
  const [connectionRun, setConnectionRun] = useState(0);
  const lastEventIdRef = useRef(0);

  useEffect(() => {
    let disposed = false;
    let pollingTimer: ReturnType<typeof setTimeout> | undefined;
    let socket: WebSocket | undefined;
    const nextUrls = getRealtimeUrls();

    setUrls(nextUrls);
    setConnection({
      detail: "WebSocket 연결을 시도합니다.",
      mode: "connecting",
    });

    function recordEvents(nextEvents: RealtimeEvent[]) {
      const lastEventId = lastEventIdRef.current;
      const uniqueEvents = nextEvents.filter((event) => event.id > lastEventId);

      if (uniqueEvents.length === 0) return;

      lastEventIdRef.current = Math.max(
        lastEventId,
        ...uniqueEvents.map((event) => event.id),
      );

      setEvents((current) =>
        [...uniqueEvents.sort((a, b) => b.id - a.id), ...current].slice(
          0,
          maxVisibleEvents,
        ),
      );
    }

    async function pollEvents() {
      if (disposed) return;

      try {
        const response = await fetch(
          `${nextUrls.polling}?after=${lastEventIdRef.current}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error(`Polling failed: HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!isRealtimeEventListResponse(data)) {
          throw new Error("Polling response shape is invalid.");
        }

        recordEvents(data.events);
        setConnection({
          detail: "WebSocket 대신 HTTP polling으로 실시간 갱신 중입니다.",
          mode: "polling",
        });
        setError(undefined);
      } catch (reason) {
        setConnection({
          detail: getErrorMessage(reason),
          mode: "offline",
        });
        setError(getErrorMessage(reason));
      } finally {
        if (!disposed) pollingTimer = setTimeout(pollEvents, 3000);
      }
    }

    function startPolling(detail: string) {
      setConnection({ detail, mode: "polling" });
      void pollEvents();
    }

    try {
      socket = new WebSocket(nextUrls.websocket);
    } catch (reason) {
      startPolling(getErrorMessage(reason));
      return () => {
        disposed = true;
        if (pollingTimer) clearTimeout(pollingTimer);
      };
    }

    socket.onopen = () => {
      setConnection({
        detail: "WebSocket으로 실시간 이벤트를 수신 중입니다.",
        mode: "websocket",
      });
      setError(undefined);
    };

    socket.onmessage = (event) => {
      const realtimeEvent = parseRealtimeEvent(event.data);
      if (!realtimeEvent) {
        setError("WebSocket message shape is invalid.");
        return;
      }

      recordEvents([realtimeEvent]);
    };

    socket.onclose = () => {
      if (!disposed) {
        startPolling("WebSocket 연결이 닫혀 polling fallback으로 전환했습니다.");
      }
    };

    socket.onerror = () => {
      setError("WebSocket 연결에 실패했습니다. 연결 종료 후 polling으로 전환합니다.");
    };

    return () => {
      disposed = true;
      socket?.close();
      if (pollingTimer) clearTimeout(pollingTimer);
    };
  }, [connectionRun]);

  function reconnect() {
    lastEventIdRef.current = 0;
    setEvents([]);
    setError(undefined);
    setConnectionRun((value) => value + 1);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Realtime Control</p>
          <h1>실시간 사고 피드</h1>
        </div>
        <div className="topbar-actions">
          <Link className="nav-link nav-link--strong" href="/map">
            지도 관제
          </Link>
          <Link className="nav-link nav-link--strong" href="/risk-3d">
            3D 위험 구역
          </Link>
          <Link className="nav-link" href="/incidents">
            사고 목록
          </Link>
          <Link className="nav-link" href="/">
            관제 홈
          </Link>
          <XRayToggle enabled={xray} onChange={setXray} />
        </div>
      </header>

      <XRayBox
        enabled={xray}
        label="app/realtime/RealtimePage"
        layer="app"
        packageName="apps/web"
        stacks={["Next App Router", "React", "TypeScript"]}
      >
        <section aria-label="실시간 사고 피드" className="dashboard">
          <XRayBox
            enabled={xray}
            label="widget/RealtimeConnectionSummary"
            packageName="apps/web"
            stacks={["WebSocket", "Polling", "Shared Types"]}
          >
            <div className="panel metric-grid">
              <RealtimeMetric
                title="연결 모드"
                value={getConnectionLabel(connection.mode)}
                tone={getConnectionTone(connection.mode)}
              />
              <RealtimeMetric title="수신 이벤트" value={String(events.length)} tone="info" />
              <RealtimeMetric title="마지막 ID" value={String(lastEventIdRef.current || "-")} />
              <RealtimeMetric
                title="Fallback"
                value={connection.mode === "polling" ? "On" : "Ready"}
                tone={connection.mode === "polling" ? "warning" : "neutral"}
              />
            </div>
          </XRayBox>

          <div className="realtime-layout">
            <XRayBox
              enabled={xray}
              label="widget/RealtimeFeed"
              packageName="apps/web"
              stacks={["WebSocket lifecycle", "fetch", "Polling fallback", "cleanup"]}
            >
              <section className="panel realtime-feed" aria-labelledby="realtime-feed-title">
                <div className="panel-title-row">
                  <div>
                    <h2 id="realtime-feed-title">이벤트 스트림</h2>
                    <Badge tone={getConnectionTone(connection.mode)}>
                      {getConnectionLabel(connection.mode)}
                    </Badge>
                  </div>
                  <button className="secondary-button" onClick={reconnect} type="button">
                    재연결
                  </button>
                </div>

                <p className="redux-proof" aria-live="polite">
                  <span>{connection.detail}</span>
                  {urls ? <span>WS {urls.websocket}</span> : null}
                  {urls ? <span>Poll {urls.polling}</span> : null}
                </p>

                {error ? (
                  <p className="state-message state-message--error" role="alert">
                    {error}
                  </p>
                ) : null}

                <XRayBox
                  enabled={xray}
                  label="feature/realtime/ValidateRealtimeEvents"
                  packageName="packages/api-types"
                  stacks={["Runtime validation", "TypeScript"]}
                >
                  {events.length === 0 ? (
                    <p className="state-message" role="status">
                      수신된 이벤트가 아직 없습니다. realtime 서버가 켜져 있으면 곧 heartbeat가 표시됩니다.
                    </p>
                  ) : (
                    <ol className="realtime-event-list" aria-live="polite">
                      {events.map((event) => (
                        <RealtimeEventRow event={event} key={event.id} />
                      ))}
                    </ol>
                  )}
                </XRayBox>
              </section>
            </XRayBox>

            <XRayBox
              enabled={xray}
              label="entity/realtime/RealtimeProof"
              packageName="packages/api-types"
              stacks={["RealtimeEvent", "RealtimeMessage"]}
            >
              <aside className="panel realtime-proof" aria-labelledby="realtime-proof-title">
                <h2 id="realtime-proof-title">10·14단계 증명</h2>
                <dl className="detail-grid map-detail-grid">
                  <ProofItem label="WebSocket" value="/ws 연결 후 이벤트 수신" />
                  <ProofItem label="Polling" value="/events?after=id fallback" />
                  <ProofItem label="검증" value="isRealtimeEventListResponse" />
                  <ProofItem label="서버" value="apps/realtime-server 독립 workspace" />
                </dl>
              </aside>
            </XRayBox>
          </div>
        </section>
      </XRayBox>
    </main>
  );
}

function RealtimeMetric({
  title,
  tone = "neutral",
  value,
}: {
  title: string;
  tone?: BadgeTone;
  value: string;
}) {
  return (
    <article className={`metric metric--${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

function RealtimeEventRow({ event }: { event: RealtimeEvent }) {
  return (
    <li className="realtime-event-card">
      <div>
        <strong>{getRealtimeEventTitle(event.message)}</strong>
        <span>{formatRealtimeDate(event.message.sentAt)}</span>
      </div>
      <Badge tone={getRealtimeEventTone(event.message)}>{event.message.type}</Badge>
    </li>
  );
}

function ProofItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function parseRealtimeEvent(value: string) {
  try {
    const data = JSON.parse(value);
    return isRealtimeEvent(data) ? data : undefined;
  } catch {
    return undefined;
  }
}

function getRealtimeUrls(): RealtimeUrls {
  const host = window.location.hostname || "127.0.0.1";
  return {
    polling:
      process.env.NEXT_PUBLIC_REALTIME_POLL_URL ?? `http://${host}:3001/events`,
    websocket:
      process.env.NEXT_PUBLIC_REALTIME_WS_URL ?? `ws://${host}:3001/ws`,
  };
}

function getConnectionLabel(mode: ConnectionMode) {
  if (mode === "websocket") return "WebSocket";
  if (mode === "polling") return "Polling";
  if (mode === "offline") return "Offline";
  return "Connecting";
}

function getConnectionTone(mode: ConnectionMode): BadgeTone {
  if (mode === "websocket") return "success";
  if (mode === "polling") return "warning";
  if (mode === "offline") return "danger";
  return "info";
}

function getRealtimeEventTitle(message: RealtimeMessage) {
  if (message.type === "heartbeat") return "서버 heartbeat 수신";
  if (message.type === "incident.statusChanged") {
    return `${message.incidentId} 상태 변경: ${incidentStatusLabels[message.status]}`;
  }
  return `${message.incident.id} 사고 이벤트`;
}

function getRealtimeEventTone(message: RealtimeMessage): BadgeTone {
  if (message.type === "heartbeat") return "neutral";
  if (message.type === "incident.statusChanged") return "warning";
  return "info";
}

function formatRealtimeDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "실시간 연결에 실패했습니다.";
}
