# CityWatch FE Lab 현재 정리

이 문서는 현재까지 만든 내용을 단계 정리용 기준 문서로 남긴다. CityWatch FE Lab의 본체는 도시 안전 관제 시스템 학습이 아니라, 학습한 프론트엔드 구현을 실제 기능으로 만들고 그 근거를 X-Ray로 보여주는 사이드 프로젝트다. 도시 안전 관제는 서로 다른 기술을 하나의 제품 흐름 안에서 연결하기 위한 주제다.

## 1. 프로젝트 목적

겉으로 보이는 주제는 실시간 도시 안전 관제 대시보드다.

- 도시 사고 현황을 본다.
- 사고 심각도와 대응 상태를 본다.
- 사고 목록과 상세를 본다.
- 지도, 실시간 데이터, 3D 위험 구역을 거쳐 성능 페이지까지 확장한다.

하지만 이 프로젝트의 실제 목적은 프론트엔드 학습 결과를 작동하는 코드와 화면으로 증명하는 것이다.

면접관이나 사용자가 화면을 봤을 때 단순히 "대시보드를 만들었다"에서 끝나지 않도록 X-Ray를 둔다. X-Ray는 어떤 UI가 어느 FSD 계층, 패키지, 기술스택에서 왔는지 직접 탐색하게 하는 학습 증명 장치다.

현재 X-Ray selector는 전체, FSD-style, Module Federation 경계를 구분해 표시한다. 이후에는 같은 방식으로 다음 관점을 단계적으로 추가한다.

```txt
architecture → FSD-style UI boundary
rendering    → SSR, client boundary 등
technology   → OpenLayers, React Three Fiber, WebSocket 등
source       → local workspace, shared package, remote
delivery     → local bundle, Module Federation
```

아직 구현되지 않은 관점은 현재 기능처럼 표시하지 않는다. 실제 기술이 연결되는 단계에서 X-Ray의 선택 항목과 증명 데이터를 함께 추가한다.

예시:

```txt
app/home/HomePage
widget/SafetyOverview
entity/incident/IncidentRow
shared/ui/SeverityBadge
```

화면 라벨은 짧게 유지한다. 대신 자세한 기술 증거는 DOM 속성에 남긴다.

```txt
data-xray-layer
data-xray-label
data-xray-package
data-xray-proofs
data-xray-stacks
title
```

이렇게 하면 화면은 지저분해지지 않고, 나중에 X-Ray Inspector 패널을 만들 때 선택한 UI의 패키지와 기술스택을 보여줄 수 있다.

## 2. 현재 모노레포 구조

현재 루트는 앱이 아니라 작업장이다. 실제 실행 앱과 공유 패키지를 한 저장소에서 관리하기 위해 npm workspaces 기반 모노레포로 잡았다.

```txt
CityWatchFELab
├─ apps
│  ├─ web
│  ├─ analytics-remote
│  └─ realtime-server
├─ packages
│  ├─ api-types
│  ├─ ui
│  └─ config
├─ docs
├─ package.json
└─ package-lock.json
```

각 폴더의 현재 역할은 이렇다.

```txt
apps/web
실제 브라우저에서 실행되는 Next.js App Router 앱이다.

apps/analytics-remote
Vite로 빌드되는 Module Federation remote다. 사고 배열을 받아 분석 지표를 계산하는 순수 함수를 manifest로 공개한다.

apps/realtime-server
WebSocket/Polling 실시간 서버다. 현재는 Node 표준 `http`/`crypto`만 사용해서 `/ws`, `/events`, `/health`를 제공한다.

packages/api-types
사고, 위치, 상태, 실시간 메시지 같은 공통 타입 계약을 둔다.

packages/ui
Badge, SeverityBadge, XRayBox, XRayToggle 같은 공유 UI를 둔다.

packages/config
공유 설정이 필요해질 때 쓰기 위한 자리다. 현재는 package.json만 있는 준비 상태다.
```

중요한 점은 "폴더가 있다"와 "기능이 구현됐다"를 구분하는 것이다. 현재 `realtime-server`와 `analytics-remote`에는 실제 기능이 들어갔고, `config`만 구조상 자리만 잡힌 상태다.

