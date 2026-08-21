"use client";

import { Badge, XRayBox, type BadgeTone } from "@citywatch/ui";
import Link from "next/link";
import { useXRay } from "../xray-selector";

type ImplementationState = "complete" | "partial" | "planned";
type ImplementationItem = {
  evidence: string;
  href?: string;
  limit: string;
  name: string;
  state: ImplementationState;
};

const implementationItems: ImplementationItem[] = [
  {
    evidence: "Vite remote manifest와 React 분석 모듈을 Host가 런타임에 로드합니다.",
    href: "/?xray=module-federation",
    limit: "분석 모듈 하나를 분리한 학습 범위이며 SSR Federation과 다중 Remote 운영은 포함하지 않습니다.",
    name: "Module Federation",
    state: "complete",
  },
  {
    evidence: "npm Workspaces가 apps/*와 packages/*의 import·remote·network 관계를 연결합니다.",
    href: "/?xray=monorepo",
    limit: "packages/config는 실제 공유 설정 없이 자리만 준비된 상태입니다.",
    name: "Monorepo",
    state: "complete",
  },
  {
    evidence: "REST 좌표를 Feature와 VectorSource로 바꿔 OpenStreetMap Canvas에 표시합니다.",
    href: "/map?xray=openlayers",
    limit: "브라우저 전용 지도이며 오프라인 타일·공간 인덱스·대규모 운영 최적화는 포함하지 않습니다.",
    name: "OpenLayers",
    state: "complete",
  },
  {
    evidence: "선택 사고 좌표와 위험도를 R3F Canvas의 Three.js 객체로 렌더링합니다.",
    href: "/risk-3d?xray=r3f",
    limit: "선택 사고 중심의 학습 장면이며 GPU 성능 측정과 대량 3D 객체 렌더링은 증명하지 않습니다.",
    name: "R3F / Three.js",
    state: "complete",
  },
  {
    evidence: "WebSocket을 먼저 연결하고 종료되면 cursor 기반 HTTP Polling으로 이어받습니다.",
    href: "/realtime?xray=websocket",
    limit: "이벤트는 서버 메모리에만 있으며 인증·영구 저장·메시지 브로커는 구현하지 않았습니다.",
    name: "WebSocket / Polling",
    state: "complete",
  },
  {
    evidence: "GET·POST·PATCH Route Handler와 브라우저 fetch의 요청·응답 흐름을 구현했습니다.",
    href: "/incidents?xray=rest-api",
    limit: "사고 저장소는 프로세스 메모리이므로 서버 재시작 시 등록·수정 데이터가 초기화됩니다.",
    name: "REST API",
    state: "complete",
  },
  {
    evidence: "필터와 선택 사고 ID가 dispatch→reducer→selector를 거쳐 여러 화면에서 공유됩니다.",
    href: "/incidents?xray=redux",
    limit: "Redux는 관제 UI 상태만 소유하며 서버 데이터 캐시와 영구 저장은 담당하지 않습니다.",
    name: "Redux Toolkit",
    state: "complete",
  },
  {
    evidence: "사고 등록 입력을 같은 Zod schema로 브라우저와 Route Handler에서 검증합니다.",
    href: "/incidents/new?xray=zod",
    limit: "등록 계약 중심이며 모든 API 응답을 Zod schema로 파싱하는 구조는 아닙니다.",
    name: "Zod Validation",
    state: "complete",
  },
  {
    evidence: "OpenLayers Cluster와 React 가상 목록의 실제 marker·DOM 범위를 화면에 표시합니다.",
    href: "/performance?xray=performance",
    limit: "생성 fixture 기반이며 FPS·메모리·처리 시간과 실제 사용자 환경의 성능은 측정하지 않았습니다.",
    name: "Performance",
    state: "complete",
  },
  {
    evidence: "packages/ui의 Badge·SeverityBadge·X-Ray 상태를 독립 Story로 렌더링합니다.",
    limit: "공유 UI 일부만 다루며 앱 전체 페이지의 시각 회귀 테스트는 포함하지 않습니다.",
    name: "Storybook",
    state: "complete",
  },
  {
    evidence: "위험도·공유 계약·Remote 계산·WebSocket frame을 자동 테스트로 검증합니다.",
    limit: "핵심 순수 로직과 계약 위주이며 실제 브라우저 E2E 테스트는 아직 없습니다.",
    name: "Unit Test",
    state: "complete",
  },
  {
    evidence: "incident 상세 흐름이 app→widget→feature·entity Public API를 사용하고 자동 경계 검사도 통과합니다.",
    href: "/incidents/INC-001?xray=fsd-style",
    limit: "incident 핵심 slice 밖의 일부 페이지 전용 UI는 아직 Next route 폴더에 함께 있습니다.",
    name: "FSD migration coverage",
    state: "partial",
  },
  {
    evidence: "src/fsd의 pages/incident-detail→widgets/incident-detail→features/incident-control→entities/incident에 실제 slice와 Public API를 구성했습니다.",
    href: "/incidents/INC-001?xray=fsd-style",
    limit: "incident vertical slice를 기준으로 증명한 범위이며 모든 화면을 일괄 이동한 것은 아닙니다.",
    name: "정식 FSD",
    state: "complete",
  },
  {
    evidence: "23단계에서 서버 데이터 요청과 HTML 렌더링 경계를 실제 코드로 구현해야 합니다.",
    limit: "현재 주요 데이터 화면은 use client와 브라우저 fetch를 사용하므로 의미 있는 SSR 데이터 렌더링은 미증명입니다.",
    name: "의미 있는 SSR 데이터 렌더링",
    state: "planned",
  },
];

