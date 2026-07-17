# 5단계: REST API

## 1. 지금까지 한 것

4단계까지는 화면 라우팅과 관제 UI 흐름을 먼저 만들었다.

완료된 단계는 다음과 같다.

```txt
0. Monorepo workspace 세팅
1. apps/web 생성
2. X-Ray Box + X-Ray toggle
3. / 대시보드
4. /incidents 목록/상세
5. REST API
```

4단계의 구조는 다음과 같았다.

```txt
화면 컴포넌트
→ mock-incidents.ts 직접 import
→ 목록/상세 렌더링
```

이 구조는 라우팅 학습 단계에서는 충분했다. 하지만 REST API 학습을 보여주려면 화면이 데이터를 직접 들고 있으면 안 된다.

그래서 5단계에서는 데이터 접근 경계를 다음처럼 바꿨다.

```txt
화면 컴포넌트
→ fetch("/api/incidents")
→ Next Route Handler
→ incident-store
→ JSON 응답
→ 화면 렌더링
```

## 2. 이번에 구현한 것

이번 단계에서 구현한 REST API는 세 개다.

```txt
GET   /api/incidents
GET   /api/incidents/[id]
PATCH /api/incidents/[id]/status
```

각 역할은 다음과 같다.

```txt
GET /api/incidents
사고 목록 조회. search, severity, status, regionId query를 지원한다.

GET /api/incidents/[id]
사고 상세 조회.

PATCH /api/incidents/[id]/status
사고 상태 변경. 관제 시스템의 대응 흐름을 증명한다.
```

이번 단계에서 `POST /api/incidents`는 만들지 않았다. 사고 등록은 6단계 `create form + validation/accessibility`에서 처리한다. 그래야 6단계의 목적이 흐려지지 않는다.

## 3. 왜 이걸 했는지

이 프로젝트는 단순 화면 데모가 아니라 학습 증명용 프로젝트다. 따라서 REST API 단계에서 보여줘야 하는 것은 "fetch 한 번 했다"가 아니다.

이번 단계의 목적은 다음이다.

```txt
1. UI가 mock 배열을 직접 읽지 않게 만들기
2. Next App Router의 Route Handler를 실제 API 서버처럼 사용하기
3. API 요청/응답 타입을 packages/api-types와 연결하기
4. query/body 입력 검증을 넣기
5. 잘못된 요청은 ApiError 형태로 반환하기
6. 상세 화면에서 PATCH 상태 변경까지 수행하기
7. X-Ray 라벨로 어떤 UI가 REST API를 쓰는지 보이게 하기
```

면접에서 설명할 수 있는 핵심 문장은 이것이다.

```txt
4단계까지는 라우팅과 화면 구조를 만들었고,
5단계에서는 화면이 mock 데이터를 직접 읽지 않도록 REST API 경계를 세웠습니다.
목록/상세는 GET으로 읽고, 사고 상태 변경은 PATCH로 처리합니다.
API에서는 query와 body를 검증하고 ApiError 형태로 실패를 반환합니다.
```

## 4. 어떻게 세팅했는지

### 4-1. api-types에 런타임 검증 상수 추가

파일:

```txt
packages/api-types/src/index.ts
```

기존에는 `IncidentStatus`, `IncidentSeverity`, `IncidentCategory`가 TypeScript type으로만 있었다.

하지만 TypeScript type은 런타임에 사라진다.

예를 들어 API에서 이런 요청이 들어왔다고 하자.

```txt
GET /api/incidents?severity=bad
```

이 값이 유효한지 검사하려면 런타임에 실제 배열이 필요하다.

그래서 다음 상수를 추가했다.

```ts
export const incidentSeverities = ["low", "medium", "high", "critical"] as const;
export const incidentStatuses = ["reported", "dispatching", "in_progress", "resolved", "false_alarm"] as const;
export const incidentCategories = ["fire", "traffic", "flood", "crime", "facility", "medical", "weather"] as const;
```

그리고 타입은 이 상수에서 파생되게 바꿨다.

```ts
export type IncidentSeverity = (typeof incidentSeverities)[number];
export type IncidentStatus = (typeof incidentStatuses)[number];
export type IncidentCategory = (typeof incidentCategories)[number];
```

검증 함수도 추가했다.

```ts
isIncidentSeverity(value)
isIncidentStatus(value)
isIncidentCategory(value)
```

이제 API 쪽에서 query/body 값을 안전하게 검사할 수 있다.

또한 `@citywatch/api-types`가 런타임 값도 export하게 됐기 때문에 `packages/api-types/package.json`에 `exports`를 추가했다.

```json
{
  "exports": {
    ".": "./src/index.ts"
  }
}
```

이 설정이 없으면 type-only import는 통과해도, 런타임 import에서 Next build가 패키지를 해석하지 못한다.

### 4-2. API store 추가

파일:

```txt
apps/web/app/api/incidents/incident-store.ts
```

여기에는 서버 Route Handler가 사용할 in-memory store가 있다.

현재 제공 함수는 다음과 같다.

