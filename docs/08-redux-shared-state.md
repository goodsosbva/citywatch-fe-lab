# 8단계: Redux 상태 공유

## 1. 지금까지 한 것

7단계까지는 사고 등록, REST API, 위험도 계산, Vitest 단위 테스트까지 만들었다.

```txt
사고 등록
→ Zod 검증
→ REST API
→ 사고 목록/상세
→ 위험도 계산
→ Vitest 단위 테스트
```

8단계에서는 사고 목록 관제 화면의 필터와 선택 사고를 Redux로 공유한다.

이번 단계에서 Redux에 넣은 값은 다음이다.

```ts
filters: {
  search: string;
  severity: IncidentSeverity | "all";
  status: IncidentStatus | "all";
  regionId: string;
}

selectedIncidentId?: string;
```

Redux에 넣지 않은 값은 다음이다.

```ts
incidents: Incident[];
loading: boolean;
error?: string;
```

이유는 구분이 다르기 때문이다.

```txt
filters / selectedIncidentId
→ 여러 UI가 같이 봐야 하는 클라이언트 화면 상태
→ Redux에 적합

incidents / loading / error
→ REST API 요청 결과와 요청 상태
→ 현재 단계에서는 page local state로 충분
```

즉 이번 단계에서 Redux는 서버 데이터 캐시가 아니라, 관제 화면의 공용 UI 상태를 관리한다.

## 2. 이번에 구현한 것

추가한 의존성:

```txt
@reduxjs/toolkit
react-redux
```

주요 파일:

```txt
apps/web/app/incidents/incident-control-slice.ts
apps/web/app/store.ts
apps/web/app/store-provider.tsx
apps/web/app/store-hooks.ts
apps/web/app/layout.tsx
apps/web/app/incidents/page.tsx
apps/web/app/incidents/incident-detail-view.tsx
```

X-Ray 라벨:

```txt
feature/incident/ShareIncidentFilters
feature/incident/ShareSelectedIncident
```

## 3. Redux를 왜 이렇게 만들었는지

Redux store는 개발자가 직접 `dispatch`, `getState`, `subscribe`, `replaceReducer`를 만드는 객체가 아니다.

개발자는 다음을 정의한다.

```txt
1. 초기 state
2. state를 바꾸는 reducer 규칙
3. action creator
4. selector
5. configureStore에 등록할 reducer map
```

그러면 Redux Toolkit의 `configureStore`가 실제 store 객체를 만든다.

그 결과 store는 기본적으로 다음 API를 가진다.

```ts
store.dispatch;
store.getState;
store.subscribe;
store.replaceReducer;
```

핵심 흐름:

```txt
createSlice()
→ reducer 함수와 action creator 생성

export default incidentControlSlice.reducer
→ reducer 함수만 store.ts로 내보냄

configureStore({ reducer: { incidentControl: incidentControlReducer }})
→ reducer를 재료로 Redux store 객체 생성

Redux store 객체
→ dispatch / getState / subscribe / replaceReducer 기본 API를 가짐
```

즉 `dispatch/getState/subscribe/replaceReducer`는 `incident-control-slice.ts`에서 export한 것이 아니다.
`configureStore`가 store를 만들면서 생기는 Redux store 기본 API다.

## 4. 코드 흐름

### 4-1. slice에서 초기 state를 만든다

파일:

```txt
apps/web/app/incidents/incident-control-slice.ts
```

코드:

```ts
type AllFilter = "all";

export type IncidentFilters = {
  search: string;
  severity: IncidentSeverity | AllFilter;
  status: IncidentStatus | AllFilter;
  regionId: string;
};

export type IncidentControlState = {
  filters: IncidentFilters;
  selectedIncidentId?: string;
};

const initialFilters: IncidentFilters = {
  search: "",
  severity: "all",
  status: "all",
  regionId: "all",
};

const initialState: IncidentControlState = {
  filters: initialFilters,
};
```

실행 전 상태:

```txt
Redux store 없음
incidentControl state 없음
dispatch 없음
getState 없음
```

해결하려는 문제:

```txt
사고 목록 화면이 처음 열렸을 때 사용할 기본 필터 상태가 필요하다.
```

이 코드 뒤에 생기는 값:

```ts
initialState = {
  filters: {
    search: "",
    severity: "all",
    status: "all",
    regionId: "all",
  },
};
```

다음 코드에서 사용되는 방식:

```ts
createSlice({
  name: "incidentControl",
  initialState,
  reducers: { ... },
});
```

없애면 생기는 문제:

```txt
Redux가 처음 state를 만들 기준이 없다.
filters.search 같은 값을 안전하게 읽을 수 없다.
```

예제 추적:

```txt
검색 input 초기 value
→ filters.search
→ ""
```

### 4-2. createSlice로 case reducer와 action creator를 만든다

파일:

```txt
apps/web/app/incidents/incident-control-slice.ts
```

코드:

```ts
const incidentControlSlice = createSlice({
  name: "incidentControl",
  initialState,
  reducers: {
    setSearchFilter(state, action: PayloadAction<string>) {
      state.filters.search = action.payload;
    },
    setSeverityFilter(state, action: PayloadAction<IncidentFilters["severity"]>) {
      state.filters.severity = action.payload;
    },
    setStatusFilter(state, action: PayloadAction<IncidentFilters["status"]>) {
      state.filters.status = action.payload;
    },
    setRegionFilter(state, action: PayloadAction<string>) {
      state.filters.regionId = action.payload;
    },
    resetIncidentFilters(state) {
      state.filters = { ...initialFilters };
    },
    setSelectedIncidentId(state, action: PayloadAction<string>) {
      state.selectedIncidentId = action.payload;
    },
  },
});
```

실행 전 상태:

```txt
initialState만 있음
아직 reducer 함수 없음
아직 action creator 없음
아직 Redux store 없음
```

해결하려는 문제:

```txt
검색어, 심각도, 상태, 지역, 선택 사고 ID를 어떻게 바꿀지 규칙이 필요하다.
```

이 코드 뒤에 생기는 값:

