# CityWatch FE Lab

CityWatch FE Lab은 도시 안전 사고를 접수, 분류, 조회, 상태 변경할 수 있도록 구현한 **도시 안전 관제 시스템**입니다.

사고 목록과 상세, 대응 상태 변경, 관제 요약 지표를 중심으로 실제 관제 화면의 흐름을 구성합니다. 이 기능을 구현하는 과정에서 Next.js App Router, TypeScript, REST API, X-Ray 라벨, 모노레포 같은 프론트엔드 기술을 단계적으로 적용합니다.

## 기술 적용 요약

관제 시스템 기능 안에서 라우팅, 타입 공유, REST API, X-Ray 시각화, 모노레포 구조를 확인할 수 있습니다. 이후 단계에서는 지도, 실시간 데이터, 3D 위험 구역, 성능 최적화, Storybook, Module Federation까지 같은 관제 흐름 안에 확장합니다.

자세한 기술 적용 설명은 [docs/tech-proof-points.md](docs/tech-proof-points.md)에 정리합니다.

## 현재 구현 범위

현재까지 구현된 범위입니다.

- 도시 안전 관제 홈 대시보드
- 사고 목록 페이지
- 사고 상세 페이지
- 사고 목록/상세/상태 변경용 내부 REST API
- UI 블록의 출처를 화면에 보여주는 X-Ray 모드

## 실행 방법

저장소 루트에서 실행합니다.

```bash
npm run dev:web
```

브라우저에서 확인합니다.

```txt
http://127.0.0.1:3000/
```

주요 화면입니다.

```txt
http://127.0.0.1:3000/incidents
http://127.0.0.1:3000/incidents/INC-001
```

확인용 API입니다.

```txt
http://127.0.0.1:3000/api/incidents
http://127.0.0.1:3000/api/incidents/INC-001
```

## 검증 방법

```bash
npm run typecheck
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
docs/tech-proof-points.md
docs/xray-labels.md
```