# 6단계: 사고 등록 폼 + validation/accessibility

## 1. 지금까지 한 것

5단계까지는 관제 홈, 사고 목록, 사고 상세, 상태 변경 흐름을 만들었다.

현재 흐름은 다음과 같다.

```txt
홈 / 목록 / 상세 화면
→ fetch
→ Next Route Handler
→ incident-store
→ JSON 응답
→ 화면 갱신
```

완료된 단계는 다음이다.

```txt
0. Monorepo workspace 세팅
1. apps/web 생성
2. X-Ray Box + X-Ray toggle
3. / 대시보드
4. /incidents 목록/상세
5. REST API
6. create form + validation/accessibility
```

5단계에서는 조회와 상태 변경만 있었다.

```txt
GET   /api/incidents
GET   /api/incidents/[id]
PATCH /api/incidents/[id]/status
```

그래서 관제원이 신규 사고를 직접 접수하는 흐름은 아직 없었다.

## 2. 이번에 구현한 것

이번 단계에서는 사고 등록 흐름을 추가했다.

추가된 화면:

```txt
/incidents/new
```

추가된 API:

```txt
POST /api/incidents
```

추가된 주요 코드:

```txt
apps/web/app/incidents/new/page.tsx
apps/web/app/incidents/incident-api.ts
apps/web/app/api/incidents/route.ts
apps/web/app/api/incidents/incident-store.ts
apps/web/app/incidents/incident-format.ts
apps/web/app/globals.css
```

화면에서 입력하는 값은 `CreateIncidentInput` 형태로 맞춘다.

```txt
title
description
category
severity
regionId
location.latitude
location.longitude
affectedPeople
assignedTeam
```

등록 성공 시 API는 새 사고를 만들고 상세 화면으로 이동한다.

```txt
POST /api/incidents
→ 201 Created
→ /incidents/INC-004 이동
```

## 3. 왜 이걸 했는지

관제 시스템에서 사고 등록은 핵심 흐름이다.

목록과 상세만 있으면 이미 있는 사고를 보는 화면에 그친다. 신규 사고 접수까지 있어야 다음 흐름이 자연스럽다.

```txt
사고 접수
→ 목록에 표시
→ 상세 확인
→ 상태 변경
```

프론트엔드 학습 관점에서는 이 단계에서 다음을 보여준다.

```txt
1. controlled form
2. submit 처리
3. Zod schema 기반 클라이언트 입력 검증
4. 같은 Zod schema 기반 서버 입력 검증
5. REST API POST
6. 성공 후 라우팅
7. noValidate / field error / aria-invalid / aria-describedby / aria-busy / role="alert" / role="status"
8. X-Ray 라벨로 app/widget/feature/entity 경계 표시
```

중요한 점은 검증을 화면에만 두지 않았다는 것이다.

클라이언트 검증은 사용자가 빨리 피드백을 받기 위한 것이고, 서버 검증은 실제 API 경계 보호용이다.

## 4. 어떻게 세팅했는지

### 4-1. 등록 API 추가

파일:

```txt
apps/web/app/api/incidents/route.ts
```

기존 파일에는 `GET`만 있었다.

이번에 같은 route 파일에 `POST`를 추가했다.

```txt
app/api/incidents/route.ts
→ GET  /api/incidents
→ POST /api/incidents
```

POST 흐름은 다음과 같다.

```txt
1. request.json()으로 body 파싱
2. JSON 객체인지 확인
3. title / description / category / severity / regionId 검증
4. location.latitude / location.longitude 검증
5. affectedPeople 검증
6. assignedTeam optional 검증
7. createIncident(input) 호출
8. 201 + { incident } 반환
```

서버 검증 기준:

```txt
title: 4~80자
description: 10~300자
category: incidentCategories에 있는 값
severity: incidentSeverities에 있는 값
regionId: 영문/숫자/hyphen, 40자 이하
latitude: -90~90
longitude: -180~180
affectedPeople: 0~100000 정수
assignedTeam: 선택값, 40자 이하
```

