# 22. 정식 FSD 구현

## 무엇이 바뀌었는가

기존에는 `app/incidents` 안에 API 호출, Redux slice, 표시 형식, 상세 화면이 함께 있었다.

```text
apps/web/app/incidents/
├─ incident-api.ts
├─ incident-control-slice.ts
├─ incident-format.ts
└─ incident-detail-view.tsx
```

X-Ray 라벨은 `app`, `widget`, `feature`, `entity`를 표시했지만 실제 파일은 Next route 폴더에 섞여 있었다. 22단계에서는 여러 화면이 함께 사용하는 incident 흐름을 실제 FSD slice로 이동했다.

```text
apps/web/
├─ app/
│  └─ incidents/[id]/
│     ├─ page.tsx
│     └─ incident-detail-route.tsx
└─ src/fsd/
   ├─ entities/incident/
   │  ├─ api/incident-api.ts
   │  ├─ model/incident-format.ts
   │  └─ index.ts
   ├─ features/incident-control/
   │  ├─ model/incident-control-slice.ts
   │  └─ index.ts
   ├─ widgets/incident-detail/
   │  ├─ ui/incident-detail-view.tsx
   │  └─ index.ts
   └─ pages/incident-detail/
      ├─ ui/incident-detail-page.tsx
      └─ index.ts
```

## 왜 바꿨는가

폴더 이름이 FSD처럼 보이는 것만으로는 정식 FSD가 아니다. 다음 세 조건이 실제 코드에 필요하다.

```text
slice가 자기 책임을 소유한다
→ 외부는 index.ts Public API만 사용한다
→ 상위 계층만 하위 계층을 의존한다
```

기존 구조에서는 `/map`, `/risk-3d`, `/performance`, 상세 화면이 모두 `app/incidents/incident-api.ts` 같은 route 내부 파일을 직접 가져갔다. 즉, 다른 route가 incidents route의 내부 구현에 의존했다.

변경 후 route는 URL 진입과 Provider 연결만 담당하고, 재사용 가능한 업무 코드는 `src`의 FSD slice가 소유한다.

## 계층별 책임

### page: incident-detail

`pages/incident-detail`은 하나의 URL 화면에 필요한 widget을 조립한다. Next.js의 `app/incidents/[id]/page.tsx`는 프레임워크 route entry이고, 실제 FSD page는 `src/fsd/pages/incident-detail`이다.

```text
Next app route
→ FSD page/incident-detail
→ widget/incident-detail
```

Next.js의 `app` 디렉터리와 FSD `app` 계층은 이름이 같아도 같은 개념이 아니다. 또한 `src/pages`는 Next Pages Router 예약 경로이므로 FSD 계층은 `src/fsd/pages`에 둔다. 이 프로젝트에서는 Next route 파일을 얇은 framework adapter로 두고 FSD Page Public API를 호출한다.

### entity: incident

`entities/incident`는 사고라는 업무 데이터가 공통으로 필요로 하는 코드만 소유한다.

```text
API 요청
응답 검증
날짜·지역·상태 표시 형식
Incident 관련 공개 타입
```

외부에서는 내부 파일을 직접 가져오지 않는다.

```ts
import {
  fetchIncidents,
  getRegionName,
  incidentStatusLabels,
} from "@/entities/incident";
```

위 import는 `entities/incident/index.ts`를 통과한다.

### feature: incident-control

`features/incident-control`은 사용자가 사고 목록을 검색하고, 심각도·상태·지역을 선택하고, 현재 사고를 선택하는 행동 상태를 소유한다.

```text
입력 변경
→ Redux action
→ incidentControl reducer
→ selector
→ 목록·지도·3D 화면 재렌더링
```

feature는 `IncidentListQuery`, `IncidentSeverity`, `IncidentStatus`를 entity Public API에서 가져온다.

```text
feature/incident-control
→ entity/incident
```

반대로 entity가 feature를 가져오는 경로는 없다.

### widget: incident-detail

`widgets/incident-detail`은 상세 화면의 로딩, 상태 변경 폼, 상세 정보 패널을 하나의 사용자 화면 단위로 조립한다.

```text
widget/incident-detail
├─ feature/incident-control의 선택 상태 사용
└─ entity/incident의 API·표시 형식 사용
```

