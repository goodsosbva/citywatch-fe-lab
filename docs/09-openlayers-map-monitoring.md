# 09. OpenLayers 지도 관제

이 문서는 9단계에서 OpenLayers를 이용해 도시 안전 사고를 지도 위에 표시한 구현 흐름을 정리한다.

이번 단계의 핵심은 외부 실시간 API를 붙이는 것이 아니다. 핵심은 기존에 만든 사고 REST API와 Redux 관제 상태를 지도 화면에 연결해서, 관제 시스템이 위치 기반 화면까지 확장될 수 있음을 증명하는 것이다.

## 1. 지금까지 한 것

이전 단계까지 구현된 흐름은 다음과 같다.

```txt
0. Monorepo workspace 세팅
1. apps/web Next 앱 생성
2. X-Ray Box + X-Ray toggle
3. / 관제 홈 대시보드
4. /incidents 목록/상세
5. REST API
6. 사고 등록 + Zod validation/accessibility
7. 위험도 계산 + Vitest unit test
8. Redux 필터/선택 상태 공유
```

현재 사고 데이터는 다음 파일에서 생성된다.

```txt
apps/web/app/api/incidents/incident-store.ts
```

이 파일의 `initialIncidents`는 이미 좌표를 가지고 있다.

```ts
location: { latitude: 37.4979, longitude: 127.0276 }
```

그래서 9단계에서 새 DB나 새 백엔드 모델을 만들 필요는 없었다.

이미 있는 데이터 흐름은 다음과 같다.

```txt
apps/web/app/api/incidents/incident-store.ts
→ listIncidents(query)
→ GET /api/incidents
→ apps/web/app/incidents/incident-api.ts
→ fetchIncidents(query)
→ 화면 local state
```

Redux에는 사고 목록 데이터 자체가 아니라 관제 UI 상태만 들어간다.

```txt
filters
selectedIncidentId
```

관련 파일:

```txt
apps/web/app/incidents/incident-control-slice.ts
```

## 2. 이번에 구현한 것

이번 단계에서 추가한 기능은 다음이다.

```txt
/map 지도 관제 페이지
OpenLayers 지도 렌더링
OpenStreetMap 무료 타일 사용
기존 /api/incidents 사고 데이터를 지도 마커로 표시
Redux 필터를 지도 조회에도 공유
지도 마커/버튼 선택 시 selectedIncidentId 공유
선택 사고 요약 패널 표시
X-Ray 라벨로 OpenLayers, REST, Redux 연결 표시
```

수정/추가한 핵심 파일은 다음이다.

```txt
apps/web/package.json
apps/web/app/layout.tsx
apps/web/app/map/page.tsx
apps/web/app/map/openlayers-incident-map.tsx
apps/web/app/globals.css
apps/web/app/shell.tsx
apps/web/app/incidents/page.tsx
```

무료 공개 데이터 판단도 같이 했다.

```txt
9번에 바로 맞는 무료 외부 리소스
→ OpenStreetMap tile

10번 이후에 맞는 무료 공개 API
→ 서울시 실시간 도시데이터
→ 재난안전데이터 공유플랫폼
→ 기상청 공공데이터
```

서울시 실시간 도시데이터는 사고통제/도로소통/인구/날씨 데이터를 제공하므로 좋지만, 인증키, proxy, 응답 정규화, polling이 필요하다. 그래서 9번에 넣지 않고 10번 실시간 단계로 미뤘다.

## 3. 왜 이걸 했는지

9단계의 목적은 “지도 라이브러리를 써봤다”가 아니다.

관제 시스템에서 지도는 다음 역할을 한다.

```txt
사고가 어디에서 발생했는가?
어느 지역에 위험이 몰려 있는가?
목록에서 본 필터 결과를 공간적으로도 볼 수 있는가?
선택한 사고를 목록/지도/상세가 같은 상태로 공유하는가?
```

그래서 구현 판단은 다음처럼 했다.

```txt
지도 바탕
→ OpenLayers + OpenStreetMap

사고 데이터
→ 기존 내부 REST API 재사용

필터
→ 기존 Redux selectIncidentListQuery 재사용

선택 사고
→ 기존 Redux setSelectedIncidentId 재사용

실시간 외부 데이터
→ 10번으로 분리
```