```txt
listIncidents(query)
getIncidentById(id)
updateIncidentStatus(id, status)
```

현재 DB는 붙이지 않았다.

이유는 이번 단계의 목적이 DB가 아니라 REST API 경계 학습이기 때문이다.

현재 저장 방식은 다음과 같다.

```txt
initialIncidents 배열
→ Map으로 보관
→ GET/PATCH Route Handler가 이 Map을 사용
```

단점도 명확하다.

```txt
서버를 재시작하면 상태 변경은 초기화된다.
실서비스라면 DB가 필요하다.
현재는 REST API 흐름 학습용이다.
```

이게 현재 단계에서 가장 작은 구현이다.

### 4-3. GET /api/incidents

파일:

```txt
apps/web/app/api/incidents/route.ts
```

Next App Router에서 API route는 파일 시스템으로 매핑된다.

```txt
app/api/incidents/route.ts
→ /api/incidents
```

여기서 `GET` 함수를 export하면 Next가 GET 요청 때 실행한다.

지원 query:

```txt
search
severity
status
regionId
```

검증:

```txt
search가 80자를 넘으면 400
severity가 허용 값이 아니면 400
status가 허용 값이 아니면 400
regionId는 trim 후 필터에 사용
```

성공 응답:

```json
{
  "incidents": []
}
```

실패 응답:

```json
{
  "code": "INVALID_SEVERITY",
  "message": "유효하지 않은 사고 심각도입니다."
}
```

### 4-4. GET /api/incidents/[id]

파일:

```txt
apps/web/app/api/incidents/[id]/route.ts
```

매핑:

```txt
app/api/incidents/[id]/route.ts
→ /api/incidents/INC-001
```

흐름:

```txt
1. params.id 읽기
2. getIncidentById(id) 호출
3. 없으면 404 ApiError
4. 있으면 { incident } 반환
```

성공 응답:

```json
{
  "incident": {}
}
```

없는 사고 응답:

```json
{
  "code": "INCIDENT_NOT_FOUND",
  "message": "사고를 찾을 수 없습니다."
}
```

### 4-5. PATCH /api/incidents/[id]/status

파일:

```txt
apps/web/app/api/incidents/[id]/status/route.ts
```

매핑:

```txt
app/api/incidents/[id]/status/route.ts
→ /api/incidents/INC-001/status
```

요청 body:

```json
{
  "incidentId": "INC-001",
  "status": "resolved"
}
```

검증:

```txt
JSON 파싱 실패 → 400 INVALID_JSON
본문이 객체가 아님 → 400 INVALID_JSON
incidentId와 URL id 불일치 → 400 INCIDENT_ID_MISMATCH
status가 허용 값 아님 → 400 INVALID_STATUS
사고 id 없음 → 404 INCIDENT_NOT_FOUND
성공 → 200 + 변경된 incident 반환
```

상태 변경이 성공하면 `updatedAt`도 현재 시각으로 갱신한다.

## 5. 화면은 어떻게 바뀌었는지

### 5-1. fetch client 추가

파일:

```txt
apps/web/app/incidents/incident-api.ts
```

브라우저/client component에서 API를 호출하는 함수만 둔다.

```txt
fetchIncidents(query)
fetchIncident(id)
changeIncidentStatus(input)
```

새 의존성은 추가하지 않았다.

```txt
axios 안 씀
React Query 안 씀
SWR 안 씀
기본 fetch 사용
```

현재 단계에서는 이게 가장 적당하다. 캐싱, 재검증, 서버 상태 동기화는 8번 Redux나 이후 단계에서 필요해질 때 다룬다.

### 5-2. 포맷 로직 분리

파일:

```txt
apps/web/app/incidents/incident-format.ts
```

여기에는 화면 표시용 값만 둔다.

```txt
incidentCategoryLabels
incidentStatusLabels
getRegionName
formatIncidentDate
getStatusTone
```

이 파일은 API가 아니다. UI 표시 전용이다.

### 5-3. 홈 / 변경

파일:

```txt
apps/web/app/shell.tsx
```

기존:

```txt
incidents 직접 import
```

변경:

```txt
useEffect
→ fetchIncidents()
→ 상태 저장
→ metric과 최근 사고 렌더링
```

홈에는 loading/error 상태도 추가했다.

```txt
loading → REST API에서 사고 데이터를 불러오는 중입니다.
error → role="alert"로 오류 표시
success → REST API badge 표시
```

X-Ray 라벨도 REST API 흐름을 보여준다.

```txt
feature/incident/FetchIncidentList
```

### 5-4. 사고 목록 /incidents 변경

파일:

```txt
apps/web/app/incidents/page.tsx
```

기존:

```txt
incidents 직접 import
```

변경:

```txt
fetchIncidents()
→ 목록 렌더링
```

X-Ray 라벨:

```txt
app/incidents/IncidentsPage
widget/IncidentListSummary
widget/IncidentList
feature/incident/FetchIncidentList
entity/incident/IncidentListItem
feature/incident/ViewIncidentDetail
shared/ui/SeverityBadge
```

