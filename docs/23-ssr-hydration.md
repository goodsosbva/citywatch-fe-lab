# 23. SSR 구현

## 무엇이 바뀌었는가

사고 상세 화면의 최초 데이터 로딩을 브라우저에서 서버로 옮겼다.

변경 전에는 서버가 사고 ID만 Client Component에 전달했다.

```text
브라우저가 /incidents/INC-001 요청
→ page.tsx는 id만 전달
→ 제목 없는 기본 HTML
→ 브라우저 JavaScript 실행
→ useEffect 실행
→ GET /api/incidents/INC-001
→ setIncident
→ 제목과 상세 정보 표시
```

변경 후에는 Server Component가 사고 데이터를 먼저 조회한다.

```text
브라우저가 /incidents/INC-001 요청
→ page.tsx Server Component 실행
→ getIncidentById("INC-001")
→ initialIncident 생성
→ 사고 제목과 상세 정보가 포함된 HTML 응답
→ 브라우저가 같은 initialIncident로 hydration
→ Redux 선택 동기화와 PATCH 폼 활성화
```

## 왜 이것이 의미 있는 SSR인가

Next.js를 설치했거나 `page.tsx`가 Server Component라는 사실만으로 데이터 SSR이 완료되는 것은 아니다. 사용자가 필요한 업무 데이터가 서버 렌더링 결과에 실제로 포함되어야 한다.

이번 구현에서는 브라우저 JavaScript가 상세 API를 호출하기 전에도 HTML에 다음 값이 들어 있다.

```text
사고 제목
사고 설명
심각도와 상태
지역과 영향 인원
담당 팀
접수·갱신 시각
상태 변경 form
```

따라서 JavaScript 실행 이후에 빈 화면을 채우는 CSR이 아니라, 서버가 완성한 업무 화면을 브라우저가 이어받는다.

## 1. 서버 전용 repository

기존 메모리 저장소는 Route Handler 내부에 있었다.

```text
app/api/incidents/incident-store.ts
```

SSR 페이지도 같은 데이터를 사용해야 하므로 Incident Entity의 서버 전용 API로 이동했다.

```text
src/fsd/entities/incident/
├─ api/incident-repository.ts
├─ server.ts
└─ index.ts
```

`index.ts`는 브라우저에서도 사용할 수 있는 API와 표시 형식을 공개한다. `server.ts`는 서버 repository만 공개한다.

```ts
import { getIncidentById } from "@/entities/incident/server";
```

repository에는 `server-only`를 import했다. Client Component가 실수로 이 코드를 가져오면 Next 빌드가 실패하므로 메모리 데이터와 서버 변경 함수가 브라우저 번들로 넘어가지 않는다.

Route Handler도 같은 서버 Public API를 사용한다.

```text
Server Component ─┐
                  ├→ entities/incident/server → incident repository
Route Handler ────┘
```

SSR 전용 복제 데이터나 두 번째 저장소는 만들지 않았다.

## 2. Server Component의 request-time 조회

동적 사고 상세 route에서 직접 repository를 조회한다.

```ts
export const dynamic = "force-dynamic";

export default async function IncidentDetailPage({ params }) {
  const { id } = await params;
  const incident = getIncidentById(id);

  if (!incident) notFound();

  return (
    <IncidentDetailRoute
      initialIncident={incident}
      serverRenderedAt={new Date().toISOString()}
    />
  );
}
```

`force-dynamic`은 빌드 시 고정 HTML을 만드는 대신 요청마다 현재 메모리 repository를 읽게 한다. 상태를 PATCH한 뒤 상세 URL을 새로 요청하면 변경된 상태를 서버가 다시 렌더링한다.

존재하지 않는 ID는 빈 Client Component를 보내지 않고 서버에서 `notFound()` 경계로 보낸다. 스트리밍이 시작된 응답은 HTTP 200일 수 있지만 Next의 Not Found UI와 `noindex` 메타데이터가 포함된다.

## 3. 서버와 브라우저의 경계

`page.tsx`는 서버에서만 실행되지만 상태 변경 폼은 브라우저 이벤트가 필요하다. 그래서 서버가 읽은 직렬화 가능한 Incident 객체를 Client Component prop으로 전달한다.

```text
Server Component
→ initialIncident: Incident
→ IncidentDetailRoute Client Component
→ IncidentDetailView Client Component
```

