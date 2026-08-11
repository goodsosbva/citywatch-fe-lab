# 20-4. REST / Redux / Validation X-Ray

20-4는 새로운 REST API, Redux store, Zod schema를 만드는 단계가 아니다. 이미 동작하는 사고 조회와 등록 흐름을 X-Ray selector에서 각각 선택하고, 화면에서 실제 코드와 현재 값을 따라갈 수 있게 연결한 단계다.

```txt
/incidents
→ REST API
→ Redux
→ Shared Contract

/incidents/new
→ Zod Validation
→ Input Validation
→ Accessibility
```

새 API, 새 slice, 새 schema, 새 상태, 새 CSS, 새 의존성은 추가하지 않았다. 기존 동작을 증거 경계와 패널에 연결했다.

## 1. 이번 단계에서 추가된 기능

X-Ray selector에 네 관점을 추가했다.

```txt
REST API
Redux
Zod Validation
Accessibility
```

대표 경로는 다음과 같다.

```txt
?xray=rest-api      → /incidents
?xray=redux         → /incidents
?xray=zod           → /incidents/new
?xray=accessibility → /incidents/new
```

선택한 순간에만 대표 화면으로 안내한다. 그 뒤 다른 메뉴로 이동하면 현재 route를 유지하고 `xray` query만 따라간다.

변경 파일은 네 개다.

```txt
apps/web/app/xray-selector.tsx
apps/web/app/incidents/page.tsx
apps/web/app/incidents/new/page.tsx
docs/20-4-rest-redux-validation-xray.md
```

## 2. 네 기술의 책임을 먼저 구분한다

### 2.1 REST API

REST API는 브라우저와 서버가 HTTP 요청과 응답으로 데이터를 교환하는 경계다.

```txt
브라우저
→ GET /api/incidents?severity=critical
→ Next Route Handler
→ JSON 응답
→ 브라우저 state
```

REST는 필터 UI의 상태를 저장하지 않는다. 요청으로 들어온 조건을 검사하고 결과를 응답한다.

### 2.2 Redux

Redux는 이 프로젝트에서 관제 필터와 선택 사고 ID를 공유한다.

```txt
검색 입력 변경
→ dispatch(setSearchFilter(value))
→ incidentControlSlice reducer
→ state.filters.search 변경
→ selector가 IncidentListQuery 생성
```

사고 목록 서버 응답 자체는 Redux에 저장하지 않는다. 현재 구조에서 서버 응답은 각 페이지의 React state가 소유한다.

```txt
Redux
→ 조회 조건과 선택 ID

React state
→ 현재 REST 응답, loading, error
```

### 2.3 Zod Validation

Zod는 외부 입력이 애플리케이션이 기대하는 모양인지 실행 중에 검사한다.

```txt
폼 문자열 또는 request JSON
→ createIncidentInputSchema.safeParse
→ 성공: CreateIncidentInput
→ 실패: fieldErrors
```

TypeScript 타입은 빌드 후 사라진다. `CreateIncidentInput`이라고 작성하는 것만으로 브라우저 입력이나 HTTP JSON이 안전해지지 않는다.

### 2.4 Accessibility

접근성은 같은 폼을 키보드와 보조 기술로도 이해하고 조작할 수 있게 만드는 실행 규칙이다.

```txt
label htmlFor
→ input id

fieldErrors.title
→ aria-invalid=true
→ aria-describedby=incident-title-error
→ 오류 문장과 연결
```

접근성은 설명 문구만 붙이는 것이 아니라 실제 DOM 속성과 상태 변화로 증명한다.

## 3. 설정은 어디에서 시작되는가

### 3.1 루트 `package.json`

루트는 npm workspace의 진입점이다.

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

이 설정으로 `apps/web`이 다음 로컬 패키지를 일반 package import처럼 사용할 수 있다.

```txt
@citywatch/api-types
@citywatch/ui
```

Zod schema와 공유 계약을 `apps/web` 안에 복사하지 않는 이유다.

### 3.2 `apps/web/package.json`

웹 앱은 화면, Route Handler, Redux 연결을 실행한다.

```txt
@reduxjs/toolkit
react-redux
@citywatch/api-types
@citywatch/ui
```

