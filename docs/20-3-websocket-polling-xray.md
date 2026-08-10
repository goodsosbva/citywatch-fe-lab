# 20-3. WebSocket / Polling X-Ray

20-3은 `/realtime`에 이미 구현되어 있던 실시간 통신을 다시 만드는 단계가 아니다. X-Ray 선택기에 `WebSocket / Polling` 관점을 추가하고, 사용자가 화면만 보아도 다음 실제 코드 흐름을 추적할 수 있게 만든 단계다.

```txt
WebSocket 우선 연결
→ 수신 문자열 JSON 변환
→ 단일 이벤트 런타임 검증
→ 공통 recordEvents 반영

WebSocket 종료
→ HTTP polling fallback
→ 마지막 이벤트 ID 이후만 요청
→ 목록 응답 런타임 검증
→ 같은 recordEvents 반영
```

새 통신 라이브러리, 새 상태 관리 도구, 새 helper는 추가하지 않았다. 브라우저 기본 `WebSocket`, 기존 `fetch`, React의 `useEffect`·`useState`·`useRef`, Node 표준 모듈만 사용한다.

## 1. 이번 단계의 범위

변경 파일은 다음 세 개다.

```txt
apps/web/app/xray-selector.tsx
apps/web/app/realtime/page.tsx
docs/20-3-websocket-polling-xray.md
```

각 파일의 책임은 다음과 같다.

| 파일 | 20-3에서 맡은 일 | 이 위치인 이유 |
| --- | --- | --- |
| `apps/web/app/xray-selector.tsx` | `websocket` 모드 등록, 선택 항목 표시, 대표 화면 `/realtime`로 최초 이동 | 모든 페이지가 공유하는 X-Ray 모드와 URL 동기화의 단일 소유자이기 때문 |
| `apps/web/app/realtime/page.tsx` | 실제 통신 경계에 `websocket` 증거 연결, 전용 증거 패널 표시 | WebSocket lifecycle, polling, 검증, 화면 상태가 실제로 만나는 페이지이기 때문 |
| `docs/20-3-websocket-polling-xray.md` | 개념, 전체 실행 순서, 실습, 한계 기록 | 기능 코드와 학습 설명을 섞지 않기 위해서 |

변경하지 않은 핵심 파일도 있다.

```txt
apps/realtime-server/src/server.mjs
apps/realtime-server/src/websocket-frame.mjs
packages/api-types/src/index.ts
apps/web/app/globals.css
```

서버와 타입 가드는 20-3 전에 이미 실제로 동작하고 있었다. CSS도 기존 `technology-evidence`, `technology-flow`, `technology-code`를 그대로 재사용할 수 있었다. 같은 일을 하는 코드와 스타일을 하나 더 만들지 않은 이유다.

## 2. WebSocket과 polling을 뿌리부터 구분하기

### 2.1 일반 HTTP 요청

일반적인 HTTP 통신에서는 브라우저가 먼저 요청해야 서버가 응답한다.

```txt
브라우저: 새 데이터 있습니까?
→ 서버: 현재 데이터입니다.
→ 연결 단위의 요청/응답 종료
```

화면을 계속 최신으로 만들려면 브라우저가 반복해서 물어야 한다. 이것이 polling이다.

```txt
GET /events?after=10
→ 응답 처리
→ 3초 기다림
→ GET /events?after=12
→ 응답 처리
→ 3초 기다림
```

장점은 HTTP만 통과할 수 있으면 동작 방식이 단순하다는 것이다. 단점은 새 데이터가 없어도 반복 요청이 발생하고, 새 이벤트가 생긴 순간부터 다음 요청까지 지연이 생긴다는 것이다.

### 2.2 WebSocket

WebSocket은 처음 한 번 연결한 뒤 그 연결을 유지한다. 연결이 열린 동안에는 서버가 브라우저의 새 HTTP 요청을 기다리지 않고 이벤트를 보낼 수 있다.

```txt
브라우저와 서버가 연결을 한 번 엶
→ 서버에서 사고 상태 변경 발생
→ 서버가 즉시 같은 연결로 메시지 전송
→ 브라우저 onmessage 실행
```

현재 CityWatch에서는 WebSocket이 기본 경로이고 polling이 장애 대비 경로다.

```txt
빠른 기본 경로: WebSocket
안전한 대체 경로: HTTP polling
공통 결과 처리: recordEvents
```

두 전송 경로가 있어도 화면 상태를 반영하는 함수는 하나다. 이 구조 덕분에 WebSocket용 목록 처리와 polling용 목록 처리가 서로 달라지지 않는다.

## 3. 설정은 어디에서 시작되는가

실시간 기능의 설정은 한 파일에 모두 넣지 않는다. 실행 책임에 따라 가장 가까운 위치에 둔다.

### 3.1 루트 `package.json`

루트는 workspace 전체를 실행하는 입구다.

```json
{
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "node scripts/dev.mjs",
    "dev:web": "npm --workspace @citywatch/web run dev",
    "dev:realtime": "npm --workspace @citywatch/realtime-server run dev"
  }
}
```

여기에는 WebSocket 구현을 넣지 않는다. 어떤 workspace를 실행할지만 위임한다.

```txt
npm run dev:realtime
→ @citywatch/realtime-server workspace의 dev 실행

npm run dev:web
→ @citywatch/web workspace의 dev 실행
```

루트 `npm run dev`는 `scripts/dev.mjs`를 통해 web, analytics remote, realtime 서버를 함께 실행한다. 한 서비스만 관찰하는 실습에서는 개별 명령을 쓰는 편이 로그와 장애 원인을 구분하기 쉽다.

### 3.2 `apps/realtime-server/package.json`

실시간 서버는 독립 프로세스이므로 자기 workspace에 실행 명령을 가진다.

```json
{
  "name": "@citywatch/realtime-server",
  "type": "module",
  "scripts": {
    "dev": "node --watch src/server.mjs",
    "start": "node src/server.mjs",
    "test": "node --test src/websocket-frame.test.mjs"
  }
}
```

이 경계가 중요한 이유는 Next.js 화면 코드가 서버 구현 파일을 import하지 않게 하기 위해서다.

```txt
apps/web
→ WebSocket URL과 HTTP URL을 통해서만 통신

apps/realtime-server
→ 독립 Node 프로세스로 3001 포트 사용
```

### 3.3 서버 포트

`apps/realtime-server/src/server.mjs`가 서버가 실제로 들을 포트를 결정한다.

```js
const port = Number(process.env.PORT ?? 3001);
```

