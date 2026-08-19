# 20-10. R3F / Three.js X-Ray 개선

## 목표

기존 R3F X-Ray는 3D 장면을 실제로 보여주고 있었지만 경계 이름은 다음처럼 FSD 관점과 섞여 있었다.

```text
widget/RiskZoneScene
feature/risk-3d/R3FThreePipeline
```

R3F를 선택한 사람에게 필요한 질문은 `widget인가 feature인가`가 아니다.

```text
어디까지 React가 관리하는가?
어디부터 R3F Canvas인가?
R3F JSX는 어떤 Three.js 객체가 되는가?
Three.js 객체는 어떻게 화면 픽셀이 되는가?
```

20-10은 새 3D 기능을 만드는 단계가 아니다. 이미 동작하는 장면의 실제 책임과 렌더링 흐름을 정확하게 드러내는 단계다.

## 최종 화면 경계

R3F 모드의 3D 화면에는 두 개의 X-Ray 경계만 표시한다.

```text
React · apps/web · RiskZoneScene
└─ R3F Canvas · @react-three/fiber
```

첫 번째 경계는 React가 관리하는 HTML·상태 영역이다.

- 선택된 `Incident`를 받는다.
- 위험 점수와 장면 데이터를 계산한다.
- Canvas 주변의 접근성 설명, 툴팁, 초기화 버튼을 렌더링한다.
- R3F `Canvas`에 camera와 WebGL 설정을 전달한다.

두 번째 경계는 `@react-three/fiber`가 관리하는 Canvas 영역이다.

- React JSX를 Three.js 장면 객체로 연결한다.
- 객체의 생성·갱신·제거를 React 생명주기와 맞춘다.
- Three.js `WebGLRenderer`가 사용할 실제 `<canvas>`를 만든다.

## 왜 Mesh마다 화면 테두리를 만들지 않았는가

`<mesh>`는 JSX에 적혀 있지만 브라우저 DOM의 `<mesh>` 태그가 아니다.

```tsx
<mesh>
  <cylinderGeometry />
  <meshStandardMaterial />
</mesh>
```

R3F가 이 JSX를 다음 Three.js 객체로 변환한다.

```text
THREE.Mesh
├─ THREE.CylinderGeometry
└─ THREE.MeshStandardMaterial
```

이 객체들은 Canvas 내부 장면 그래프에 존재한다. 개발자 도구의 HTML 트리에는 개별 DOM 요소로 나타나지 않는다. 따라서 Mesh마다 HTML 테두리를 덧씌우면 실제 경계를 거짓으로 표현하게 된다.

화면에는 실제 DOM 경계인 React 영역과 Canvas 영역만 표시하고, Canvas 내부 객체는 증거 패널의 장면 트리로 표시한다.

## X-Ray 조건

페이지는 기존 `useXRay()` 결과를 한 번만 읽는다.

```tsx
const { enabled: xray, mode } = useXRay();
const [viewMode, setViewMode] = useState<RiskViewMode>("2d");
const r3fXray = mode === "r3f" && viewMode === "3d";
```

`r3fXray`는 두 조건이 모두 맞아야 `true`다.

```text
X-Ray 선택 = r3f
그리고
현재 화면 = 3d
```

결과는 다음과 같다.

| X-Ray 선택 | 화면 모드 | R3F 경계 | R3F 증거 패널 |
| --- | --- | --- | --- |
| R3F | 3D | 표시 | 표시 |
| R3F | 2D | 숨김 | 숨김 |
| FSD | 3D | 기존 FSD 경계 | 숨김 |
| Off | 3D | 숨김 | 숨김 |

2D 화면은 OpenLayers로 렌더링된다. R3F를 선택했다는 이유만으로 2D 지도 아래에 WebGL 증거를 남기지 않는다.

## React 경계 구현

3D 화면을 감싸던 기존 `XRayBox`를 재사용한다.

```tsx
<XRayBox
  enabled={xray || r3fXray}
  label={
    r3fXray
      ? "react/risk-3d/RiskZoneScene"
      : viewMode === "2d"
        ? "widget/OpenLayersIncidentMap"
        : "widget/RiskZoneScene"
  }
  layer={r3fXray ? "app" : "widget"}
  packageName="apps/web"
>
```

