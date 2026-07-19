# 12. 대량 데이터 성능 관제

`/performance`는 `GET /api/incidents/many-data?size=5000|10000`에서 실제로 5,000건 또는 10,000건 JSON 응답을 받아, 전체 분포는 2D 클러스터로 보고 선택 사고는 3D로 상세 확인하는 성능 검증 화면이다.

## 1. 구현 목적

기존 사고 목록과 지도는 현재 API 데이터 3건을 모두 DOM과 지도 마커로 표시한다. 이 방식은 3건에서는 단순하지만, 수천 건이 되면 목록 DOM과 지도 마커가 동시에 늘어난다. 또한 3D에 모든 사고를 기둥으로 올리면 위치를 읽기 어려워지고 WebGL 객체 수도 늘어난다.

이 단계는 다음 두 렌더링 비용을 분리해 줄인다.

```txt
지도
→ 개별 마커 대신 OpenLayers Cluster로 가까운 사고를 숫자 마커 하나로 묶음

목록
→ 전체 데이터는 유지하고, 현재 스크롤 화면에 보이는 행만 DOM에 렌더링
```

## 2. 데이터 흐름

```txt
/performance 접속
→ fetchPerformanceIncidents(scenarioSize)
→ GET /api/incidents/many-data?size={5000|10000}
→ 서버가 listIncidents()와 createPerformanceIncidents(...) 실행
→ 5,000 또는 10,000건 JSON 응답
→ `viewMode === "2d"`이면 `ClusteredPerformanceMap`에 전체 시나리오 전달
→ `viewMode === "3d"`이면 `RiskZoneScene`에 선택한 `selectedIncident` 한 건만 전달
→ VirtualIncidentList에는 보이는 범위만 전달해 DOM 렌더링
→ 지도 또는 목록 클릭
→ selectedIncidentId local state 변경
→ 선택 시나리오 패널 갱신
```

`selectedIncidentId`는 이 페이지의 local state다. 생성된 `PERF-xxxxx` ID가 기존 Redux의 실제 사고 선택값을 덮어쓰지 않는다.

## 3. 성능 시나리오의 경계

`many-data` Route Handler가 `performance-fixture.ts`를 호출한다. 이 route는 REST 응답을 저장하거나 POST하지 않는다. 원본 사고의 분류·심각도·상태·영향 인원은 유지하고, ID·제목·좌표만 바꾼다.

### 좌표가 균일 격자가 아닌 이유와 실제 계산

초기 원본 데이터의 `affectedPeople` 값은 `INC-001 = 42`, `INC-002 = 18`, `INC-003 = 7`이다. `createPerformanceIncidents`는 이 값을 가중치로 사용한다. 따라서 전체 가중치 `totalWeight`는 `67`이고, 각 생성 사고는 결정적 난수 `randomUnit(index, 11)`의 구간에 따라 세 원본 중 하나를 고른다.

```ts
const weights = source.map((incident) => Math.max(incident.affectedPeople, 1));
const totalWeight = weights.reduce((total, weight) => total + weight, 0);
const template = source[getWeightedIndex(weights, totalWeight, randomUnit(index, 11))];
```

5,000건 기준으로 기대 분포는 `42 / 67`, `18 / 67`, `7 / 67` 비율이다. 즉 약 `3,134건`, `1,343건`, `523건`이 각 기존 사고 좌표 주변에 생긴다. 매번 완전히 같은 수가 된다는 뜻은 아니며, `randomUnit` 결과가 어느 가중치 구간에 들어가는지에 따라 달라진다.

좌표는 선택된 `template.location`에서 원형으로 퍼진다. `distance`는 `0`에서 최대 `0.018`도 안에서 계산되고, `2.35` 제곱 때문에 대부분의 사고가 중심 근처에 더 조밀하게 남으며 일부만 멀리 퍼진다.

