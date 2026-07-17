# 11. React Three Fiber 3D 위험 구역

이 화면은 전체 사고를 2D 지도에서 선택한 뒤, 선택한 사고 한 건의 실제 지도 주변과 위험도를 3D로 상세 확인하는 관제 기능이다.

## 1. 구현 목적과 진입점

사고가 여러 건일 때는 전체 위치와 분포를 비교해야 하므로 2D 지도가 적합하다. 반대로 하나의 사고를 확인할 때는 기둥이 어떤 실제 도로 위에 있는지, 위험 점수와 영향 인원이 어느 정도인지 가까운 범위에서 보는 편이 낫다.

그래서 `Risk3DPage`는 두 모드를 나눈다.

```txt
2D 전체 위치
→ OpenLayers로 필터 결과의 모든 사고 위치 비교
→ 지도 마커 또는 사고 목록 버튼으로 한 사고 선택

3D 선택 지점
→ 선택한 사고의 좌표를 중심으로 OpenStreetMap 3×3 타일 표시
→ 그 지점 원점에 기둥 하나 표시
→ 위험 점수, 위험 단계, 영향 인원을 함께 확인
```

진입점은 `apps/web/app/risk-3d/page.tsx`의 `Risk3DPage`다. 사용자가 `/risk-3d`에 접속하면 페이지가 REST API에서 사고 목록을 받고, Redux에 있는 선택 ID와 합쳐 `selectedIncident`를 만든다.

## 2. 전체 데이터 흐름

### 최초 진입과 기본 선택

```txt
사용자: /risk-3d 접속
→ Risk3DPage 렌더링, viewMode = "2d"
→ selectIncidentListQuery로 Redux 필터를 query로 변환
→ useEffect의 loadIncidents 실행
→ fetchIncidents(query)
→ GET /api/incidents 응답 Incident[]
→ setIncidents(nextIncidents)
→ 현재 selectedIncidentId가 목록에 없으면 getHighestRiskIncidentId(...) 계산
→ dispatch(setSelectedIncidentId(...))
→ selectedIncident = incidents.find(incident.id === selectedIncidentId)
```

서버에서 받은 `Incident[]`는 이 화면에서만 쓰는 조회 결과이므로 `incidents` local state에 둔다. 반면 다른 화면과 공유해야 하는 필터와 선택 ID는 Redux의 `selectIncidentListQuery`, `selectSelectedIncidentId`를 사용한다.

```ts
const query = useAppSelector(selectIncidentListQuery);
const selectedIncidentId = useAppSelector(selectSelectedIncidentId);
const selectedIncident = useMemo(
  () => incidents.find((incident) => incident.id === selectedIncidentId),
  [incidents, selectedIncidentId],
);
```

`selectedIncident`가 없을 때 3D 버튼은 비활성화된다. 따라서 유효한 사고가 정해지기 전에는 빈 3D 장면을 열 수 없다.

```tsx
<button
  aria-pressed={viewMode === "3d"}
  disabled={!selectedIncident}
  onClick={() => setViewMode("3d")}
  type="button"
>
  3D 선택 지점
</button>
```

### 사용자가 사고를 선택하는 흐름

```txt
사용자: 2D 지도 마커 클릭 또는 사고 목록 버튼 클릭
→ selectIncident(incidentId)
→ dispatch(setSelectedIncidentId(incidentId))
→ Redux selectedIncidentId 변경
→ Risk3DPage 재렌더링
→ selectedIncident가 새 Incident를 가리킴
→ 상세 패널과 3D 모드의 RiskZoneScene 입력이 같은 사고로 맞춰짐
```

선택 함수는 한 줄로 유지한다. 3D 기둥이 선택 상태를 바꾸지 않으므로, 선택의 출발점은 OpenLayers 지도와 접근 가능한 HTML 버튼 두 곳뿐이다.

```ts
function selectIncident(incidentId: string) {
  dispatch(setSelectedIncidentId(incidentId));
}
```

## 3. 2D와 3D의 책임 분리

`viewMode`가 `"2d"`이면 모든 필터 결과를 OpenLayers에 넘긴다. `"3d"`이면 이미 고른 한 건만 `RiskZoneScene`에 넘긴다.

```tsx
{viewMode === "2d" ? (
  <OpenLayersIncidentMap
    incidents={incidents}
    onSelectIncident={selectIncident}
    selectedIncidentId={selectedIncidentId}
  />
) : selectedIncident ? (
  <RiskZoneScene incident={selectedIncident} />
) : null}
```