R3F 관점일 때만 라벨을 실제 실행 책임으로 바꾼다.

```text
react/risk-3d/RiskZoneScene
packageName = apps/web
```

FSD 관점에서는 기존 `widget/RiskZoneScene` 의미를 유지한다. 한 관점에서 두 종류의 용어를 동시에 표시하지 않는 것이 핵심이다.

## Canvas 경계 구현

`RiskZoneScene`은 성능 페이지에서도 재사용된다. 따라서 `xray` prop은 선택값으로 추가하고 기본값을 `false`로 둔다.

```tsx
type RiskZoneSceneProps = {
  incident: Incident;
  xray?: boolean;
};

export function RiskZoneScene({ incident, xray = false }: RiskZoneSceneProps) {
```

일반 호출자는 바뀌지 않는다.

```tsx
<RiskZoneScene incident={selectedIncident} />
```

R3F X-Ray를 표시하는 화면만 값을 전달한다.

```tsx
<RiskZoneScene incident={selectedIncident} xray={r3fXray} />
```

실제 `Canvas`를 기존 `XRayBox`로 감싼다.

```tsx
<XRayBox
  className="r3f-canvas-xray"
  enabled={xray}
  label="r3f/Canvas"
  packageName="@react-three/fiber"
  proofs={["r3f"]}
>
  <Canvas>...</Canvas>
</XRayBox>
```

새 X-Ray 컴포넌트를 만들지 않은 이유는 기존 `XRayBox`가 조건부 경계, 패키지 정보, 기술 proof를 이미 지원하기 때문이다.

## 데이터에서 화면까지 전체 흐름

```text
REST Incident
→ Redux selectedIncidentId
→ React selectedIncident
→ createRiskScene(incident)
→ RiskZone
→ RiskTower JSX
→ R3F reconciler
→ Three.js Scene 객체
→ WebGLRenderer
→ WebGL draw call
→ GPU vertex/fragment 처리
→ framebuffer
→ browser canvas
```

### 1. React가 선택 사고를 찾는다

```tsx
const selectedIncident = incidents.find(
  (incident) => incident.id === selectedIncidentId,
);
```

Redux에는 선택된 사고의 ID가 있고, React는 REST 응답 배열에서 실제 사고 객체를 찾는다.

### 2. 사고를 3D 표현 값으로 바꾼다

```tsx
const scene = createRiskScene(incident);
```

`createRiskScene`은 업무 데이터를 렌더링 데이터로 바꾼다.

```text
risk.score
→ 기둥 높이

risk.level
→ 기둥 색상

affectedPeople
→ 링 반지름

incident.location
→ 지도 타일 중심
```

현재 높이 공식은 다음과 같다.

```ts
height = 0.35 + risk.score / 45
```

증거 패널은 선택된 사고의 실제 ID, 위험 점수, 영향 인원, 계산된 높이를 표시한다. 고정 예제 문구가 아니라 현재 React 상태에서 나온 값이다.

### 3. React가 R3F JSX를 렌더링한다

```tsx
<Canvas camera={{ fov: 38, position: [0, 12, 8.5] }}>
  <MapGround center={scene.center} />
  <RiskTower zone={scene.zone} />
</Canvas>
```

이 코드는 장면에 무엇이 있어야 하는지를 선언한다.

### 4. R3F가 JSX와 Three.js를 연결한다

R3F는 React 전용 renderer다. 일반 React가 JSX를 HTML DOM으로 바꾸는 것과 달리, R3F는 Canvas 안의 JSX를 Three.js 객체로 바꾼다.

```text
<mesh>
→ THREE.Mesh

<planeGeometry>
→ THREE.PlaneGeometry

<ringGeometry>
→ THREE.RingGeometry

<cylinderGeometry>
→ THREE.CylinderGeometry

<meshBasicMaterial>
→ THREE.MeshBasicMaterial

<meshStandardMaterial>
→ THREE.MeshStandardMaterial
```

React prop이 바뀌면 R3F는 기존 Three.js 객체와 새 JSX를 비교해 필요한 속성이나 객체를 갱신한다.

## 실제 장면 객체 관계

