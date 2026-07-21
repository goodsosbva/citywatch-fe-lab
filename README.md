# CityWatch FE Lab

CityWatch FE Lab은 학습한 프론트엔드 기술을 실제 기능으로 구현하고, 그 구현 근거를 X-Ray로 직접 보여주기 위한 **프론트엔드 사이드 프로젝트**입니다.

도시 안전 관제는 서로 다른 기술을 하나의 제품 흐름 안에서 연결하기 위한 주제입니다. 사고 접수·분류·조회·상태 변경 화면에는 Next.js App Router, TypeScript, REST API, Redux, OpenLayers, React Three Fiber, WebSocket, Storybook, Module Federation 같은 학습 결과가 실제 코드로 구현되어 있습니다.

X-Ray는 이 프로젝트의 핵심 증명 장치입니다. 현재 selector로 경계를 끄거나 전체·FSD-style·Module Federation 관점을 선택할 수 있으며, 이후에는 Monorepo, OpenLayers·3D 같은 구현 증거도 원하는 관점만 골라 보는 Inspector로 확장합니다.

## 학습 증명 요약

관제 시스템 화면을 사용하면서 라우팅, 타입 공유, REST API, Zod 기반 등록 폼 검증, 접근성, 위험도 계산 단위 테스트, Redux 상태 공유, OpenLayers 지도, WebSocket/Polling 실시간 피드, React Three Fiber 3D 위험 구역, 대량 데이터 성능 처리, 모노레포 구조, Storybook UI 검증을 확인할 수 있습니다. X-Ray는 화면을 구성한 코드와 기술의 근거를 사용자가 직접 탐색할 수 있게 합니다.

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
- 독립 Node workspace의 WebSocket 서버와 실패 시 polling fallback으로 전환되는 실시간 사고 피드
- OpenStreetMap 실제 위치 위에서 위험 점수를 3D 기둥으로 비교하는 위험 구역
- OpenLayers 클러스터 지도와 가상 목록으로 5,000·10,000건을 확인하는 성능 시나리오
- UI 블록의 출처를 화면에 보여주는 X-Ray 모드
- `packages/ui` 공용 컴포넌트를 격리 검증하는 Storybook
- Vite remote의 분석 함수를 runtime manifest로 불러오는 Module Federation

## 실행 방법

저장소 루트에서 실행합니다.

```bash
npm run dev
```

이 명령은 web, analytics remote, realtime server를 함께 실행하며 `Ctrl+C`로 모두 종료한다. 특정 서비스만 확인할 때는 `npm run dev:web`, `npm run dev:remote`, `npm run dev:realtime`을 각각 사용한다.

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
GET  http://127.0.0.1:3002/mf-manifest.json
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
apps/analytics-remote   Vite Module Federation 분석 remote
apps/realtime-server    독립 실행되는 WebSocket/Polling Node 서버
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
docs/14-realtime-server-separation.md
docs/15-analytics-remote-module-federation.md
docs/16-xray-selector.md
docs/17-module-federation-xray-filter.md
docs/tech-proof-points.md
docs/xray-labels.md
```