Redux가 `apps/web`의 의존성인 이유는 브라우저 UI state를 이 앱이 소유하기 때문이다. Zod는 공유 schema가 있는 `packages/api-types`에서 사용한다.

### 3.3 Redux Provider 위치

공통 store는 앱 layout 쪽 Provider에서 한 번 공급한다.

```txt
Root layout
→ StoreProvider
→ 모든 route
→ useAppDispatch / useAppSelector
```

페이지마다 store를 만들면 route 이동 때 상태가 분리된다. Provider를 공통 상단에 두면 `/incidents`, `/map`, `/risk-3d`가 같은 필터와 선택 ID를 읽을 수 있다.

### 3.4 Slice 위치

Redux 상태와 reducer는 다음 파일에 있다.

```txt
apps/web/app/incidents/incident-control-slice.ts
```

이 파일이 소유하는 값은 두 종류뿐이다.

```ts
type IncidentControlState = {
  filters: IncidentFilters;
  selectedIncidentId?: string;
};
```

서버 응답 캐시나 범용 form state까지 넣지 않았다. 현재 공유가 필요한 관제 상태만 slice에 둔다.

### 3.5 공유 계약과 schema 위치

다음 파일이 사고 타입과 등록 검증 규칙을 소유한다.

```txt
packages/api-types/src/index.ts
```

주요 계약은 다음과 같다.

```txt
IncidentListQuery
IncidentListResponse
CreateIncidentInput
IncidentDetailResponse
ApiError
createIncidentInputSchema
validateCreateIncidentInput
```

클라이언트와 Route Handler가 같은 입력 규칙을 사용해야 하므로 특정 페이지 내부가 아니라 공유 package에 둔다.

## 4. X-Ray selector의 뿌리부터 route까지

### 4.1 허용 타입

`XRayProof`에 안정적인 ID를 추가했다.

```ts
| "rest-api"
| "redux"
| "zod"
| "accessibility"
```

표시 문자열을 proof 판단에 사용하지 않는다. 예를 들어 화면 문구가 `Zod Validation`에서 `Zod 입력 검증`으로 바뀌어도 proof ID `zod`는 유지할 수 있다.

### 4.2 실제 option

```tsx
<option value="rest-api">REST API</option>
<option value="redux">Redux</option>
<option value="zod">Zod Validation</option>
<option value="accessibility">Accessibility</option>
```

사용자가 보게 되는 문구와 URL에 들어가는 안정적인 값이 분리된다.

### 4.3 URL 외부 입력 검증

사용자는 주소를 직접 수정할 수 있다. 따라서 `getXRayMode`가 네 값을 허용 목록과 비교한다.

```txt
?xray=zod
→ 허용됨

?xray=unknown
→ 허용되지 않음
→ all로 복구
```

TypeScript의 `as XRayMode`는 런타임 URL을 검사하지 못한다.

### 4.4 대표 경로

```ts
if (mode === "rest-api" || mode === "redux") return "/incidents";
if (mode === "zod" || mode === "accessibility") return "/incidents/new";
```

REST와 Redux는 목록 조회에서 가장 분명하게 연결된다. Zod와 접근성은 등록 폼에서 실제 오류 상태를 만들 수 있다.

대표 경로는 selector를 변경할 때만 사용한다. 일반 메뉴 이동 때 다시 계산하지 않으므로 사용자를 특정 페이지에 고정하지 않는다.

## 5. `/incidents`의 Redux 전체 흐름

### 5.1 화면이 store를 읽는다

```ts
const filters = useAppSelector(selectIncidentFilters);
const query = useAppSelector(selectIncidentListQuery);
const activeFilterCount = useAppSelector(selectActiveIncidentFilterCount);
const selectedIncidentId = useAppSelector(selectSelectedIncidentId);
```

각 selector의 결과는 목적이 다르다.

| selector | 반환값 | 소비 위치 |
| --- | --- | --- |
| `selectIncidentFilters` | input에 표시할 원본 필터 | 검색·select value |
| `selectIncidentListQuery` | `all`을 제거한 REST query | `fetchIncidents(query)` |
| `selectActiveIncidentFilterCount` | 활성 필터 개수 | Redux 배지 |
| `selectSelectedIncidentId` | 여러 화면이 공유하는 선택 ID | 목록 강조·지도·3D |

### 5.2 사용자가 검색어를 입력한다

