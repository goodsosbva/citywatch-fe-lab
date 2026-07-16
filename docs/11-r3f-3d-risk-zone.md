# 11. React Three Fiber 3D 위험 구역

이 단계는 OpenStreetMap 실제 지도 위에 기존 사고 REST 데이터의 위험도를 3D 기둥으로 세우고, 기둥 선택을 기존 Redux 선택 상태에 연결한 구현이다.

## 1. 구현 목적

목록은 사고를 비교하기 좋고 지도는 실제 위치를 보기 좋지만, 여러 사고의 위험 크기를 공간 안에서 한 번에 비교하기는 어렵다. 따라서 다음 규칙으로 사고를 입체화했다.

```txt
위험 점수 → 기둥 높이
위험 단계 → 기둥 색상
위도/경도 → 바닥의 X/Z 위치
영향 인원 → 기둥 반지름
```

새 데이터 모델은 만들지 않았다. 5단계 REST 응답, 7단계 `calculateIncidentRisk`, 8단계 Redux 선택 상태를 그대로 재사용했다.

실사용 형태를 보완할 때는 deck.gl의 공식 `ColumnLayer`와 `HexagonLayer` 패턴을 참고했다. 개별 사고는 좌표·높이·색상·tooltip을 가진 선택 가능한 기둥으로 표현하고, 여러 점의 집계는 데이터가 많을 때만 hexagon binning을 사용한다. 현재 사고는 3건이므로 집계 계층은 추가하지 않았다.

- https://deck.gl/docs/api-reference/layers/column-layer
- https://deck.gl/docs/api-reference/aggregation-layers/hexagon-layer

## 2. 추가한 파일과 의존성

```txt
apps/web/app/risk-3d/page.tsx
apps/web/app/risk-3d/risk-zone-scene.tsx
```

```json
"@react-three/fiber": "^9.6.1",
"three": "^0.185.1",
"@types/three": "^0.185.1"
```

React 상태와 JSX로 Three.js 장면을 구성하기 위해 React Three Fiber를 사용했다. 장면에 필요한 조명, 메시, 기하 도형은 Three.js 표준 객체를 R3F JSX로 선언했다.

## 3. 전체 데이터 흐름

```txt
사용자가 /risk-3d 접속
→ Risk3DPage 렌더링
→ selectIncidentListQuery로 Redux 필터 query 생성
→ fetchIncidents(query)로 GET /api/incidents 요청
→ 응답 Incident[]를 incidents local state에 저장
→ RiskZoneScene에 incidents 전달
→ createRiskScene이 중심 좌표와 위험 구역 계산
→ MapGround가 OpenStreetMap 타일을 3D 바닥에 렌더링
→ toMapTilePoint가 사고 좌표를 같은 지도 좌표로 변환
→ Canvas가 실제 위치 위에 RiskTower 목록 렌더링
→ 선택값이 없으면 가장 높은 위험 점수 사고를 자동 선택
→ 사용자가 기둥 또는 HTML 사고 버튼 선택
→ selectIncident(incidentId)
→ dispatch(setSelectedIncidentId(incidentId))
→ selectSelectedIncidentId 결과 변경
→ 선택 기둥 강조, 버튼 aria-pressed, SelectedRiskZone 상세 갱신
```

서버 데이터는 `incidents` local state에 두고, 여러 화면이 공유해야 하는 필터와 선택 ID만 Redux에 둔 기존 원칙을 유지했다.

## 4. 페이지의 역할

`Risk3DPage`는 데이터 요청과 UI 상태 연결을 담당한다.

```ts
const query = useAppSelector(selectIncidentListQuery);
const selectedIncidentId = useAppSelector(selectSelectedIncidentId);

const nextIncidents = await fetchIncidents(query);
setIncidents(nextIncidents);
```

Redux 필터가 바뀌면 `query`가 바뀌고 `useEffect`가 다시 실행된다. 따라서 목록이나 지도에서 쓰던 검색 조건이 3D 화면의 사고 조회에도 그대로 적용된다.

선택은 한 함수로 모았다.

```ts
function selectIncident(incidentId: string) {
  dispatch(setSelectedIncidentId(incidentId));
}
```

R3F 기둥과 HTML 버튼이 모두 이 함수를 호출한다. 선택 경로가 달라도 최종 상태는 `selectedIncidentId` 하나이므로 3D 강조와 상세 표시가 어긋나지 않는다.

## 5. 사고 데이터를 3D 값으로 바꾸는 과정

`createRiskScene`은 유효한 위도와 경도만 남기고 전체 사고 좌표의 평균을 장면 중심으로 계산한다. `toMapTilePoint`는 지도 타일과 사고 좌표에 같은 Web Mercator 공식을 적용한다.