개발 기본값은 `3001`이다. 다른 환경에서는 서버 프로세스의 `PORT`만 바꿀 수 있다. 포트를 바꾸면 브라우저가 사용하는 두 URL도 같은 포트로 맞춰야 한다.

### 3.4 브라우저 URL 환경 변수

개발 URL은 `apps/web/.env.development`에 있다.

```env
NEXT_PUBLIC_REALTIME_POLL_URL=http://127.0.0.1:3001/events
NEXT_PUBLIC_REALTIME_WS_URL=ws://127.0.0.1:3001/ws
```

이 파일이 `apps/web` 아래에 있는 이유는 이 값을 읽는 실행 주체가 Next.js web 앱이기 때문이다. `NEXT_PUBLIC_` 접두사가 붙은 값은 브라우저 번들에서도 읽을 수 있다. 비밀키를 이 접두사에 넣으면 안 된다.

환경 변수가 없으면 `getRealtimeUrls()`가 현재 브라우저 hostname과 기본 포트 `3001`을 사용한다.

```ts
function getRealtimeUrls(): RealtimeUrls {
  const host = window.location.hostname || "127.0.0.1";
  return {
    polling:
      process.env.NEXT_PUBLIC_REALTIME_POLL_URL ?? `http://${host}:3001/events`,
    websocket:
      process.env.NEXT_PUBLIC_REALTIME_WS_URL ?? `ws://${host}:3001/ws`,
  };
}
```

URL 결정이 `useEffect` 안에서 실행되는 이유는 `window.location`이 브라우저에만 있기 때문이다. 이 파일은 Client Component이며 첫 화면이 브라우저에 연결된 뒤 실제 hostname을 읽는다.

## 4. X-Ray selector 데이터의 뿌리부터 URL까지

`navigationItems.map`처럼 select의 항목도 갑자기 생기는 것이 아니다. 데이터 정의, 화면 표시, 선택 이벤트, URL, 라우터가 한 줄로 연결된다.

### 4.1 타입에 가능한 값을 등록한다

`apps/web/app/xray-selector.tsx`의 `XRayProof`가 가능한 기술 증거 값의 뿌리다.

```ts
export type XRayProof =
  | "fsd-style"
  | "module-federation"
  | "monorepo"
  | "openlayers"
  | "r3f"
  | "websocket";
```

그다음 `XRayMode`가 공통 제어값을 합친다.

```ts
type XRayMode = "off" | "all" | XRayProof;
```

뜻은 다음과 같다.

```txt
off
→ X-Ray 경계 끄기

all
→ 모든 기본 경계 보기

websocket
→ WebSocket / Polling 증거만 집중해서 보기
```

### 4.2 `<option>`이 실제 선택 항목을 만든다

```tsx
<option value="websocket">WebSocket / Polling</option>
```

사용자에게 보이는 문구는 `WebSocket / Polling`이고, 코드와 URL에 전달되는 값은 `websocket`이다.

### 4.3 사용자가 select를 변경한다

```tsx
<select
  aria-label="X-Ray 관점"
  onChange={(event) => setMode(event.target.value as XRayMode)}
  value={mode}
>
```

실행 흐름은 다음과 같다.

```txt
사용자가 WebSocket / Polling 선택
→ 브라우저 change 이벤트 발생
→ event.target.value === "websocket"
→ XRayProvider가 제공한 setMode("websocket") 호출
```

`aria-label`은 화면 읽기 도구가 이 select의 목적을 알게 한다.

### 4.4 `selectMode`가 state와 URL을 함께 바꾼다

Context에 전달된 `setMode`의 실제 구현은 `selectMode`다.

```ts
function selectMode(nextMode: XRayMode) {
  const url = new URL(window.location.href);
  modeRef.current = nextMode;
  setMode(nextMode);
  url.searchParams.set("xray", nextMode);
  router.replace(
    `${getXRayPathname(nextMode, pathname)}?${url.searchParams.toString()}`,
    { scroll: false },
  );
}
```

각 값의 역할은 다르다.

```txt
setMode(nextMode)
→ React가 현재 선택값과 X-Ray 경계를 다시 렌더링

modeRef.current = nextMode
→ route effect가 가장 최근 선택값을 즉시 기억

searchParams.set("xray", nextMode)
→ 새로고침과 링크 공유 뒤에도 선택값 복원 가능

router.replace(...)
→ 브라우저 전체 새로고침 없이 Next route 변경
```

### 4.5 대표 화면은 `/realtime`이다

```ts
function getXRayPathname(mode: XRayMode, currentPathname: string) {
  if (mode === "module-federation" || mode === "monorepo") return "/";
  if (mode === "openlayers") return "/map";
  if (mode === "r3f") return "/risk-3d";
  if (mode === "websocket") return "/realtime";
  return currentPathname;
}
```

`websocket`을 선택한 순간 `/realtime?xray=websocket`으로 이동한다. 이유는 해당 기술을 바로 확인할 수 있는 대표 화면이 `/realtime`이기 때문이다.

그러나 `/realtime`에 사용자를 고정하지는 않는다.

```txt
selector에서 websocket 선택
→ 한 번 /realtime로 안내

그 뒤 사용자가 지도 메뉴 클릭
→ /map?xray=websocket로 이동
→ 현재 route /map 유지
→ xray 선택값만 유지
```

`XRayProvider`의 route effect는 현재 `pathname`에 query를 동기화할 뿐, 매번 `getXRayPathname`을 호출하지 않는다. 따라서 페이지 이동 때마다 `/realtime`로 되돌리는 route lock이 없다.

### 4.6 새로고침 때 URL 값을 검증한다

브라우저 URL은 사용자가 직접 바꿀 수 있으므로 문자열을 그대로 믿지 않는다.

```ts
function getXRayMode(value: string | null): XRayMode {
  return value === "off" ||
    value === "fsd-style" ||
    value === "module-federation" ||
    value === "monorepo" ||
    value === "openlayers" ||
    value === "r3f" ||
    value === "websocket"
    ? value
    : "all";
}
```

예를 들어 `?xray=unknown`이면 `all`로 되돌린다. TypeScript의 `as XRayMode`는 런타임 입력을 검증하지 못하므로 이 함수가 필요하다.

## 5. `useXRay()`는 왜 한 번만 호출하는가

`RealtimePage`의 호출은 하나다.

```ts
const { enabled: xray, mode } = useXRay();
```

`useXRay()`의 기본 proof는 `fsd-style`이다.

```ts
export function useXRay(proofs: readonly XRayProof[] = ["fsd-style"]) {
  const { mode } = useXRayContext();
  return {
    enabled: mode === "all" || (mode !== "off" && proofs.includes(mode)),
    mode,
  };
}
```

따라서 반환값의 의미는 다음과 같다.

```txt
xray
→ 전체 X-Ray 또는 기본 FSD 경계를 표시해야 하는가