잘못된 요청은 `ApiError` 형태로 반환한다.

예시:

```json
{
  "code": "INVALID_TITLE",
  "message": "사고명은 4자 이상 80자 이하로 입력해야 합니다."
}
```

### 4-2. incident-store에 createIncident 추가

파일:

```txt
apps/web/app/api/incidents/incident-store.ts
```

추가된 함수:

```txt
createIncident(input)
```

역할:

```txt
1. 다음 사고 ID 생성
2. status를 reported로 고정
3. reportedAt / updatedAt을 현재 시각으로 설정
4. Map에 저장
5. 생성된 incident 반환
```

현재 저장소는 in-memory Map이다.

```txt
서버 재시작 시 새로 등록한 사고는 사라진다.
```

이번 단계의 목적은 DB가 아니라 등록 폼과 API 경계 검증이므로 DB는 붙이지 않았다.

### 4-3. 클라이언트 API 함수 추가

파일:

```txt
apps/web/app/incidents/incident-api.ts
```

추가된 함수:

```txt
createIncident(input)
```

내부 흐름:

```txt
fetch("/api/incidents", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(input)
})
```

응답이 실패하면 기존 `IncidentApiError` 흐름을 그대로 탄다.

새 에러 처리 구조를 만들지 않고 기존 API client 패턴을 재사용했다.

### 4-4. 등록 페이지 추가

파일:

```txt
apps/web/app/incidents/new/page.tsx
```

라우트:

```txt
app/incidents/new/page.tsx
→ /incidents/new
```

이 페이지는 client component다.

이유는 다음 상태가 필요하기 때문이다.

```txt
form state
saving state
error state
X-Ray toggle state
submit event 처리
router.push
```

등록 성공 후 이동:

```txt
const incident = await createIncident(input)
router.push(`/incidents/${incident.id}`)
```

### 4-5. controlled input과 form state

`value={form.title}`의 `form`은 HTML `<form>` 태그에서 자동으로 오는 값이 아니다.

이 값은 React component 안에서 만든 state다.

```tsx
type FormState = {
  title: string;
  description: string;
  category: string;
  severity: string;
  regionId: string;
  latitude: string;
  longitude: string;
  affectedPeople: string;
  assignedTeam: string;
};

const initialForm: FormState = {
  title: "",
  description: "",
  category: "traffic",
  severity: "medium",
  regionId: "junggu",
  latitude: "37.5657",
  longitude: "126.9769",
  affectedPeople: "0",
  assignedTeam: "",
};

const [form, setForm] = useState<FormState>(initialForm);
```

역할은 다음과 같다.

```txt
form    → 현재 등록 폼의 입력값 전체를 들고 있는 React state 객체
setForm → form state를 갱신하는 함수
```

예를 들어 사고명 input은 이렇게 연결된다.

```tsx
<input
  value={form.title}
  onChange={(event) => updateField("title", event.target.value)}
/>
```

이 구조를 controlled input이라고 부른다.

흐름은 다음과 같다.

```txt
1. 최초 렌더링
→ form = initialForm
→ form.title = ""
→ input value = ""

2. 사용자가 사고명 입력
→ onChange 발생
→ event.target.value로 입력 문자열을 읽음
→ updateField("title", 입력값) 호출

3. updateField 실행
→ setForm으로 title만 새 값으로 교체

4. React 재렌더링
→ value={form.title}
→ input에 최신 state 값이 다시 표시됨
```

`updateField`는 기존 state를 보존하면서 특정 필드만 바꾼다.

```tsx
function updateField(field: keyof FormState, value: string) {
  setForm((current) => ({
    ...current,
    [field]: value,
  }));
}
```

예를 들어 사용자가 `강남역 침수`를 입력하면 다음처럼 처리된다.

```txt
field = "title"
value = "강남역 침수"
```

결과 state:

```ts
{
  ...기존 form,
  title: "강남역 침수"
}
```

여기서 중요한 점은 HTML input 값은 기본적으로 문자열이라는 것이다.

