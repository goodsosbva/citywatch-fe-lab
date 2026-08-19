# 22. Monorepo Workspace Map

## 1. 무엇을 개선했는가

기존 Monorepo X-Ray는 최근 사고 영역 전체를 다음 경계로 감쌌다.

```txt
package/ui/SharedComponents
└─ entity/incident/IncidentRows
```

이 표시는 `packages/ui`의 공유 컴포넌트 사용은 알려 주지만 Monorepo의 핵심인 저장소 루트, 여러 workspace, workspace 사이 관계를 보여 주지 못했다. 또한 최근 사고 section과 REST 처리처럼 `apps/web`이 소유한 코드까지 `packages/ui` 영역처럼 보이게 했다.

개선 후에는 해당 테두리를 제거하고 다음 구조를 한 화면에 표시한다.

```txt
city-watch-fe-lab
└─ package.json · npm workspaces
   ├─ apps/*
   │  ├─ apps/web                  현재 Next.js Host
   │  ├─ apps/analytics-remote     Vite federated remote
   │  └─ apps/realtime-server      WebSocket / HTTP server
   └─ packages/*
      ├─ packages/ui               공유 React UI
      └─ packages/api-types        공유 타입과 실행 중 검증
```

## 2. 왜 테두리 하나로는 Monorepo를 설명할 수 없는가

Monorepo는 화면 렌더링 기술이 아니다. 하나의 저장소가 여러 실행 앱과 공유 패키지를 함께 관리하는 저장소 구조다.

```txt
FSD X-Ray
→ DOM 영역이 어떤 UI 책임 계층에 속하는지 표시

Monorepo
→ 소스 코드가 어떤 workspace에 속하고 서로 어떻게 연결되는지 표시
```

따라서 화면 section 전체에 `package/ui` 테두리를 그리면 다음과 같은 잘못된 해석이 생긴다.

```txt
최근 사고 section 전체가 packages/ui 소유인가?
REST 요청도 packages/ui에서 실행하는가?
IncidentRow도 packages/ui에서 export하는가?
```

실제 책임은 다음과 같다.

```txt
apps/web
→ 최근 사고 section 조립
→ REST 요청과 loading/error 처리
→ Link와 IncidentRow 렌더링

packages/ui
→ Badge
→ SeverityBadge
→ XRayBox

packages/api-types
→ Incident 타입
→ Zod schema
→ runtime guard
```

그래서 Monorepo mode에서는 DOM 소유권을 과장하는 테두리 대신 workspace 구조도를 사용한다.

## 3. selector에서 화면까지 흐름

사용자가 `Monorepo`를 선택한다.

```txt
X-Ray select onChange
→ setMode("monorepo")
→ URL에 ?xray=monorepo 기록
→ 현재 pathname 유지
→ 공통 layout의 MonorepoWorkspaceMap이 mode와 pathname을 읽음
```

공통 `layout.tsx`는 모든 라우트의 관제 콘텐츠가 끝난 뒤 Workspace Map을 렌더링할 자리를 제공한다. 주제인 관제 화면이 먼저 나오고 저장소 설명은 뒤에서 보조한다. 컴포넌트 내부에서는 정확한 mode가 아닐 때 `null`을 반환한다.

```tsx
<AppNavigation />
{children}
<MonorepoWorkspaceMap />
```

선택 시에도 이동하지 않고, 다른 메뉴로 이동해도 query만 유지한다.

```txt
/?xray=monorepo
→ 지도 관제 클릭
→ /map?xray=monorepo
```

## 4. 저장소 루트가 먼저 보여야 하는 이유

여러 폴더만 나열한다고 Monorepo가 되는 것은 아니다. 하나의 루트 설정이 여러 workspace를 관리한다는 사실이 먼저 보여야 한다.

Workspace Map의 최상단은 다음 근거를 표시한다.

```txt
Repository root
city-watch-fe-lab
package.json · workspaces: apps/*, packages/*
```

실제 루트 `package.json` 설정은 다음과 같다.

```json
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

이 설정 때문에 루트에서 의존성을 설치하고 workspace script를 실행할 수 있다.

```bash
npm install
npm --workspace @citywatch/web run dev
npm run test --workspaces --if-present
```

## 5. apps와 packages를 분리한 이유

Workspace Map은 workspace를 두 그룹으로 나눈다.

### apps/*

독립적으로 실행하거나 배포할 수 있는 단위다.

```txt
apps/web
→ Next.js Host

apps/analytics-remote
→ Vite Module Federation remote

apps/realtime-server
→ Node WebSocket / HTTP server
```

### packages/*

다른 workspace가 import해서 사용하는 공유 단위다.

```txt
packages/ui
→ Badge, SeverityBadge, XRayBox

