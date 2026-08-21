# 20-15. Performance X-Ray 개선

## 큰 그림

이 단계는 새로운 성능 최적화를 추가하는 작업이 아니다. 이미 구현된 OpenLayers 클러스터와 React 가상 목록이 실제로 줄인 렌더링 범위를 현재 값으로 보여주는 작업이다.

```text
서버가 반환한 Incident[] 전체
├─ 2D: VectorSource 원본 점 → 현재 해상도의 Cluster marker
├─ 목록: 전체 배열 → 현재 scrollTop의 slice → DOM row
└─ 3D: 선택한 Incident 한 건 → RiskZoneScene
```

FPS, 처리 시간, 메모리 절감률은 측정하지 않으므로 표시하지 않는다. 화면에는 컴포넌트가 이미 계산하고 있는 개수만 표시한다.

## 변경 파일

```text
apps/web/app/performance/page.tsx
apps/web/app/performance/clustered-performance-map.tsx
apps/web/app/performance/virtual-incident-list.tsx
apps/web/app/globals.css
docs/20-15-performance-xray-improvement.md
```

## 1. 데이터 로드부터 화면까지

사용자가 사고 수를 선택하면 `scenarioSize`가 바뀐다.

```text
select onChange
→ setScenarioSize(5,000 또는 10,000)
→ useEffect 재실행
→ fetchPerformanceIncidents(scenarioSize)
→ GET /api/incidents/many-data?size=...
→ Incident[] 저장
```

새 요청을 시작할 때 이전 `clusterStats`와 `virtualRange`를 비운다. 따라서 새 데이터가 아직 계산되지 않았는데 이전 시나리오의 숫자가 현재 증거처럼 남지 않는다.

## 2. 2D marker 계산 흐름

`ClusteredPerformanceMap`은 유효한 좌표마다 OpenLayers `Feature<Point>`를 하나 만든다.

```text
Incident.location
→ fromLonLat([longitude, latitude])
→ Point
→ Feature
→ VectorSource
```

`sourceMarkerCount`는 이 원본 `VectorSource`의 Feature 수다. 다음 단계에서 `Cluster({ distance: 38, source })`가 현재 지도 해상도를 기준으로 가까운 Feature를 묶는다.

지도 렌더가 끝나는 `rendercomplete` 시점에 cluster source가 현재 제공하는 Feature들을 읽는다.

```text
cluster feature의 features.length === 1
→ single marker

cluster feature의 features.length > 1
→ 여러 원본 점을 묶은 cluster marker
```

그래서 증거 패널은 다음 실제 값을 표시한다.

```text
2D 원본 marker = sourceMarkerCount
2D 현재 marker = renderedMarkerCount
                = clusterMarkerCount + singleMarkerCount
```

지도를 확대하거나 축소하면 OpenLayers가 cluster를 다시 계산하고 `rendercomplete`가 다시 발생한다. 값이 실제로 달라졌을 때만 React 부모 state를 갱신한다.

## 3. 가상 목록 계산 흐름

`VirtualIncidentList`는 기존 계산식을 그대로 사용한다.

```text
scrollTop
→ getVisibleRange(scrollTop, incidents.length)
→ start, end
→ incidents.slice(start, end)
→ visibleIncidents.map(...)
→ 실제 li DOM
```

자식은 이때 이미 알고 있는 값만 부모로 전달한다.

```text
start
end
renderedCount = visibleIncidents.length
total = incidents.length
```

증거 패널의 `가상화 계산 범위`와 `실제 목록 DOM`은 이 값을 사용한다. 별도의 가상화 계산을 복제하지 않으므로 화면 목록과 증거 숫자가 서로 달라질 출처를 만들지 않는다.

## 4. 2D와 3D 경계

성능 X-Ray에서는 실제 렌더링 책임 세 곳만 표시한다.

```text
performance/2d/OpenLayersCluster
performance/3d/SingleIncidentScene
performance/virtual-list/RenderedRows
```

2D 모드는 전체 Incident 배열을 지도 source에 넣고 cluster marker로 표현한다. 3D 모드는 선택한 `Incident` 한 건만 `RiskZoneScene`에 전달한다.

```tsx
<RiskZoneScene incident={selectedIncident} />
```

이는 3D 내부 객체 수나 GPU 성능을 측정했다는 뜻이 아니다. 증명 가능한 사실은 3D 컴포넌트의 입력 범위가 선택 사고 한 건이라는 점뿐이다.

## 5. FSD X-Ray와 분리

기존에는 성능 모드에서도 `widget`, `feature`, `fsd-style` proof가 함께 표시됐다. 개선 후 성능 모드의 경계는 `performance` proof만 가진다.

설명용 `PerformanceEvidencePanel`도 X-Ray 테두리에서 제외했다. 패널은 구현 결과를 읽는 UI이지 OpenLayers, R3F, 가상 목록의 실제 렌더링 경계가 아니기 때문이다.

전체 또는 FSD-style 모드를 선택했을 때의 기존 경계는 그대로 유지한다.

## 6. 화면에서 확인하는 방법

```text
http://127.0.0.1:3000/performance?xray=performance
```

1. 사고 수를 10,000건으로 선택한다.
2. 원본 데이터와 2D 원본 marker가 10,000인지 확인한다.
3. 현재 marker가 cluster와 single의 합인지 확인한다.
4. 지도를 확대해 현재 marker와 두 하위 숫자가 바뀌는지 확인한다.
5. 목록을 스크롤해 계산 범위가 바뀌고 DOM row 수는 전체 데이터보다 작은지 확인한다.
6. 3D 선택 사고를 누른다.
7. X-Ray 경계가 `performance/3d/SingleIncidentScene`으로 바뀌고 입력 범위가 한 건인지 확인한다.

## 7. 표시하지 않는 주장

다음 값은 실제 측정 장치를 두지 않았으므로 X-Ray에 표시하지 않는다.

```text
FPS
렌더링 소요 시간
메모리 사용량
몇 배 빨라졌다는 비율
GPU draw call 또는 실제 Three.js object 수
```

이 값이 필요해지는 시점에는 같은 입력과 환경에서 측정 도구를 먼저 연결하고, 측정 결과만 추가해야 한다.
