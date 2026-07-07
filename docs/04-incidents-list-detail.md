# 4단계: /incidents 목록/상세

## 1. 지금까지 한 것

현재까지는 모노레포 기반을 잡고, Next App Router 앱을 만들고, 공유 타입과 공유 UI 패키지를 분리했다.

완료된 흐름은 다음과 같다.

```txt
0. Monorepo workspace 세팅
1. apps/web 생성
2. X-Ray Box + X-Ray toggle
3. / 대시보드
4. /incidents 목록/상세
```

3단계까지는 `/` 홈에서 관제 요약과 최근 사고 mock 데이터를 보여줬다. 이때 화면 위에는 X-Ray 라벨을 띄워서 `app`, `widget`, `entity`, `shared`, `feature` 계층을 시각적으로 보여주도록 했다.

## 2. 이번에 구현한 것

이번 4단계에서는 사고 목록과 사고 상세 라우트를 만들었다.

새로 생긴 라우트는 다음과 같다.

```txt
/incidents
/incidents/INC-001
/incidents/INC-002
/incidents/INC-003
```

구현 파일은 다음과 같다.

```txt
apps/web/app/incidents/mock-incidents.ts
apps/web/app/incidents/page.tsx
apps/web/app/incidents/incident-detail-view.tsx
apps/web/app/incidents/[id]/page.tsx
```

기존 홈도 수정했다.

```txt
apps/web/app/shell.tsx
apps/web/app/globals.css
```

홈의 최근 사고에서 상세 페이지로 이동할 수 있고, 상단에서 전체 사고 목록으로 이동할 수 있다.

## 3. 왜 이걸 했는지

이번 단계의 핵심은 REST API가 아니다. REST API는 다음 단계다.

이번 단계의 목적은 App Router의 실제 라우팅 흐름을 먼저 증명하는 것이다.

```txt
홈 /
→ 사고 목록 /incidents
→ 사고 상세 /incidents/[id]
```

이 흐름이 있어야 다음 단계에서 REST API를 붙였을 때 데이터 소스만 mock에서 API로 바꾸면 된다.

또한 같은 incident 데이터를 홈, 목록, 상세에서 같이 쓰기 위해 mock 데이터를 `shell.tsx` 안에 두지 않고 `mock-incidents.ts`로 분리했다. 이렇게 해야 사고 데이터의 기준점이 하나가 된다.

## 4. 어떻게 세팅했는지

### mock 데이터 분리

`apps/web/app/incidents/mock-incidents.ts`에 사고 mock 데이터를 모았다.

여기에는 다음이 들어 있다.

```txt
incidents
getIncidentById
getRegionName
formatIncidentDate
incidentCategoryLabels
incidentStatusLabels
```

이 파일은 아직 API가 아니다. 현재는 프론트에서 쓰는 임시 read model이다.

### 목록 페이지

`apps/web/app/incidents/page.tsx`는 `/incidents` 경로다.

여기서 하는 일은 다음과 같다.

```txt
1. incidents mock 데이터 읽기
2. 사고 목록 요약 지표 계산
3. 사고 리스트 렌더링
4. 각 사고를 /incidents/[id] 링크로 연결
5. X-Ray 라벨로 app/widget/entity/feature/shared 표시
```

대표 X-Ray 라벨은 다음과 같다.

```txt
app/incidents/IncidentsPage
widget/IncidentListSummary
widget/IncidentList
entity/incident/IncidentListItem
feature/incident/ViewIncidentDetail
shared/ui/SeverityBadge
```

### 상세 페이지

`apps/web/app/incidents/[id]/page.tsx`는 동적 라우트다.

여기서 하는 일은 다음과 같다.

```txt
1. URL의 id를 params에서 받음
2. getIncidentById(id)로 mock 데이터 조회
3. 없으면 notFound() 실행
4. 있으면 IncidentDetailView에 incident 전달
```

그리고 `generateStaticParams()`를 사용해서 현재 mock 데이터 기준 상세 페이지를 미리 만들 수 있게 했다.

```txt
INC-001
INC-002
INC-003
```

상세 화면 자체는 `incident-detail-view.tsx`에 두었다. 이유는 X-Ray toggle이 `useState`를 쓰기 때문이다. 즉, 상세 라우트는 서버에서 id를 찾고, 실제 토글 가능한 화면은 client component가 담당한다.

## 5. 실제로 동작시키면 어떤 흐름인지

개발 서버를 켠다.

```bash
npm run dev:web
```

브라우저에서 홈으로 들어간다.

```txt
http://127.0.0.1:3000/
```

홈에서 `사고 목록` 또는 `전체 보기`를 누르면 다음으로 이동한다.

```txt
http://127.0.0.1:3000/incidents
```

목록에서 사고의 `상세`를 누르면 다음처럼 동적 라우트로 이동한다.

```txt
http://127.0.0.1:3000/incidents/INC-001
```

Next App Router 관점에서는 이렇게 동작한다.

```txt
/incidents 요청
→ app/incidents/page.tsx 렌더링

/incidents/INC-001 요청
→ app/incidents/[id]/page.tsx 렌더링
→ params.id = "INC-001"
→ getIncidentById("INC-001")
→ IncidentDetailView 렌더링
```

## 6. 검증 결과

타입 검증:

```bash
npm run typecheck
```

결과:

```txt
@citywatch/web 통과
@citywatch/api-types 통과
@citywatch/ui 통과
```

Next production build:

```bash
npm --workspace @citywatch/web run build
```

빌드 결과 라우트:

```txt
/                         Static
/incidents                Static
/incidents/[id]           SSG
/incidents/INC-001        generateStaticParams
/incidents/INC-002        generateStaticParams
/incidents/INC-003        generateStaticParams
```

실행 중인 dev 서버 응답 확인:

```txt
GET /incidents → 200
GET /incidents/INC-001 → 200
```

콘텐츠 확인:

```txt
/incidents 응답에 "사고 목록 관제" 포함
/incidents 응답에 "강남역 지하 보행로 침수 감지" 포함
/incidents 응답에 "/incidents/INC-001" 링크 포함

/incidents/INC-001 응답에 "강남역 지하 보행로 침수 감지" 포함
/incidents/INC-001 응답에 "상세 정보" 포함
/incidents/INC-001 응답에 "/incidents" 뒤로가기 링크 포함
```

## 7. 아직 안 한 것

아직 다음은 하지 않았다.

```txt
5. REST API
6. create form + validation/accessibility
7. Unit Test / TDD 위험도 계산
8. Redux 상태 공유
9. OpenLayers 지도 관제
10. WebSocket/Polling 실시간 처리
11. R3F 3D 위험 구역
12. performance page 대량 데이터 관제
13. Storybook UI 증명
14. realtime-server 분리
15. analytics-remote + Module Federation
```

특히 이번 단계의 데이터는 아직 mock이다. API 호출이 아니다.

다음 5단계에서 해야 할 일은 `/incidents` 화면이 직접 mock 배열을 읽는 대신 REST API route를 통해 데이터를 받아오게 바꾸는 것이다.