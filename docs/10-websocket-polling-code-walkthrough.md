# 10단계 WebSocket/Polling 구현 설명서

`/realtime`은 WebSocket을 기본 연결로 사용하고, 연결이 닫히면 HTTP polling으로 전환해 실시간 사고 이벤트를 계속 표시하는 화면이다.

## 현재 코드 기준

이 문서는 다음 파일의 현재 코드를 기준으로 한다.

```txt
apps/web/app/realtime/page.tsx
apps/realtime-server/src/server.mjs
apps/realtime-server/src/websocket-frame.mjs
packages/api-types/src/index.ts
```

초기 구현에는 받은 모든 ID를 `seenEventIdsRef`의 `Set`에 저장했다. 현재 구현은 그 `Set`을 제거하고 `lastEventIdRef` 하나를 다음 polling의 기준점과 중복 방지 기준으로 함께 사용한다. 이 서버는 이벤트 ID를 증가 순서로 한 번씩 발급하고, polling은 마지막 ID보다 큰 이벤트만 반환하기 때문이다.

## 1. 문제와 진입점

사고 목록 REST API는 요청한 시점의 데이터를 한 번 돌려준다. 화면을 열어 둔 뒤 서버에서 사고 상태가 바뀌어도, 브라우저가 다시 요청하기 전에는 화면이 그 변화를 알 수 없다.

`/realtime`의 진입점은 `RealtimePage`다. 사용자가 이 경로에 들어오면 컴포넌트가 렌더링되고 `useEffect`가 WebSocket 연결을 시작한다.

```txt
사용자: /realtime 접속
→ RealtimePage 렌더링
→ useEffect 실행
→ getRealtimeUrls()
→ new WebSocket(nextUrls.websocket)
→ realtime-server의 server.on("upgrade")
→ socket.onmessage
→ parseRealtimeEvent
→ recordEvents
→ setEvents
→ RealtimeEventRow 목록 렌더링
```

WebSocket이 실패하거나 닫히면 흐름은 다음으로 바뀐다.

```txt
socket.onclose
→ startPolling(...)
→ pollEvents()
→ GET /events?after={lastEventIdRef.current}
→ isRealtimeEventListResponse
→ recordEvents
→ setEvents
→ 3초 뒤 다음 pollEvents 예약
```

## 2. 코드에서 확인되는 사실과 범위

### 코드에서 확실히 확인되는 내용

- `apps/realtime-server`는 `/health`, `/events`, `/ws`를 제공한다.
- 서버는 `appendEvent`에서 `id: ++nextEventId`로 증가하는 숫자 ID를 붙인다.
- `/events?after=id`는 `event.id > after`인 이벤트만 응답한다.
- 서버는 4초마다 heartbeat 또는 `incident.statusChanged` 이벤트를 만든다.
- 브라우저는 WebSocket 메시지와 polling JSON을 모두 런타임 타입 가드로 확인한 뒤에만 화면 상태에 저장한다.
- 화면에는 최신 12개만 `events` state에 남긴다.
- WebSocket 종료와 polling 타이머는 effect cleanup에서 정리한다.

### 코드 구조상 추정되는 구현 의도

- WebSocket lifecycle과 장애 시 fallback을 한 화면에서 학습·증명하려는 구조다.
- 운영용 메시지 브로커 대신 Node 표준 모듈과 작은 프레임 인코더를 사용해 통신 원리를 드러내려는 구조다.

### 코드만으로 확정할 수 없는 내용

- 운영 환경에서도 이 서버를 그대로 사용할지는 알 수 없다.
- 실제 공공 API, DB, 인증·권한, 사용자별 구독 범위는 구현되어 있지 않다.
- 서버 재시작으로 ID가 0부터 다시 시작했을 때의 복구 정책은 구현되어 있지 않다.

## 3. 서버: 하나의 이벤트를 두 전송 경로로 제공

서버의 핵심은 이벤트를 한 번 만들고, WebSocket과 HTTP가 같은 `RealtimeEvent` 모양을 사용하게 하는 것이다.

```js
function appendEvent(message) {
  const event = { id: ++nextEventId, message };
  events.push(event);
  if (events.length > maxEvents) events.shift();
  return event;
}

function broadcast(event) {
  for (const socket of clients) {
    sendEvent(socket, event);
  }
}
```

예를 들어 `nextEventId`가 `7`일 때 heartbeat가 생기면, `appendEvent`는 다음 값을 만든다.

```txt
실행 전: nextEventId = 7, events.length = 7
→ appendEvent({ type: "heartbeat", sentAt: "..." })
→ event = { id: 8, message: { type: "heartbeat", sentAt: "..." } }
→ nextEventId = 8
→ events 배열에 event 저장
→ broadcast(event)가 연결된 WebSocket 클라이언트에 같은 event 전송
```

