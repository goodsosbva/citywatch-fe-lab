# 20-9. OpenLayers X-Ray 개선

## 목표

기존 OpenLayers X-Ray는 다음 세 경계를 중첩했다.

```txt
widget/IncidentMapBoard
└─ feature/RenderIncidentMarkers

feature/OpenLayersPipeline
```

OpenLayers를 선택했는데 FSD의 `widget`, `feature` 이름이 먼저 보여 React와 지도 엔진의 책임을 구분하기 어려웠다. 20-9는 실제 렌더링 소유권에 맞춰 경계를 두 개로 줄인다.

```txt
파란색
React · apps/web · IncidentMapBoard

초록색
OpenLayers · ol · MapCanvas
```

증거 패널은 구현 설명이므로 X-Ray 테두리에서 제외한다.

## React와 OpenLayers의 역할

### React가 담당하는 것

```txt
REST API 호출
Redux query 읽기
Incident[] 상태 보관
selectedIncidentId 읽기
지도 panel 제목·상태 UI
OpenLayersIncidentMap props 전달
선택 결과 dispatch
```

### OpenLayers가 담당하는 것

```txt
Map, View 생성
OSM TileLayer 생성
Feature<Point> 생성
VectorSource, VectorLayer 생성
DOM target 안에 Canvas 지도 생성
marker style 계산
singleclick hit detection
viewport와 layer 다시 그리기
```

React JSX가 지도 타일이나 마커 DOM을 직접 반복 렌더링하지 않는다. React는 빈 target `<div>`를 만들고 OpenLayers가 그 안의 viewport와 Canvas를 직접 관리한다.

## 선택 시 화면 흐름

```txt
OpenLayers 선택
→ /map으로 한 번 이동
→ 일반 FSD 경계 숨김
→ React 지도 panel 파란 경계 표시
→ OpenLayers target 초록 경계 표시
→ 증거 패널 표시
```

다른 메뉴로 이동하면 `?xray=openlayers`는 유지되지만 OpenLayers 지도 경계는 표시하지 않는다.

## X-Ray hook 단순화

기존에는 `useXRay`를 두 번 호출했다.

```tsx
const { enabled: xray } = useXRay();
const { enabled: openLayersXray, mode } = useXRay(["openlayers"]);
```

현재 mode는 한 번의 hook 호출로 이미 알 수 있으므로 직접 비교한다.

```tsx
const { enabled: xray, mode } = useXRay();
const openLayersXray = mode === "openlayers";
```

별도 selector helper나 OpenLayers 전용 context는 만들지 않았다.

## 경계를 두 개로 줄인 방법

지도 panel 경계는 mode에 따라 의미를 바꾼다.

```tsx
<XRayBox
  enabled={xray || openLayersXray}
  label={
    openLayersXray
      ? "react/map/IncidentMapBoard"
      : "widget/IncidentMapBoard"
  }
  packageName="apps/web"
>
```

FSD mode에서는 기존 `widget/IncidentMapBoard`를 유지한다. OpenLayers mode에서는 같은 실제 DOM 경계를 `React · apps/web · IncidentMapBoard`로 읽는다.

지도 target 경계도 같은 방법으로 분리한다.

```tsx
<XRayBox
  label={
    openLayersXray
      ? "openlayers/map/MapCanvas"
      : "feature/map/RenderIncidentMarkers"
  }
  packageName={openLayersXray ? "ol" : "apps/web"}
>
  <OpenLayersIncidentMap ... />
</XRayBox>
```

`ol`은 설치된 OpenLayers npm package 이름이다. 기술 이름을 workspace처럼 꾸민 값이 아니라 실제 실행 라이브러리를 나타낸다.

## REST 데이터에서 Canvas까지

### 1. Redux query로 REST 요청

```txt
Redux filters
→ selectIncidentListQuery
→ query
→ fetchIncidents(query)
→ Incident[]
```

React `MapPage`가 응답을 `incidents` state에 저장한다.

### 2. React가 props 전달

```tsx
<OpenLayersIncidentMap
  incidents={incidents}
  onSelectIncident={selectIncident}
  selectedIncidentId={selectedIncidentId}
/>
```

React가 OpenLayers에 전달하는 입력은 세 가지다.

```txt
incidents
→ 그릴 사고 데이터

selectedIncidentId
→ 선택 marker style 판단값

onSelectIncident
→ OpenLayers click을 Redux dispatch로 돌려보낼 callback
```

### 3. 좌표 유효성 확인

```tsx
if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
  return [];
}
```

REST 데이터의 좌표가 유한한 숫자가 아니면 Feature를 만들지 않는다. 잘못된 좌표를 지도 투영 함수에 전달하지 않는 입력 경계다.

### 4. 경위도를 지도 좌표로 투영

사고 데이터는 경도·위도 좌표를 사용한다.

```txt
[longitude, latitude]
```

OpenLayers 지도는 기본적으로 Web Mercator 투영 좌표를 사용하므로 `fromLonLat`으로 변환한다.

```tsx
new Point(
  fromLonLat([longitude, latitude]),
)
```

### 5. Feature 생성

OpenLayers는 `Incident` 객체 자체를 그리지 않는다. geometry와 속성을 가진 `Feature`로 변환한다.

```tsx
new Feature({
  geometry: new Point(...),
  incidentId: incident.id,
  riskLevel: risk.level,
  riskScore: risk.score,
})
```

각 값의 역할:

```txt
geometry
→ 지도 위 위치

incidentId
→ click 후 Redux로 보낼 식별자

riskLevel
→ marker 색상

riskScore
→ marker 크기
```