const stateMeta: Record<ImplementationState, { label: string; tone: BadgeTone }> = {
  complete: { label: "구현 완료", tone: "success" },
  partial: { label: "부분 구현", tone: "warning" },
  planned: { label: "예정 · 미증명", tone: "neutral" },
};

export default function ImplementationStatusPage() {
  const { enabled: xray } = useXRay();
  const counts = implementationItems.reduce(
    (result, item) => ({ ...result, [item.state]: result[item.state] + 1 }),
    { complete: 0, partial: 0, planned: 0 },
  );

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Implementation Status</p>
          <h1>구현 상태와 한계</h1>
        </div>
      </header>

      <XRayBox
        enabled={xray}
        label="app/status/ImplementationStatusPage"
        layer="app"
        packageName="apps/web"
        stacks={["Next App Router", "React", "TypeScript"]}
      >
        <section aria-labelledby="status-summary-title" className="dashboard implementation-status">
          <div className="panel implementation-status__intro">
            <div>
              <h2 id="status-summary-title">상태 판정 기준</h2>
              <p>
                완료는 약속한 학습 범위의 실행 화면·코드·검증 근거가 있다는 뜻이며,
                프로덕션 준비 완료를 의미하지 않습니다. 각 항목의 한계를 함께 확인합니다.
              </p>
            </div>
            <dl className="implementation-status__counts">
              <StatusCount label="완료" tone="complete" value={counts.complete} />
              <StatusCount label="부분" tone="partial" value={counts.partial} />
              <StatusCount label="예정" tone="planned" value={counts.planned} />
            </dl>
          </div>

          {(["complete", "partial", "planned"] as const).map((state) => (
            <StatusSection
              items={implementationItems.filter((item) => item.state === state)}
              key={state}
              state={state}
            />
          ))}
        </section>
      </XRayBox>
    </main>
  );
}

function StatusCount({ label, tone, value }: { label: string; tone: ImplementationState; value: number }) {
  return (
    <div data-status={tone}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function StatusSection({ items, state }: { items: ImplementationItem[]; state: ImplementationState }) {
  const meta = stateMeta[state];

  return (
    <section aria-labelledby={`implementation-${state}-title`} className="implementation-status__section">
      <div className="panel-title-row">
        <h2 id={`implementation-${state}-title`}>{meta.label}</h2>
        <Badge tone={meta.tone}>{items.length}개</Badge>
      </div>
      <div className="implementation-status__grid">
        {items.map((item) => (
          <article className="panel implementation-status__card" data-status={state} key={item.name}>
            <div className="panel-title-row">
              <h3>{item.name}</h3>
              <Badge tone={meta.tone}>{meta.label}</Badge>
            </div>
            <dl>
              <div><dt>현재 근거</dt><dd>{item.evidence}</dd></div>
              <div><dt>현재 한계</dt><dd>{item.limit}</dd></div>
            </dl>
            {item.href ? <Link className="nav-link nav-link--strong" href={item.href}>실행 화면에서 확인</Link> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