## 3. 루트 package.json 세팅

현재 루트 `package.json`에는 workspaces가 있다.

```json
{
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

`private: true`는 현재 루트 패키지를 실수로 npm에 배포하지 않게 막는 안전장치다. 여기서 "루트는 배포 대상이 아니다"라는 말은 기술적으로 강제된 법칙이 아니라, 현재 프로젝트 구조상 루트가 실제 앱 코드가 아니라 workspace 묶음 역할을 하기 때문에 그렇게 설계했다는 뜻이다.

현재 루트 scripts는 다음 흐름을 만든다.

```txt
npm run dev:web
→ @citywatch/web workspace의 dev 실행

npm run typecheck
→ 모든 workspace의 typecheck 실행

npm run build
→ 모든 workspace의 build 실행, 있는 경우만 실행

npm run test
→ 모든 workspace의 test 실행, 있는 경우만 실행
```

`dev:realtime`은 `@citywatch/realtime-server`의 Node 서버를 실행하고, `dev:remote`는 `@citywatch/analytics-remote`의 Vite 개발 서버를 3002번 포트에서 실행한다.

## 4. 현재 구현된 패키지

### apps/web

`apps/web`은 Next.js App Router 기반 host 앱이다.

현재 핵심 파일은 다음과 같다.

```txt
apps/web/app/layout.tsx
apps/web/app/page.tsx
apps/web/app/shell.tsx
apps/web/app/globals.css
apps/web/app/risk-3d/page.tsx
apps/web/app/risk-3d/risk-zone-scene.tsx
apps/web/next.config.ts
apps/web/package.json
```

`apps/web/package.json`에는 실제 실행 스크립트가 있다.

```txt
npm --workspace @citywatch/web run dev
→ next dev --hostname 127.0.0.1 --port 3000
```

루트에서 실행할 때는 다음 명령을 쓴다.

```bash
npm run dev:web
```

### packages/api-types

관제 시스템에서 공유할 타입을 둔다.

현재 대표 타입은 다음과 같다.

```txt
Incident
IncidentSeverity
IncidentStatus
IncidentCategory
Coordinates
RealtimeMessage
CreateIncidentInput
UpdateIncidentStatusInput
```

REST API 응답과 실시간 서버 payload는 이 타입 계약과 런타임 타입 가드를 기준으로 검증한다.

### apps/analytics-remote

`apps/analytics-remote`는 Vite 기반 Module Federation provider다.

```txt
apps/analytics-remote/vite.config.ts
apps/analytics-remote/src/incident-analytics.ts
apps/analytics-remote/src/incident-analytics.test.ts
apps/analytics-remote/src/analytics-metrics.tsx
apps/web/app/analytics-remote-panel.tsx
```

remote는 `./analytics-metrics`를 공개하고 host는 `mf-manifest.json`을 읽어 `citywatch_analytics/analytics-metrics`를 런타임에 불러온다. 원격 모듈은 분석 계산과 지표 React UI를 함께 제공하고, Host는 원격 로드 상태와 페이지 조립을 담당한다.

### packages/ui

공유 UI와 X-Ray 표시 시스템을 둔다.

현재 들어있는 UI는 다음과 같다.

```txt
Badge
SeverityBadge
XRayBox
XRayToggle
```

`SeverityBadge`는 사고 심각도 값을 받아 화면 배지로 보여준다.

```txt
critical → 긴급
high → 높음
medium → 보통
low → 낮음
```

`XRayBox`는 감싼 UI 영역에 테두리와 라벨을 표시한다. `XRayToggle`은 이 표시 모드를 켜고 끈다.

## 5. 현재 화면 구현

현재 `/` 홈 화면은 관제 홈이다.

화면 구성은 이렇다.

```txt
상단 헤더
→ CityWatch FE Lab
→ X-Ray 토글

관제 요약
→ 전체 사고
→ 긴급 사고
→ 대응 중
→ 영향 인원

