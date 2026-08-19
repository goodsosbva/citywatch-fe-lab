"use client";

import { Badge } from "@citywatch/ui";
import { usePathname } from "next/navigation";
import { useXRay } from "./xray-selector";

export function MonorepoWorkspaceMap() {
  const pathname = usePathname();
  const { mode } = useXRay();

  if (mode !== "monorepo") return null;

  const pageName = getPageName(pathname);
  const usesAnalyticsRemote = pathname === "/";
  const usesRealtimeServer = pathname === "/realtime";

  return (
    <div className="shell monorepo-global">
      <aside aria-labelledby="monorepo-evidence-title" className="panel monorepo-evidence">
        <div className="panel-title-row">
          <div>
            <p className="eyebrow">Repository Architecture · {pageName}</p>
            <h2 id="monorepo-evidence-title">Monorepo Workspace Map</h2>
          </div>
          <Badge tone="success">npm workspaces</Badge>
        </div>

        <p>현재 페이지의 Host는 <code>apps/web</code>이며, 아래 workspace를 직접 가져오거나 실행 중에 연결합니다.</p>

        <section className="monorepo-page-sources" aria-labelledby="monorepo-page-sources-title">
          <h3 id="monorepo-page-sources-title">현재 페이지 출처 · {pageName}</h3>
          <ul>
            <li>
              <strong>{pageName} 라우트·상태·사용자 동작</strong>
              <span className="workspace-source workspace-source--app">소유 apps/web</span>
            </li>
            <li>
              <strong>Badge·SeverityBadge·X-Ray 경계</strong>
              <span className="workspace-source workspace-source--package">UI packages/ui</span>
            </li>
            <li>
              <strong>공유 데이터 계약·검증·계산</strong>
              <span className="workspace-source workspace-source--contract">계약 packages/api-types</span>
            </li>
            {usesAnalyticsRemote ? (
              <li>
                <strong>원격 사고 분석 지표</strong>
                <span className="workspace-source workspace-source--app">Host apps/web</span>
                <span className="workspace-source workspace-source--remote">Remote apps/analytics-remote</span>
              </li>
            ) : null}
            {usesRealtimeServer ? (
              <li>
                <strong>WebSocket 이벤트·HTTP polling</strong>
                <span className="workspace-source workspace-source--app">Client apps/web</span>
                <span className="workspace-source workspace-source--remote">Server apps/realtime-server</span>
              </li>
            ) : null}
          </ul>
        </section>

        <div className="monorepo-map" aria-label="CityWatch 모노레포 workspace 구조">
          <div className="monorepo-root">
            <span>Repository root</span>
            <strong>city-watch-fe-lab</strong>
            <code>package.json · workspaces: apps/*, packages/*</code>
          </div>

          <div className="monorepo-workspace-columns">
            <section className="monorepo-workspace-group monorepo-workspace-group--apps" aria-labelledby="monorepo-apps-title">
              <h3 id="monorepo-apps-title">apps/* · 실행 단위</h3>
              <div className="monorepo-workspace-card monorepo-workspace-card--current">
                <div><code>apps/web</code><span>Next.js Host</span></div>
                <strong>현재 화면</strong>
              </div>
              <div className={`monorepo-workspace-card${usesAnalyticsRemote ? " monorepo-workspace-card--current" : ""}`}>
                <div><code>apps/analytics-remote</code><span>Vite federated remote</span></div>
                {usesAnalyticsRemote ? <strong>현재 연결</strong> : null}
              </div>
              <div className={`monorepo-workspace-card${usesRealtimeServer ? " monorepo-workspace-card--current" : ""}`}>
                <div><code>apps/realtime-server</code><span>WebSocket / HTTP server</span></div>
                {usesRealtimeServer ? <strong>현재 연결</strong> : null}
              </div>
            </section>

            <section className="monorepo-workspace-group monorepo-workspace-group--packages" aria-labelledby="monorepo-packages-title">
              <h3 id="monorepo-packages-title">packages/* · 공유 단위</h3>
              <div className="monorepo-workspace-card monorepo-workspace-card--current">
                <div><code>packages/ui</code><span>Badge · SeverityBadge · XRayBox</span></div>
                <strong>현재 사용</strong>
              </div>
              <div className="monorepo-workspace-card monorepo-workspace-card--current">
                <div><code>packages/api-types</code><span>Incident · Zod schema · runtime guards</span></div>
                <strong>현재 사용</strong>
              </div>
            </section>
          </div>
        </div>

        <ul className="monorepo-relations">
          <li><code>apps/web</code><span>workspace import →</span><code>packages/ui</code></li>
          <li><code>apps/web</code><span>workspace import →</span><code>packages/api-types</code></li>
          {usesAnalyticsRemote ? <li><code>apps/web</code><span>runtime remote →</span><code>apps/analytics-remote</code></li> : null}
          {usesRealtimeServer ? <li><code>apps/web</code><span>WebSocket / HTTP →</span><code>apps/realtime-server</code></li> : null}
        </ul>

        <dl className="monorepo-code">
          <div>
            <dt>Workspace 설정</dt>
            <dd><code>workspaces: [&quot;apps/*&quot;, &quot;packages/*&quot;]</code></dd>
          </div>
          <div>
            <dt>공유 타입 import</dt>
            <dd><code>import type &#123; Incident &#125; from &quot;@citywatch/api-types&quot;;</code></dd>
          </div>
          <div>
            <dt>공유 UI import</dt>
            <dd><code>import &#123; Badge, XRayBox &#125; from &quot;@citywatch/ui&quot;;</code></dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function getPageName(pathname: string) {
  if (pathname === "/") return "관제 홈";
  if (pathname === "/incidents/new") return "사고 등록";
  if (pathname.startsWith("/incidents/")) return "사고 상세";
  if (pathname === "/incidents") return "사고 목록";
  if (pathname === "/map") return "지도 관제";
  if (pathname === "/risk-3d") return "3D 위험 구역";
  if (pathname === "/realtime") return "실시간 피드";
  if (pathname === "/performance") return "대량 관제";
  return pathname;
}
