# 20-12. REST API X-Ray 개선

## 목표

기존 REST API 관점은 실제 `fetch`와 Route Handler를 사용했지만 화면에는 FSD 경계가 함께 표시됐고, 증거 패널에는 Redux 내부 상태까지 섞여 있었다. 또한 성공 응답은 `IncidentListResponse`라고 TypeScript 단언만 했기 때문에 네트워크 JSON의 런타임 형태를 확인하지 않았다.

20-12는 REST 요청의 실제 실행 경계만 다음 순서로 연결한다.

```text
사용자 필터 변경
→ IncidentListQuery 변경
→ fetchIncidents(query)
→ GET /api/incidents?... 
→ Next Route Handler GET
→ query 입력 검증
→ incident-store listIncidents(query)
→ JSON 응답
→ isIncidentListResponse(data)
→ React incidents 상태 변경
→ 목록·요약 다시 렌더링
```

## 최종 화면 경계

REST API 관점의 DOM X-Ray 경계는 하나다.

```text
rest/IncidentsClient
```

브라우저가 실제로 소유하는 React 화면과 상태만 테두리로 표시한다. Next Route Handler와 서버 메모리 저장소는 브라우저 DOM을 렌더링하지 않으므로 서버 주변에 가짜 X-RayBox를 만들지 않는다. 서버 실행 경계는 REST 실행 증거 패널의 코드 흐름으로 표시한다.

FSD-style 관점에서는 기존 `app/widget/feature/entity` 경계를 그대로 유지한다. Redux 관점의 action/reducer/selector 증거도 기존 Redux 패널에만 남긴다. REST 관점에서는 이 경계와 패널을 켜지 않는다.

## 1. 사용자가 조회 조건을 선택한다

파일:

```text
apps/web/app/incidents/page.tsx
```

`IncidentFilterPanel`의 `<input>`과 `<select>`는 실제 `onChange` 이벤트를 사용한다.

```text
검색 입력     → onSearchChange
심각도 선택   → onSeverityChange
상태 선택     → onStatusChange
지역 선택     → onRegionChange
초기화 버튼   → onReset
```

현재 애플리케이션은 여러 화면이 필터를 공유하므로 이 callback은 기존 action을 dispatch한다. Redux 내부 동작은 Redux X-Ray의 책임이고, REST 관점은 그 결과로 만들어진 `IncidentListQuery`부터 네트워크 경계를 추적한다.

`selectIncidentListQuery`가 `all`과 빈 검색어를 제거해 API에 보낼 query만 만든다.

```text
화면 필터
{ search: "침수", severity: "critical", status: "all", regionId: "all" }

REST query
{ search: "침수", severity: "critical" }
```

## 2. query 변경이 실제 요청을 시작한다

`IncidentsPage`의 `useEffect` dependency는 `query`다.

```tsx
useEffect(() => {
  // loadIncidents 선언·실행
}, [query]);
```

필터 선택으로 query가 바뀌면 effect가 다시 실행된다. `loadIncidents`는 요청 직전에 기존 상태를 사용해 다음 값을 갱신한다.

```text
setLoading(true)
→ 화면과 증거 패널을 요청 중 상태로 변경

setRequestUrl(getIncidentListUrl(query))
→ 이번에 실제 호출할 URL을 증거 패널에 기록
```

별도의 데모용 REST 상태를 만들지 않았다. 패널은 요청 코드가 사용하는 `query`, `loading`, `error`, `incidents`와 동일한 값을 받는다.

## 3. query를 GET URL로 직렬화한다

파일:

```text
apps/web/app/incidents/incident-api.ts
```

`getIncidentListUrl(query)`는 브라우저 표준 `URLSearchParams`를 사용한다.

```text
search   → search parameter
severity → severity parameter
status   → status parameter
regionId → regionId parameter
```

값이 하나도 없으면 다음 URL이 된다.

```text
/api/incidents
```

검색어와 심각도가 있으면 브라우저가 안전하게 인코딩한 다음 URL이 된다.

```text
/api/incidents?search=...&severity=critical
```

화면 증거와 실제 fetch가 같은 함수를 호출하므로 표시 URL을 별도로 조립하다 어긋나는 상태를 만들지 않는다.

## 4. 브라우저가 GET 요청을 보낸다

`fetchIncidents(query)`는 URL을 만든 뒤 기존 `requestJson`을 호출한다.