이렇게 하면 9번의 학습 포인트가 흐려지지 않는다.

만약 9번에 서울시 실시간 도시데이터까지 바로 넣었다면 다음 작업이 한 번에 섞인다.

```txt
OpenLayers 지도 구현
외부 API 인증키 관리
CORS/proxy 처리
외부 응답 타입 분석
Incident 타입 정규화
polling 주기 처리
실패 fallback 처리
```

이건 10번 WebSocket/Polling 단계의 책임이다.

## 4. 어떻게 세팅했는지

### 4-1. OpenLayers 설치

파일:

```txt
apps/web/package.json
```

추가된 dependency:

```json
"ol": "^10.9.0"
```

설치 명령:

```bash
npm install --workspace @citywatch/web ol
```

이 작업으로 `package-lock.json`도 갱신된다.

이유:

```txt
OpenLayers는 현재 프로젝트에 설치되어 있지 않았다.
따라서 Map, View, TileLayer, VectorLayer, VectorSource, Feature 등을 import하려면 ol 패키지가 필요하다.
```

### 4-2. OpenLayers 기본 CSS 로딩

파일:

```txt
apps/web/app/layout.tsx
```

추가한 코드:

```ts
import "ol/ol.css";
```

이유:

```txt
OpenLayers는 지도 안에 줌 버튼, attribution, viewport DOM을 만든다.
ol/ol.css를 로딩하지 않으면 기본 컨트롤 위치와 스타일이 깨질 수 있다.
```

`layout.tsx`에 넣은 이유는 `/map` 페이지가 이 CSS를 안정적으로 사용할 수 있게 하기 위해서다.

### 4-3. `/map` 페이지 생성

파일:

```txt
apps/web/app/map/page.tsx
```

핵심 역할:

```txt
Redux에서 query 읽기
fetchIncidents(query) 호출
incidents local state 저장
OpenLayersIncidentMap에 incidents 전달
선택 사고 패널 표시
X-Ray 라벨 표시
```

핵심 코드 흐름:

```ts
const query = useAppSelector(selectIncidentListQuery);
const selectedIncidentId = useAppSelector(selectSelectedIncidentId);
```

여기서 `query`는 Redux 필터를 REST API 요청용으로 바꾼 값이다.

예를 들어 Redux state가 다음이면:

```ts
filters = {
  search: "",
  severity: "critical",
  status: "all",
  regionId: "all",
};
```

`selectIncidentListQuery` 결과는 다음이 된다.

```ts
query = {
  severity: "critical",
};
```

그 다음 이 query가 API 요청에 들어간다.

```ts
const nextIncidents = await fetchIncidents(query);
setIncidents(nextIncidents);
```

실제 요청은 다음처럼 만들어진다.

```txt
GET /api/incidents?severity=critical
```

### 4-4. OpenLayers 전용 컴포넌트 생성

파일:

```txt
apps/web/app/map/openlayers-incident-map.tsx
```

이 파일은 React UI 컴포넌트처럼 보이지만 내부적으로는 OpenLayers imperative API를 다룬다.

입력 props:

```ts
type OpenLayersIncidentMapProps = {
  incidents: Incident[];
  onSelectIncident: (incidentId: string) => void;
  selectedIncidentId?: string;
};
```

각 prop의 역할:

```txt
incidents
→ 지도에 찍을 사고 목록

selectedIncidentId
→ 현재 선택된 사고 마커를 강조하기 위한 값

onSelectIncident
→ 마커 클릭 시 부모 page.tsx에 선택 사고 ID를 넘기는 함수
```

OpenLayers 초기화 흐름:

```ts
const source = new VectorSource();
const markerLayer = new VectorLayer({
  source,
  style: (feature) => getMarkerStyle(feature, selectedIncidentIdRef.current),
});
const map = new Map({
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
    markerLayer,
  ],
  target: targetRef.current,
  view: new View({
    center: seoulCenter,
    zoom: 11,
  }),
});
```