```txt
incidentControlSlice.reducer
incidentControlSlice.actions.setSearchFilter
incidentControlSlice.actions.setSeverityFilter
incidentControlSlice.actions.setStatusFilter
incidentControlSlice.actions.setRegionFilter
incidentControlSlice.actions.resetIncidentFilters
incidentControlSlice.actions.setSelectedIncidentId
```

중요한 표현:

```txt
reducers 객체 안에 작성한 메서드는 action 그 자체가 아니다.
이 메서드는 case reducer다.
createSlice가 case reducer 이름을 기준으로 action creator를 자동 생성한다.
```

예제:

```ts
setSearchFilter(state, action: PayloadAction<string>) {
  state.filters.search = action.payload;
}
```

이 case reducer를 기준으로 Redux Toolkit이 이런 action creator를 만든다.

```ts
incidentControlSlice.actions.setSearchFilter("침수");
```

개념적으로 만들어지는 action 객체:

```ts
{
  type: "incidentControl/setSearchFilter",
  payload: "침수",
}
```

다음 코드에서 사용되는 방식:

```ts
dispatch(setSearchFilter("침수"));
```

없애면 생기는 문제:

```txt
검색 input은 바뀌어도 Redux state를 바꾸는 규칙이 없다.
setSearchFilter action creator도 만들 수 없다.
```

예제 추적:

변경 전 state:

```ts
state = {
  filters: {
    search: "",
    severity: "all",
    status: "all",
    regionId: "all",
  },
};
```

action:

```ts
{
  type: "incidentControl/setSearchFilter",
  payload: "침수",
}
```

case reducer 실행:

```ts
state.filters.search = action.payload;
```

변경 후 state:

```ts
state = {
  filters: {
    search: "침수",
    severity: "all",
    status: "all",
    regionId: "all",
  },
};
```

### 4-3. actions를 export한다

파일:

```txt
apps/web/app/incidents/incident-control-slice.ts
```

코드:

```ts
export const {
  resetIncidentFilters,
  setRegionFilter,
  setSearchFilter,
  setSelectedIncidentId,
  setSeverityFilter,
  setStatusFilter,
} = incidentControlSlice.actions;
```

실행 전 상태:

```txt
action creator는 incidentControlSlice.actions 안에만 있음
page.tsx에서 바로 import할 수 없음
```

해결하려는 문제:

```txt
화면 컴포넌트에서 dispatch(setSearchFilter("침수"))처럼 사용해야 한다.
```

이 코드 뒤에 생기는 값:

```ts
setSearchFilter;
setStatusFilter;
setSelectedIncidentId;
```

다음 코드에서 사용되는 방식:

```ts
import { setSearchFilter } from "./incident-control-slice";

dispatch(setSearchFilter("침수"));
```

없애면 생기는 문제:

```txt
page.tsx에서 setSearchFilter를 import할 수 없다.
화면에서 action을 보내는 코드가 깨진다.
```

예제 추적:

```ts
setSearchFilter("침수");
```

결과:

```ts
{
  type: "incidentControl/setSearchFilter",
  payload: "침수",
}
```

### 4-4. selector를 만든다

파일:

```txt
apps/web/app/incidents/incident-control-slice.ts
```

코드:

```ts
type IncidentControlRootState = {
  incidentControl: IncidentControlState;
};

export const selectIncidentFilters = (state: IncidentControlRootState) =>
  state.incidentControl.filters;

export const selectSelectedIncidentId = (state: IncidentControlRootState) =>
  state.incidentControl.selectedIncidentId;
```

실행 전 상태:

```txt
Redux state 전체에서 필요한 값을 꺼내는 함수가 없음
```

해결하려는 문제:

```txt
컴포넌트가 state.incidentControl.filters 같은 구조를 매번 직접 알 필요가 없게 한다.
```

이 코드 뒤에 생기는 값:

```txt
selectIncidentFilters
selectSelectedIncidentId
```

다음 코드에서 사용되는 방식:

```ts
const filters = useAppSelector(selectIncidentFilters);
const selectedIncidentId = useAppSelector(selectSelectedIncidentId);
```

없애면 생기는 문제:

```txt
컴포넌트가 Redux state 구조를 직접 알아야 한다.
state key가 바뀌면 여러 화면 코드를 고쳐야 한다.
```

예제 추적:

입력 state:

```ts
state = {
  incidentControl: {
    filters: {
      search: "침수",
      severity: "all",
      status: "all",
      regionId: "all",
    },
    selectedIncidentId: "INC-001",
  },
};
```

실행:

```ts
selectIncidentFilters(state);
```

결과:

```ts
{
  search: "침수",
  severity: "all",
  status: "all",
  regionId: "all",
}
```

### 4-5. createSelector로 REST query를 만든다

파일:

```txt
apps/web/app/incidents/incident-control-slice.ts
```

코드:

```ts
export const selectIncidentListQuery = createSelector(
  selectIncidentFilters,
  (filters): IncidentListQuery => {
    const query: IncidentListQuery = {};
    const search = filters.search.trim();

    if (search) query.search = search;
    if (filters.severity !== "all") query.severity = filters.severity;
    if (filters.status !== "all") query.status = filters.status;
    if (filters.regionId !== "all") query.regionId = filters.regionId;

    return query;
  },
);
```

실행 전 상태:

```txt
Redux filters는 화면용 값이다.
severity/status/regionId에는 "all" 같은 UI 전용 값이 들어갈 수 있다.
```

해결하려는 문제:

```txt
API에는 search/status/regionId 같은 실제 query만 보내야 한다.
"all"은 API query로 보내면 안 된다.
```

이 코드 뒤에 생기는 값:

```txt
Redux filters를 IncidentListQuery 형태로 변환하는 selector
```

다음 코드에서 사용되는 방식:

```ts
const query = useAppSelector(selectIncidentListQuery);
```

없애면 생기는 문제:

```txt
page.tsx가 API query 조립 규칙까지 알아야 한다.
"all" 제거 로직이 화면 코드에 섞인다.
```

예제 추적:

입력 filters:

```ts
{
  search: "침수",
  severity: "all",
  status: "in_progress",
  regionId: "seocho",
}
```

실행:

```ts
const query: IncidentListQuery = {};
const search = filters.search.trim();
```

대입:

```ts
search = "침수";
```

조건 처리:

```ts
if (search) query.search = search;
// query.search = "침수"

if (filters.severity !== "all") query.severity = filters.severity;
// severity가 "all"이라 실행 안 됨

if (filters.status !== "all") query.status = filters.status;
// query.status = "in_progress"

if (filters.regionId !== "all") query.regionId = filters.regionId;
// query.regionId = "seocho"
```

결과:

```ts
{
  search: "침수",
  status: "in_progress",
  regionId: "seocho",
}
```

### 4-6. reducer를 export한다

파일:

```txt
apps/web/app/incidents/incident-control-slice.ts
```

코드:

```ts
export default incidentControlSlice.reducer;
```

실행 전 상태:

```txt
incidentControlSlice.reducer는 파일 내부에만 있음
store.ts에서 configureStore에 넣을 수 없음
```

해결하려는 문제:

```txt
configureStore가 사용할 reducer 함수를 밖으로 내보내야 한다.
```

이 코드 뒤에 생기는 값:

```txt
default export로 incidentControl reducer가 외부에 공개됨
```

다음 코드에서 사용되는 방식:

```ts
import incidentControlReducer from "./incidents/incident-control-slice";
```

없애면 생기는 문제:

```txt
store.ts가 incidentControlReducer를 import할 수 없다.
Redux store를 만들 때 incidentControl state를 등록할 수 없다.
```

### 4-7. configureStore에 reducer를 등록한다

파일:

```txt
apps/web/app/store.ts
```

코드:

```ts
import { configureStore } from "@reduxjs/toolkit";
import incidentControlReducer from "./incidents/incident-control-slice";

export function makeStore() {
  return configureStore({
    reducer: {
      incidentControl: incidentControlReducer,
    },
  });
}
```

실행 전 상태:

```txt
incidentControlReducer는 있음
하지만 Redux store 객체는 아직 없음
dispatch/getState/subscribe/replaceReducer도 없음
```

해결하려는 문제:

```txt
reducer는 state 변경 규칙일 뿐이다.
React 앱이 사용할 실제 Redux store 객체가 필요하다.
```

이 코드 뒤에 생기는 값:

```ts
const store = makeStore();
```

개념적 결과:

```ts
store = {
  dispatch: function,
  getState: function,
  subscribe: function,
  replaceReducer: function,
  ...
};
```

`reducer` 객체 내부 규칙:

```ts
configureStore({
  reducer: {
    [stateKey]: reducerFunction,
  },
});
```

현재 코드의 의미:

```txt
Redux 전체 state 안에 incidentControl이라는 key를 만든다.
incidentControl 아래 state는 incidentControlReducer가 관리한다.
```

초기 state:

```ts
store.getState();
```

결과:

```ts
{
  incidentControl: {
    filters: {
      search: "",
      severity: "all",
      status: "all",
      regionId: "all",
    },
  },
}
```

없애거나 다르게 작성하면 생기는 문제:

```ts
configureStore({
  reducer: {
    incident: incidentControlReducer,
  },
});
```

이렇게 바꾸면 state 구조도 바뀐다.

```ts
state.incident.filters;
```

하지만 selector는 현재 이 구조를 본다.

```ts
state.incidentControl.filters;
```

그래서 selector가 깨진다.

### 4-8. store 타입을 export한다

파일:

```txt
apps/web/app/store.ts
```

코드:

```ts
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
```

실행 전 상태:

```txt
makeStore 함수는 있지만,
makeStore가 반환하는 store 타입 이름이 없음
RootState 타입도 없음
dispatch 타입도 없음
```

해결하려는 문제:

```txt
useDispatch와 useSelector를 타입 안전하게 쓰려면 store 타입이 필요하다.
```

이 코드 뒤에 생기는 타입:

```txt
AppStore
→ makeStore()가 반환하는 Redux store 객체 타입

RootState
→ store.getState()가 반환하는 전체 state 타입

AppDispatch
→ store.dispatch 함수 타입
```

예제 추적:

```ts
const store = makeStore();
```

`store`는 다음 API를 가진다.

```ts
store.dispatch;
store.getState;
store.subscribe;
store.replaceReducer;
```

그래서:

```ts
type AppStore = ReturnType<typeof makeStore>;
```

는 개념적으로:

```ts
type AppStore = typeof store;
```

와 같다.

다음:

```ts
type RootState = ReturnType<AppStore["getState"]>;
```

는:

```ts
store.getState();
```

가 반환하는 타입이다.

예:

```ts
{
  incidentControl: IncidentControlState;
}
```

다음:

```ts
type AppDispatch = AppStore["dispatch"];
```

는:

```ts
store.dispatch
```

함수의 타입이다.

다음 코드에서 사용되는 방식:

```ts
import type { AppDispatch, RootState } from "./store";
```

없애면 생기는 문제:

```txt
useAppDispatch/useAppSelector를 정확한 타입으로 만들 수 없다.
selector state 구조와 dispatch action 타입 검사가 약해진다.
```

### 4-9. typed hook을 만든다

파일:

```txt
apps/web/app/store-hooks.ts
```

코드:

```ts
"use client";

import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "./store";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

실행 전 상태:

```txt
React Redux의 기본 useDispatch/useSelector는 있음
하지만 이 앱의 store 타입이 붙은 hook은 없음
```

해결하려는 문제:

```txt
컴포넌트마다 useDispatch<AppDispatch>() 같은 타입 지정을 반복하지 않게 한다.
```

이 코드 뒤에 생기는 값:

```txt
useAppDispatch
useAppSelector
```

다음 코드에서 사용되는 방식:

```ts
const dispatch = useAppDispatch();
const filters = useAppSelector(selectIncidentFilters);
```

없애면 생기는 문제:

```txt
컴포넌트마다 dispatch/selector 타입을 직접 연결해야 한다.
잘못된 action payload나 state key 오타를 놓치기 쉬워진다.
```

### 4-10. Provider를 만든다

파일:

```txt
apps/web/app/store-provider.tsx
```

코드:

```tsx
"use client";