```text
fetchIncidents(query)
→ getIncidentListUrl(query)
→ requestJson<unknown>(url)
→ fetch(url)
```

`RequestInit`을 넘기지 않았으므로 브라우저 기본 method인 GET 요청이다.

`requestJson`은 응답 body를 JSON으로 파싱하고 HTTP 상태를 확인한다.

```text
response.json 성공
→ data 보관

response.json 실패
→ data = undefined

response.ok = false
→ 서버 ApiError면 code/message 유지
→ 다른 응답이면 HTTP_ERROR로 정규화
→ IncidentApiError throw
```

## 5. Next Route Handler가 query를 읽고 검증한다

파일:

```text
apps/web/app/api/incidents/route.ts
```

Next App Router는 이 파일의 `GET` export를 `/api/incidents`의 GET 처리기로 연결한다.

```tsx
export async function GET(request: Request)
```

처리 순서는 다음과 같다.

```text
new URL(request.url)
→ searchParams 읽기
→ 각 문자열 trim
→ 검색어 길이 검사
→ severity 허용 값 검사
→ status 허용 값 검사
→ 검증된 값만 IncidentListQuery에 복사
```

신뢰 경계에서 다음 실패를 400 JSON으로 반환한다.

```text
search 80자 초과      → SEARCH_TOO_LONG
알 수 없는 severity   → INVALID_SEVERITY
알 수 없는 status     → INVALID_STATUS
```

TypeScript 타입은 브라우저 요청을 막을 수 없으므로 `isIncidentSeverity`와 `isIncidentStatus`의 런타임 검사를 유지한다.

## 6. 서버 저장소가 목록을 필터링한다

파일:

```text
apps/web/app/api/incidents/incident-store.ts
```

검증을 통과한 query만 `listIncidents(query)`로 전달된다.

```text
severity 일치 확인
→ status 일치 확인
→ regionId 일치 확인
→ id/title/description/assignedTeam 검색 확인
→ 일치하는 Incident[] 반환
```

현재 저장소는 REST 학습 범위에 맞춘 서버 메모리 `Map`이다. X-Ray를 위해 DB나 가짜 서버 상태를 추가하지 않았다.

Route Handler는 결과를 공유 응답 계약 모양으로 반환한다.

```tsx
NextResponse.json<IncidentListResponse>({
  incidents: listIncidents(query),
});
```

## 7. 브라우저가 성공 응답도 런타임 검증한다

파일:

```text
packages/api-types/src/index.ts
apps/web/app/incidents/incident-api.ts
```

`requestJson<IncidentListResponse>` 같은 generic은 컴파일 때만 존재하며 서버가 보낸 JSON을 검사하지 않는다. 따라서 응답을 먼저 `unknown`으로 받고 공유 계약의 `isIncidentListResponse`로 확인한다.

```text
unknown JSON
→ 객체인지 확인
→ incidents가 배열인지 확인
→ 모든 항목이 isIncident를 통과하는지 확인
```

각 Incident는 ID·문자열·카테고리·심각도·상태·좌표·날짜·영향 인원·선택적 담당 팀 형태를 검사한다. 하나라도 잘못되면 목록 state에 넣지 않는다.

```text
검증 성공
→ data.incidents 반환

검증 실패
→ IncidentApiError(502, "INVALID_RESPONSE", ...)
```

## 8. React 상태와 화면이 바뀐다

`fetchIncidents(query)`가 검증된 배열을 반환하면 `loadIncidents`가 다음 순서로 처리한다.

```text
setIncidents(nextIncidents)
→ setError(undefined)
→ finally setLoading(false)
```

React가 다시 렌더링하면 같은 `incidents` 배열이 다음 UI에 연결된다.

```text
조회 결과 수
대응 필요 수
긴급 수
영향 인원 합계
사고 목록 행
REST 증거의 검증 완료 건수
```

실패하면 `setError(getErrorMessage(reason))`로 오류를 저장하고 목록 대신 `role="alert"` 메시지를 표시한다. 성공하지 않은 응답으로 기존 화면을 거짓 갱신하지 않는다.

## 9. 오래된 비동기 응답을 막는다

effect는 `active` flag를 소유한다.

```text
새 query로 effect 재실행 또는 페이지 이동
→ 이전 effect cleanup
→ active = false
```