```txt
type="number" input도 event.target.value는 string이다.
```

그래서 `latitude`, `longitude`, `affectedPeople`도 form state 단계에서는 문자열로 들고 있다.

```txt
form.latitude = "37.5657"
form.affectedPeople = "12"
```

이 문자열 값은 submit 시점에 Zod schema로 넘어가면서 정제된다.

```txt
React form state 문자열
→ buildIncidentInput(form)
→ validateCreateIncidentInput(value)
→ createIncidentInputSchema.safeParse(value)
→ z.coerce.number()로 number 변환
```

즉 인과 흐름은 다음이다.

```txt
input value
→ React form state
→ submit 시 schema 입력 객체로 조립
→ Zod schema 검증/정제
→ 성공한 CreateIncidentInput만 POST API로 전달
```

정리하면 다음 한 줄이다.

```txt
form은 HTML form 객체가 아니라 React state이고, Zod schema는 이 state를 submit 시점에 API 입력값으로 검증/정제하는 경계다.
```

### 4-6. 공유 타입과 라벨 사용

공유 타입:

```txt
CreateIncidentInput
incidentCategories
incidentSeverities
isIncidentCategory
isIncidentSeverity
```

위 값은 `packages/api-types`에서 가져온다.

즉 폼과 API가 같은 도메인 기준을 사용한다.

화면 표시용 라벨은 다음 파일에 둔다.

```txt
apps/web/app/incidents/incident-format.ts
```

추가한 라벨:

```txt
incidentSeverityLabels
```

### 4-7. 스키마 검증 방식

검증 기준은 `packages/api-types`의 Zod schema와 `validateCreateIncidentInput()`에 둔다.

```txt
packages/api-types/src/index.ts
→ createIncidentInputSchema 선언
→ validateCreateIncidentInput(value)
→ schema.safeParse(value)
→ success면 CreateIncidentInput 반환
→ 실패면 Zod issue를 field별 errors로 변환
```

이 함수는 클라이언트와 서버가 같이 쓴다.

```txt
/incidents/new page
→ buildIncidentInput(form)
→ validateCreateIncidentInput()
→ fieldErrors 표시

POST /api/incidents
→ request.json()
→ validateCreateIncidentInput()
→ createIncidentInputSchema.safeParse()
→ 실패 시 ApiError 반환
```

즉 같은 입력 규칙이 화면과 API에 따로 흩어지지 않는다.

이번 단계에서는 `zod`를 `@citywatch/api-types` dependency로 추가했다.

```txt
packages/api-types/package.json
→ dependencies.zod
```

왜 web 앱이 아니라 api-types에 설치했는가:

```txt
검증 기준의 소유자는 화면이 아니라 사고 도메인 계약이다.
등록 화면도 검증 기준을 써야 하고,
POST API도 같은 기준을 써야 한다.
따라서 schema는 apps/web 내부가 아니라 packages/api-types에 둔다.
```

Zod가 동작하는 순서는 다음이다.

```txt
1. createIncidentInputSchema에 입력 구조와 규칙을 선언한다.
2. 사용자가 submit하면 form state를 schema 입력 모양으로 만든다.
3. validateCreateIncidentInput(value)가 schema.safeParse(value)를 호출한다.
4. safeParse 성공 시 result.data가 나온다.
5. result.data는 trim, number coerce, assignedTeam 빈 값 제거가 반영된 값이다.
6. safeParse 실패 시 result.error.issues가 나온다.
7. issues의 path를 title, latitude 같은 화면 field key로 변환한다.
8. 클라이언트는 fieldErrors로 보여주고, 서버는 ApiError로 반환한다.
```

핵심은 `parse()`가 아니라 `safeParse()`를 쓴 점이다.

```txt
parse()     → 실패하면 throw
safeParse() → { success: true | false } 객체 반환
```

폼 submit과 API route에서는 실패를 정상 제어 흐름으로 다뤄야 하므로 `safeParse()`가 맞다.

현재 Zod schema가 처리하는 변환도 있다.