import { useRef, type ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "./store";

export function StoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  return <Provider store={storeRef.current}>{children}</Provider>;
}
```

실행 전 상태:

```txt
makeStore는 있음
하지만 React 컴포넌트 트리에 store가 공급되지 않음
```

해결하려는 문제:

```txt
React 컴포넌트가 useAppDispatch/useAppSelector로 Redux store에 접근하려면 Provider가 필요하다.
```

이 코드 뒤에 생기는 값:

```tsx
<Provider store={storeRef.current}>{children}</Provider>
```

다음 코드에서 사용되는 방식:

```tsx
<StoreProvider>{children}</StoreProvider>
```

없애면 생기는 문제:

```txt
useAppSelector/useAppDispatch를 호출하는 컴포넌트가 Redux context를 찾지 못한다.
```

예제 추적:

첫 렌더링:

```ts
storeRef.current = null;
```

조건 실행:

```ts
if (!storeRef.current) {
  storeRef.current = makeStore();
}
```

결과:

```ts
storeRef.current = store;
```

다음 렌더링:

```ts
storeRef.current !== null;
```

그래서 `makeStore()`를 다시 호출하지 않는다.

### 4-11. layout에 Provider를 연결한다

파일:

```txt
apps/web/app/layout.tsx
```

코드:

```tsx
<body>
  <StoreProvider>{children}</StoreProvider>
</body>
```

실행 전 상태:

```txt
StoreProvider는 있지만 앱 트리에 연결되지 않음
```

해결하려는 문제:

```txt
Next App Router의 모든 page가 같은 Redux store 아래에서 렌더링되어야 한다.
```

이 코드 뒤에 생기는 구조:

```tsx
<StoreProvider>
  <IncidentsPage />
</StoreProvider>
```

Next App Router 흐름:

```txt
요청: /incidents
→ app/layout.tsx
→ app/incidents/page.tsx
→ page.tsx가 layout의 children으로 들어감
→ StoreProvider 아래에서 렌더링됨
```

없애면 생기는 문제:

```txt
하위 page에서 Redux store를 사용할 수 없다.
```

## 5. 실제로 동작시키면 어떤 흐름인지

예제는 검색어 `침수` 입력 기준이다.

### 5-1. page가 Redux 값을 읽는다

파일:

```txt
apps/web/app/incidents/page.tsx
```

코드:

```tsx
const dispatch = useAppDispatch();
const filters = useAppSelector(selectIncidentFilters);
const query = useAppSelector(selectIncidentListQuery);
const selectedIncidentId = useAppSelector(selectSelectedIncidentId);
```

현재 Redux state:

```ts
{
  incidentControl: {
    filters: {
      search: "",
      severity: "all",
      status: "all",
      regionId: "all",
    },
  },
}
```

결과:

```ts
filters = {
  search: "",
  severity: "all",
  status: "all",
  regionId: "all",
};

query = {};
```

### 5-2. 검색 input에 값을 입력한다

파일:

```txt
apps/web/app/incidents/page.tsx
```

코드:

```tsx
<input
  className="text-input"
  id="incident-search"
  onChange={(event) => onSearchChange(event.target.value)}
  placeholder="사고명, ID, 담당 팀"
  type="search"
  value={filters.search}
/>
```

사용자 입력:

```txt
침수
```

실제 값:

```ts
event.target.value = "침수";
```

실행:

```ts
onSearchChange("침수");
```

### 5-3. dispatch로 action을 보낸다

파일:

```txt
apps/web/app/incidents/page.tsx
```

코드:

```tsx
onSearchChange={(value) => dispatch(setSearchFilter(value))}
```

대입:

```ts
value = "침수";
```

실행:

```ts
dispatch(setSearchFilter("침수"));
```

action creator 결과:

```ts
{
  type: "incidentControl/setSearchFilter",
  payload: "침수",
}
```

### 5-4. reducer가 state를 바꾼다

파일:

```txt
apps/web/app/incidents/incident-control-slice.ts
```

코드:

```ts
setSearchFilter(state, action: PayloadAction<string>) {
  state.filters.search = action.payload;
}
```

변경 전:

```ts
state.filters.search = "";
```

대입:

```ts
action.payload = "침수";
```

변경 후:

```ts
state.filters.search = "침수";
```

전체 state:

```ts
{
  incidentControl: {
    filters: {
      search: "침수",
      severity: "all",
      status: "all",
      regionId: "all",
    },
  },
}
```

### 5-5. selector가 REST query를 만든다

파일:

```txt
apps/web/app/incidents/incident-control-slice.ts
```

코드:

```ts
export const selectIncidentListQuery = createSelector(
  selectIncidentFilters,
  (filters): IncidentListQuery => {
    const query: IncidentListQuery = {};
    const search = filters.search.trim();

    if (search) query.search = search;
    if (filters.severity !== "all") query.severity = filters.severity;
    if (filters.status !== "all") query.status = filters.status;
    if (filters.regionId !== "all") query.regionId = filters.regionId;

    return query;
  },
);
```

입력:

```ts
filters = {
  search: "침수",
  severity: "all",
  status: "all",
  regionId: "all",
};
```

처리:

```ts
const query = {};
const search = "침수";

query.search = "침수";
```

결과:

```ts
query = {
  search: "침수",
};
```

### 5-6. query 변경으로 API를 다시 호출한다

파일:

```txt
apps/web/app/incidents/page.tsx
```

코드:

```tsx
useEffect(() => {
  let active = true;

  async function loadIncidents() {
    setLoading(true);

    try {
      const nextIncidents = await fetchIncidents(query);
      if (!active) return;
      setIncidents(nextIncidents);
      setError(undefined);
    } catch (reason) {
      if (!active) return;
      setError(getErrorMessage(reason));
    } finally {
      if (active) setLoading(false);
    }
  }

  void loadIncidents();

  return () => {
    active = false;
  };
}, [query]);
```

대입:

```ts
query = { search: "침수" };
```

실행:

```ts
fetchIncidents({ search: "침수" });
```

### 5-7. fetchIncidents가 URL을 만든다

파일:

```txt
apps/web/app/incidents/incident-api.ts
```

코드:

```ts
export async function fetchIncidents(query: IncidentListQuery = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.severity) params.set("severity", query.severity);
  if (query.status) params.set("status", query.status);
  if (query.regionId) params.set("regionId", query.regionId);

  const suffix = params.size ? `?${params.toString()}` : "";
  const data = await requestJson<IncidentListResponse>(`/api/incidents${suffix}`);
  return data.incidents;
}
```

대입:

```ts
query.search = "침수";
```

처리:

```ts
params.set("search", "침수");
```

결과:

```txt
GET /api/incidents?search=침수
```

### 5-8. 서버 route가 query를 읽는다

파일:

```txt
apps/web/app/api/incidents/route.ts
```

코드:

```ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const severity = searchParams.get("severity")?.trim();
  const status = searchParams.get("status")?.trim();
  const regionId = searchParams.get("regionId")?.trim();

  const query: IncidentListQuery = {};
  if (search) query.search = search;
  if (severity && isIncidentSeverity(severity)) query.severity = severity;
  if (status && isIncidentStatus(status)) query.status = status;
  if (regionId) query.regionId = regionId;

  return NextResponse.json<IncidentListResponse>({ incidents: listIncidents(query) });
}
```

입력 URL:

```txt
/api/incidents?search=침수
```

결과:

```ts
search = "침수";