```ts
const distance = Math.pow(randomUnit(index, 23), 2.35) * maximumLatitudeOffset;
const angle = randomUnit(index, 37) * Math.PI * 2;

latitude: template.location.latitude + Math.sin(angle) * distance,
longitude:
  template.location.longitude +
  (Math.cos(angle) * distance) / Math.cos((template.location.latitude * Math.PI) / 180),
```

`randomUnit`은 `index`와 `salt`만 입력으로 받는 순수 함수다. 즉 `PERF-00001`은 API를 다시 호출해도 같은 원본 위치·같은 좌표를 받는다. `Math.random()`을 쓰면 새로고침마다 분포가 바뀌어 전후 성능 비교와 재현이 불가능해진다.

### `PERF-00001` 한 건을 실제 숫자로 추적

`/performance` 첫 렌더링 시 `scenarioSize = 10000`, `incidents = []`, `selectedIncidentId = undefined`, `viewMode = "2d"`다. `useEffect`가 `fetchPerformanceIncidents(10000)`을 호출하면 URL은 `/api/incidents/many-data?size=10000`이 된다.

Route Handler의 `size`는 처음에는 문자열 `"10000"`이고 `Number(...)` 이후 숫자 `10000`이 된다. `isPerformanceScenarioSize(10000)`은 참이므로 `createPerformanceIncidents(listIncidents(), 10000)`이 실행된다.

초기 원본 사고가 세 건일 때 `index = 0`의 중간값은 다음과 같다.

```txt
randomUnit(0, 11) = 0.1792707269
0.1792707269 * totalWeight(67) = 12.0111406997
→ 첫 가중치 42보다 작음
→ template = INC-001

randomUnit(0, 23) = 0.4684583768
distance = 0.4684583768 ^ 2.35 * 0.018
         = 0.0030293495도

randomUnit(0, 37) = 0.5115078143
angle = 0.5115078143 * 2π
      = 3.2138983832 라디안
```

`INC-001.location`의 원래 값은 `latitude: 37.4979`, `longitude: 127.0276`이다. 위 거리와 각도를 더하면 API의 첫 응답 객체는 아래 값이 된다. `severity`, `status`, `affectedPeople` 등은 `...template`로 복사된 값이다.

```txt
id: PERF-00001
title: 강남역 지하 보행로 침수 감지 · 성능 시나리오 1
location.latitude: 37.4976811515
location.longitude: 127.0237916729
severity: critical
status: in_progress
affectedPeople: 42
```

클라이언트의 `setIncidents(nextIncidents)`가 이 10,000개 배열을 `incidents` state에 저장한다. 그 다음 `useEffect([incidents])`가 `selectedIncidentId`를 첫 ID인 `"PERF-00001"`로 바꾸고, `selectedIncident`은 `incidents.find(...)`로 같은 객체를 찾는다.

따라서 같은 서버 입력과 사고 수에서는 같은 시나리오가 API로 반환된다. 이 데이터는 운영 사고, 실제 피해 범위, 실시간 데이터가 아니다.

## 4. OpenLayers 클러스터 지도

`ClusteredPerformanceMap`은 원본 `VectorSource`에 10,000개 feature를 넣고, `Cluster`가 화면 거리 38px 안의 feature를 하나의 cluster feature로 묶는다. 원본 10,000건은 JavaScript 메모리에 유지되지만, 화면에 그리는 마커 수는 현재 확대 수준의 cluster 수로 줄어든다.

```ts
const source = new VectorSource();
const clusterSource = new Cluster({ distance: 38, source });
```

스타일은 cluster의 사고 수를 key로 `styleCache`에 보관한다. 렌더링마다 `Style`, `Fill`, `Text` 객체를 새로 만들지 않는다.

```txt
cluster 1건 → 주황 단일 마커
cluster 2건 이상 → 파란 숫자 마커
cluster 클릭 → 해당 좌표 범위로 지도 확대
단일 마커 클릭 → local selectedIncidentId 변경
```