현재 장면의 핵심 관계는 다음과 같다.

```text
Scene
├─ PerspectiveCamera
│  ├─ fov: 38
│  └─ position: [0, 12, 8.5]
├─ ambientLight
├─ hemisphereLight
├─ directionalLight
├─ MapGround
│  └─ 9 × Mesh
│     ├─ PlaneGeometry
│     └─ MeshBasicMaterial
│        └─ OpenStreetMap Texture
└─ RiskTower
   ├─ Mesh
   │  ├─ RingGeometry
   │  └─ MeshBasicMaterial
   ├─ Mesh
   │  ├─ RingGeometry
   │  └─ MeshBasicMaterial
   └─ Mesh
      ├─ CylinderGeometry
      └─ MeshStandardMaterial
```

### Mesh

Mesh는 화면에 그릴 수 있는 하나의 3D 물체다.

```text
Mesh = Geometry + Material + Transform
```

### Geometry

Geometry는 물체의 형태다.

- `PlaneGeometry`: 지도 타일이 붙는 평면
- `RingGeometry`: 영향 범위와 기둥 외곽 링
- `CylinderGeometry`: 위험 점수 높이를 표현하는 기둥

내부에는 꼭짓점 위치, normal, UV, 삼각형 index 같은 배열이 있다.

### Material

Material은 물체 표면을 어떻게 칠할지 정한다.

- `MeshBasicMaterial`: 조명 계산 없이 텍스처나 색상을 표시
- `MeshStandardMaterial`: 조명, 거칠기, 금속성 등을 계산

### Camera

Camera는 장면을 어느 위치와 각도에서 볼지 정한다. 현재는 `PerspectiveCamera`이며 `fov`는 38이다.

카메라는 물체를 만들지 않는다. 3D 좌표를 화면의 2D 위치로 투영할 때 사용되는 행렬을 제공한다.

## Three.js에서 WebGL과 GPU까지

애플리케이션 코드에는 `gl.drawElements()`가 직접 나오지 않는다. Three.js의 `WebGLRenderer`가 이 저수준 작업을 담당하기 때문이다.

실행 흐름은 다음과 같다.

```text
1. Three.js가 Geometry 배열을 WebGL buffer로 만든다.
2. buffer를 GPU 메모리에 업로드한다.
3. Material과 조명에 맞는 shader program을 준비한다.
4. Camera의 view·projection 행렬을 계산한다.
5. Mesh의 position·rotation·scale을 model 행렬로 계산한다.
6. WebGL draw call을 실행한다.
7. GPU vertex shader가 각 꼭짓점의 화면 위치를 계산한다.
8. GPU가 삼각형 내부의 픽셀 후보를 만든다.
9. fragment shader가 각 픽셀의 색상과 조명을 계산한다.
10. depth test를 통과한 결과를 framebuffer에 기록한다.
11. 브라우저가 framebuffer 결과를 Canvas에 표시한다.
```

R3F, Three.js, WebGL의 역할을 한 줄씩 정리하면 다음과 같다.

```text
R3F      React JSX와 Three.js 객체의 생명주기를 연결한다.
Three.js 장면, Mesh, Geometry, Material, Camera, Renderer를 관리한다.
WebGL    Three.js가 GPU에 그리기 명령을 전달하는 브라우저 API다.
GPU      꼭짓점과 픽셀 계산을 병렬로 실행한다.
Canvas   최종 픽셀 결과가 브라우저 페이지에 나타나는 영역이다.
```

## 증거 패널 변경

기존 `feature/risk-3d/R3FThreePipeline` X-RayBox는 삭제했다. 증거 패널은 실제 R3F 기능 영역이 아니라 React로 만든 설명 UI이기 때문이다.

대신 패널 안에 네 실행 단계를 표시한다.

```text
React 입력
→ R3F 조정
→ Three.js 객체
→ WebGL Canvas
```

그 아래에는 실제 객체 트리와 더 낮은 실행 흐름을 표시한다.

```text
RiskTower JSX
→ THREE.Mesh
→ Geometry GPU buffer
→ Material + Light + Camera
→ WebGL draw call
→ Canvas pixels
```

## 2D와 3D 표시 분리