query = {
  search: "침수",
};
```

### 5-9. 서버 store에서 실제 데이터를 필터링한다

파일:

```txt
apps/web/app/api/incidents/incident-store.ts
```

코드:

```ts
export function listIncidents(query: IncidentListQuery = {}) {
  const search = query.search?.trim().toLowerCase();

  return [...incidents.values()].filter((incident) => {
    if (query.severity && incident.severity !== query.severity) return false;
    if (query.status && incident.status !== query.status) return false;
    if (query.regionId && incident.regionId !== query.regionId) return false;
    if (!search) return true;

    return [incident.id, incident.title, incident.description, incident.assignedTeam ?? ""].some((value) => value.toLowerCase().includes(search));
  });
}
```

입력:

```ts
query = { search: "침수" };
```

검색 대상 예시:

```ts
incident.title = "강남역 지하 보행로 침수 감지";
```

검사:

```ts
"강남역 지하 보행로 침수 감지".includes("침수");
// true
```

결과:

```txt
INC-001은 응답에 남음
```

### 5-10. 응답을 local state에 저장하고 화면을 갱신한다

파일:

```txt
apps/web/app/incidents/page.tsx
```

코드:

```tsx
const nextIncidents = await fetchIncidents(query);
if (!active) return;
setIncidents(nextIncidents);
setError(undefined);
```

입력:

```ts
nextIncidents = [
  {
    id: "INC-001",
    title: "강남역 지하 보행로 침수 감지",
    ...
  },
];
```

실행:

```ts
setIncidents(nextIncidents);
```

다음 렌더링:

```tsx
{incidents.map((incident) => (
  <IncidentListItem
    incident={incident}
    key={incident.id}
    onSelect={() => dispatch(setSelectedIncidentId(incident.id))}
    selected={incident.id === selectedIncidentId}
    xray={xray}
  />
))}
```

결과:

```txt
화면에는 "강남역 지하 보행로 침수 감지" 카드가 표시된다.
```

## 6. 이해 점검 피드백

이 섹션은 Redux를 공용 store 정도로 알고 있는 상태에서, 현재 구현을 어떻게 이해해야 하는지 점검한 내용이다.
먼저 사용자가 정리한 이해 내용을 그대로 남기고, 그 문장을 기준으로 하나씩 피드백한다.

### 6-0. 사용자가 정리한 이해 내용

사용자 정리 원문:

```txt
incident-contorl-slice.ts 에서 리듀서 즉, 리덕스 규칙을 만든다.
본 프로젝트는 리덕스 툴킷을 이용해서 해다 매서드인 createSlice이용해서 쓴다.
쓰는 방법은

파라미터 - 이름,state,reducer: { 객체 안에 매서드를 만드는데 이게 actions가 된다. }
actions는 state 값을 c/u/d 할 때 사용하는 매서드이다.

다르게 사용 즉 조회용은 getState를 써서 가져오거나
state를 보기 쉽게 미리 만들어 놓은게 있는데 그것이 바로 selector다.

createSelector을 이용해서 만들며
state로 가져올 함수르 첫번째 파라미터로 넣고
두번째 파라미터로 가져온 state값을 기준으로 적절하게 개발자가 변형후 return 해서 입맛에 맞게 쓴다.

여기까지가 리듀서 정의다 현재 본 프로젝트의 개발에서는!

다음단계로 store.ts에서 해당 리듀서를 가져와서 변수로 넣고
configureStore를 이용해서 해당 리듀서 규칙을 기준으로 스토어를 만드는 단계이다.

이때,

{
  reducer: {
    incidentControl: incidentControlReducer,
  },
}

이 내부에 정해진 규칙이 있는지?

이렇게 해서

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

해당 타입들도 export 해준다.

이러한 스토어들을 넣어주는 컴포넌트를 만든 부분이 아래이다.

"use client";

import { useRef, type ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "./store";

export function StoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  return <Provider store={storeRef.current}>{children}</Provider>;
}

이것을 루트 layout.ts에서

<StoreProvider>{children}</StoreProvider>

에 넣었고 next.js에서는 layout.ts를 자동적으로 가져와서
children에 page.tsx가 들어가게 되고
그 하위에 쭈르륵 트리형태로 돔이 생성되므로
이 스토어 전역 스토어에 역할을 하게된다.
```

이 원문은 큰 흐름을 잘 잡고 있다.
다만 몇 가지 표현은 실무 설명에서 오해가 생길 수 있다.

아래 피드백은 원문의 문장을 순서대로 훑으면서 정리한다.

### 6-1. "incident-control-slice.ts에서 리듀서, 즉 Redux 규칙을 만든다"

사용자 정리:

```txt
incident-control-slice.ts에서 Redux 규칙을 만든다.
```

판정:

```txt
맞다.
다만 "리듀서"라는 말은 더 정확히 나눠야 한다.
```

정확한 설명:

```txt
incident-control-slice.ts에서는 다음을 만든다.