mode
→ 사용자가 실제로 선택한 정확한 관점은 무엇인가
```

실시간 경계는 다음처럼 두 조건을 합친다.

```tsx
enabled={xray || mode === "websocket"}
```

전용 증거 패널은 정확히 해당 모드에서만 렌더링한다.

```tsx
{mode === "websocket" ? <WebSocketPollingEvidencePanel ... /> : null}
```

`useXRay()`를 기본용과 WebSocket용으로 두 번 호출할 필요가 없다. 한 Context에서 같은 `mode`를 두 번 읽은 뒤 별칭을 늘리는 것보다, 한 번 받은 원본 `mode`를 직접 비교하는 편이 짧고 의미도 분명하다.

```txt
한 번 호출
→ Context 구독 한 곳
→ xray와 mode의 출처 한 곳
→ mode === "websocket"이라는 실제 조건이 코드에 그대로 보임
```

새 `useWebSocketXRay` helper도 만들지 않았다. 한 번만 쓰는 비교식보다 helper가 더 많은 간접 경로를 만들기 때문이다.

## 6. 서버의 데이터 계약

WebSocket과 polling은 전송 방식만 다르고 같은 `RealtimeEvent`를 전달한다.

```ts
export type RealtimeEvent = {
  id: number;
  message: RealtimeMessage;
};
```

`RealtimeMessage`는 현재 네 종류다.

```txt
incident.created
incident.updated
incident.statusChanged
heartbeat
```

polling 응답은 이벤트 배열과 서버 시간을 묶는다.

```ts
export type RealtimeEventListResponse = {
  events: RealtimeEvent[];
  serverTime: ISODateTime;
};
```

이 계약이 `packages/api-types`에 있는 이유는 서버와 화면 어느 한쪽만의 내부 모양이 아니기 때문이다. 화면은 이 타입과 런타임 가드를 import하고, 서버는 같은 JSON 모양을 만든다.

## 7. Node 서버가 시작된 뒤 일어나는 일

### 7.1 메모리 상태

`apps/realtime-server/src/server.mjs`는 최소 상태만 가진다.

```js
const clients = new Set();
const events = [];
const maxEvents = 50;
let nextEventId = 0;
let tick = 0;
```

```txt
clients
→ 현재 연결된 WebSocket socket

events
→ polling fallback이 다시 꺼내 갈 최근 이벤트

maxEvents = 50
→ 개발 서버 메모리가 끝없이 증가하지 않게 하는 상한