함수, Map, class instance가 아니라 JSON으로 표현 가능한 Incident 객체만 경계를 통과한다.

## 4. 최초 client fetch 제거

기존 Widget은 빈 상태로 시작했다.

```ts
const [incident, setIncident] = useState<Incident>();
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchIncident(incidentId).then(setIncident);
}, [incidentId]);
```

변경 후에는 서버 데이터를 그대로 초기 상태로 쓴다.

```ts
const [incident, setIncident] = useState(initialIncident);
const [selectedStatus, setSelectedStatus] = useState(initialIncident.status);
```

그 결과 다음 코드가 삭제됐다.

```text
fetchIncident()
상세 조회 useEffect
최초 loading 상태
최초 loadError 상태
중복 GET /api/incidents/:id 요청
```

## 5. Hydration 이후 동작

Hydration은 서버 HTML을 버리고 새로 그리는 과정이 아니다. React가 같은 초기 데이터로 기존 HTML에 이벤트 처리와 상태 연결을 붙이는 과정이다.

```text
서버 HTML
사고 제목·상세·form 존재
        ↓ hydration
useState(initialIncident) 연결
Redux 선택 ID 동기화
onChange·onSubmit 이벤트 활성화
        ↓ 사용자 상태 변경
PATCH /api/incidents/INC-001/status
        ↓
응답 Incident로 client state 갱신
```

최초 조회는 SSR이 담당하지만 사용자 변경은 기존 REST API를 유지한다. SSR 때문에 모든 상호작용을 서버로 옮기지 않았다.

## 6. SSR X-Ray

Selector에 `SSR / Hydration` 관점을 추가했다.

```text
?xray=ssr
→ /incidents/INC-001?xray=ssr
```

화면에는 다음 실제 경계가 표시된다.

```text
ssr/IncidentDetailHydrationBoundary
→ browser/HydratedIncidentDetailView
```

증거 패널은 별도 가짜 상태가 아니라 서버가 전달한 props를 표시한다.

```text
서버가 조회한 사고 ID와 제목
서버 렌더링 시각
최초 상세 API 요청 없음
Hydration 이후 Redux·PATCH 상호작용
```

## 7. 전체 데이터 흐름

```text
1. Browser
   GET /incidents/INC-001?xray=ssr

2. Next Server Component
   params.id 읽기

3. Entity server Public API
   getIncidentById("INC-001")

4. Incident repository
   Map에서 Incident 반환

5. React server render
   initialIncident로 제목·상세·form HTML 생성

6. HTTP response
   HTML + RSC payload 전달

7. Browser hydration
   useState(initialIncident)
   Redux selectedIncidentId 동기화
   form event handler 연결

8. User interaction
   상태 선택 후 제출

9. REST API
   PATCH /api/incidents/INC-001/status

10. Client state
    변경 응답으로 화면 갱신
```

## 8. 직접 검증 방법

```text
http://127.0.0.1:3000/incidents/INC-001?xray=ssr
```

확인 항목은 다음과 같다.

1. 원본 HTTP HTML에 사고 제목과 `data-ssr-incident-id="INC-001"`가 있는지 확인한다.
2. 화면 첫 표시부터 사고 제목과 상세 정보가 있는지 확인한다.
3. X-Ray에 Server Component와 hydration 경계가 표시되는지 확인한다.
4. 최초 로딩 문구와 상세 GET 요청이 없는지 확인한다.
5. 상태 변경 form을 제출하면 PATCH 요청과 성공 메시지가 나타나는지 확인한다.
6. 잘못된 사고 ID에 Next Not Found UI와 `noindex`가 포함되는지 확인한다.

## 9. 현재 한계

이번 완료 범위는 사고 상세 한 경로의 request-time SSR이다.

```text
포함
→ 서버 데이터 조회
→ 서버 HTML
→ 직렬화된 초기 props
→ hydration
→ 이후 client 상호작용

미포함
→ 영속 데이터베이스
→ 사용자 인증·권한
→ Next cache/revalidation 전략
→ 전체 목록·지도·3D 화면의 SSR 전환
→ JavaScript 완전 비활성 상태에서의 상태 변경
```

`구현 완료`는 이 학습 범위를 실제 코드와 HTML로 증명했다는 뜻이며, 운영 SSR 시스템 전체가 완성됐다는 뜻은 아니다.