```ts
const risk = calculateIncidentRisk(incident);
const point = toMapTilePoint(incident.location);

return {
  color: riskZoneColors[risk.level],
  height: 0.35 + risk.score / 45,
  impactRadius: 0.5 + Math.sqrt(incident.affectedPeople) * 0.12,
  position: [
    clamp((point.x - centerPoint.x) * mapTileWorldSize, -8, 8),
    0,
    clamp((point.y - centerPoint.y) * mapTileWorldSize, -8, 8),
  ],
  radius: 0.3 + Math.min(Math.max(incident.affectedPeople, 0), 100) / 650,
};
```

예를 들어 `INC-001`의 위험 점수가 `100`이면 높이는 다음과 같다.

```txt
실행 전 risk.score = 100
→ 0.35 + 100 / 45
→ height ≈ 2.57
→ cylinderGeometry의 높이로 전달
→ 위험 점수 46인 기둥보다 높게 표시
```

임의의 위도·경도 배율을 쓰지 않고 지도 타일 번호의 차이에 `mapTileWorldSize`를 곱한다. 따라서 지도 바닥과 기둥이 같은 좌표계를 사용한다. `clamp`는 예외적으로 먼 좌표가 카메라 밖으로 나가는 것을 막는다.

## 6. R3F 장면과 상호작용

`Canvas`는 카메라, 조명, OpenStreetMap 바닥과 `RiskTower`를 렌더링한다.

```tsx
<Canvas camera={{ fov: 38, position: [7, 12, 10] }} shadows>
  <ambientLight intensity={0.75} />
  <directionalLight castShadow position={[8, 12, 6]} />
  <MapGround center={scene.center} />
  {scene.zones.map((zone) => <RiskTower key={zone.incident.id} zone={zone} />)}
</Canvas>
```

`OrbitControls`는 회전·확대·이동을 제공하고 `시점 초기화` 버튼은 카메라와 target을 기본값으로 복원한다. 기둥을 낮게 유지해 도로명을 가리지 않고, 반투명 원 크기로 영향 인원 규모를 비교한다. 원은 실제 피해 반경이 아니라 인원 규모의 시각 부호이며 범례에 그 의미를 표시한다.

기둥 클릭은 사고 ID를 페이지로 올린다.

```tsx
onClick={(event) => {
  event.stopPropagation();
  onSelect(zone.incident.id);
}}
```

`useFrame`은 선택 링을 매 프레임 회전시키고, 선택된 링만 크기를 조금씩 바꾼다. 데이터가 바뀌는 기능이 아니라 현재 선택을 시각적으로 구분하는 렌더링 효과다.

```ts
ring.rotation.z += delta * (selected ? 1.4 : 0.28);
const scale = selected ? 1 + Math.sin(clock.elapsedTime * 3) * 0.08 : 1;
ring.scale.setScalar(scale);
```

## 7. 접근성과 실패 처리

WebGL 메시만으로는 키보드와 화면 읽기 도구 사용자가 사고를 선택하기 어렵다. 같은 사고 목록을 실제 `<button>`으로 제공하고 선택 여부를 `aria-pressed`로 표시했다.

```tsx
<button
  aria-pressed={selected}
  onClick={() => onSelect(incident.id)}
  type="button"
>
```

장면 컨테이너에는 텍스트 대체 설명이 있고, WebGL을 사용할 수 없는 브라우저에는 `Canvas`의 `fallback` 오류 메시지가 표시된다. 데이터 요청에는 기존 loading, error, empty 상태를 모두 유지했다.

## 8. 검증 결과

```txt
npm run typecheck → 통과
npm run test → 7개 테스트 통과
npm --workspace @citywatch/web run build → 통과, /risk-3d 생성
npm audit --omit=dev → 취약점 0건
```

Playwright로 데스크톱과 390px 모바일을 확인했다.

```txt
캔버스 색상 구간 461개 → 지도 타일과 3D 기둥이 함께 렌더링됨
0.7초 사이 변경 픽셀 8296개 → 선택 링과 useFrame 애니메이션 동작
첫 진입 시 최고 위험 사고 INC-001 자동 선택과 tooltip 표시
지도 회전 후 시점 초기화 동작
3D 기둥 클릭 → INC-001 선택
HTML 버튼 클릭 → INC-002와 상세 패널 일치
데스크톱/모바일 가로 overflow 없음
```

## 9. 최종 결과

```txt
기존 REST Incident[]
→ 기존 calculateIncidentRisk 재사용
→ OpenStreetMap 타일과 사고 좌표를 같은 Web Mercator 좌표로 변환
→ createRiskScene에서 높이·색상·위치·반지름 계산
→ 실제 지도 바닥 위에 R3F RiskTower 렌더링
→ pointer·keyboard 선택을 Redux selectedIncidentId로 통합
→ 지도 기반 3D 장면, 선택 목록, 상세 패널이 같은 사고를 표시
```

11단계는 3D를 별도 데모로 붙인 것이 아니라, 앞 단계의 REST·위험도 계산·Redux 상태를 하나의 입체 관제 화면으로 연결한 단계다.