1. 초기 state
2. case reducer
3. action creator
4. selector
5. store에 등록할 reducer 함수
```

관련 코드:

```ts
const incidentControlSlice = createSlice({
  name: "incidentControl",
  initialState,
  reducers: {
    setSearchFilter(state, action: PayloadAction<string>) {
      state.filters.search = action.payload;
    },
  },
});
```

여기서 `reducers` 안에 있는 `setSearchFilter`는 store 전체 reducer가 아니다.
정확히는 `case reducer`다.

```txt
case reducer
→ 특정 action type 하나를 처리하는 작은 reducer 규칙
```

이 `case reducer`들을 모아서 `createSlice`가 최종 reducer 함수를 만든다.

```ts
incidentControlSlice.reducer
```

이 최종 reducer가 store.ts로 넘어간다.

### 6-2. "Redux Toolkit의 createSlice를 이용해서 쓴다"

사용자 정리:

```txt
본 프로젝트는 Redux Toolkit을 이용해서 해당 메서드인 createSlice를 이용해서 쓴다.
```

판정:

```txt
맞다.
```

정확한 설명:

```txt
Redux를 직접 쓰면 action type 문자열, action creator, reducer switch문을 직접 작성해야 한다.
Redux Toolkit의 createSlice는 이 반복 작업을 줄여준다.
```

직접 Redux 방식이면 대략 이렇게 써야 한다.

```ts
const SET_SEARCH_FILTER = "incidentControl/setSearchFilter";

function setSearchFilter(payload: string) {
  return {
    type: SET_SEARCH_FILTER,
    payload,
  };
}

function incidentControlReducer(state = initialState, action: { type: string; payload?: unknown }) {
  switch (action.type) {
    case SET_SEARCH_FILTER:
      return {
        ...state,
        filters: {
          ...state.filters,
          search: String(action.payload),
        },
      };
    default:
      return state;
  }
}
```

Redux Toolkit을 쓰면 현재 프로젝트처럼 줄어든다.

```ts
const incidentControlSlice = createSlice({
  name: "incidentControl",
  initialState,
  reducers: {
    setSearchFilter(state, action: PayloadAction<string>) {
      state.filters.search = action.payload;
    },
  },
});
```

즉 `createSlice`는 다음을 대신 만든다.

```txt
action type
action creator
최종 reducer 함수
```

### 6-3. "파라미터는 이름, state, reducers 객체다"

사용자 정리:

```txt
파라미터 - 이름, state, reducer: { 객체 안에 메서드를 만든다 }
```

판정:

```txt
방향은 맞다.
표현은 조금 고쳐야 한다.
```

정확한 표현:

```txt
createSlice는 하나의 설정 객체를 받는다.
그 설정 객체 안에 name, initialState, reducers를 넣는다.
```

현재 코드:

```ts
createSlice({
  name: "incidentControl",
  initialState,
  reducers: {
    setSearchFilter(state, action: PayloadAction<string>) {
      state.filters.search = action.payload;
    },
  },
});
```

여기서 각 필드의 역할:

```txt
name
→ action type prefix가 된다.
→ "incidentControl/setSearchFilter"

initialState
→ store가 처음 만들어질 때 incidentControl state의 기본값이 된다.

reducers
→ action이 들어왔을 때 state를 어떻게 바꿀지 case reducer를 정의한다.
```

예제:

```ts
setSearchFilter("침수");
```

이 action creator가 만드는 action:

```ts
{
  type: "incidentControl/setSearchFilter",
  payload: "침수",
}
```

`type` 앞부분인 `incidentControl`은 `name`에서 온다.
`type` 뒷부분인 `setSearchFilter`는 `reducers` 안의 메서드 이름에서 온다.

### 6-4. "reducers 객체 안의 메서드가 actions가 된다"

사용자 정리:

```txt
reducers: { 객체 안에 메서드를 만드는데 이게 actions가 된다. }
```

판정:

```txt
절반은 맞고, 절반은 보정해야 한다.
```

틀릴 수 있는 표현:

```txt
reducers 안의 메서드 자체가 action이다.
```

정확한 표현:

```txt
reducers 안의 메서드는 case reducer다.
createSlice가 그 case reducer 이름을 보고 action creator를 자동 생성한다.
```

현재 코드:

```ts
reducers: {
  setSearchFilter(state, action: PayloadAction<string>) {
    state.filters.search = action.payload;
  },
}
```

이 코드에서 `setSearchFilter`는 state 변경 규칙이다.

그리고 Redux Toolkit이 자동으로 만든 action creator는 여기 들어 있다.

```ts
incidentControlSlice.actions.setSearchFilter
```

그래서 밖으로 꺼낼 때는 이렇게 쓴다.

```ts
export const {
  setSearchFilter,
} = incidentControlSlice.actions;
```

실제 호출:

```ts
setSearchFilter("침수");
```

결과:

```ts
{
  type: "incidentControl/setSearchFilter",
  payload: "침수",
}
```

즉 정확한 흐름:

```txt
reducers.setSearchFilter 작성
→ createSlice가 actions.setSearchFilter 자동 생성
→ export const { setSearchFilter } = incidentControlSlice.actions
→ 화면에서 dispatch(setSearchFilter("침수"))
```

### 6-5. "actions는 state 값을 C/U/D 할 때 사용하는 메서드다"

사용자 정리:

```txt
actions는 state 값을 c/u/d 할 때 사용하는 메서드이다.
```

판정:

```txt
실무 설명으로는 조금 위험하다.
상태 변경 요청이라고 이해하는 게 더 정확하다.
```

정확한 표현:

```txt
action creator는 action 객체를 만드는 함수다.
action 객체는 "어떤 일이 일어났는지"를 store에 알리는 이벤트다.
state를 직접 바꾸는 것은 action이 아니라 reducer다.
```

예제:

```ts
dispatch(setSearchFilter("침수"));
```

여기서 `setSearchFilter("침수")`는 state를 바로 바꾸지 않는다.
이 함수는 action 객체를 만든다.

```ts
{
  type: "incidentControl/setSearchFilter",
  payload: "침수",
}
```

그 action 객체를 `dispatch`가 store에 보낸다.

```ts
dispatch({
  type: "incidentControl/setSearchFilter",
  payload: "침수",
});
```

그 다음 reducer가 state를 바꾼다.

```ts
state.filters.search = action.payload;
```

즉 정확한 실행 순서:

```txt
action creator
→ action 객체 생성
→ dispatch(action)
→ reducer 실행
→ state 변경
```

### 6-6. "조회는 getState로 가져오거나 selector를 쓴다"

사용자 정리:

```txt
조회용은 getState를 써서 가져오거나 state를 보기 쉽게 미리 만들어 놓은게 selector다.
```

판정:

```txt
원리적으로는 맞다.
React 앱 설명으로는 보정이 필요하다.
```

정확한 설명:

```txt
Redux store 자체에는 getState가 있다.
store.getState()를 호출하면 현재 전체 Redux state를 가져올 수 있다.