HTTP fallback은 별도 데이터를 만들지 않는다. 이미 저장한 이벤트에서 필요한 ID 이후만 꺼낸다.

```js
if (url.pathname === "/events") {
  const after = Number(url.searchParams.get("after") ?? 0);
  writeJson(response, 200, {
    events: events.filter((event) => event.id > after),
    serverTime: now(),
  });
  return;
}
```

클라이언트가 `after=8`을 보내고 서버에 `9`, `10`이 있으면 응답의 `events`는 `[9, 10]`뿐이다. 이 계약이 클라이언트가 모든 과거 ID를 `Set`으로 기억하지 않아도 되는 근거다.

## 4. WebSocket 연결 과정

브라우저가 `ws://host:3001/ws`에 연결하면 Node HTTP 서버는 `upgrade` 이벤트를 받는다. `/ws` 경로와 `sec-websocket-key`가 없으면 즉시 socket을 끊고, 유효하면 WebSocket handshake 응답을 직접 작성한다.

```js
if (url.pathname !== "/ws" || typeof key !== "string") {
  socket.destroy();
  return;
}

socket.write([
  "HTTP/1.1 101 Switching Protocols",
  "Upgrade: websocket",
  "Connection: Upgrade",
  `Sec-WebSocket-Accept: ${getWebSocketAccept(key)}`,
  "",
  "",
].join("\r\n"));
```

handshake가 끝나면 `clients`에 socket을 넣고, 연결 직후 heartbeat를 하나 보낸다. `close`와 `error`에서는 `clients`에서 삭제한다. 따라서 이미 끊긴 socket으로 다음 broadcast를 계속 시도하지 않는다.

`websocket-frame.mjs`는 handshake의 accept 값과 JSON 문자열을 WebSocket text frame으로 만드는 작은 프로토콜 처리 파일이다. 이 코드는 학습용 최소 서버이며, 운영급 서버 라이브러리의 대체를 목표로 하지 않는다.

## 5. 클라이언트 state와 ref의 역할

`RealtimePage`에는 화면에 보이는 값과 통신 제어 값이 분리되어 있다.

```ts
const [connection, setConnection] = useState<ConnectionState>(...);
const [events, setEvents] = useState<RealtimeEvent[]>([]);
const [error, setError] = useState<string>();
const [urls, setUrls] = useState<RealtimeUrls>();
const [connectionRun, setConnectionRun] = useState(0);
const lastEventIdRef = useRef(0);
```

| 값 | 저장하는 내용 | 변경자 | 쓰이는 곳 |
| --- | --- | --- | --- |
| `connection` | connecting, websocket, polling, offline과 설명 문구 | socket callback, `pollEvents` | 연결 배지와 상태 문구 |
| `events` | 검증을 통과한 최신 12개 `RealtimeEvent` | `recordEvents` | `RealtimeEventRow` 목록 |
| `error` | 연결·응답·형식 오류 문구 | socket/polling 오류 처리 | `role="alert"` 오류 UI |
| `urls` | 실제 WS, polling URL | effect 시작 시 | 화면의 연결 주소 표시 |
| `connectionRun` | 새 effect를 만들기 위한 숫자 | `reconnect` | effect dependency |
| `lastEventIdRef` | 마지막으로 받아 화면에 반영한 가장 큰 ID | `recordEvents`, `reconnect` | polling `after`와 중복 방지 |

`events`는 바뀌면 목록을 다시 그려야 하므로 state다. 반대로 `lastEventIdRef`는 비동기 callback이 최신 값을 바로 읽어야 하지만 값 자체를 화면에 표시할 필요는 없으므로 ref다. 다만 현재 화면의 마지막 ID 지표는 다음 렌더 시 ref의 현재 값을 읽어 표시한다.

## 6. 이벤트 검증과 커서 기반 중복 방지

네트워크 JSON은 TypeScript 타입을 믿을 수 없다. 타입은 빌드 후 제거되므로, WebSocket 문자열과 `response.json()` 결과에는 런타임 검사가 필요하다.

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

polling도 같은 원칙을 쓴다.

```ts
const data = await response.json();
if (!isRealtimeEventListResponse(data)) {
  throw new Error("Polling response shape is invalid.");
}

recordEvents(data.events);
```

검증을 통과한 이벤트는 `recordEvents`에서 마지막 처리 ID보다 큰 것만 남긴다.

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
    [...uniqueEvents.sort((a, b) => b.id - a.id), ...current].slice(0, maxVisibleEvents),
  );
}
```

예시 값은 다음과 같다.

```txt
실행 전
lastEventIdRef.current = 8
events = [{ id: 8, ... }, { id: 7, ... }]