```tsx
onSearchChange={(value) => dispatch(setSearchFilter(value))}
```

실행 순서:

```txt
input change
→ setSearchFilter(value) action 생성
→ dispatch
→ incidentControlSlice reducer 실행
→ state.filters.search 변경
→ selector 재계산
→ IncidentsPage 재렌더링
```

Redux Toolkit의 `createSlice` reducer 안에서는 다음처럼 대입한다.

```ts
setSearchFilter(state, action: PayloadAction<string>) {
  state.filters.search = action.payload;
}
```

Redux Toolkit 내부의 Immer가 불변 업데이트 결과를 만든다. 화면에서 별도 spread 복사를 반복하지 않는다.

### 5.3 selector가 REST query를 만든다

화면용 필터에는 `all`이 있지만 API query에는 필요 없다.

```ts
if (search) query.search = search;
if (filters.severity !== "all") query.severity = filters.severity;
if (filters.status !== "all") query.status = filters.status;
if (filters.regionId !== "all") query.regionId = filters.regionId;
```

예제:

```txt
Redux filters
{
  search: "침수",
  severity: "all",
  status: "in_progress",
  regionId: "all"
}

IncidentListQuery
{
  search: "침수",
  status: "in_progress"
}
```

`all`을 API에 보내 서버가 특별한 문자열로 해석하게 만들지 않는다.

### 5.4 query가 바뀌면 조회한다

```ts
useEffect(() => {
  void loadIncidents();
  return () => {
    active = false;
  };
}, [query]);
```

`createSelector`는 입력 필터가 바뀌지 않으면 같은 query 참조를 재사용한다. 실제 query가 바뀌었을 때 effect가 다시 실행된다.

## 6. `/incidents`의 REST 전체 흐름

### 6.1 query를 URL로 바꾼다

`incident-api.ts`의 `fetchIncidents`가 브라우저 요청을 만든다.

```ts
const params = new URLSearchParams();
if (query.search) params.set("search", query.search);
if (query.severity) params.set("severity", query.severity);
if (query.status) params.set("status", query.status);
if (query.regionId) params.set("regionId", query.regionId);
```

```txt
{ severity: "critical", regionId: "junggu" }
→ severity=critical&regionId=junggu
→ GET /api/incidents?severity=critical&regionId=junggu
```

`URLSearchParams`를 사용하므로 검색어의 공백이나 한글을 직접 문자열 연결하지 않는다.

### 6.2 공통 HTTP 처리

```ts
const response = await fetch(url, init);
const data = await response.json().catch(() => undefined);

if (!response.ok) {
  throw new IncidentApiError(...);
}
```

HTTP 오류이면 `ApiError` 모양을 확인해 사용자 메시지를 보존하고, 알 수 없는 오류 모양이면 공통 문구를 사용한다.

### 6.3 Route Handler가 query를 다시 검사한다

`apps/web/app/api/incidents/route.ts`의 `GET`이 서버 신뢰 경계다.

```txt
search 길이 검사
severity 허용값 검사
status 허용값 검사
query 생성
listIncidents(query)
IncidentListResponse JSON 반환
```

브라우저에서 TypeScript로 query를 만들었더라도 서버 검사를 생략할 수 없다. 누구든 URL을 직접 호출할 수 있기 때문이다.

### 6.4 응답을 화면 state에 넣는다

```ts
const nextIncidents = await fetchIncidents(query);
if (!active) return;
setIncidents(nextIncidents);
```

`active`는 페이지가 사라진 뒤 늦게 끝난 요청이 state를 갱신하지 않게 한다.

최종 흐름:

```txt
Redux filter
→ selectIncidentListQuery
→ URLSearchParams
→ GET /api/incidents
→ Route Handler query validation
→ listIncidents
→ IncidentListResponse
→ data.incidents
→ setIncidents
→ incidents.map
→ IncidentListItem DOM
```

## 7. Shared Contract가 의미하는 것

`IncidentListQuery`와 `IncidentListResponse`를 브라우저와 Route Handler가 함께 import한다.

```ts
type IncidentListResponse = {
  incidents: Incident[];
};
```

이렇게 하면 필드 이름과 TypeScript 사용법은 한 곳에서 맞출 수 있다.

그러나 현재 성공 응답은 다음 cast를 사용한다.