R3F 관점을 선택하면 데이터가 준비된 뒤 3D 화면으로 한 번 안내된다. 사용자는 이후 `2D 전체 위치` 버튼으로 돌아갈 수 있다.

2D로 돌아간 순간 다음 요소가 모두 사라진다.

- React/RiskZoneScene X-Ray 경계
- R3F Canvas 경계
- R3F / Three.js 증거 패널

실제 2D 지도와 사고 선택 UI는 그대로 동작한다. X-Ray는 기능 상태를 변경하지 않고 현재 화면에 존재하는 기술만 설명한다.

## 접근성

WebGL Canvas 안의 Mesh는 HTML 버튼이 아니므로 스크린 리더와 키보드가 개별 Mesh를 직접 탐색하지 못한다.

기존 접근성 대체 수단을 유지했다.

- Canvas 앞의 `sr-only` 텍스트가 선택 사고와 위험 점수를 설명한다.
- Canvas 바깥의 HTML 사고 버튼으로 동일한 사고를 선택할 수 있다.
- 시점 초기화는 실제 `<button>`이다.
- WebGL 생성 실패 시 `role="alert"` 오류를 표시한다.

X-Ray 시각 라벨은 `aria-hidden="true"`인 기존 `XRayBox` 라벨을 사용하므로 스크린 리더의 업무 화면 읽기를 방해하지 않는다.

## CSS 표시 원칙

R3F 모드에서 두 경계의 색을 구분한다.

```text
파란색 = React · apps/web
초록색 = R3F Canvas · @react-three/fiber
```

증거 패널은 네 단계에 별도 색을 사용한다.

```text
파랑 = React
초록 = R3F
주황 = Three.js
보라 = WebGL/GPU
```

작은 화면에서는 네 카드를 한 열로 바꾸고 화살표를 아래 방향으로 회전한다.

## 변경 파일

```text
apps/web/app/risk-3d/page.tsx
apps/web/app/risk-3d/risk-zone-scene.tsx
apps/web/app/globals.css
docs/20-10-r3f-threejs-xray-improvement.md
```

## 의도적으로 추가하지 않은 것

- 새 X-Ray 컴포넌트
- 새 Context나 전역 상태
- 별도 Three.js inspector 패키지
- WebGL 호출 가로채기
- 실제 GPU 내부 객체를 가장한 DOM 테두리
- 2D 화면의 R3F 설명

기존 `XRayBox`, 현재 `mode`, `viewMode`, 실제 장면 JSX만으로 요구가 충족되기 때문이다.

## 확인 순서

1. `/risk-3d?xray=r3f`에 접속한다.
2. 데이터 로딩 후 `3D 선택 지점`이 활성화되는지 확인한다.
3. 파란 `React · apps/web · RiskZoneScene` 경계를 확인한다.
4. 그 안의 초록 `R3F Canvas · @react-three/fiber` 경계를 확인한다.
5. `widget`, `feature`, `entity` 라벨이 R3F 화면에 섞이지 않는지 확인한다.
6. 증거 패널의 사고 ID와 위험 점수가 선택 사고와 같은지 확인한다.
7. 다른 사고를 선택하고 동적 값과 기둥이 바뀌는지 확인한다.
8. `2D 전체 위치`를 누른다.
9. R3F 경계와 증거 패널이 모두 사라지는지 확인한다.
10. `3D 선택 지점`을 누르면 다시 나타나는지 확인한다.
11. `/incidents?xray=r3f`로 이동해 관계없는 페이지에 R3F 경계가 없는지 확인한다.

## 현재 한계

증거 패널은 현재 코드로 선언한 객체 관계를 설명하며 GPU 드라이버 내부 상태를 실시간으로 읽지는 않는다. 실제 draw call 수는 텍스처 로딩, 렌더러 최적화, 프레임 상태에 따라 달라질 수 있으므로 고정 숫자로 표시하지 않았다.

현재 학습 목표는 앱 코드에서 시작해 Canvas 픽셀까지 이어지는 책임과 인과관계를 정확히 이해하는 것이다. 실시간 GPU 프로파일링이 필요해지는 시점에는 브라우저 성능 도구나 Three.js의 `gl.info`를 별도 단계로 추가하면 된다.
