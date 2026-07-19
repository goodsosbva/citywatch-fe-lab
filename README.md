# CityWatch FE Lab

CityWatch FE Lab은 도시 안전 사고를 접수, 분류, 조회, 상태 변경할 수 있도록 구현한 **도시 안전 관제 시스템**입니다.

사고 목록과 상세, 대응 상태 변경, 관제 요약 지표를 중심으로 실제 관제 화면의 흐름을 구성합니다. 이 기능을 구현하는 과정에서 Next.js App Router, TypeScript, REST API, X-Ray 라벨, 모노레포 같은 프론트엔드 기술을 단계적으로 적용합니다.

## 기술 적용 요약

관제 시스템 기능 안에서 라우팅, 타입 공유, REST API, Zod 기반 등록 폼 검증, 접근성, 위험도 계산 단위 테스트, Redux 상태 공유, OpenLayers 지도 관제, WebSocket/Polling 실시간 피드, React Three Fiber 3D 위험 구역, 대량 데이터 성능 관제, X-Ray 시각화, 모노레포 구조, Storybook UI 증명을 확인할 수 있습니다. 이후 단계에서는 Module Federation까지 같은 관제 흐름 안에 확장합니다.

자세한 기술 적용 설명은 [docs/tech-proof-points.md](docs/tech-proof-points.md)에 정리합니다.

## 현재 구현 범위

현재까지 구현된 범위입니다.

- 도시 안전 관제 홈 대시보드
- 사고 목록 페이지
- 사고 상세 페이지
- 사고 등록 페이지
- 사고 목록/상세/등록/상태 변경용 내부 REST API
- 사고 위험도 계산과 단위 테스트
- 사고 목록 필터와 선택 사고를 공유하는 Redux 상태
- 사고 위치를 OpenLayers 지도에 표시하는 지도 관제 페이지
- WebSocket 실패 시 polling fallback으로 전환되는 실시간 사고 피드
- OpenStreetMap 실제 위치 위에서 위험 점수를 3D 기둥으로 비교하는 위험 구역
- OpenLayers 클러스터 지도와 가상 목록으로 5,000·10,000건을 확인하는 성능 시나리오
- UI 블록의 출처를 화면에 보여주는 X-Ray 모드
- `packages/ui` 공용 컴포넌트를 격리 검증하는 Storybook

## 실행 방법

저장소 루트에서 실행합니다.

```bash
npm run dev:web
npm run dev:realtime
```

브라우저에서 확인합니다.

```txt
http://127.0.0.1:3000/
```

주요 화면입니다.

```txt
http://127.0.0.1:3000/incidents
http://127.0.0.1:3000/map
http://127.0.0.1:3000/risk-3d
http://127.0.0.1:3000/performance
http://127.0.0.1:3000/realtime
http://127.0.0.1:3000/incidents/new
http://127.0.0.1:3000/incidents/INC-001
```

확인용 API입니다.

```txt
GET  http://127.0.0.1:3000/api/incidents
GET  http://127.0.0.1:3000/api/incidents/many-data?size=10000
POST http://127.0.0.1:3000/api/incidents
GET  http://127.0.0.1:3000/api/incidents/INC-001
GET  http://127.0.0.1:3001/health
GET  http://127.0.0.1:3001/events
```

## 검증 방법

```bash
npm run typecheck
npm run test
npm --workspace @citywatch/web run build
```

## 작업 공간 구조

```txt
apps/web                현재 실행되는 Next App Router 앱
apps/analytics-remote   추후 Module Federation remote 구현 위치
apps/realtime-server    추후 WebSocket/Polling 서버 구현 위치
packages/api-types      API/도메인 공유 타입
packages/ui             공통 UI와 X-Ray 컴포넌트
docs                    단계별 학습/구현 정리 문서
```

## 문서

자세한 구현 설명은 `docs/` 하위에 정리합니다.

```txt
docs/00-current-architecture-summary.md
docs/04-incidents-list-detail.md
docs/05-rest-api.md
docs/06-create-form-validation-accessibility.md
docs/07-risk-score-unit-test.md
docs/07-risk-score-code-walkthrough.md
docs/08-redux-shared-state.md
docs/09-openlayers-map-monitoring.md
docs/10-websocket-polling-realtime.md
docs/10-websocket-polling-code-walkthrough.md
docs/11-r3f-3d-risk-zone.md
docs/12-performance-large-data-monitoring.md
docs/13-storybook-ui-proof.md
docs/tech-proof-points.md
docs/xray-labels.md
```