이 분리가 필요한 이유는 전체 도시를 3D 기둥으로 비교하면 기둥은 보이지만 어느 실제 위치에서 솟았는지 파악하기 어려워지기 때문이다. 현재 3D 화면은 도시 전체 비교 기능이 아니라, 2D에서 고른 한 사고의 주변 맥락을 확인하는 상세 뷰다.

기존 다중 사고 배열과 3D 기둥 클릭 callback은 제거했다.

```ts
// 이전
type RiskZoneSceneProps = {
  incidents: Incident[];
  onSelectIncident: (incidentId: string) => void;
  selectedIncidentId?: string;
};

// 현재
type RiskZoneSceneProps = {
  incident: Incident;
};
```

입력이 하나면 평균 중심 좌표, 여러 기둥의 상대 좌표 계산, 3D 안의 hover·click 선택 상태가 모두 필요 없어져 장면의 책임이 선명해진다.

## 4. Incident를 3D 장면 값으로 바꾸는 과정

`RiskZoneScene`은 선택된 `incident` 하나로 `createRiskScene`을 호출한다.

```ts
const scene = createRiskScene(incident);
```

유효한 위도·경도가 아니면 서울 기본 중심과 `zone: undefined`를 반환한다. 이 경우 지도 바닥은 만들 수 있지만 기둥과 tooltip은 렌더링하지 않는다.

유효한 좌표일 때 변환 규칙은 다음과 같다.

```ts
const risk = calculateIncidentRisk(incident);

return {
  center: incident.location,
  zone: {
    color: incidentRiskLevelColors[risk.level],
    height: 0.35 + risk.score / 45,
    impactRadius: 0.48 + Math.sqrt(Math.max(incident.affectedPeople, 0)) * 0.07,
    incident,
    position: [0, 0, 0],
    radius: 0.3 + Math.min(Math.max(incident.affectedPeople, 0), 100) / 650,
    risk,
  },
};
```

| 입력 값 | 계산된 표시 값 | 의미 |
| --- | --- | --- |
| `incident.location` | `center` | 가져올 OSM 지도 타일의 중심 좌표 |
| `risk.score` | `height` | 점수가 클수록 높은 기둥 |
| `risk.level` | `color` | 위험 단계별 기둥 색상 |
| `affectedPeople` | `radius`, `impactRadius` | 기둥 굵기와 반투명 링의 비교 크기 |

예를 들어 위험 점수가 `80`, 영향 인원이 `18`이면 다음과 같이 계산된다.

```txt
height = 0.35 + 80 / 45 ≈ 2.13
radius = 0.3 + 18 / 650 ≈ 0.33
impactRadius = 0.48 + sqrt(18) × 0.07 ≈ 0.78
```

링은 실제 피해 반경이 아니다. 영향 인원을 기둥만으로 비교하기 어려워 보조적으로 표시하는 값이며, 화면 범례와 설명에도 그 제한을 표시한다.

## 5. 기둥이 실제 지도 위치에 보이는 이유

`position: [0, 0, 0]`은 사고 좌표를 버린다는 뜻이 아니다. 선택 사고의 좌표로 지도 타일 자체를 중앙에 배치했기 때문에, 장면 원점이 바로 선택 사고의 실제 위치다.

```txt
incident.location
→ createRiskScene의 center
→ MapGround(center)
→ createMapTiles(center)
→ Web Mercator 타일 번호 계산
→ 선택 사고 주변 OSM 3×3 타일을 장면 중앙에 배치
→ RiskTower position [0, 0, 0]
→ 지도 중앙의 선택 사고 위치에 기둥 표시
```

`createMapTiles`와 `toMapTilePoint`는 OpenStreetMap URL에 필요한 Web Mercator 타일 번호를 계산한다. 3×3 타일은 넓은 도시 전체를 보여주려는 용도가 아니라, 기둥 바닥과 근처 도로·지형을 같이 확인할 수 있는 상세 범위다.

```ts
const centerPoint = toMapTilePoint(center);
const startX = Math.round(centerPoint.x - mapTileCount / 2);
const startY = Math.round(centerPoint.y - mapTileCount / 2);
```

## 6. R3F 장면과 조작

`Canvas`는 장면의 카메라·조명·지도 바닥·기둥 하나를 선언적으로 렌더링한다.

```tsx
<Canvas camera={{ fov: 38, position: detailCameraPosition }} dpr={[1, 1.5]}>
  <ambientLight intensity={0.75} />
  <hemisphereLight args={["#ffffff", "#64748b", 1.8]} />
  <directionalLight intensity={2.2} position={[8, 12, 6]} />
  <MapGround center={scene.center} />
  <MapControls resetViewKey={resetViewKey} />
  {scene.zone ? <RiskTower zone={scene.zone} /> : null}
</Canvas>
```