polling 응답
nextEvents = [{ id: 9, ... }, { id: 10, ... }]

filter 결과
uniqueEvents = [{ id: 9, ... }, { id: 10, ... }]

커서 갱신
lastEventIdRef.current = 10

화면 state 갱신
events = [{ id: 10, ... }, { id: 9, ... }, { id: 8, ... }, { id: 7, ... }]
```

그 뒤 같은 ID `10`이 다시 들어오면 `10 > 10`이 거짓이므로 바로 반환한다. 이 방식은 서버가 증가하는 고유 ID를 보장하고, WebSocket은 순서대로 전달되며, polling은 한 요청이 끝난 뒤 다음 요청을 예약하는 현재 코드 구조에서 성립한다.

기존 `seenEventIdsRef` 방식은 모든 과거 ID를 계속 `Set`에 보관했다. 화면에는 12개만 남겨도 `Set`은 연결이 유지되는 동안 계속 커질 수 있었다. 현재는 마지막 숫자 하나만 보관한다.

## 7. fallback, 재연결, 정리

WebSocket이 열리면 기본 모드가 된다.

```ts
socket.onopen = () => {
  setConnection({
    detail: "WebSocket으로 실시간 이벤트를 수신 중입니다.",
    mode: "websocket",
  });
  setError(undefined);
};
```

연결이 닫히면 `startPolling`이 바로 첫 polling을 시작한다. `pollEvents`의 `finally`는 요청이 끝난 후에만 3초 timer를 만든다. 따라서 같은 effect 안에서 polling 요청이 동시에 겹치지 않는다.

```ts
socket.onclose = () => {
  if (!disposed) {
    startPolling("WebSocket 연결이 닫혀 polling fallback으로 전환했습니다.");
  }
};

finally {
  if (!disposed) pollingTimer = setTimeout(pollEvents, 3000);
}
```

재연결 버튼은 새 데이터를 처음부터 다시 보려는 명시적 동작이다.

```ts
function reconnect() {
  lastEventIdRef.current = 0;
  setEvents([]);
  setError(undefined);
  setConnectionRun((value) => value + 1);
}
```

`connectionRun`이 증가하면 effect의 dependency가 바뀐다. React는 기존 effect cleanup을 실행해 이전 socket과 timer를 정리한 뒤 새 WebSocket 연결을 만든다.

```ts
return () => {
  disposed = true;
  socket?.close();
  if (pollingTimer) clearTimeout(pollingTimer);
};
```

이 cleanup이 없으면 페이지를 나갔다 다시 들어왔을 때 기존 socket과 새 socket이 모두 이벤트를 받고, 이전 timer도 polling을 계속해 중복 요청과 제거된 컴포넌트의 state 변경이 생길 수 있다.

## 8. 잘못된 구현과 비교

아래 코드는 polling 응답을 무조건 앞에 붙인다.

```ts
function recordEvents(nextEvents: RealtimeEvent[]) {
  setEvents((current) => [...nextEvents, ...current]);
}
```

처음에는 정상처럼 보인다. 예를 들어 첫 polling이 `[9, 10]`을 반환하면 화면에 두 행이 보인다. 하지만 WebSocket에서 이미 `10`을 받았고 `lastEventId`도 올리지 않은 상태에서 polling이 `[10, 11]`을 반환하면 화면은 다음처럼 된다.

```txt
실행 전: [{ id: 10, ... }]
잘못된 추가: [{ id: 10, ... }, { id: 11, ... }, { id: 10, ... }]
결과: ID 10이 두 번 표시됨
```

현재 코드는 `event.id > lastEventIdRef.current`를 먼저 검사하므로 같은 상황에서 `10`은 제외하고 `11`만 추가한다.

## 9. 구현 범위와 검증

현재 서버는 최근 50개 이벤트만 메모리에 보관한다. 따라서 오래 끊겼거나 서버가 재시작되면 운영 환경처럼 누락 없는 복구를 보장하지 않는다. 운영 단계에서는 WSS, 인증·권한, Origin 검증, heartbeat timeout, 재연결 backoff, 이벤트 영속화, 다중 서버 메시지 브로커, backpressure와 관측 지표가 필요하다.

현재 구현 검증 명령은 다음과 같다.

```bash
npm run dev:realtime
npm run dev:web
npm run typecheck
npm test
```

서버만 확인할 때는 `http://127.0.0.1:3001/health`, fallback 응답은 `http://127.0.0.1:3001/events?after=0`에서 확인한다.