### 6. VectorSource와 VectorLayer 연결

```txt
Feature[]
→ VectorSource
→ VectorLayer
```

코드:

```tsx
source.clear();
source.addFeatures(features);
```

`VectorSource`는 현재 벡터 데이터 보관소이고 `VectorLayer`는 source의 Feature를 어떻게 지도에 그릴지 담당한다.

### 7. OSM 타일과 벡터 마커 합성

```tsx
new Map({
  layers: [
    new TileLayer({ source: new OSM() }),
    markerLayer,
  ],
  target: targetRef.current,
  view: new View(...),
});
```

렌더링 순서는 다음과 같다.

```txt
OSM TileLayer
→ 배경 도로 지도

VectorLayer
→ 사고 marker

Map
→ 두 layer를 target DOM에 합성

브라우저
→ OpenLayers가 생성한 Canvas 표시
```

## Canvas에서 Redux까지 선택 왕복

### 1. 지도 클릭

```tsx
map.on("singleclick", handler)
```

### 2. 클릭 픽셀의 Feature 찾기

```tsx
map.forEachFeatureAtPixel(
  event.pixel,
  (nextFeature) => nextFeature,
)
```

### 3. Feature 속성에서 incident ID 읽기

```tsx
const incidentId = feature?.get("incidentId");
```

문자열인지 확인한 뒤 React callback을 호출한다.

```tsx
if (typeof incidentId === "string") {
  onSelectIncidentRef.current(incidentId);
}
```

### 4. React가 Redux dispatch

```tsx
function selectIncident(incidentId: string) {
  dispatch(setSelectedIncidentId(incidentId));
}
```

### 5. Redux 값이 다시 지도에 전달

```text
Redux selectedIncidentId 변경
→ React rerender
→ OpenLayersIncidentMap prop 변경
→ selectedIncidentIdRef 갱신
→ source.changed()
→ VectorLayer style 함수 다시 실행
→ 선택 marker의 radius와 stroke 변경
```

전체 왕복은 다음과 같다.

```txt
Canvas singleclick
→ Feature incidentId
→ React callback
→ Redux dispatch
→ selectedIncidentId prop
→ source.changed()
→ Canvas marker style 갱신
```

## 증거 패널의 동적 값

증거 패널은 정적인 예시 숫자를 사용하지 않는다.

```tsx
<OpenLayersEvidencePanel
  incidentCount={incidents.length}
  selectedIncidentId={selectedIncidentId}
/>
```

화면에는 현재 상태가 표시된다.

```txt
incidents: 3건
selected: INC-001
```

필터로 REST 결과가 바뀌거나 지도 marker를 선택하면 증거 패널도 같이 갱신된다.

## React 종료 정리

OpenLayers는 React가 생성한 JSX DOM이 아니므로 effect cleanup에서 직접 정리한다.

```tsx
return () => {
  unByKey(clickKey);
  map.setTarget(undefined);
  mapRef.current = null;
  sourceRef.current = null;
};
```

```text
unByKey(clickKey)
→ OpenLayers click listener 해제

map.setTarget(undefined)
→ Map과 DOM target 연결 해제

ref = null
→ 이미 제거된 객체 참조 해제
```

개발 환경의 React 재실행이나 페이지 이동에서 같은 target에 Map과 listener가 중복 연결되는 것을 막는다.

## 접근성 경계

Canvas marker는 기본 HTML button이 아니므로 키보드와 화면 읽기 프로그램의 기본 조작 대상이 아니다. 그래서 지도 오른쪽의 실제 사고 선택 버튼 목록은 그대로 유지한다.

```text
시각적 위치 선택
→ OpenLayers marker

키보드·화면 읽기 선택
→ HTML 사고 버튼 목록
```

X-Ray 개선을 이유로 접근 가능한 대체 조작을 제거하지 않았다.

## 변경 파일

```txt
apps/web/app/map/page.tsx
→ useXRay 한 번 호출
→ React/OpenLayers 두 경계
→ 동적 증거 패널
→ REST → Canvas → Redux 흐름 표시

apps/web/app/globals.css
→ React 파란 경계
→ OpenLayers 초록 경계
→ React → ol → Canvas 구조도
→ 모바일 한 열 배치

docs/20-9-openlayers-xray-improvement.md
→ 구현 원인과 전체 데이터·선택 흐름 기록
```

## 확인 순서

```txt
1. /map?xray=openlayers 접속
2. React · apps/web · IncidentMapBoard 파란 경계 확인
3. OpenLayers · ol · MapCanvas 초록 경계 확인
4. app/widget/feature/entity FSD 경계가 없는지 확인
5. 증거 패널 incidents 값 확인
6. 지도 marker 클릭
7. Redux selected 값과 선택 사고 panel 갱신 확인
8. 선택 marker style 변경 확인
9. 다른 메뉴 이동 후 OpenLayers 경계가 사라지는지 확인
```

## 현재 한계

- Canvas marker 자체는 HTML 접근성 트리에 포함되지 않는다.
- OpenStreetMap tile 네트워크 시간은 별도로 측정하지 않는다.
- 생성된 Feature 개수를 별도 React state로 복제하지 않고 REST 입력 건수만 표시한다.
- invalid 좌표는 Feature 생성에서 제외되므로 입력 건수와 실제 marker 수가 다를 수 있다.
- 대량 데이터 화면의 Cluster source는 `/performance`에서 별도로 다룬다.

Feature 수를 React로 다시 전달하는 callback은 현재 요구에 필요하지 않아 추가하지 않았다. 실제 marker 수 계측 요구가 생길 때만 추가한다.