하지만 React 컴포넌트에서는 보통 store.getState()를 직접 호출하지 않는다.
React Redux의 useSelector 계열 hook을 사용한다.
```

현재 코드:

```ts
const filters = useAppSelector(selectIncidentFilters);
const query = useAppSelector(selectIncidentListQuery);
```

개념적으로는 이 흐름에 가깝다.

```ts
const state = store.getState();
const filters = selectIncidentFilters(state);
const query = selectIncidentListQuery(state);
```

하지만 실제 React 코드에서는 `useAppSelector`를 쓴다.

이유:

```txt
useAppSelector는 값을 읽는 것뿐 아니라,
store state가 바뀌었을 때 컴포넌트 리렌더링까지 연결한다.
```

만약 컴포넌트에서 `store.getState()`만 직접 쓰면:

```txt
현재 값은 읽을 수 있지만,
state 변경 시 React 컴포넌트가 자동으로 다시 렌더링되는 흐름을 놓치기 쉽다.
```

### 6-7. "selector는 createSelector로 만든다"

사용자 정리:

```txt
createSelector을 이용해서 만들며 state로 가져올 함수를 첫번째 파라미터로 넣고
두번째 파라미터로 가져온 state값을 기준으로 변형후 return 해서 입맛에 맞게 쓴다.
```

판정:

```txt
현재 프로젝트 기준으로는 맞다.
일반 개념으로는 input selector가 여러 개일 수 있다는 점만 보정하면 된다.
```

현재 코드:

```ts
export const selectIncidentListQuery = createSelector(
  selectIncidentFilters,
  (filters): IncidentListQuery => {
    const query: IncidentListQuery = {};
    const search = filters.search.trim();

    if (search) query.search = search;
    if (filters.severity !== "all") query.severity = filters.severity;
    if (filters.status !== "all") query.status = filters.status;
    if (filters.regionId !== "all") query.regionId = filters.regionId;

    return query;
  },
);
```

현재 프로젝트에서는 input selector가 하나다.

```ts
selectIncidentFilters
```

그래서 두 번째 함수는 `filters`를 받는다.

```ts
(filters): IncidentListQuery => { ... }
```

입력:

```ts
filters = {
  search: "침수",
  severity: "all",
  status: "in_progress",
  regionId: "seocho",
}
```

반환:

```ts
{
  search: "침수",
  status: "in_progress",
  regionId: "seocho",
}
```

일반적으로는 이렇게 여러 input selector를 받을 수도 있다.

```ts
createSelector(
  selectIncidentFilters,
  selectSelectedIncidentId,
  (filters, selectedIncidentId) => {
    return { filters, selectedIncidentId };
  },
);
```

정확한 표현:

```txt
createSelector는 앞쪽에 input selector들을 받고,
마지막 함수에서 그 selector들이 반환한 값을 조합하거나 변형해 최종 값을 만든다.
```

### 6-8. "여기까지가 reducer 정의다"

사용자 정리:

```txt
여기까지가 리듀서 정의다 현재 본 프로젝트의 개발에서는!
```

판정:

```txt
표현을 나눠야 한다.
```

정확한 설명:

```txt
incident-control-slice.ts 전체가 reducer 정의만 하는 것은 아니다.
이 파일은 Redux slice 정의 파일이다.
```

포함하는 것:

```txt
initialState
case reducers
generated actions export
selectors
default reducer export
```

즉 정확한 표현:

```txt
여기까지가 incidentControl slice 정의다.
그 안에 reducer 정의, action creator export, selector 정의가 함께 들어 있다.
```

### 6-9. "store.ts에서 reducer를 가져와 configureStore로 store를 만든다"

사용자 정리:

```txt
다음단계로 store.ts에서 해당 리듀서를 가져와서 변수로 넣고
configureStore를 이용해서 해당 리듀서 규칙을 기준으로 스토어를 만드는 단계이다.
```

판정:

```txt
맞다.
```

현재 코드:

```ts
import { configureStore } from "@reduxjs/toolkit";
import incidentControlReducer from "./incidents/incident-control-slice";

export function makeStore() {
  return configureStore({
    reducer: {
      incidentControl: incidentControlReducer,
    },
  });
}
```

정확한 인과:

```txt
incidentControlReducer
→ incidentControl slice의 state 변경 규칙

configureStore
→ 이 reducer를 받아 실제 Redux store 객체 생성

makeStore()
→ 생성된 store 객체 반환
```

이때 생기는 store API:

```ts
store.dispatch;
store.getState;
store.subscribe;
store.replaceReducer;
```

이 네 개는 개발자가 reducer에서 export한 것이 아니다.
`configureStore`가 Redux store를 만들면서 제공하는 기본 API다.

### 6-10. "configureStore의 reducer 객체 내부 규칙"

사용자 질문:

```ts
{
  reducer: {
    incidentControl: incidentControlReducer,
  },
}
```

```txt
이 내부에 정해진 규칙이 있는지?
```

답:

```txt
있다.
```

형식:

```ts
configureStore({
  reducer: {
    [stateKey]: reducerFunction,
  },
});
```

현재 코드:

```ts
configureStore({
  reducer: {
    incidentControl: incidentControlReducer,
  },
});
```

의미:

```txt
Redux 전체 state 안에 incidentControl이라는 key를 만든다.
그 key 아래 state는 incidentControlReducer가 관리한다.
```

그래서 state 구조는 이렇게 된다.

```ts
{
  incidentControl: {
    filters: {
      search: "",
      severity: "all",
      status: "all",
      regionId: "all",
    },
    selectedIncidentId: undefined,
  }
}
```

만약 key를 바꾸면:

```ts
configureStore({
  reducer: {
    incident: incidentControlReducer,
  },
});
```

state 구조도 바뀐다.

```ts
{
  incident: {
    filters: ...
  }
}
```

하지만 현재 selector는 이것을 본다.

```ts
state.incidentControl.filters;
```

따라서 key 이름을 바꾸면 selector도 같이 바꿔야 한다.

### 6-11. "AppStore, RootState, AppDispatch도 export한다"

사용자 정리:

```txt
해당 타입들도 export 해준다.
```

판정:

```txt
맞다.
```

현재 코드:

```ts
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
```

정확한 설명:

```txt
AppStore
→ makeStore()가 반환하는 완성된 Redux store 객체 타입