이 코드가 하는 일:

```txt
VectorSource
→ 사고 마커 Feature를 담는 저장소

VectorLayer
→ VectorSource의 Feature를 지도 위에 그리는 레이어

TileLayer + OSM
→ OpenStreetMap 배경 지도

View
→ 초기 중심 좌표와 zoom

Map
→ target DOM에 실제 지도 생성
```

중요한 좌표 변환:

```ts
new Point(fromLonLat([longitude, latitude]))
```

프로젝트의 사고 데이터는 이렇게 생겼다.

```ts
location: {
  latitude: 37.4979,
  longitude: 127.0276,
}
```

하지만 OpenLayers `fromLonLat`는 다음 순서를 요구한다.

```txt
[longitude, latitude]
```

그래서 반드시 다음처럼 넣어야 한다.

```ts
fromLonLat([127.0276, 37.4979])
```

반대로 넣으면 마커가 서울이 아닌 엉뚱한 위치에 찍힌다.

### 4-5. 마커 클릭과 Redux 연결

파일:

```txt
apps/web/app/map/openlayers-incident-map.tsx
```

OpenLayers 클릭 처리:

```ts
const clickKey = map.on("singleclick", (event) => {
  const feature = map.forEachFeatureAtPixel(event.pixel, (nextFeature) => nextFeature);
  const incidentId = feature?.get("incidentId");

  if (typeof incidentId === "string") {
    onSelectIncidentRef.current(incidentId);
  }
});
```

이 코드의 흐름:

```txt
지도 클릭
→ 클릭한 pixel에 Feature가 있는지 확인
→ Feature에서 incidentId 꺼냄
→ 부모가 넘겨준 onSelectIncident 호출
```

부모 파일:

```txt
apps/web/app/map/page.tsx
```

부모에서 연결한 함수:

```ts
function selectIncident(incidentId: string) {
  dispatch(setSelectedIncidentId(incidentId));
}
```

결과:

```txt
마커 클릭
→ selectIncident("INC-001")
→ dispatch(setSelectedIncidentId("INC-001"))
→ Redux state.incidentControl.selectedIncidentId = "INC-001"
→ 선택 사고 패널 갱신
```

### 4-6. cleanup 처리

파일:

```txt
apps/web/app/map/openlayers-incident-map.tsx
```

정리 코드:

```ts
return () => {
  unByKey(clickKey);
  map.setTarget(undefined);
  mapRef.current = null;
  sourceRef.current = null;
};
```

이유:

```txt
OpenLayers는 React가 자동으로 정리해주는 JSX UI가 아니다.
map.on으로 등록한 이벤트와 target DOM 연결을 직접 끊어야 한다.
```

이 cleanup이 없으면 페이지 이동 후에도 이전 map target이나 이벤트가 남을 수 있다.

### 4-7. CSS 추가

파일:

```txt
apps/web/app/globals.css
```

추가한 주요 클래스:

```txt
map-layout
map-board
map-canvas
map-side-panel
map-selected-card
map-detail-grid
map-incident-list
map-incident-button
```

가장 중요한 클래스는 `map-canvas`다.

```css
.map-canvas {
  height: min(62vh, 640px);
  min-height: 460px;
}
```

이유:

```txt
OpenLayers는 target DOM의 크기를 기준으로 지도를 그린다.
target div에 높이가 없으면 지도 영역이 0px에 가깝게 접혀 빈 화면처럼 보일 수 있다.
```

## 5. 실제로 동작시키면 어떤 흐름인지

### 5-1. 사용자가 `/map`에 들어간다

```txt
사용자 동작
→ http://127.0.0.1:3000/map 접속

Next App Router
→ apps/web/app/map/page.tsx 실행

MapPage
→ Redux에서 filters 읽음
→ selectIncidentListQuery로 REST query 생성
```

실제 코드:

```ts
const query = useAppSelector(selectIncidentListQuery);
```

### 5-2. 사고 목록을 API로 가져온다

```txt
MapPage useEffect 실행
→ fetchIncidents(query)
→ GET /api/incidents
→ listIncidents(query)
→ Incident[] 응답
→ setIncidents(nextIncidents)
```

