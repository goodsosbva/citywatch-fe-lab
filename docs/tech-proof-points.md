# 프론트엔드 기술 적용 포인트

이 문서는 CityWatch FE Lab에서 관제 시스템 기능 안에 어떤 프론트엔드 기술을 녹였는지 정리한다.

## 현재 적용된 기술

### Next.js App Router

```txt
/
/incidents
/incidents/[id]
/api/incidents
/api/incidents/[id]
/api/incidents/[id]/status
```

화면 라우트와 API 라우트를 App Router 파일 시스템 구조로 구성한다.

### TypeScript

사고 도메인 타입, API 요청/응답 타입, 상태값을 `packages/api-types`에서 공유한다.

대표 타입:

```txt
Incident
IncidentStatus
IncidentSeverity
IncidentListResponse
IncidentDetailResponse
ApiError
```

### Zod

사고 등록 입력은 `packages/api-types`의 `createIncidentInputSchema`로 검증한다.

```txt
createIncidentInputSchema
validateCreateIncidentInput
schema.safeParse
fieldErrors
ApiError
```

같은 schema를 등록 화면과 `POST /api/incidents`가 함께 사용한다.

### REST API

사고 목록 조회, 상세 조회, 등록, 상태 변경을 Next Route Handler로 구현한다.

```txt
GET   /api/incidents
POST  /api/incidents
GET   /api/incidents/[id]
PATCH /api/incidents/[id]/status
```


### Unit Test / TDD

위험도 계산은 `packages/api-types`의 순수 함수로 분리하고 Vitest로 검증한다.

```txt
calculateIncidentRisk
vitest
describe / it / expect
risk-score.test.ts
feature/incident/CalculateRiskScore
```

목록/상세 화면에서는 이 계산 결과를 위험도 배지로 표시하고, X-Ray 라벨로 테스트된 기능 출처를 보여준다.

### Redux

사고 목록의 관제 필터와 선택 사고 ID를 Redux Toolkit slice로 공유한다.

```txt
incidentControlSlice
StoreProvider
useAppDispatch
useAppSelector
selectIncidentListQuery
feature/incident/ShareIncidentFilters
feature/incident/ShareSelectedIncident
```

필터 state는 REST API query로 변환되어 `GET /api/incidents` 요청에 사용된다.
선택 사고 ID는 목록 카드와 상세 화면에서 같은 값으로 표시된다.

### X-Ray Mode

화면 위에 짧은 FSD-style 라벨을 표시한다.

```txt
app
widget
feature
entity
shared
```

예시:

```txt
app/incidents/IncidentsPage
feature/incident/FetchIncidentList
feature/incident/ChangeIncidentStatus
entity/incident/IncidentListItem
shared/ui/SeverityBadge
```

### Monorepo

실행 앱과 공유 패키지를 분리한다.

```txt
apps/web
packages/api-types
packages/ui
```

### Shared UI

공통 UI를 `packages/ui`에서 재사용한다.

```txt
Badge
SeverityBadge
XRayBox
XRayToggle
```

### 상태 처리와 접근성

현재 화면 흐름에 포함된 기본 처리:

```txt
loading state
error state
aria-busy
role="status"
role="alert"
label 연결
button disabled 처리
```

## 이후 적용 예정

이후 단계에서는 같은 관제 시스템 안에 다음 기술을 추가한다.

```txt
OpenLayers
WebSocket / Polling
React Three Fiber
성능 최적화
Storybook
Module Federation
```