`styleCache`는 같은 cluster 크기에 대한 `Style` 객체를 다시 만든다. 예를 들어 화면에 `17`건 cluster가 여러 개라면 첫 번째 `17`건 마커에서 만든 파란 원과 숫자 텍스트 스타일을 이후 마커가 재사용한다.

## 5. 가상 목록

`VirtualIncidentList`의 행 높이는 `76px`, viewport 높이는 `456px`, `overscan`은 위·아래 각각 `6행`이다.

```ts
const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
const end = Math.min(
  total,
  Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan,
);
```

최초 진입의 `scrollTop = 0`이면 `start = 0`, `end = 12`가 되어 12개 행만 렌더링한다. 중간 지점에서는 위 6행, 화면 안 6행, 아래 6행을 합쳐 보통 18행을 렌더링한다. `incidents.length * rowHeight`는 10,000건에서 `760,000px`라 스크롤바 길이는 전체 목록처럼 유지된다. 실제 DOM은 `incidents.slice(start, end)`의 `<li>`와 `<button>`만 만든다.

각 행에는 `aria-posinset`, `aria-setsize`, 선택 버튼의 `aria-pressed`를 넣어 현재 위치와 선택 상태를 전달한다.

## 6. 2D 전체 분포와 3D 선택 상세

`PerformancePage`의 `viewMode` 초기값은 `"2d"`다. 전체 분포를 파악하는 단계에서는 `ClusteredPerformanceMap`만 렌더링한다. 사용자가 목록 또는 단일 마커를 선택하면 `selectedIncidentId`가 예를 들어 `"PERF-01342"`로 바뀌고, `selectedIncident`에는 그 ID와 일치하는 `Incident` 객체가 들어간다.

```ts
const selectedIncident = useMemo(
  () => incidents.find((incident) => incident.id === selectedIncidentId),
  [incidents, selectedIncidentId],
);
```

사용자가 `3D 선택 사고`를 누르면 `viewMode`가 `"3d"`가 되고, `RiskZoneScene`에는 `selectedIncident` 한 건만 전달된다.

```tsx
{viewMode === "2d" ? (
  <ClusteredPerformanceMap incidents={incidents} onSelectIncident={setSelectedIncidentId} />
) : selectedIncident ? (
  <RiskZoneScene incident={selectedIncident} />
) : null}
```

`RiskZoneScene`은 선택 사고 중심으로 OpenStreetMap 타일 3 x 3장을 깔고, 위험 점수로 기둥 높이와 색상을 계산한다. 따라서 3D에서 보이는 기둥 바닥은 `selectedIncident.location`의 실제 좌표이고, 전체 10,000건을 기둥으로 중복 렌더링하지 않는다.

## 7. 검증 범위

```bash
npm run typecheck
npm test
npm --workspace @citywatch/web run build
```

현재 확인된 결과:

```txt
TypeScript: web, api-types, ui 통과
테스트: WebSocket frame 2개, api-types 5개 통과
Next build: /performance 정적 라우트 생성 확인
GET /api/incidents/many-data?size=5000 → 5,000건 반환
GET /api/incidents/many-data?size=10000 → 10,000건 반환
GET /api/incidents/many-data?size=123 → 400 INVALID_PERFORMANCE_SIZE
```

브라우저 자동 검증은 현재 Chrome 플러그인 런타임 경로가 없어 실행하지 못했다. 다음 수동 확인은 `/performance`에서 한다.

```txt
1. 10,000건 선택 시 Source 지표가 10,000을 표시하는지 확인
2. 지도에 숫자 cluster 마커가 보이고 클릭 시 확대되는지 확인
3. 목록 스크롤 중 DOM 건수가 약 18개를 유지하는지 확인
4. 목록 또는 단일 지도 마커 선택이 선택 시나리오 패널에 반영되는지 확인
```