nextEventId
→ 이벤트마다 증가하는 cursor
```

### 7.2 이벤트 생성과 저장

```js
function appendEvent(message) {
  const event = { id: ++nextEventId, message };
  events.push(event);
  if (events.length > maxEvents) events.shift();
  return event;
}
```

이벤트를 WebSocket으로 보내기 전에 `events` 배열에도 저장한다. 그래서 WebSocket 연결이 끊긴 순간에 생긴 이벤트를 polling이 같은 ID 기준으로 이어받을 수 있다.

서버는 4초마다 heartbeat 또는 사고 상태 변경을 만든다.

```txt
setInterval 4초
→ appendEvent(message)
→ id 증가와 메모리 저장
→ broadcast(event)
→ clients의 각 socket으로 동일 event 전송
```

### 7.3 HTTP endpoint

서버는 한 프로세스에서 세 endpoint를 제공한다.

| 경로 | 역할 |
| --- | --- |
| `/health` | 서버 시간, 연결 client 수, 보관 event 수 확인 |
| `/events?after=id` | 주어진 ID보다 큰 이벤트만 JSON으로 반환 |
| `/ws` | HTTP upgrade 뒤 WebSocket 연결로 사용 |

polling의 핵심은 다음 조건이다.

```js
events.filter((event) => event.id > after)
```

`after=10`이면 ID `10`을 다시 보내지 않고 `11`부터 보낸다.

## 8. WebSocket handshake는 무엇인가

WebSocket은 아무 설명 없이 TCP 연결이 갑자기 바뀌는 프로토콜이 아니다. 브라우저가 먼저 HTTP Upgrade 요청을 보내고, 서버가 전환에 동의해야 한다.

### 8.1 브라우저가 시작한다

클라이언트 코드 한 줄이 handshake 요청을 만든다.

```ts
socket = new WebSocket(nextUrls.websocket);
```

브라우저가 내부적으로 다음 성격의 헤더를 보낸다.

```txt
GET /ws HTTP/1.1
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: 브라우저가 만든 임의 값
```

애플리케이션 코드가 이 헤더를 직접 조립하지 않는 이유는 브라우저 기본 WebSocket 구현이 프로토콜을 담당하기 때문이다.

### 8.2 Node HTTP 서버가 upgrade를 받는다

```js
server.on("upgrade", (request, socket) => {
  const url = new URL(request.url ?? "/", ...);
  const key = request.headers["sec-websocket-key"];

  if (url.pathname !== "/ws" || typeof key !== "string") {
    socket.destroy();
    return;
  }
```

경로가 `/ws`가 아니거나 key가 없으면 연결을 거부한다.

### 8.3 서버가 101로 전환을 승인한다

```js
socket.write([
  "HTTP/1.1 101 Switching Protocols",
  "Upgrade: websocket",
  "Connection: Upgrade",
  `Sec-WebSocket-Accept: ${getWebSocketAccept(key)}`,
  "",
  "",
].join("\r\n"));
```

`getWebSocketAccept`는 브라우저 key 뒤에 WebSocket 표준 GUID를 붙이고 SHA-1과 Base64를 적용한다.

```js
createHash("sha1")
  .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
  .digest("base64");
```

이 값은 암호나 로그인 인증이 아니다. 요청을 받은 서버가 WebSocket handshake 규칙을 이해했다는 확인값이다.

### 8.4 JSON 문자열도 WebSocket frame에 넣어야 한다

handshake 뒤에는 HTTP response를 반복하지 않는다. 서버는 JSON 문자열을 WebSocket text frame으로 인코딩한다.

```js
socket.write(encodeWebSocketText(JSON.stringify(event)));
```

`encodeWebSocketText`가 하는 일은 다음과 같다.

```txt
JSON 문자열
→ UTF-8 Buffer
→ FIN + text opcode 헤더
→ payload 길이 헤더
→ header와 payload 결합
→ socket.write
```

브라우저의 `WebSocket` 객체는 이 frame을 풀어서 `message` 이벤트의 `event.data` 문자열로 넘긴다.

## 9. 브라우저 전체 코드 실행 흐름

### 9.1 첫 렌더

사용자가 `/realtime`에 들어오면 `RealtimePage`가 먼저 화면 상태를 만든다.

```ts
const [connection, setConnection] = useState<ConnectionState>({ ... });
const [events, setEvents] = useState<RealtimeEvent[]>([]);
const [error, setError] = useState<string>();
const [urls, setUrls] = useState<RealtimeUrls>();
const [connectionRun, setConnectionRun] = useState(0);
const lastEventIdRef = useRef(0);
```

| 값 | 역할 | state/ref인 이유 |
| --- | --- | --- |
| `connection` | connecting, websocket, polling, offline과 설명 | 바뀔 때 배지와 안내 문구를 다시 그려야 하므로 state |
| `events` | 검증을 통과해 화면에 표시할 이벤트 | 목록을 다시 그려야 하므로 state |
| `error` | 연결·payload 오류 | `role="alert"`를 다시 그려야 하므로 state |
| `urls` | 실제 사용 중인 WS와 poll URL | 증거 화면에 보여 주므로 state |
| `connectionRun` | effect를 다시 만드는 재연결 번호 | 값 변경으로 effect를 재실행해야 하므로 state |
| `lastEventIdRef` | 마지막으로 반영한 가장 큰 ID | 비동기 callback이 최신 값을 즉시 읽되, ID 변경만으로 별도 렌더할 필요가 없으므로 ref |

### 9.2 effect가 연결 소유권을 가진다

```ts
useEffect(() => {
  let disposed = false;
  let pollingTimer: ReturnType<typeof setTimeout> | undefined;
  let socket: WebSocket | undefined;
  const nextUrls = getRealtimeUrls();
  // 연결 시작과 callback 등록

  return () => {
    disposed = true;
    socket?.close();
    if (pollingTimer) clearTimeout(pollingTimer);
  };
}, [connectionRun]);
```

WebSocket과 polling timer를 같은 effect가 만들고 같은 cleanup이 정리한다. 연결의 생성과 수명을 한 곳에서 추적할 수 있다.

### 9.3 정상 WebSocket 경로

전체 순서는 다음과 같다.

```txt
1. RealtimePage 렌더링
2. useEffect 실행
3. getRealtimeUrls()로 WS와 poll URL 결정
4. new WebSocket(ws://127.0.0.1:3001/ws)
5. 브라우저가 HTTP Upgrade 요청
6. Node server.on("upgrade") 실행
7. 서버가 101 Switching Protocols 응답
8. 브라우저 socket.onopen 실행
9. 서버가 JSON을 WebSocket text frame으로 전송
10. 브라우저 socket.onmessage 실행
11. parseRealtimeEvent(event.data)
12. JSON.parse
13. isRealtimeEvent 런타임 검증
14. recordEvents([realtimeEvent])
15. lastEventIdRef 갱신
16. setEvents로 최신 목록 갱신
17. React가 RealtimeEventRow를 다시 렌더링
18. 브라우저가 새 이벤트 행 표시
```

`onopen`에서는 연결 모드를 WebSocket으로 바꾼다.

```ts
socket.onopen = () => {
  setConnection({
    detail: "WebSocket으로 실시간 이벤트를 수신 중입니다.",
    mode: "websocket",
  });
  setError(undefined);
};
```

### 9.4 `onmessage`는 문자열을 바로 저장하지 않는다

```ts
socket.onmessage = (event) => {
  const realtimeEvent = parseRealtimeEvent(event.data);
  if (!realtimeEvent) {
    setError("WebSocket message shape is invalid.");
    return;
  }

  recordEvents([realtimeEvent]);
};
```

`event.data`는 외부에서 온 문자열이다. `RealtimeEvent` 타입이라고 단정하지 않는다.

```ts
function parseRealtimeEvent(value: string) {
  try {
    const data = JSON.parse(value);
    return isRealtimeEvent(data) ? data : undefined;
  } catch {
    return undefined;
  }
}
```

두 종류의 실패를 하나의 안전한 결과로 바꾼다.

```txt
JSON 문법 자체가 틀림
→ JSON.parse throw
→ undefined

JSON이지만 RealtimeEvent 모양이 아님
→ isRealtimeEvent false
→ undefined
```

잘못된 payload는 `recordEvents`까지 도달하지 않는다.

## 10. 두 런타임 validator가 필요한 이유

TypeScript 타입은 개발 중 오타와 잘못된 함수 호출을 잡는다. 그러나 빌드된 JavaScript에는 타입 선언이 남지 않는다.

```txt
const data = await response.json()
→ 런타임에는 외부 값
→ TypeScript type만으로 내용 보장 불가
```

그래서 전송 경로마다 실제 값의 모양을 확인한다.

### 10.1 WebSocket 단일 이벤트 검증

```ts
export function isRealtimeEvent(value: unknown): value is RealtimeEvent {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    value.id > 0 &&
    isRealtimeMessage(value.message)
  );
}
```

검사 순서는 다음과 같다.

```txt
객체인가
→ id가 양수 number인가
→ message가 허용된 realtime message인가
```

`isRealtimeMessage`는 `type`별 필수 필드와 사고 status 같은 허용값까지 확인한다.

### 10.2 polling 목록 응답 검증

```ts
export function isRealtimeEventListResponse(
  value: unknown,
): value is RealtimeEventListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.events) &&
    value.events.every(isRealtimeEvent) &&
    typeof value.serverTime === "string"
  );
}
```

polling 응답은 바깥 객체만 맞는다고 끝나지 않는다. 배열 안의 모든 이벤트가 `isRealtimeEvent`를 통과해야 한다.

```txt
response 객체 검증
→ events 배열 검증
→ 배열의 각 event 검증
→ 각 event.message 검증
→ serverTime 문자열 검증
```

목록 중 하나라도 잘못되면 전체 응답을 반영하지 않는다. 부분적으로 신뢰할 수 없는 데이터가 UI state에 섞이는 것을 막는다.

## 11. `recordEvents`가 두 경로를 합치는 법

검증을 통과한 WebSocket 이벤트와 polling 이벤트는 모두 이 함수로 들어간다.

```ts
function recordEvents(nextEvents: RealtimeEvent[]) {
  const lastEventId = lastEventIdRef.current;
  const uniqueEvents = nextEvents.filter((event) => event.id > lastEventId);

  if (uniqueEvents.length === 0) return;

  lastEventIdRef.current = Math.max(
    lastEventId,
    ...uniqueEvents.map((event) => event.id),
  );

  setEvents((current) =>
    [...uniqueEvents.sort((a, b) => b.id - a.id), ...current].slice(
      0,
      maxVisibleEvents,
    ),
  );
}
```

### 11.1 중복 방지

현재 마지막 ID가 `10`일 때 `10`, `11`, `12`가 오면 `11`, `12`만 남긴다.

```txt
lastEventId = 10
nextEvents = [10, 11, 12]
→ event.id > 10
→ uniqueEvents = [11, 12]
→ lastEventIdRef.current = 12
```

모든 과거 ID를 `Set`에 계속 저장하지 않는다. 서버가 증가하는 고유 ID를 발급한다는 현재 계약에서는 마지막 숫자 하나면 충분하다.

### 11.2 최신순 정렬

polling 응답은 서버 저장 순서대로 오래된 ID부터 올 수 있다. 화면에는 최신 이벤트가 위에 보여야 하므로 새 묶음을 ID 내림차순으로 정렬한다.

```txt
[11, 12]
→ sort((a, b) => b.id - a.id)
→ [12, 11]
```

### 11.3 화면에는 12개만 유지

```ts
const maxVisibleEvents = 12;
```

```txt
새 이벤트 + 기존 화면 이벤트
→ 최신순으로 합침
→ slice(0, 12)
→ 화면 state가 끝없이 커지지 않음
```

서버는 fallback 복구를 위해 최근 50개를 보관하고, 브라우저는 가독성을 위해 12개만 표시한다. 두 숫자는 책임이 다르다.

이 중복 방지는 서버가 ID를 증가 순서로 유일하게 발급한다는 계약에 의존한다. 운영에서 순서가 뒤섞이는 여러 producer를 붙이면 cursor 계약부터 다시 설계해야 한다.

## 12. `onerror`와 `onclose`를 구분하는 이유

두 callback은 같은 뜻이 아니다.

### 12.1 `onerror`

```ts
socket.onerror = () => {
  setError(
    "WebSocket 연결에 실패했습니다. 연결 종료 후 polling으로 전환합니다.",
  );
};
```

`error`는 통신 문제가 발생했다는 신호다. 브라우저는 보안상 상세 네트워크 원인을 거의 제공하지 않는다. 이 시점에는 오류 문구만 표시한다.

### 12.2 `onclose`

```ts
socket.onclose = () => {
  if (!disposed) {
    startPolling("WebSocket 연결이 닫혀 polling fallback으로 전환했습니다.");
  }
};
```

`close`는 해당 WebSocket 연결이 실제로 종료되었다는 lifecycle 신호다. polling 전환은 여기에서 한 번만 시작한다.

```txt
error에서 polling 시작 + close에서도 polling 시작
→ polling loop가 두 개 생길 위험