```ts
return data as T;
```

따라서 목록 성공 응답의 실제 JSON 모양을 런타임에서 검증하는 것은 아니다. 같은 Next 앱 내부 Route Handler를 신뢰하는 현재 범위의 단순화다. 외부 API로 바뀌면 `IncidentListResponse` runtime validator 또는 Zod response schema가 필요하다.

```txt
Shared TypeScript Contract
→ 컴파일 시 개발자 계약

Zod / runtime guard
→ 실행 중 외부 데이터 검증
```

두 개념을 같은 것으로 설명하면 안 된다.

## 8. `/incidents/new` 폼 데이터의 출발점

브라우저 input 값은 숫자 input이라도 기본적으로 문자열이다.

```ts
type FormState = {
  latitude: string;
  longitude: string;
  affectedPeople: string;
  // 나머지 필드
};
```

예를 들어 영향 인원 input에 `12`가 보여도 `form.affectedPeople`은 문자열 `"12"`다.

`updateField`는 현재 필드를 바꾸고 그 필드의 이전 오류만 지운다.

```ts
setForm((current) => ({ ...current, [field]: value }));
setFieldErrors((current) => ({ ...current, [field]: undefined }));
```

## 9. submit부터 Zod까지

### 9.1 브라우저 기본 제출을 막는다

```ts
event.preventDefault();
```

페이지 전체 새로고침 대신 React handler에서 검증과 POST를 순서대로 실행하기 위해서다.

### 9.2 문자열 폼을 schema 입력 모양으로 만든다

```ts
const result = buildIncidentInput(form);
```

`buildIncidentInput`은 새 검증 규칙을 만들지 않는다. 폼의 평평한 위도·경도 문자열을 공유 schema가 기대하는 `location` 객체로 배치한 뒤 기존 validator를 호출한다.

```ts
return validateCreateIncidentInput({
  title: form.title,
  location: {
    latitude: form.latitude,
    longitude: form.longitude,
  },
  affectedPeople: form.affectedPeople,
  // 나머지 필드
});
```

### 9.3 공유 validator

```ts
const result = createIncidentInputSchema.safeParse(value);
```

`safeParse`는 잘못된 입력에서 throw하지 않고 성공·실패 union을 반환한다.

```txt
success=true
→ result.data는 변환이 끝난 CreateIncidentInput

success=false
→ result.error.issues
→ 필드별 오류 문구로 변환
```

Zod가 처리하는 대표 규칙:

```txt
title             → trim, 4~80자
description       → trim, 10~300자
category          → 허용된 IncidentCategory
severity          → 허용된 IncidentSeverity
regionId          → 길이와 영문 소문자·숫자·하이픈
latitude          → 숫자 변환, -90~90
longitude         → 숫자 변환, -180~180
affectedPeople    → 정수 변환, 0~100000
assignedTeam      → 빈 문자열은 undefined, 최대 40자
```

### 9.4 실패하면 POST하지 않는다

```ts
if (!result.success) {
  setFieldErrors(result.errors);
  setError("입력값을 확인해야 합니다.");
  return;
}
```

`return`이 있으므로 잘못된 입력은 `createIncident`까지 내려가지 않는다.

### 9.5 성공하면 POST한다

```ts
const incident = await createIncident(result.input);
router.push(`/incidents/${incident.id}`);
```

검증에 성공해 숫자 변환과 trim이 끝난 `result.input`만 서버로 보낸다.

## 10. 서버가 같은 입력을 다시 검증하는 이유

POST Route Handler는 body를 `unknown`으로 시작한다.

```ts
let body: unknown;
body = await request.json();
```

그 뒤 순서대로 검사한다.

```txt
JSON parsing 성공 여부
→ 객체인지 검사
→ validateCreateIncidentInput(body)
→ 실패하면 400 ApiError
→ 성공하면 createIncident(result.input)
→ 201 IncidentDetailResponse
```

클라이언트 검증은 빠른 사용자 피드백을 위한 것이다. 보안 경계는 서버 검증이다.

```txt
브라우저 검증을 우회한 직접 POST
→ Route Handler가 다시 Zod 검증
→ 잘못된 데이터 저장 차단
```

같은 validator를 재사용하므로 클라이언트와 서버에 규칙을 두 벌로 작성하지 않는다.