packages/api-types
→ Incident, Zod schema, runtime guards
```

`apps/web`에는 `현재 화면` 표시를 붙인다. 사용자가 지금 보고 있는 UI가 어느 workspace에서 실행되는지 바로 알 수 있게 한다.

## 6. 연결 관계를 구분해야 하는 이유

모든 workspace가 같은 방식으로 연결되는 것은 아니다.

```txt
apps/web
→ workspace import
→ packages/ui

apps/web
→ workspace import
→ packages/api-types

apps/web
→ runtime remote
→ apps/analytics-remote

apps/web
→ WebSocket / HTTP
→ apps/realtime-server
```

### workspace import

같은 저장소의 패키지를 일반 모듈처럼 import한다.

```ts
import { Badge, SeverityBadge, XRayBox } from "@citywatch/ui";
import type { Incident } from "@citywatch/api-types";
```

### runtime remote

빌드 시점의 일반 import가 아니라 실행 중 Module Federation runtime이 remote module을 불러온다.

```txt
apps/web
→ mf-manifest.json
→ citywatch_analytics/analytics-metrics
→ AnalyticsMetrics 렌더링
```

### WebSocket / HTTP

소스 package import가 아니라 별도 서버 프로세스와 네트워크로 통신한다.

```txt
apps/web
→ WebSocket /ws
→ apps/realtime-server

apps/web
→ HTTP /events
→ apps/realtime-server
```

이 세 연결을 같은 `uses` 화살표로 표시하면 빌드 시점 의존성과 실행 중 통신을 구분할 수 없다. 그래서 관계 이름을 화면에 직접 표시한다.

## 7. 코드 변경의 핵심

제거한 구조:

```tsx
<XRayBox label="package/ui/SharedComponents">
  <RecentIncidents />
</XRayBox>
```

제거한 Monorepo proof:

```tsx
proofs={["fsd-style", "monorepo"]}
```

FSD mode의 기존 UI 계층은 그대로 남긴다.

```tsx
<XRayBox enabled={xray} label="widget/RecentIncidents">
  <XRayBox enabled={xray} label="feature/incident/FetchIncidentList">
    <XRayBox enabled={xray} label="entity/incident/IncidentRows">
```

따라서 두 관점은 다음처럼 분리된다.

```txt
FSD-style
→ widget / feature / entity 테두리

Monorepo
→ Repository root / apps / packages / 관계 구조도
```

## 8. 구현을 최소화한 방법

추가하지 않은 것:

```txt
그래프 라이브러리
SVG 연결선 계산
workspace 정보를 읽는 새 API
WorkspaceCard 공용 컴포넌트
새 전역 상태
```

현재 workspace는 다섯 개이므로 JSX와 CSS Grid만으로 충분하다.

```txt
HTML section과 div
→ 의미 구조

CSS Grid
→ apps/packages 두 열