error는 안내만 표시
→ close에서 한 번 전환
→ polling loop 하나
```

`new WebSocket(...)` 생성 자체가 동기적으로 throw하는 경우에는 아직 정상 socket lifecycle이 시작되지 않았으므로 `catch`가 바로 `startPolling`을 호출한다.

## 13. polling fallback 전체 흐름

WebSocket 연결이 닫히면 다음 코드가 실행된다.

```ts
function startPolling(detail: string) {
  setConnection({ detail, mode: "polling" });
  void pollEvents();
}
```

첫 polling을 즉시 실행한다. 3초를 먼저 기다리지 않는 이유는 연결이 끊긴 직후의 공백을 줄이기 위해서다.

### 13.1 `after` cursor

```ts
const response = await fetch(
  `${nextUrls.polling}?after=${lastEventIdRef.current}`,
  { cache: "no-store" },
);
```

예를 들어 WebSocket으로 마지막 ID `17`까지 받았다면 fallback 첫 요청은 다음과 같다.

```txt
GET /events?after=17
```

서버는 `17`을 다시 보내지 않고 `18` 이후만 보낸다. `cache: "no-store"`는 브라우저나 Next의 캐시 결과가 아니라 매번 현재 서버 응답을 받으려는 뜻이다.

### 13.2 응답 상태와 payload를 모두 확인한다

```ts
if (!response.ok) {
  throw new Error(`Polling failed: HTTP ${response.status}`);
}

const data = await response.json();
if (!isRealtimeEventListResponse(data)) {
  throw new Error("Polling response shape is invalid.");
}
```

HTTP 200인지 확인하는 것과 JSON 모양을 확인하는 것은 별개다. 서버가 200으로 오류 모양을 반환해도 validator가 막는다.

### 13.3 3초 `setTimeout`

```ts
finally {
  if (!disposed) pollingTimer = setTimeout(pollEvents, 3000);
}
```

`setInterval` 대신 요청이 끝난 뒤 `setTimeout` 하나를 예약한다.

```txt
pollEvents 시작
→ fetch 완료 또는 실패
→ 처리 완료
→ 3초 뒤 다음 pollEvents 한 번 예약
```

응답이 5초 걸리면 같은 요청이 3초마다 겹치지 않는다. 이전 요청이 끝난 뒤 3초를 기다린다.

polling이 한 번 실패해 `offline`이 되어도 `finally`가 다음 시도를 예약한다. 서버가 다시 살아나면 다음 성공한 polling에서 모드가 `polling`으로 돌아온다.

## 14. cleanup과 수동 재연결

### 14.1 페이지를 떠날 때 cleanup

```ts
return () => {
  disposed = true;
  socket?.close();
  if (pollingTimer) clearTimeout(pollingTimer);
};
```

순서에 이유가 있다.

```txt
disposed = true
→ 이후 onclose가 실행되어도 polling을 새로 시작하지 않음

socket.close()
→ 열린 WebSocket 종료

clearTimeout
→ 예약된 다음 polling 제거
```

cleanup이 없으면 다른 페이지로 이동한 뒤에도 이전 socket과 timer가 살아 있을 수 있다. 다시 `/realtime`에 오면 새 연결까지 생겨 중복 메시지와 중복 요청이 발생한다.

### 14.2 재연결 버튼

```ts
function reconnect() {
  lastEventIdRef.current = 0;
  setEvents([]);
  setError(undefined);
  setConnectionRun((value) => value + 1);
}
```

```txt
사용자가 재연결 클릭
→ cursor 0으로 초기화
→ 화면 목록과 오류 제거
→ connectionRun 증가
→ 기존 effect cleanup
→ 새 effect 실행
→ 새 WebSocket 연결 시도
```

재연결 로직을 별도 연결 manager로 추상화하지 않았다. 현재 소비자는 이 페이지 하나이고, React effect dependency 변경만으로 수명 교체가 충분하다.

## 15. 서버에서 canvas가 아닌 DOM까지 도달하는 전체 순서

WebGL과 달리 이 화면의 최종 출력은 일반 HTML 목록이다. 정상 WebSocket 경로 전체를 코드 이름으로 다시 연결하면 다음과 같다.

```txt
apps/realtime-server/src/server.mjs
setInterval(..., 4000)
→ appendEvent(message)
→ { id, message } 생성
→ events 배열에 저장
→ broadcast(event)
→ sendEvent(socket, event)