## 11. 접근성 코드 흐름

### 11.1 label과 input 연결

```tsx
<label htmlFor="incident-title">사고명</label>
<input id="incident-title" />
```

label을 클릭해도 input에 focus가 가고, 화면 읽기 도구가 입력 이름을 알 수 있다.

### 11.2 오류 상태와 설명 연결

```tsx
<input
  aria-invalid={Boolean(fieldErrors.title)}
  aria-describedby={
    fieldErrors.title ? "incident-title-error" : undefined
  }
/>

<FieldError
  id="incident-title-error"
  message={fieldErrors.title}
/>
```

오류가 있을 때만 `aria-describedby`가 실제로 존재하는 오류 문장을 가리킨다.

### 11.3 비동기 상태

```tsx
<form aria-busy={saving}>
<button disabled={saving} type="submit">
```

저장 중 중복 제출을 막고 폼이 처리 중임을 전달한다.

### 11.4 live message

```tsx
<p role="status">사고를 등록하는 중입니다.</p>
<p role="alert">{error}</p>
```

일반 진행 상태와 즉시 알려야 할 오류의 의미를 구분한다.

`noValidate`는 브라우저 기본 오류 팝업 대신 공유 Zod 오류를 일관되게 표시하기 위한 선택이다. 그래서 커스텀 오류의 `aria-invalid`, 설명 연결, live region을 빠뜨리면 안 된다.

## 12. X-Ray 코드는 어떻게 연결했는가

두 페이지 모두 hook을 한 번만 호출한다.

```ts
const { enabled: xray, mode } = useXRay();
```

정확한 기술 선택은 원본 mode를 직접 비교한다.

```tsx
enabled={xray || mode === "rest-api"}
enabled={xray || mode === "zod" || mode === "accessibility"}
```

별도 `useRestXRay`, `useReduxXRay`, `useValidationXRay` helper는 만들지 않았다. 한 페이지에서 한 번 쓰는 직접 비교보다 간접 경로만 늘어나기 때문이다.

### 12.1 `/incidents` 경계

```txt
feature/incident/ShareIncidentFilters
→ rest-api, redux

widget/IncidentList
→ rest-api

feature/incident/FetchIncidentList
→ rest-api

entity/incident/IncidentListItems
→ rest-api, Shared Contract 표시
```

### 12.2 `/incidents/new` 경계

```txt
widget/IncidentCreateForm
→ rest-api, zod, accessibility

feature/incident/CreateIncident
→ rest-api, zod, accessibility

entity/incident/CreateIncidentInput
→ rest-api, zod, accessibility, Shared Validation
```

### 12.3 동적 증거 패널

목록 패널은 기존 값을 받는다.

```txt
filters
query
activeFilterCount
selectedIncidentId
loading
incidents.length
```

등록 패널도 기존 값을 받는다.

```txt
fieldErrors 개수
saving
```

증거용 가짜 store나 가짜 API 상태를 만들지 않았다. 사용자가 필터를 변경하거나 검증 오류를 만들면 패널의 현재 값도 같이 바뀐다.

기존 공통 CSS를 그대로 재사용한다.

```txt
technology-evidence
technology-flow
technology-code
```

## 13. 직접 실습 1 — REST API

개발 서버를 실행한다.

```powershell
npm run dev:web
```

다음 주소를 연다.

```txt
http://127.0.0.1:3000/incidents?xray=rest-api
```

확인 순서:

```txt
1. selector가 REST API인지 확인한다.
2. REST 관련 경계와 REST API 증거 패널을 확인한다.
3. 심각도를 긴급으로 변경한다.
4. 패널의 현재 REST query가 {"severity":"critical"}인지 확인한다.
5. Network에서 /api/incidents?severity=critical 요청을 확인한다.
6. 응답 JSON의 incidents 배열과 화면 결과 개수를 비교한다.
7. 검색어를 입력해 URL encoding과 새 GET 요청을 확인한다.
```

잘못된 query도 확인할 수 있다.

```txt
http://127.0.0.1:3000/api/incidents?severity=unknown
```

예상 결과는 HTTP 400과 `INVALID_SEVERITY` 오류다.

## 14. 직접 실습 2 — Redux

```txt
http://127.0.0.1:3000/incidents?xray=redux
```