### 5-5. 사고 상세 /incidents/[id] 변경

파일:

```txt
apps/web/app/incidents/[id]/page.tsx
apps/web/app/incidents/incident-detail-view.tsx
```

`page.tsx`는 URL의 `id`만 client view에 넘긴다.

```txt
/incidents/INC-001
→ params.id = "INC-001"
→ <IncidentDetailView incidentId="INC-001" />
```

상세 client view는 REST API로 데이터를 읽는다.

```txt
fetchIncident("INC-001")
→ GET /api/incidents/INC-001
→ 상세 렌더링
```

상태 변경은 다음 흐름이다.

```txt
select에서 상태 선택
→ 상태 변경 버튼 클릭
→ changeIncidentStatus({ incidentId, status })
→ PATCH /api/incidents/[id]/status
→ 성공 응답의 incident로 화면 갱신
```

접근성 기본도 넣었다.

```txt
label htmlFor="incident-status"
select id="incident-status"
form aria-busy
loading role="status"
error role="alert"
버튼 disabled 처리
```

## 6. 실제로 동작시키면 어떤 흐름인지

개발 서버 실행:

```bash
npm run dev:web
```

홈 접속:

```txt
http://127.0.0.1:3000/
```

흐름:

```txt
HomePage
→ CityWatchShell
→ useEffect 실행
→ fetchIncidents()
→ GET /api/incidents
→ incident-store listIncidents()
→ { incidents } 응답
→ metric / 최근 사고 렌더링
```

사고 목록 접속:

```txt
http://127.0.0.1:3000/incidents
```

흐름:

```txt
IncidentsPage
→ fetchIncidents()
→ GET /api/incidents
→ 목록 표시
```

사고 상세 접속:

```txt
http://127.0.0.1:3000/incidents/INC-001
```

흐름:

```txt
IncidentDetailRoute
→ params.id 읽기
→ IncidentDetailView에 incidentId 전달
→ fetchIncident("INC-001")
→ GET /api/incidents/INC-001
→ 상세 표시
```

상태 변경:

```txt
상태 select 변경
→ 상태 변경 버튼 클릭
→ PATCH /api/incidents/INC-001/status
→ API에서 body 검증
→ updateIncidentStatus
→ 변경된 incident 반환
→ 화면 상태/updatedAt 갱신
```

## 7. 검증 결과

타입 검증:

```bash
npm run typecheck
```

결과:

```txt
@citywatch/web 통과
@citywatch/api-types 통과
@citywatch/ui 통과
```

Next production build:

```bash
npm --workspace @citywatch/web run build
```

결과:

```txt
/                                Static
/api/incidents                   Dynamic
/api/incidents/[id]              Dynamic
/api/incidents/[id]/status       Dynamic
/incidents                       Static
/incidents/[id]                  SSG
```

API smoke test:

```txt
GET /api/incidents → 200, 3개 반환
GET /api/incidents?severity=critical → 200, 1개 반환
GET /api/incidents?severity=bad → 400
GET /api/incidents/INC-001 → 200
GET /api/incidents/NOPE → 404
PATCH /api/incidents/INC-001/status 정상 값 → 200
PATCH /api/incidents/INC-001/status 잘못된 값 → 400
PATCH 테스트 후 INC-001 상태는 in_progress로 복구
```

빌드 중 한 번 문제가 있었다.

```txt
@citywatch/api-types에서 런타임 상수를 import하자 Next build가 패키지를 못 찾음
```

원인은 `packages/api-types/package.json`에 runtime `exports`가 없었기 때문이다.

해결:

```json
"exports": {
  ".": "./src/index.ts"
}
```

이 설정 후 build가 통과했다.

## 8. 아직 안 한 것

아직 다음은 하지 않았다.

```txt
6. create form + validation/accessibility
7. Unit Test / TDD 위험도 계산
8. Redux 상태 공유
9. OpenLayers 지도 관제
10. WebSocket/Polling 실시간 처리
11. R3F 3D 위험 구역
12. performance page 대량 데이터 관제
13. Storybook UI 증명
14. realtime-server 분리
15. analytics-remote + Module Federation
```

이번 단계에서 공개 API도 직접 붙이지 않았다.

이유는 다음과 같다.

```txt
5번 목표는 내부 REST API 경계 만들기
공개 API는 대부분 read-only
우리 관제 시스템은 상태 변경과 등록 흐름이 필요
API key는 클라이언트에 노출하면 안 됨
```

공개 API는 이후 단계에서 붙이는 것이 맞다.

```txt
7번 위험도 계산 → 기상청 데이터로 보정 가능
9번 OpenLayers → 서울 실시간 도시데이터 위치/혼잡도 표시 가능
10번 실시간 처리 → 재난문자/도시데이터 polling 가능
```

현재 결론:

```txt
5번은 Next Route Handler로 내부 REST API를 만들고,
화면이 mock 파일을 직접 읽지 않도록 fetch 기반으로 바꾸며,
상세 화면에서 PATCH 상태 변경까지 증명한 단계다.
```