apps/realtime-server/src/websocket-frame.mjs
encodeWebSocketText(JSON.stringify(event))
→ WebSocket text frame 생성
→ socket.write(frame)

브라우저 WebSocket 구현
frame 수신·해제
→ MessageEvent.data 문자열 생성

apps/web/app/realtime/page.tsx
socket.onmessage
→ parseRealtimeEvent
→ JSON.parse
→ packages/api-types의 isRealtimeEvent
→ recordEvents
→ setEvents
→ RealtimePage 재렌더링
→ events.map
→ RealtimeEventRow
→ <li> DOM 생성·갱신
→ 브라우저가 이벤트 목록 표시
```

fallback 경로는 앞부분만 바뀐다.

```txt
socket.onclose
→ startPolling
→ pollEvents
→ fetch(/events?after=id)

server.mjs의 createServer request handler
→ events.filter(event.id > after)
→ writeJson

브라우저 response.json
→ isRealtimeEventListResponse
→ recordEvents
→ 이후 DOM 갱신은 WebSocket 경로와 동일
```

## 16. X-Ray 증거 패널은 어떻게 구현되었는가

### 16.1 실제 경계에 proof를 연결한다

연결 요약, 이벤트 피드, 런타임 검증, 공유 이벤트 타입 경계는 다음 조건을 사용한다.

```tsx
enabled={xray || mode === "websocket"}
proofs={["fsd-style", "websocket"]}
```

따라서 전체/FSD 모드에서 기존 구조 증거가 유지되고, WebSocket 모드에서도 실시간 관련 경계만 보인다.

### 16.2 전용 패널은 해당 모드에서만 존재한다

```tsx
{mode === "websocket" ? (
  <XRayBox
    enabled={mode === "websocket"}
    label="feature/realtime/WebSocketPollingPipeline"
    packageName="apps/web"
    proofs={["websocket"]}
    stacks={["WebSocket", "Polling", "Runtime validation", "cleanup"]}
  >
    <WebSocketPollingEvidencePanel
      connection={connection}
      lastEventId={lastEventIdRef.current}
      urls={urls}
    />
  </XRayBox>
) : null}
```

패널에 새 통신 상태를 만들지 않는다. 실제 화면이 이미 가진 세 값을 prop으로 읽는다.

```txt
connection
→ 현재 WebSocket / Polling / Offline 상태

lastEventId
→ fallback이 이어받을 cursor