확인 순서:

```txt
1. 검색어를 입력한다.
2. Redux 필터 개수가 1로 바뀌는지 확인한다.
3. status 또는 region filter를 하나 더 고른다.
4. 필터 개수가 2로 바뀌는지 확인한다.
5. 증거 패널의 원본 filters와 파생 query를 비교한다.
6. 사고 한 건을 선택한다.
7. selectedIncidentId가 증거 패널에 표시되는지 확인한다.
8. 지도 관제로 이동한다.
9. 같은 Redux 필터와 선택 사고가 반영되는지 확인한다.
```

핵심은 Redux badge가 아니라 실제 state가 다른 화면의 REST 조회와 선택에 재사용되는 것이다.

## 15. 직접 실습 3 — Zod 실패 경로

```txt
http://127.0.0.1:3000/incidents/new?xray=zod
```

빈 사고명과 짧은 설명으로 제출한다.

예상 흐름:

```txt
handleSubmit
→ buildIncidentInput
→ validateCreateIncidentInput
→ safeParse 실패
→ fieldErrors 설정
→ return
→ POST 요청 없음
```

확인할 것:

```txt
1. Zod 증거 패널의 오류 개수가 증가한다.
2. 사고명과 상세 내용 아래에 필드 오류가 보인다.
3. Network에 POST /api/incidents가 생기지 않는다.
4. 오류 필드를 수정하면 해당 필드 오류가 지워진다.
```

숫자 변환도 확인한다.

```txt
영향 인원 "12"
→ Zod coerce
→ number 12
```

빈 숫자 문자열은 `0`으로 오해하지 않도록 먼저 `NaN`으로 바뀌고 검증에 실패한다.

## 16. 직접 실습 4 — 접근성

```txt
http://127.0.0.1:3000/incidents/new?xray=accessibility
```

마우스를 사용하지 않고 진행한다.

```txt
1. Tab으로 각 입력과 버튼에 이동한다.
2. label을 클릭했을 때 대응 input에 focus가 가는지 확인한다.
3. 잘못된 값으로 제출한다.
4. 오류 input의 aria-invalid가 true인지 확인한다.
5. aria-describedby가 화면의 오류 p id를 가리키는지 확인한다.
6. 제출 버튼이 saving 중 disabled인지 확인한다.
7. status와 alert가 의미에 맞게 존재하는지 확인한다.
```

현재 구현은 첫 오류 필드로 focus를 자동 이동하지 않는다. 오류를 더 빠르게 찾게 해야 하는 요구가 생기면 submit 실패 시 첫 오류 input에 focus하는 기능을 추가한다.

## 17. 직접 실습 5 — 서버 재검증

클라이언트 폼을 통하지 않고 잘못된 JSON을 보낸다.

```powershell
Invoke-WebRequest `
  -Method Post `
  -ContentType 'application/json' `
  -Body '{"title":"x"}' `
  -Uri 'http://127.0.0.1:3000/api/incidents'
```

예상 결과:

```txt
POST Route Handler
→ request.json 성공
→ validateCreateIncidentInput 실패
→ HTTP 400
→ INVALID_TITLE 또는 첫 번째 필드 오류 code
→ 저장되지 않음
```

이 실습이 클라이언트 검증만 믿지 않는 이유를 증명한다.

## 18. 문제를 코드 위치로 찾는 법

| 증상 | 먼저 확인할 위치 | 이유 |
| --- | --- | --- |
| selector에 기술이 없음 | `xray-selector.tsx` option | 사용자에게 보이는 직접 출처 |
| URL 직접 접근이 all로 바뀜 | `getXRayMode` | query 허용 목록 |
| 선택해도 대표 화면으로 안 감 | `getXRayPathname` | 선택 시 route 결정 |
| 검색 변경 후 요청이 안 감 | slice와 `selectIncidentListQuery` | input에서 query까지의 경로 |
| `all`이 API로 전송됨 | `selectIncidentListQuery` | UI 전용 값을 제거하는 위치 |
| API가 잘못된 severity를 허용 | Route Handler `GET` | 서버 query 신뢰 경계 |
| 잘못된 폼이 POST됨 | `handleSubmit`의 실패 return | POST 전 차단 위치 |
| 직접 POST가 잘못된 데이터를 저장 | Route Handler `POST` validator | 서버 body 신뢰 경계 |
| 오류 문구가 input과 연결되지 않음 | `aria-describedby`와 FieldError id | 접근성 설명 관계 |
| 저장 중 여러 번 제출됨 | `saving`과 button disabled | 중복 제출 차단 |