최근 사고 목록
→ 사고 제목
→ 사고 설명
→ 심각도 배지
```

현재 화면 데이터는 `apps/web/app/api/incidents/*`의 REST API를 통해 읽는다. 홈, 목록, 상세 화면은 `fetch` 기반 client API를 사용하고, 사고 상태 변경은 `PATCH /api/incidents/[id]/status`로 처리한다.

사고 목록의 검색/심각도/상태/지역 필터와 선택 사고 ID는 Redux Toolkit으로 공유한다. Redux에는 관제 UI 상태만 올리고, 사고 목록 데이터 자체는 기존 REST API 응답을 화면 local state에 둔다.

`/risk-3d`는 REST 사고 좌표와 OpenStreetMap 타일을 같은 Web Mercator 좌표로 변환한다. 실제 도로 지도 위에서 위험 점수는 기둥 높이, 위험 단계는 색상으로 표시하며 3D 기둥과 키보드 버튼은 Redux의 `selectedIncidentId`를 공유한다.

즉 현재 단계에서 중요한 것은 "실제 서버 데이터"가 아니라, 화면 구조와 타입 계약을 먼저 잡은 것이다.

## 6. Next.js App Router 원리 정리

현재 프로젝트에서 `/` 요청이 들어오면 Next가 파일 시스템 라우터를 돌면서 `layout.tsx`와 `page.tsx`를 자동으로 합성한다.

사람이 `layout.tsx`를 직접 import해서 감싸는 게 아니다.

현재 구조는 이렇다.

```txt
apps/web/app
├─ layout.tsx
├─ page.tsx
└─ shell.tsx
```

`GET /` 요청 흐름은 개념적으로 이렇게 이해하면 된다.

```txt
요청: GET /

Next 라우터가 경로 계산
→ / 에 해당하는 파일 찾음
→ app/page.tsx 발견
→ 그 page가 속한 상위 layout 찾음
→ app/layout.tsx 발견
→ Next가 내부적으로 조립
```

개념상 조립 결과는 이렇다.

```tsx
<RootLayout>
  <HomePage />
</RootLayout>
```

현재 `layout.tsx`는 이런 역할을 한다.

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

여기서 `children` 자리에 들어가는 것이 현재 라우트의 `page.tsx` 결과다.

현재 `page.tsx`는 다음 흐름이다.

```tsx
export default function HomePage() {
  return <CityWatchShell />;
}
```

그래서 `/` 요청의 최종 구조는 개념적으로 이렇게 된다.

```tsx
<html lang="ko">
  <body>
    <CityWatchShell />
  </body>
</html>
```

핵심 원리는 다음 다섯 줄이다.

```txt
1. Next는 app 폴더를 라우트 트리로 읽는다.
2. page.tsx는 실제 URL에 매칭되는 leaf node다.
3. layout.tsx는 그 page를 감싸는 parent node다.
4. page 결과가 layout의 children으로 들어간다.
5. 이 조립은 Next가 빌드/런타임에서 자동으로 한다.
```

중첩 라우트가 있으면 layout도 중첩된다.

예를 들어 나중에 구조가 이렇게 되면:

```txt
app
├─ layout.tsx
├─ page.tsx
└─ incidents
   ├─ layout.tsx
   └─ page.tsx
```

`/incidents` 요청은 개념적으로 이렇게 조립된다.

```tsx
<AppRootLayout>
  <IncidentsLayout>
    <IncidentsPage />
  </IncidentsLayout>
</AppRootLayout>
```

현재 프로젝트의 `/`는 중간 layout이 없으므로 단순하다.

```txt
app/layout.tsx
└─ app/page.tsx
   └─ CityWatchShell
```

최종 한 줄 정리:

```txt
layout.tsx는 Next가 app 라우트 트리를 분석해서 page.tsx를 children으로 넘겨 자동으로 감싸는 부모 컴포넌트다.
```

## 7. 실제 실행 흐름

개발 서버 실행:

```bash
npm run dev:web
```

내부 흐름:

```txt
npm run dev:web
→ npm --workspace @citywatch/web run dev
→ next dev --hostname 127.0.0.1 --port 3000
→ http://127.0.0.1:3000
```

Module Federation remote 실행:

```bash
npm run dev:remote
```

내부 흐름:

```txt
npm run dev:remote
→ @citywatch/analytics-remote의 Vite 개발 서버 실행
→ http://127.0.0.1:3002/mf-manifest.json 공개
→ web host가 manifest에서 원격 모듈 위치 확인
→ 원격 분석 함수를 로드하고 기존 REST 사고 데이터를 전달
```

타입 검증:

```bash
npm run typecheck
```

내부 흐름:

```txt
npm run typecheck
→ npm run typecheck --workspaces --if-present
→ @citywatch/web typecheck
→ @citywatch/api-types typecheck
→ @citywatch/ui typecheck
```

빌드 검증:

```bash
npm --workspace @citywatch/web run build
```

이 명령은 Next 앱이 실제 production build 단계에서도 깨지지 않는지 확인한다.

## 8. 현재까지 검증된 것

현재 확인한 검증 결과는 다음과 같다.

```txt
npm run typecheck 통과
npm run test 통과
npm --workspace @citywatch/web run build 통과
http://127.0.0.1:3000 브라우저 확인
X-Ray 라벨 DOM 확인 완료
Module Federation manifest와 remote 함수 로드 확인
remote 분석 수치와 X-Ray `remote` 경계 확인
http://127.0.0.1:3000/map 브라우저 확인
OpenLayers 지도와 사고 마커 확인
http://127.0.0.1:3000/risk-3d 브라우저 확인
R3F 캔버스와 선택 사고 중심 실제 위치 지도, 모바일 배치 확인
```

X-Ray 라벨은 화면에서 짧은 FSD 경로만 보인다.

```txt
app/home/HomePage
widget/SafetyOverview
entity/incident/IncidentMetric
widget/RecentIncidents
entity/incident/IncidentRow
shared/ui/SeverityBadge
remote/analytics/AnalyticsMetrics
```

패키지명과 기술스택은 화면 라벨에는 직접 섞지 않는다. 대신 DOM 속성에 남긴다.

## 9. 17단계 진행표

현재 로드맵은 17단계까지 완료했다. 모노레포 세팅은 0단계 선행 작업으로 둔다.

```txt
0. Monorepo workspace 세팅 - 완료
1. apps/web 생성 - 완료
2. X-Ray Box + X-Ray toggle - 완료
3. / 대시보드 - 완료
4. /incidents 목록/상세 - 완료
5. REST API - 완료
6. create form + validation/accessibility - 완료
7. Unit Test / TDD 위험도 계산 - 완료
8. Redux 상태 공유 - 완료
9. OpenLayers 지도 관제 - 완료
10. WebSocket/Polling 실시간 처리 - 완료
11. R3F 3D 위험 구역 - 완료
12. performance page 대량 데이터 관제 - 완료
13. Storybook UI 증명 - 완료
14. realtime-server 분리 - 완료
15. analytics-remote + Module Federation - 완료
16. X-Ray selector 기본형 - 완료
17. Module Federation 시범 필터 - 완료
```

`apps/realtime-server`는 독립 workspace와 프로세스로 구현되어 있다. `apps/analytics-remote`는 독립 Vite remote로 구현되어 있고, `packages/config`만 이후 단계를 위한 준비 상태다.

## 10. 앞으로 단계 정리할 때 쓸 형식

앞으로 각 단계를 끝낼 때는 아래 형식으로 정리한다.

```txt
1. 지금까지 한 것
2. 이번에 구현한 것
3. 왜 이걸 했는지
4. 어떻게 세팅했는지
5. 실제로 동작시키면 어떤 흐름인지
6. 검증 결과
7. 아직 안 한 것
```

이 형식을 유지하는 이유는 학습 복습과 면접 설명을 동시에 만족시키기 위해서다.

단순히 "무엇을 만들었다"가 아니라 다음까지 설명할 수 있어야 한다.

```txt
왜 이 구조가 필요한가?
어떤 파일에서 어떤 설정을 했는가?
명령을 실행하면 내부적으로 어떤 흐름이 도는가?
현재 된 것과 아직 안 된 것은 무엇인가?
```

이 프로젝트는 학습 결과를 실제 기능과 X-Ray로 보여주는 사이드 프로젝트다. 화면의 증명 근거를 코드와 문서에서도 추적할 수 있어야 하므로 구현과 기록이 같이 가야 한다.