urls
→ 브라우저가 실제로 사용한 두 endpoint
```

정적 설명만 보여 주는 가짜 증거가 아니라 현재 실행값과 코드 경로를 함께 보여 준다.

패널의 네 줄은 실제 함수에 직접 대응한다.

```txt
new WebSocket(url) → socket.onmessage
event.data → JSON.parse + isRealtimeEvent
socket.onclose → pollEvents()
/events?after=id → isRealtimeEventListResponse
```

공통 반영 함수와 cleanup도 코드 그대로 표시한다.

```txt
recordEvents(validatedEvents)
socket?.close(); clearTimeout(pollingTimer)
```

### 16.3 CSS를 추가하지 않은 이유

OpenLayers와 R3F X-Ray에서 이미 사용하는 다음 공통 class가 있다.

```txt
technology-evidence
technology-flow
technology-code
```

20-3도 기술 흐름과 코드 증거라는 같은 UI 형태다. 새 `websocket-evidence-*` 스타일을 만들면 모양은 같은데 유지보수할 CSS만 늘어난다.

## 17. 직접 확인 실습 1 — 정상 WebSocket

### 17.1 서버와 web을 각각 실행한다

프로젝트 루트에서 터미널 두 개를 연다.

터미널 1:

```powershell
npm run dev:realtime
```

터미널 2:

```powershell
npm run dev:web
```

### 17.2 endpoint를 먼저 확인한다

브라우저에서 다음 주소를 연다.

```txt
http://127.0.0.1:3001/health
```

`ok: true`, 현재 `events`, `clients`, `serverTime`이 보이면 서버 프로세스가 준비된 것이다.

### 17.3 X-Ray 화면을 연다

```txt
http://127.0.0.1:3000/realtime?xray=websocket
```

확인 순서:

```txt
1. 연결 모드가 Connecting에서 WebSocket으로 바뀐다.
2. WebSocket / Polling X-Ray 경계가 보인다.
3. 증거 패널의 현재 연결 URL이 ws://127.0.0.1:3001/ws다.
4. 연결 직후 heartbeat가 표시된다.
5. 약 4초마다 상태 변경 또는 heartbeat가 추가된다.
6. 마지막 ID가 증가한다.
7. 이벤트가 최신순이고 최대 12개까지만 보인다.
8. 오류 문구가 없다.
```

브라우저 개발자 도구의 Network에서 `WS` 항목을 선택하면 `/ws` 연결과 수신 message frame도 확인할 수 있다.

## 18. 직접 확인 실습 2 — 정확한 polling fallback

fallback을 검증할 때 realtime 서버 전체를 끄면 안 된다. 그러면 WebSocket과 polling이 모두 실패해 `Offline`만 확인하게 된다.

정확한 조건은 다음과 같다.

```txt
WebSocket URL만 실패
Polling URL과 realtime 서버는 정상
```

### 18.1 realtime 서버는 정상 실행한다

터미널 1:

```powershell
npm run dev:realtime
```

### 18.2 web 프로세스에서 WS URL만 실패 주소로 덮어쓴다

기존 web 서버를 종료한 뒤 새 PowerShell 터미널에서 실행한다.

```powershell
$env:NEXT_PUBLIC_REALTIME_WS_URL = "ws://127.0.0.1:3999/ws"
$env:NEXT_PUBLIC_REALTIME_POLL_URL = "http://127.0.0.1:3001/events"
npm run dev:web
```

`3999`에는 WebSocket 서버를 띄우지 않는다. polling은 정상 `3001`을 유지한다. 파일을 편집하지 않고 해당 터미널 프로세스에만 임시 값을 준 이유는 실습 뒤 설정 복구를 빠뜨리지 않기 위해서다.

### 18.3 화면에서 확인한다

```txt
http://127.0.0.1:3000/realtime?xray=websocket
```

예상 흐름:

```txt
new WebSocket(ws://127.0.0.1:3999/ws)
→ onerror에서 실패 안내
→ onclose에서 startPolling
→ GET http://127.0.0.1:3001/events?after=0
→ 정상 응답 검증
→ 연결 모드 Polling
→ 이벤트 목록 계속 갱신
```

확인할 것:

```txt
1. 최종 연결 배지가 Polling이다.
2. Fallback 지표가 On이다.
3. 증거 패널의 WS 주소는 실패용 3999다.
4. polling 주소는 정상 3001이다.
5. Network에 /events?after=... 요청이 보인다.
6. 요청이 끝난 뒤 약 3초 후 다음 요청이 시작된다.
7. after 값이 마지막으로 반영한 ID를 따라 증가한다.
8. 같은 ID가 목록에 중복 표시되지 않는다.
```

정상 polling이 성공하면 일시적인 WebSocket 오류 문구는 지워진다. 최종 상태와 Network 요청을 함께 보아야 한다.

실습을 끝내고 web 프로세스를 종료한다. 같은 PowerShell 세션을 계속 쓸 경우 임시 환경 변수를 제거한다.

```powershell
Remove-Item Env:NEXT_PUBLIC_REALTIME_WS_URL
Remove-Item Env:NEXT_PUBLIC_REALTIME_POLL_URL
```

그다음 `npm run dev:web`을 다시 실행하면 `apps/web/.env.development`의 정상 URL을 사용한다.

## 19. 직접 확인 실습 3 — invalid payload는 기존 테스트로 검증한다

잘못된 JSON을 보기 위해 실제 서버 코드를 임시로 망가뜨리지 않는다. 이미 `packages/api-types/test/risk-score.test.ts`에 유효·무효 polling payload 검사가 있다.

```powershell
npm --workspace @citywatch/api-types test
```

테스트가 확인하는 핵심은 다음과 같다.

```txt
정상 heartbeat event
→ isRealtimeEventListResponse(...) === true

incident.statusChanged의 status가 "unknown"
→ isIncidentStatus 실패
→ isRealtimeMessage 실패
→ isRealtimeEvent 실패
→ isRealtimeEventListResponse(...) === false
```

WebSocket handshake와 text frame은 서버 workspace의 기존 테스트로 확인한다.

```powershell
npm --workspace @citywatch/realtime-server test
```

이 테스트는 표준 예제 key의 `Sec-WebSocket-Accept` 결과와 `"ok"` text frame bytes를 검사한다.

실제 invalid payload를 수동 전송하는 별도 mock 서버는 20-3 범위에 필요하지 않다. 기존 validator 테스트가 같은 신뢰 경계를 더 빠르고 반복 가능하게 검증한다.

## 20. 직접 확인 실습 4 — 자유 라우팅

이 실습은 X-Ray가 대표 화면으로 안내하되 사용자를 고정하지 않는지 확인한다.

```txt
1. 아무 페이지에서 X-Ray select를 연다.
2. WebSocket / Polling을 선택한다.
3. /realtime?xray=websocket로 이동하는지 확인한다.
4. 상단 메뉴에서 지도 관제를 누른다.
5. /map?xray=websocket에 머무는지 확인한다.
6. 다시 3D 위험 구역을 누른다.
7. /risk-3d?xray=websocket에 머무는지 확인한다.
8. 새로고침 뒤 selector가 WebSocket / Polling을 유지하는지 확인한다.
```

페이지를 이동할 때 `/realtime`로 되돌아가면 잘못된 구현이다. 현재 구현은 query의 선택값만 유지한다.

## 21. 직접 확인 실습 5 — cleanup과 재연결

정상 WebSocket 상태에서 진행한다.

```txt
1. /realtime?xray=websocket를 연다.
2. Network에서 /ws 연결이 하나인지 확인한다.
3. 재연결 버튼을 누른다.
4. 이전 /ws가 닫히고 새 /ws가 하나 생기는지 확인한다.
5. 이벤트 목록과 마지막 ID가 초기화되는지 확인한다.
6. /map으로 이동한다.
7. 이전 /ws가 종료되는지 확인한다.
8. 3초 polling 요청이 남아서 계속 실행되지 않는지 확인한다.
```

React 개발 모드에서는 Strict Mode의 effect 검증 때문에 최초 연결이 한 번 생성·정리된 뒤 다시 생성되는 모습이 잠깐 보일 수 있다. 최종적으로 살아 있는 연결과 timer가 하나인지 확인한다.

## 22. 추가 이벤트를 직접 구현하는 순서

새 기능을 추가할 때는 화면 분기부터 만들지 않는다. 전송 계약에서 시작해 서버, 검증, 표시, 테스트 순서로 내려온다.

예를 들어 `incident.assignmentChanged` 이벤트를 학습용으로 추가한다고 가정한다. 아래는 구현 순서이며 20-3 코드에는 미리 추가되어 있지 않다.

### 22.1 공유 계약 추가

`packages/api-types/src/index.ts`의 `RealtimeMessage` union에 필요한 필드를 정의한다.

```ts
| {
    type: "incident.assignmentChanged";
    incidentId: string;
    assignedTeam: string;
    sentAt: ISODateTime;
  }
```

이 단계가 먼저인 이유는 생산자와 소비자가 합의할 JSON 모양을 먼저 고정하기 위해서다.

### 22.2 런타임 validator 추가

`isRealtimeMessage`에 해당 type의 필수 문자열을 검사하는 branch를 추가한다.

```txt
type이 맞는가
→ incidentId가 빈 문자열이 아닌가
→ assignedTeam이 허용 길이의 문자열인가
→ sentAt이 유효한 시간 문자열인가
```

현재 validator는 `sentAt`이 문자열인지만 확인한다. ISO 날짜의 실제 유효성까지 요구한다면 모든 realtime message에 일관되게 적용해야 한다.

### 22.3 validator 테스트를 먼저 추가

```txt
정상 assignmentChanged
→ true

assignedTeam 누락
→ false

알 수 없는 type
→ false
```

이 테스트가 있으면 서버나 UI를 고치는 중에도 신뢰 경계가 깨졌는지 바로 알 수 있다.

### 22.4 서버가 실제 message를 생성하게 한다

`apps/realtime-server/src/server.mjs`의 학습용 interval message 생성 분기에 새 모양을 추가한다. 이벤트 ID, 저장, broadcast는 기존 `appendEvent`와 `broadcast`를 그대로 사용한다.

```txt
새 message 모양만 추가
→ 전송 pipeline 재사용
→ 새 WebSocket helper나 새 polling endpoint 불필요
```

### 22.5 화면 표시 분기 추가

`getRealtimeEventTitle`과 필요하면 `getRealtimeEventTone`에 새 type을 처리한다. `onmessage`, `pollEvents`, `recordEvents`는 전송 내용에 독립적이므로 수정할 필요가 없다.

### 22.6 두 경로를 확인한다

```txt
정상 WS에서 새 이벤트 표시
→ WS URL만 실패시켜 polling에서도 같은 이벤트 표시
→ validator 테스트 통과
→ typecheck 통과
```

이 순서를 따르면 새 이벤트 종류를 추가해도 WebSocket용 코드와 polling용 코드를 따로 복제하지 않는다.

## 23. 문제를 증상에서 코드 위치로 찾는 법

| 증상 | 먼저 확인할 위치 | 이유 |
| --- | --- | --- |
| selector에 항목이 없음 | `XRaySelector`의 `<option>` | 사용자에게 보이는 항목의 직접 출처 |
| 새로고침 뒤 `all`로 바뀜 | `getXRayMode` | URL 문자열 허용 목록 |
| 선택해도 `/realtime`로 안 감 | `getXRayPathname` | 최초 대표 route 결정 |
| 다른 메뉴를 눌러도 `/realtime`로 돌아옴 | `XRayProvider` route effect | 선택 시 이동과 매 route 동기화를 혼동했을 가능성 |
| 계속 Connecting | 서버 3001 실행, WS URL, `onopen` | handshake가 완료되지 않음 |
| 오류 후 Polling으로 안 바뀜 | `onclose`, `startPolling` | fallback의 실제 시작점 |
| Polling도 Offline | poll URL, `/health`, HTTP status | WS만이 아니라 HTTP 경로도 실패했을 가능성 |
| 같은 이벤트가 반복됨 | `after`, `lastEventIdRef`, `recordEvents` | cursor 또는 중복 필터 문제 |
| JSON 오류가 화면 state에 들어감 | 두 runtime validator | 외부 입력 검증 경계 문제 |
| 페이지 이동 뒤 요청이 계속됨 | effect cleanup | socket 또는 timer 수명 문제 |
| 13개 이상 표시됨 | `maxVisibleEvents`, `slice(0, 12)` | 브라우저 표시 상한 문제 |
| X-Ray 패널 상태가 실제 화면과 다름 | 전달한 `connection`, `lastEventId`, `urls` | 별도 가짜 상태를 만들었는지 확인 |

## 24. 현재 구현의 한계

현재 코드는 원리를 학습하고 로컬에서 증명하기 위한 최소 구현이다.

### 서버와 프로토콜

- `ws://` 개발 연결이며 운영용 `wss://`와 인증서 구성이 없다.
- 인증, 권한, 사용자별 구독, Origin 허용 목록이 없다.
- HTTP CORS가 `Access-Control-Allow-Origin: *`이므로 민감한 운영 데이터에 그대로 쓸 수 없다.
- 직접 만든 frame 처리는 production WebSocket 서버가 제공하는 fragmentation, ping/pong, 압축, rate limit 같은 전체 기능을 구현하지 않는다.
- 이벤트는 메모리에 최근 50개만 있고 서버 재시작 시 ID와 이력이 사라진다.
- 다중 서버 간 이벤트 공유와 순서 보장이 없다.

### 클라이언트

- WebSocket이 끊기면 polling으로 전환하지만 자동으로 WebSocket을 다시 시도하지 않는다. 사용자가 재연결 버튼을 눌러야 한다.
- 재시도 backoff와 jitter가 없다.
- application heartbeat는 표시하지만 일정 시간 메시지가 없을 때 stale 연결로 판단하는 timeout은 없다.
- 진행 중인 polling `fetch`를 cleanup에서 `AbortController`로 취소하지 않는다. timer 예약과 다음 state 경로는 `disposed`로 제한하지만 이미 시작한 네트워크 요청 자체는 끝까지 갈 수 있다.
- 브라우저 tab이 숨겨져도 polling 주기를 별도로 낮추지 않는다.
- 증가하는 단일 ID와 순서 전달을 가정하므로 다중 producer의 out-of-order event에는 그대로 적용할 수 없다.

이 한계는 모두 지금 즉시 코드를 늘려야 한다는 뜻이 아니다. 실제 요구가 생기는 순서대로 보강한다.

## 25. 운영 확장 순서

현재 최소 구조를 유지하면서 확장한다면 다음 순서가 안전하다.

```txt
1. HTTPS/WSS와 reverse proxy
2. Origin 제한, 인증, 사용자별 구독 권한
3. DB 또는 durable event log와 재시작 가능한 cursor 계약
4. WebSocket 재연결 backoff + jitter + stale timeout
5. polling AbortController와 document visibility 대응
6. 통합 테스트와 연결·지연·오류 관측 지표
7. 실제로 다중 instance가 필요할 때 메시지 broker 검토
8. 프로토콜 요구가 커질 때 검증된 WebSocket 서버 라이브러리 사용
```

처음부터 broker, 연결 manager, 범용 transport abstraction을 만들지 않는다. 현재 한 페이지와 한 서버에서 요구가 확인된 다음 단계만 추가한다.

## 26. 최종 검증 명령

```powershell
npm run typecheck
npm test
git diff --check
```

20-3 관련 변경만 확인한다.

```powershell
git diff -- apps/web/app/xray-selector.tsx apps/web/app/realtime/page.tsx docs/20-3-websocket-polling-xray.md
```

최종 체크리스트:

```txt
X-Ray option의 websocket 값 등록
→ URL getXRayMode 허용
→ 선택 시 /realtime로 한 번 이동
→ 이후 자유 route 유지
→ RealtimePage에서 useXRay() 한 번만 호출
→ mode === "websocket" 직접 비교
→ 실제 WebSocket/polling 경계 표시
→ 현재 URL, cursor, connection 상태 증거 표시
→ 정상 WebSocket 확인
→ WS만 실패시킨 정확한 polling fallback 확인
→ invalid payload 기존 테스트 확인
→ cleanup과 재연결 확인
```

20-3의 핵심은 다음 한 줄로 정리된다.

```txt
사용자의 X-Ray 선택
→ URL의 websocket mode
→ /realtime 실제 통신 경계
→ WebSocket 우선·polling fallback 실행값
→ 런타임 검증과 공통 recordEvents
→ 화면에서 추적 가능한 증거
```
