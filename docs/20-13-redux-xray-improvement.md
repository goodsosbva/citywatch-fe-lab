# 20-13. Redux X-Ray 개선

## 목표

Redux 관점에서 사고 목록의 실제 실행 흐름만 보여 준다.

```txt
사용자 입력
→ dispatch
→ action 객체
→ reducer
→ Redux store
→ selector 구독
→ React 재렌더링
```

REST 요청, Zod 검증, FSD 경계는 Redux 실행 경계처럼 표시하지 않는다. 증거를 위해 별도 store, middleware, 로그 state도 만들지 않고 화면이 이미 사용하는 값만 표시한다.

## 변경 파일

```txt
apps/web/app/incidents/page.tsx
docs/20-13-redux-xray-improvement.md
```

## 경계 분리

기존 Redux 모드는 다음 두 FSD 이름의 테두리를 동시에 표시했다.

```txt
feature/incident/ShareIncidentFilters
feature/incident/ReduxFilterPipeline
```

이제 Redux 모드에서는 실제 React Redux 소비 영역인 필터 패널에 한 경계만 표시한다.

```txt
redux/IncidentControlConsumer
```

Redux 증거 패널은 설명 UI이지 별도 Redux 실행 경계가 아니므로 추가 테두리를 만들지 않는다. REST 모드의 `feature/incident/RestIncidentPipeline` 경계는 기존처럼 REST 모드에서만 표시된다.

## 실제 코드 흐름

### 1. 사용자가 입력한다

`IncidentFilterPanel`의 검색 input은 제어 컴포넌트다.

```tsx
<input
  onChange={(event) => onSearchChange(event.target.value)}
  value={filters.search}
/>
```

`filters.search`는 지역 `useState` 값이 아니라 Redux selector가 반환한 값이다.

### 2. 부모가 action creator를 호출해 dispatch한다

`IncidentsPage`는 기존 typed dispatch를 사용한다.

```tsx
const dispatch = useAppDispatch();

onSearchChange={(value) => dispatch(setSearchFilter(value))}
```

다른 필터도 같은 경로를 사용한다.

```txt
setSeverityFilter
setStatusFilter
setRegionFilter
resetIncidentFilters
setSelectedIncidentId
```

### 3. createSlice가 action 객체를 만든다

`incident-control-slice.ts`의 `reducers` 이름을 기준으로 Redux Toolkit이 action creator를 생성한다.

```ts
setSearchFilter("침수")
```

위 호출은 개념적으로 다음 action 객체를 만든다.

```ts
{
  type: "incidentControl/setSearchFilter",
  payload: "침수",
}
```

action creator가 state를 직접 바꾸는 것은 아니다. `dispatch`가 이 객체를 store로 전달한다.

### 4. reducer가 incidentControl state를 바꾼다

`store.ts`는 slice reducer를 `incidentControl` key에 등록한다.

```ts
configureStore({
  reducer: {
    incidentControl: incidentControlReducer,
  },
});
```

검색 action이 들어오면 해당 case reducer가 실행된다.

```ts
setSearchFilter(state, action: PayloadAction<string>) {
  state.filters.search = action.payload;
}
```

Redux Toolkit의 Immer 지원 때문에 이 코드는 직접 대입처럼 보이지만 기존 state를 외부에서 변형하지 않고 다음 immutable state를 만든다.

### 5. selector 구독 값이 다시 계산된다

`IncidentsPage`는 typed selector hook으로 필요한 값만 구독한다.

```ts
const filters = useAppSelector(selectIncidentFilters);
const query = useAppSelector(selectIncidentListQuery);
const activeFilterCount = useAppSelector(selectActiveIncidentFilterCount);
const selectedIncidentId = useAppSelector(selectSelectedIncidentId);
```

`selectIncidentFilters`는 원본 filters를 반환하고, `createSelector`로 만든 selector는 그 값에서 파생 결과를 계산한다.

```txt
selectActiveIncidentFilterCount
→ all/빈 값이 아닌 필터 개수

selectIncidentListQuery
→ UI 전용 all 값을 제거한 조회 조건
```

Redux X-Ray 패널에서는 REST 통신 단계로 넘어가지 않고 selector 구독과 반환값까지만 Redux 흐름으로 표시한다.

### 6. React가 다시 렌더링한다

구독 중인 selector 결과가 바뀌면 React Redux가 `IncidentsPage`를 다시 렌더링한다. 새 `filters`가 `IncidentFilterPanel`에 전달되어 다음 UI가 동시에 갱신된다.

```txt
input value
Redux 필터 개수 badge
현재 store 값
현재 selector 반환값
```

즉 화면 input이 별도 지역 복사본을 가지지 않는다.

## 전역 Redux 상태와 React 지역 상태

Redux에 저장하는 값:

```txt
filters.search
filters.severity
filters.status
filters.regionId
selectedIncidentId
```

여러 관제 화면이 함께 사용해야 하는 UI 상태다.

Redux에 저장하지 않는 값:

```txt
incidents
loading
error
```

이 값들은 현재 REST 요청을 표시하는 `IncidentsPage` 지역 상태다. Redux X-Ray 패널은 두 상태 묶음의 현재 값을 별도 항목으로 표시해 소유권을 섞지 않는다.

## 화면 간 공유

루트 `layout.tsx`의 `StoreProvider`가 페이지 트리 위에 하나의 store를 제공한다.

```txt
RootLayout
└─ StoreProvider
   └─ React Redux Provider
      └─ 현재 route page
```

따라서 클라이언트 라우팅으로 이동하는 동안 다음 화면이 같은 store를 구독한다.

```txt
/incidents
→ filters, query, activeFilterCount, selectedIncidentId

/map
→ filters, query, activeFilterCount, selectedIncidentId

/risk-3d
→ query, activeFilterCount, selectedIncidentId

/incidents/[id]
→ selectedIncidentId
```

목록이나 지도에서 `setSelectedIncidentId`를 dispatch하면 선택 ID가 같은 store에 기록되고 다른 구독 화면에서도 같은 값이 보인다.

## 동적 증거

패널은 기존 render 값만 props로 받는다.

```txt
filters
activeFilterCount
selectedIncidentId
incidents.length
loading
error
```

따라서 별도 시뮬레이션이나 하드코딩한 현재 상태가 없다. 사용자가 필터를 바꾸거나 사고를 선택하고, 요청 상태가 변하면 증거 값도 같은 렌더에서 바뀐다.

## 직접 확인

```txt
http://127.0.0.1:3000/incidents?xray=redux
```

1. 검색어를 입력한다.
2. `store.incidentControl.filters.search`와 `activeFilterCount`가 바뀌는지 확인한다.
3. 심각도 또는 지역을 선택해 controlled input과 store 값이 함께 바뀌는지 확인한다.
4. 사고를 선택해 `selectedIncidentId`가 바뀌는지 확인한다.
5. Redux 모드에서 `redux/IncidentControlConsumer` 경계 하나만 표시되는지 확인한다.
6. 지도나 상세로 이동한 뒤 X-Ray query는 유지되지만 현재 route가 강제로 `/incidents`로 되돌아가지 않는지 확인한다.

## 의도적으로 추가하지 않은 것

```txt
Redux middleware action logger
증거 전용 Redux slice
마지막 action을 저장하는 React state
Redux Persist
RTK Query
새 패키지
```

현재 실행 흐름을 보여 주는 데 필요하지 않고, 증거를 위해 애플리케이션 상태를 하나 더 만들면 오히려 실제 흐름과 증거 상태가 갈라질 수 있기 때문이다.