## 19. 현재 한계

### REST

- 데이터는 메모리 store이므로 서버 재시작 시 등록 내용이 사라진다.
- 성공 응답의 JSON은 `requestJson<T>`에서 runtime validation 없이 cast한다.
- 요청 취소를 위한 `AbortController`는 없다.
- 목록 검색 debounce가 없어 타이핑마다 query가 바뀌면 요청이 발생한다.
- 인증, 권한, rate limit, 영속 DB가 없다.

### Redux

- 필터는 메모리 상태라 새로고침하면 초기화된다.
- Redux DevTools용 별도 설정이나 persistence가 없다.
- 서버 응답 캐싱은 Redux 책임으로 넣지 않았다.
- 현재 페이지 수와 데이터 규모에서는 이 범위로 충분하다.

### Validation

- 등록 schema는 강하지만 목록 성공 응답 schema는 없다.
- 지역 ID는 문자열 형식만 검사하고 실제 허용 지역 목록과 대조하지 않는다.
- 날짜 문자열의 실제 ISO 유효성 검사까지는 하지 않는다.

### Accessibility

- submit 실패 후 첫 오류 필드로 자동 focus하지 않는다.
- 오류 요약 목록이 없다.
- 실제 screen reader별 수동 검증 기록은 별도로 남기지 않았다.

## 20. 확장 순서

실제 요구가 생기면 다음 순서로 확장한다.

```txt
1. 외부 REST API 사용 시 성공 response runtime validation
2. 검색 요청이 과도할 때 debounce 또는 명시적 검색 제출
3. 취소가 필요한 느린 요청에 AbortController
4. 영속 데이터가 필요할 때 DB와 repository 경계
5. 인증·권한과 서버 입력 정책 강화
6. 폼 오류가 많아질 때 첫 오류 focus와 오류 요약
7. 공유가 필요한 서버 캐시가 생길 때 전용 server-state 도구 검토
```

현재 필요가 없는 범용 API client, form framework, Redux persistence, schema factory는 미리 만들지 않는다.

## 21. 추가 필터를 구현할 때의 순서

예를 들어 `assignedTeam` 필터를 추가한다면 다음 순서로 진행한다.

```txt
1. IncidentListQuery에 assignedTeam 추가
2. IncidentFilters와 initialFilters에 필드 추가
3. reducer action 추가
4. selectIncidentListQuery에서 all/빈 값 제거
5. IncidentFilterPanel input 연결
6. fetchIncidents에서 URLSearchParams 추가
7. GET Route Handler에서 길이와 형식 검증
8. listIncidents에서 실제 필터 적용
9. selector·Route Handler 테스트
10. REST/Redux X-Ray 패널에서 현재 값 확인
```

화면 input만 먼저 추가하면 Redux state, URL, 서버 필터가 끊어진다. 계약에서 시작해 소비 흐름 전체를 연결해야 한다.

## 22. 최종 검증

```powershell
npm run typecheck
npm test
git diff --check
```

브라우저 체크리스트:

```txt
/incidents?xray=rest-api 직접 접근
→ REST 경계와 실제 query·응답 수 표시

/incidents?xray=redux 직접 접근
→ Redux dispatch·slice·selector 흐름 표시

/incidents/new?xray=zod 직접 접근
→ invalid submit 후 오류 수와 필드 오류 표시

/incidents/new?xray=accessibility 직접 접근
→ label·aria-invalid·aria-describedby·live region 표시

다른 메뉴 이동
→ xray query는 유지
→ 대표 페이지로 강제 복귀하지 않음
```

20-4의 핵심은 다음이다.

```txt
사용자 입력
→ Redux가 조회 조건 공유
→ REST가 서버와 데이터 교환
→ Shared Contract가 개발자 간 모양 통일
→ Zod가 실행 중 입력 검증
→ 접근성 속성이 오류와 상태를 사용자에게 전달
→ X-Ray가 이 실제 경로와 현재 값을 화면에 노출
```