이전 요청이 늦게 끝나도 다음 guard가 오래된 결과의 state 반영을 막는다.

```tsx
if (!active) return;
```

요청 자체를 취소하는 `AbortController`는 이번 변경에 추가하지 않았다. 현재 코드는 stale state overwrite를 이미 방지하며, 취소 기능을 위해 API helper와 모든 호출부를 확장하는 것은 20-12의 최소 범위를 넘는다.

## 10. REST 실행 증거 패널

패널은 다음 실제 값을 표시한다.

```text
requestUrl       → 이번 effect가 실제 요청한 GET URL
loading          → fetch 진행 여부
error            → 실제 요청·검증 실패 메시지
incidents.length → 검증을 통과해 state에 저장된 결과 수
query            → 이번 조회 계약
```

흐름 행은 실제 코드 심볼을 연결한다.

```text
filter onChange
→ IncidentListQuery
→ fetchIncidents(query)
→ GET requestUrl
→ route.ts GET
→ listIncidents(query)
→ isIncidentListResponse(data)
→ setIncidents
```

서버 Route Handler와 store는 텍스트상 실행 단계일 뿐 DOM X-Ray 경계로 꾸미지 않았다.

## 접근성·오류 처리

- 필터의 기존 `label`과 `htmlFor` 연결을 유지했다.
- 실제 요청 중인 목록 section의 `aria-busy`를 유지했다.
- loading과 빈 결과는 `role="status"`를 유지했다.
- 요청·응답 검증 오류는 `role="alert"`를 유지했다.
- 필터 적용 수는 기존 `aria-live="polite"` 영역에서 갱신한다.
- X-Ray 라벨은 공통 컴포넌트가 `aria-hidden="true"`로 렌더링한다.
- 상태는 색상뿐 아니라 `요청 중`, `응답 오류`, `N건 검증 완료` 문자열로 표시한다.

## 변경 파일

```text
apps/web/app/incidents/page.tsx
apps/web/app/incidents/incident-api.ts
apps/web/app/globals.css
packages/api-types/src/index.ts
packages/api-types/test/incident-response.test.ts
docs/20-12-rest-api-xray-improvement.md
```

## 의도적으로 추가하지 않은 것

- axios, React Query, SWR 같은 새 의존성
- REST 전용 Context 또는 상태 저장소
- 서버 경계를 흉내 내는 DOM 테두리
- 가짜 HTTP 지연·응답 상태
- 요청 기록 배열이나 디버그 로그 저장소
- Route Handler와 store를 감싸는 새 service/repository 계층

기존 `fetch`, Route Handler, store, React state와 공유 계약으로 실행 흐름을 증명할 수 있기 때문이다.

## 확인 순서

1. `/incidents?xray=rest-api`에 접속한다.
2. X-Ray 경계가 `rest/IncidentsClient` 하나인지 확인한다.
3. `app`, `widget`, `feature`, `entity` FSD 라벨이 없는지 확인한다.
4. 증거 패널의 실제 요청이 `GET /api/incidents`인지 확인한다.
5. 심각도에서 `긴급`을 선택한다.
6. 실제 요청과 브라우저 Network가 `severity=critical`을 포함하는지 확인한다.
7. badge가 `요청 중`에서 `N건 검증 완료`로 바뀌는지 확인한다.
8. 조회 결과 metric, 목록, 패널 건수가 함께 바뀌는지 확인한다.
9. 검색·상태·지역 필터를 바꿔 query 문자열이 안전하게 갱신되는지 확인한다.
10. API를 실패시키면 목록 오류와 패널의 `응답 오류`가 함께 표시되는지 확인한다.
11. 다른 메뉴로 이동해도 `xray=rest-api`는 유지되며 `/incidents`로 강제 복귀하지 않는지 확인한다.

## 현재 한계

- 브라우저 Network 패널 수준의 timing, header, byte 크기는 수집하지 않는다.
- in-memory store는 서버 재시작 시 초기화된다.
- effect는 오래된 state 반영을 막지만 네트워크 전송 자체를 취소하지 않는다.
- 상세 GET, 상태 PATCH, 생성 POST도 같은 API client를 사용하지만 20-12의 화면 증거는 목록 GET 흐름에 집중한다.

요청 이력 보존이나 성능 계측이 실제 요구가 될 때만 별도 관측 상태를 추가한다.