```txt
string.trim()       → 앞뒤 공백 제거
z.coerce.number()   → input 문자열 숫자를 number로 변환
preprocess("")      → 빈 숫자 문자열을 NaN으로 바꿔 실패 처리
assignedTeam ""     → undefined로 바꿔 선택값 제거
```

즉 Zod는 단순히 에러를 내는 도구가 아니라, 외부 입력을 검증하고 내부 타입에 맞는 값으로 정제하는 경계 역할을 한다.

### 4-8. 접근성 기본 처리

등록 폼에는 다음을 넣었다.

```txt
form noValidate로 브라우저 기본 validation bubble 비활성화
label htmlFor + input id 연결
필드별 aria-invalid
필드별 aria-describedby
필드별 inline error message
button disabled 처리
form aria-busy
저장 중 메시지 role="status"
오류 요약 메시지 role="alert"
focus-visible outline 유지
```

브라우저 기본 팝업을 그대로 쓰지 않은 이유는 다음이다.

```txt
브라우저/언어별 UI가 달라 화면 의도가 흔들린다.
X-Ray로 검증 흐름을 보여주기 어렵다.
필드별 에러 메시지를 디자인/접근성 흐름 안에 넣기 어렵다.
```

그래서 submit은 React가 받고, 검증 결과를 화면 안에 직접 표시한다.

## 5. 실제로 동작시키면 어떤 흐름인지

개발 서버 실행:

```bash
npm run dev:web
```

목록 페이지 접속:

```txt
http://127.0.0.1:3000/incidents
```

상단의 `사고 등록`을 누른다.

```txt
/incidents/new
```

폼 입력 후 제출:

```txt
NewIncidentPage
→ buildIncidentInput(form)
→ createIncident(input)
→ POST /api/incidents
→ route.ts에서 body 검증
→ incident-store createIncident
→ 201 Created
→ router.push("/incidents/INC-004")
→ 상세 화면에서 GET /api/incidents/INC-004
→ 생성된 사고 상세 표시
```

잘못된 입력이면 흐름이 멈춘다.

```txt
클라이언트 검증 실패
→ Zod issues를 fieldErrors로 변환
→ fieldErrors 상태 저장
→ 각 필드 아래 inline error 표시
→ 해당 input에 aria-invalid="true" 설정
→ role="alert" 오류 요약 표시
→ POST 요청 안 보냄
```

API에 직접 잘못된 body를 보내면 서버에서 막는다.

```txt
POST /api/incidents
→ INVALID_TITLE / INVALID_DESCRIPTION / INVALID_LOCATION 등 ApiError 반환
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

결과:

```txt
/                                Static
/api/incidents                   Dynamic
/api/incidents/[id]              Dynamic
/api/incidents/[id]/status       Dynamic
/incidents                       Static
/incidents/[id]                  SSG
/incidents/new                   Static
```

API smoke test:

```txt
POST /api/incidents 정상 body → 201, INC-004 생성, status=reported
POST body의 affectedPeople 문자열 "12" → number로 정제
POST body의 assignedTeam 빈 문자열 "" → undefined로 정제
GET /api/incidents/INC-004 → 200, 생성된 사고 조회
POST /api/incidents 잘못된 body → 400 INVALID_TITLE
```

확인 URL:

```txt
http://127.0.0.1:3000/incidents/new
```

## 7. 아직 안 한 것

아직 다음은 하지 않았다.

```txt
7. 위험도 계산 + Unit Test/TDD
8. Redux 상태 공유
9. OpenLayers 지도 관제
10. WebSocket/Polling 실시간 처리
11. R3F 3D 위험 구역
12. performance page 대량 데이터 관제
13. Storybook UI 증명
14. realtime-server 분리
15. analytics-remote + Module Federation
```

현재 결론:

```txt
6단계는 관제원이 신규 사고를 접수하는 화면과 POST API를 추가하고,
클라이언트/서버 양쪽 입력 검증과 접근성 기본 처리를 넣은 단계다.
```