실제 코드:

```ts
const nextIncidents = await fetchIncidents(query);
setIncidents(nextIncidents);
```

### 5-3. 사고 데이터가 지도 컴포넌트로 전달된다

```tsx
<OpenLayersIncidentMap
  incidents={incidents}
  onSelectIncident={selectIncident}
  selectedIncidentId={selectedIncidentId}
/>
```

여기서 `incidents` 예시는 다음이다.

```ts
[
  {
    id: "INC-001",
    title: "강남역 지하 보행로 침수 감지",
    severity: "critical",
    location: { latitude: 37.4979, longitude: 127.0276 },
  },
]
```

### 5-4. 사고가 OpenLayers Feature로 변환된다

실제 코드:

```ts
new Feature({
  geometry: new Point(fromLonLat([longitude, latitude])),
  incidentId: incident.id,
  riskScore: risk.score,
  severity: incident.severity,
})
```

변환 결과:

```txt
Incident
→ OpenLayers Feature
→ VectorSource에 추가
→ VectorLayer가 지도 위에 마커로 그림
```

### 5-5. 마커 색상과 크기가 위험도와 심각도를 반영한다

색상 기준:

```ts
const severityMarkerColors = {
  low: "#16a34a",
  medium: "#2563eb",
  high: "#f59e0b",
  critical: "#dc2626",
};
```

크기 기준:

```ts
const radius = selected ? 13 : Math.min(11, 7 + Math.floor(riskScore / 25));
```

예:

```txt
INC-001
severity = critical
riskScore = 100
→ 빨간 계열 마커
→ 큰 마커
```

### 5-6. 사용자가 마커 또는 사고 버튼을 선택한다

마커 클릭 흐름:

```txt
OpenLayers singleclick
→ feature.get("incidentId")
→ onSelectIncident("INC-001")
→ dispatch(setSelectedIncidentId("INC-001"))
```

버튼 클릭 흐름:

```tsx
<button onClick={() => selectIncident(incident.id)}>
```

결과:

```txt
Redux selectedIncidentId 변경
→ selectedIncident 계산
→ 선택 사고 패널 갱신
→ 선택 마커 style 강조
```

## 6. 검증 결과

실행한 검증:

```bash
npm run typecheck
npm run test
npm --workspace @citywatch/web run build
```

결과:

```txt
npm run typecheck 통과
npm run test 통과
npm --workspace @citywatch/web run build 통과
```

브라우저 확인:

```txt
http://127.0.0.1:3000/map
```

확인한 내용:

```txt
지도 사고 관제 h1 표시
OpenLayers viewport 생성
OpenStreetMap attribution 표시
지도 높이 460px 이상 확보
INC-001, INC-002, INC-003 사고 버튼 표시
사고 마커 표시
INC-001 선택 시 선택 패널 갱신
상세 보기 링크 표시
X-Ray 라벨 표시
```

빌드 결과에도 `/map` 라우트가 잡혔다.

```txt
└ ○ /map
```

## 7. 아직 안 한 것

이번 단계에서 일부러 하지 않은 것:

```txt
서울시 실시간 도시데이터 API 연동
재난안전데이터 공유플랫폼 연동
Polling/WebSocket 실시간 갱신
마커 클러스터링
대량 데이터 성능 최적화
지도에서 사고 등록 위치 선택
지도 타일 self-hosting
```

이유:

```txt
서울시 실시간 도시데이터 API 연동
→ 10번 WebSocket/Polling 단계에서 처리

재난안전데이터 공유플랫폼 연동
→ 10번 또는 14번 realtime-server 분리 단계에서 처리

마커 클러스터링/성능 최적화
→ 12번 performance page 단계에서 처리

지도에서 사고 등록 위치 선택
→ 현재 9번 목표가 지도 관제이므로 등록 기능 확장은 보류
```

이번 단계의 완료 기준은 다음 한 줄이다.

```txt
기존 내부 사고 REST API 데이터를 OpenLayers 지도 위에 표시하고, Redux 필터/선택 상태와 연결된 지도 관제 화면을 완성했다.
```