widget 내부 파일도 route에서 직접 가져오지 않는다.

```ts
import { IncidentDetailView } from "@/widgets/incident-detail";
```

## 실제 실행 흐름

사고 상세 URL을 열면 다음 순서로 코드가 연결된다.

```text
GET /incidents/INC-001
→ app/incidents/[id]/page.tsx
→ app/incidents/[id]/incident-detail-route.tsx
→ pages/incident-detail Public API
→ widgets/incident-detail Public API
→ IncidentDetailView
→ features/incident-control Public API
→ entities/incident Public API
→ /api/incidents/INC-001
```

`page.tsx`는 동적 URL의 `id`를 읽는다. client adapter는 X-Ray Context 값을 읽어 widget에 전달한다. 이 덕분에 widget이 app 계층의 Context 구현을 역으로 import하지 않는다.

```text
app adapter
→ xray 값을 widget prop으로 전달

widget
→ app/xray-selector를 import하지 않음
```

## Public API가 필요한 이유

다음 import는 허용하지 않는다.

```ts
import { fetchIncidents } from "@/entities/incident/api/incident-api";
```

외부 코드가 내부 폴더 구조를 알게 되면 파일 이동이나 구현 교체가 모든 소비자 변경으로 번진다. 따라서 slice 밖에서는 다음 경로만 사용한다.

```ts
import { fetchIncidents } from "@/entities/incident";
```

`index.ts`가 외부에 공개할 이름을 결정하고 `api`, `model`, `ui`는 slice 내부 구현으로 남는다.

## 의존 방향

현재 구현한 import 방향은 다음과 같다.

```text
app
↓
page
↓
widget
↓
feature
↓
entity
↓
공유 workspace와 외부 라이브러리
```

같은 상위 계층이나 아래 계층에서 위쪽 계층을 가져오지 않는다.

```text
entity → feature   금지
feature → widget   금지
widget → page      금지
page → app         금지
```

같은 관계를 의존받는 방향으로 그리면 화살표가 반대가 된다.

```text
shared ← entity ← feature ← widget ← page ← app
```

## 자동 경계 검사

`apps/web/fsd-boundaries.test.mjs`는 Node 표준 기능만 사용해 `src`의 import를 검사한다.

검사하는 규칙은 두 가지다.

```text
1. @/entities/incident/api/... 같은 private 경로 import 금지
2. entity→feature, feature→widget, widget→page 같은 상향 의존 금지
```

별도 ESLint plugin은 추가하지 않았다. 현재 세 계층과 두 규칙은 짧은 Node test로 충분하며 `npm test`에 포함된다.

## X-Ray 변경

상세 화면의 X-Ray는 실제 소스 경로에 맞춰 바뀌었다.

```text
app/incidents/[id]/IncidentDetailRoute
→ page/incident-detail/IncidentDetailPage
→ widget/incident-detail/IncidentDetailView
→ entity/incident/IncidentDetail
```

기존처럼 app 라벨 하나가 상세 widget 전체를 소유한다고 표시하지 않는다. `/incidents/INC-001?xray=fsd-style`에서 실제 route adapter와 widget 경계를 확인할 수 있다.

## 구현 상태 변경

`/status`의 상태는 다음처럼 바뀌었다.

```text
완료 11 → 12
부분 1 → 1
예정 2 → 1
```

`정식 FSD`는 완료로 이동했다. 단, 완료 근거는 incident vertical slice이며 모든 route UI를 한 번에 옮겼다는 뜻은 아니다. 그래서 전체 화면의 이동 범위는 `FSD migration coverage`라는 부분 구현 항목으로 남겼다.

## 결론

변경 전에는 FSD가 화면 라벨로만 존재했다.

```text
FSD 이름의 X-Ray
≠ 실제 FSD 구조
```

변경 후에는 incident 상세 흐름에서 구조와 실행 경로가 일치한다.

```text
실제 slice 폴더
→ Public API
→ 하향 의존
→ 자동 경계 검사
→ 실제 X-Ray 경로
```

새 상태 관리, 새 API, 새 라이브러리는 추가하지 않았다. 기존 기능의 소유 위치와 import 경계만 정리했다.