기존 monorepo-relations
→ 연결 관계 네 줄
```

workspace가 자주 추가되어 정적 목록 유지가 실제 문제가 될 때만 manifest 생성이나 자동 탐색을 고려한다.

## 9. 접근성

Workspace Map은 색상만으로 apps와 packages를 구분하지 않는다.

```txt
apps/* · 실행 단위
packages/* · 공유 단위
```

각 그룹은 heading이 있는 `section`이고 구조도 전체에는 접근 가능한 이름이 있다.

```tsx
<div aria-label="CityWatch 모노레포 workspace 구조">
<section aria-labelledby="monorepo-apps-title">
<section aria-labelledby="monorepo-packages-title">
```

작은 화면에서는 두 열을 한 열로 변경한다.

```css
@media (max-width: 760px) {
  .monorepo-workspace-columns {
    grid-template-columns: 1fr;
  }
}
```

## 10. 직접 확인 순서

1. 앱을 실행한다.

```bash
npm run dev
```

2. X-Ray에서 `Monorepo`를 선택한다.

3. URL이 `/?xray=monorepo`인지 확인한다.

4. 최근 사고 영역에 `package/SharedComponents`와 `entity/IncidentRows` 테두리가 없는지 확인한다.

5. Workspace Map에서 저장소 루트가 가장 먼저 보이는지 확인한다.

6. `apps/*`와 `packages/*`가 서로 다른 그룹인지 확인한다.

7. `apps/web`에 `현재 화면` 표시가 있는지 확인한다.

8. 네 연결 관계가 각각 `workspace import`, `runtime remote`, `WebSocket / HTTP`로 구분되는지 확인한다.

9. X-Ray를 `FSD-style`로 바꾼다.

10. Workspace Map이 사라지고 기존 widget/feature/entity 계층이 표시되는지 확인한다.

## 11. 검증 명령

```bash
npm run typecheck
npm test
git diff --check
```

## 12. 핵심 정리

```txt
이전
→ 공유 UI를 사용하는 화면에 package 테두리
→ Monorepo 전체 구조를 알기 어려움
→ 앱 소유 영역까지 packages/ui처럼 보임

개선
→ 저장소 루트를 먼저 표시
→ apps와 packages를 역할별로 분리
→ 현재 Host를 명시
→ import, runtime remote, network 관계를 구분
→ FSD 테두리와 Monorepo 구조도를 완전히 분리
```

## 13. 현재 페이지와 workspace를 연결하는 출처 표식

Monorepo는 관제 홈 전용 기능이 아니다. 공통 `layout.tsx`에서 `MonorepoWorkspaceMap`을 렌더링하므로 모든 메뉴에서 현재 페이지의 workspace 출처를 확인한다. `monorepo` 선택도 현재 경로를 유지한다.

Workspace Map만으로는 저장소의 전체 구조는 알 수 있지만 현재 화면의 각 부분을 어느 workspace가 소유하는지는 바로 알기 어렵다. 그래서 Monorepo mode의 공통 패널에 현재 pathname에 맞는 출처 chip을 표시한다.

공통 패널만으로 끝내지 않는다. 기존 `XRayBox`가 가진 `packageName`을 그대로 사용해 실제 관제 컴포넌트 위에도 workspace를 표시한다. Monorepo mode에서는 FSD의 `app/widget/feature/entity` 이름을 숨기고 workspace 이름만 보여 두 관점을 섞지 않는다.

```txt
apps/web → 파란 점선과 apps/web · 컴포넌트명 label
apps/analytics-remote → 주황 점선과 apps/analytics-remote · 컴포넌트명 label
packages/ui → 실제 Badge 안에 packages/ui 출처
```

`packages/api-types`에는 React 컴포넌트가 없으므로 화면 컴포넌트의 소유자로 표시하지 않는다. `IncidentRows`처럼 계약을 사용하는 컴포넌트도 실제 파일은 `apps/web` 소유이며, `packages/api-types`는 아래 대응표에서 `계약`으로 구분한다.

```txt
현재 페이지의 라우트·상태·사용자 동작
→ 소유 apps/web

Badge·SeverityBadge·X-Ray 경계
→ UI packages/ui

공유 데이터 계약·검증·계산
→ 계약 packages/api-types

관제 홈일 때 원격 사고 분석
→ Host apps/web + Remote apps/analytics-remote

실시간 피드일 때 이벤트 전송
→ Client apps/web + Server apps/realtime-server
```

### 소유, UI, 계약을 구분하는 이유

각 route의 화면과 상태는 `apps/web`에서 조립한다. `packages/ui`는 그 안에서 사용하는 Badge와 SeverityBadge를 제공하고, `packages/api-types`는 Incident와 실시간 이벤트의 데이터 계약을 제공한다.

```txt
소유 apps/web
→ section, REST 상태, Link, IncidentRow

UI packages/ui
→ Badge, SeverityBadge, XRayBox

계약 packages/api-types
→ Incident 타입과 필드 모양
```

`packages/api-types`는 DOM을 렌더링하지 않으므로 화면 영역의 소유자로 표시하지 않고 `계약`이라고 표시한다.

### Host와 remote를 구분하는 이유

원격 분석 panel 전체가 remote에서 오는 것은 아니다.

```txt
apps/web Host
→ panel 제목
→ manifest 로딩
→ loading/error 상태
→ 다시 불러오기 버튼

apps/analytics-remote
→ 실제 AnalyticsMetrics 계산과 지표 렌더링
```

따라서 panel 상단에는 `Host apps/web`, 실제 지표 바로 위에는 `Remote apps/analytics-remote`를 표시한다.

### 테두리 대신 chip을 사용한 이유

여러 workspace 테두리를 중첩하면 FSD X-Ray와 같은 시각적 혼란이 다시 생긴다. 출처 chip은 레이아웃을 감싸지 않고 실제 역할만 짧게 표시한다.

```txt
파란색 → app 소유 또는 Host
청록색 → 공유 UI package
보라색 → 데이터 계약 package
주황색 → runtime remote
```

`현재 페이지 출처` 목록은 pathname이 바뀔 때 함께 바뀐다. 관제 홈에서는 analytics remote를, 실시간 피드에서는 realtime server를 `현재 연결`로 강조하고, 그 밖의 페이지에서는 실제로 사용하지 않는 runtime 연결을 표시하지 않는다.