RootState
→ store.getState()가 반환하는 전체 state 타입

AppDispatch
→ store.dispatch 함수 타입
```

중요한 점:

```txt
이 타입들은 createSlice에서 만들어진 것이 아니다.
configureStore로 만들어지는 store 객체 타입에서 뽑아낸 것이다.
```

흐름:

```txt
makeStore()
→ configureStore(...)
→ 완성된 Redux store 객체 반환
→ 이 store 객체는 dispatch/getState/subscribe/replaceReducer를 가짐
→ ReturnType<typeof makeStore>가 그 store 객체 타입을 뽑음
→ AppStore가 됨
```

예제:

```ts
const store = makeStore();
```

개념적으로:

```ts
type AppStore = typeof store;
```

이걸 변수 없이 작성한 것이:

```ts
export type AppStore = ReturnType<typeof makeStore>;
```

### 6-12. "StoreProvider로 store를 넣어준다"

사용자 정리:

```txt
이러한 스토어들을 넣어주는 컴포넌트를 만든 부분이 StoreProvider이다.
```

판정:

```txt
맞다.
다만 "스토어들을"보다는 "store 객체 하나를" 넣어준다고 표현하는 게 정확하다.
```

현재 코드:

```tsx
export function StoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  return <Provider store={storeRef.current}>{children}</Provider>;
}
```

정확한 흐름:

```txt
storeRef.current가 null이면 makeStore()를 실행한다.
makeStore()는 Redux store 객체를 만든다.
Provider에 store 객체를 넘긴다.
Provider 아래 children은 같은 store에 접근할 수 있다.
```

왜 `useRef`를 쓰는가:

```txt
렌더링할 때마다 makeStore()를 다시 실행하지 않기 위해서다.
store가 매번 새로 만들어지면 Redux state가 유지되지 않는다.
```

### 6-13. "layout.tsx에서 StoreProvider로 children을 감싼다"

사용자 정리:

```txt
이것을 루트 layout.ts에서 <StoreProvider>{children}</StoreProvider>에 넣었다.
Next.js에서는 layout.ts를 자동적으로 가져와서 children에 page.tsx가 들어가게 된다.
그 하위에 트리 형태로 DOM이 생성되므로 이 스토어가 전역 스토어 역할을 하게 된다.
```

판정:

```txt
맞다.
표현만 조금 정리하면 된다.
```

정확한 설명:

```txt
Next App Router는 요청 경로에 맞는 page.tsx를 찾고,
그 page를 상위 layout.tsx의 children으로 넣어 렌더링한다.
```

현재 구조:

```tsx
<html lang="ko">
  <body>
    <StoreProvider>
      {children}
    </StoreProvider>
  </body>
</html>
```

`/incidents` 요청이면 개념적으로:

```tsx
<StoreProvider>
  <IncidentsPage />
</StoreProvider>
```

그래서 `IncidentsPage`와 그 하위 client component들은 Redux store에 접근할 수 있다.

정확한 표현:

```txt
StoreProvider 아래에 있는 client component 트리에서 하나의 Redux store를 공유한다.
```

여기서 주의:

```txt
DOM 전체가 store를 가지는 것이 아니라,
React component tree가 Provider context를 통해 store에 접근한다.
```

### 6-14. 더 정확한 정리 문장

아래처럼 정리하면 더 정확하다.

```txt
incident-control-slice.ts에서는 Redux Toolkit의 createSlice를 사용해
incidentControl 상태의 초기값, case reducer, generated action creator, selector, default reducer를 정의한다.

reducers 객체 안에 작성한 메서드는 action 자체가 아니라 case reducer다.
createSlice는 이 case reducer 이름을 기준으로 action creator를 incidentControlSlice.actions에 자동 생성한다.

store.ts에서는 incident-control-slice.ts에서 export한 reducer를 configureStore의 reducer map에 등록한다.

configureStore({
  reducer: {
    incidentControl: incidentControlReducer,
  },
})

이 설정은 Redux 전체 state 안에 incidentControl이라는 key를 만들고,
그 key 아래 state를 incidentControlReducer가 관리하게 한다.

configureStore가 실행되면 Redux store 객체가 만들어지고,
이 store 객체는 dispatch, getState, subscribe, replaceReducer를 기본 API로 가진다.

AppStore, RootState, AppDispatch는 이 store 객체에서 타입을 자동 추출한 것이다.

StoreProvider는 makeStore로 store 객체를 한 번 만들고 React Redux Provider에 넘긴다.
layout.tsx에서 StoreProvider가 children을 감싸므로,
Next App Router의 하위 client component들은 같은 Redux store에 접근할 수 있다.
```
```

또 하나의 보정:

```txt
React 컴포넌트에서 조회는 store.getState를 직접 호출하기보다
useAppSelector(selector)를 통해 한다.
```

원리적으로는 selector가 store state를 읽는다.
하지만 React에서는 `useAppSelector`가 state 읽기와 변경 구독을 함께 처리한다.

## 7. 아직 안 한 것

이번 단계에서 일부러 하지 않은 것:

```txt
서버 데이터 incidents 배열을 Redux에 저장하지 않음
RTK Query 미적용
Redux Persist 미적용
slice 단위 테스트 미추가
```

이유:

```txt
8단계의 목표는 관제 UI 상태 공유다.
서버 데이터 캐싱과 실시간 동기화는 이후 WebSocket/Polling 단계에서 다루는 편이 낫다.
```