장면은 정적이다. 기둥 클릭, hover 상태, 회전 애니메이션, 그림자 렌더링을 제거했다. 이 값들은 선택 사고 한 건을 확인하는 데 필요하지 않았고, 지도와 위치의 관계를 더 복잡하게 만들었다.

`MapControls`는 확대·축소만 허용한다. pan과 rotate를 막아 사용자가 기둥 바닥과 지도 중심의 관계를 잃지 않게 한다.

```ts
const controls = new OrbitControls(camera, gl.domElement);
controls.enablePan = false;
controls.enableRotate = false;
controls.maxDistance = 20;
controls.minDistance = 7;
controls.target.set(0, 0, 0);
```

`시점 초기화` 버튼은 `resetViewKey`를 증가시키고, 그 값이 바뀌면 effect가 정해진 카메라 위치와 target을 다시 적용한다.

```ts
onClick={() => setResetViewKey((key) => key + 1)}

useEffect(() => {
  camera.position.set(...detailCameraPosition);
  controlsRef.current?.target.set(0, 0, 0);
  controlsRef.current?.update();
}, [camera, resetViewKey]);
```

## 7. 접근성, 로딩, 실패 처리

3D Canvas 내부 mesh는 키보드 접근성과 화면 읽기 도구의 기본 제어 대상이 아니다. 따라서 사고 선택은 HTML `<button>` 목록과 2D OpenLayers 마커에 둔다. 버튼은 `aria-pressed`로 현재 선택을 전달한다.

```tsx
<button
  aria-pressed={selected}
  onClick={() => onSelect(incident.id)}
  type="button"
>
```

Canvas에는 선택 사고 ID·위험도·위험 단계를 읽는 `sr-only` 텍스트가 있고, WebGL을 사용할 수 없는 경우 `fallback` 오류 문구를 표시한다. REST 요청의 loading, error, empty 상태도 페이지에서 각각 표시한다.

```txt
loading = true → "데이터를 불러오는 중"
fetch 실패 → role="alert" 오류 문구
incidents.length = 0 → 빈 상태 문구
좌표가 잘못됨 → 지도는 기본 중심, 기둥과 tooltip은 생략
```

## 8. 단순화한 내용과 이유

| 제거한 것 | 이유 | 현재 대체 경로 |
| --- | --- | --- |
| 여러 사고를 한 Canvas에 동시에 렌더링 | 전체 위치 비교는 2D가 더 직관적 | OpenLayers 2D 전체 위치 |
| 기둥 click/hover/선택 ring | 3D에서 다시 선택할 필요가 없음 | 2D 마커와 HTML 선택 버튼 |
| 평균 중심·상대 X/Z 계산 | 단일 사고에서는 장면 중심이 곧 사고 좌표 | OSM 타일을 사고 좌표 중심으로 생성 |
| `useFrame` 애니메이션과 shadow | 정보 전달과 무관한 렌더링 비용·시각적 잡음 | 정적 기둥, 정적 링, 기본 조명 |

이 단순화는 3D 기능을 없앤 것이 아니다. 3D의 책임을 “선택 사고의 지도 기반 상세 확인”으로 제한하고, 전체 비교·선택은 2D가 담당하게 만든 것이다.

## 9. 현재 검증 범위

코드 수준에서는 다음을 확인한다.

```bash
npm run typecheck
npm test
```

브라우저 확인 시에는 다음 순서로 본다.

```txt
1. /risk-3d 최초 진입은 2D 전체 위치 모드다.
2. 2D 마커 또는 사고 목록 버튼을 누르면 선택 상세가 바뀐다.
3. 3D 선택 지점 버튼은 선택 사고가 있을 때만 활성화된다.
4. 3D로 전환하면 선택 사고 주변 지도 가운데 기둥 하나가 보인다.
5. 확대·축소와 시점 초기화가 동작한다.
6. 선택 사고를 바꾼 뒤 다시 3D로 열면 다른 좌표 주변 타일과 tooltip이 표시된다.
```

## 최종 흐름

```txt
REST Incident[] 조회
→ Redux의 selectedIncidentId와 결합
→ 2D OpenLayers에서 전체 위치 비교와 사고 선택
→ selectedIncident 생성
→ 3D 모드에서 RiskZoneScene에 한 사고 전달
→ 사고 좌표 중심 OSM 타일 생성
→ 지도 원점에 위험 점수·위험 단계·영향 인원을 표현한 기둥 렌더링
→ 선택 사고의 실제 주변 위치와 위험 정보를 함께 확인
```
