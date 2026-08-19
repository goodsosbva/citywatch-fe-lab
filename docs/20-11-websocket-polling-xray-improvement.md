# 20-11. WebSocket / Polling X-Ray 개선

## 목표

기존 WebSocket X-Ray는 실시간 통신을 실제로 구현하고 있었지만 화면에는 다음 FSD 경계가 한꺼번에 표시됐다.

```text
widget/RealtimeConnectionSummary
widget/RealtimeFeed
feature/realtime/ValidateRealtimeEvents
entity/realtime/RealtimeProof
feature/realtime/WebSocketPollingPipeline
```

이 표시는 FSD 관점에는 의미가 있지만 WebSocket을 배우려는 사람에게 필요한 통신 경계와 다르다.

20-11에서는 다음 질문에 바로 답하도록 표시를 바꿨다.

```text
어느 코드가 브라우저에서 실행되는가?
어느 코드가 독립 서버에서 실행되는가?
WebSocket 정상 경로는 무엇인가?
연결이 닫히면 Polling으로 어떻게 전환되는가?
두 경로의 JSON은 어디서 검증되고 합쳐지는가?
```

## 최종 화면 구조

WebSocket 관점에서는 화면 X-Ray 경계를 하나만 표시한다.

```text
Browser client · apps/web · RealtimeClient
```

실시간 서버는 브라우저 DOM을 렌더링하지 않으므로 서버 주변에 가짜 화면 테두리를 만들지 않는다. 대신 증거 패널에 실제 네 실행 경계를 표시한다.

```text
브라우저 클라이언트
→ 현재 전송 경로
↔ 독립 실시간 서버
→ 런타임 계약 검증
→ React events 상태
```

## X-Ray 조건

`RealtimePage`는 기존 `useXRay()`를 한 번만 호출한다.

```tsx
const { enabled: xray, mode } = useXRay();
const websocketXray = mode === "websocket";
```

`xray`는 기존 FSD·Monorepo·All 관점의 경계를 유지한다. `websocketXray`는 WebSocket 관점만 구분한다.

최상위 경계는 관점에 따라 이름을 바꾼다.

```tsx
<XRayBox
  enabled={xray || websocketXray}
  label={
    websocketXray
      ? "browser/realtime/RealtimeClient"
      : "app/realtime/RealtimePage"
  }
  packageName="apps/web"
>
```

결과는 다음과 같다.

| 관점 | 화면 경계 |
| --- | --- |
| WebSocket / Polling | `Browser client · apps/web · RealtimeClient` 하나 |
| FSD-style | 기존 app/widget/feature/entity 경계 |
| Off | 경계 없음 |

## FSD 경계를 제거한 방법

기존 내부 경계는 WebSocket 모드까지 직접 활성화했다.

```tsx
enabled={xray || mode === "websocket"}
```

20-11에서는 기존 FSD 조건만 남겼다.

```tsx
enabled={xray}
```

WebSocket 모드에서 `xray`는 `false`이고 `websocketXray`만 `true`다. 따라서 최상위 브라우저 경계만 보이고 내부 FSD 경계는 보이지 않는다.

증거 패널을 감싸던 `feature/realtime/WebSocketPollingPipeline` X-RayBox도 삭제했다. 증거 패널은 통신 기능 그 자체가 아니라 통신 기능을 설명하는 React UI이기 때문이다.

## 실제 코드 실행 위치

### 브라우저: `apps/web`

`RealtimePage`의 `useEffect`가 연결 생명주기를 소유한다.

```text
WebSocket 생성
onopen/onmessage/onclose/onerror 등록
Polling fetch 실행
외부 JSON 검증
React events 상태 갱신
재연결
cleanup
```

### 서버: `apps/realtime-server`

독립 Node 서버가 두 통신 입구를 제공한다.

```text
WebSocket: upgrade /ws
Polling:   GET /events?after=id
```

서버는 이벤트를 최대 50개 보관하고 ID를 증가시킨다.

```js
const event = { id: ++nextEventId, message };
```

WebSocket 연결에는 새 이벤트를 즉시 broadcast한다. Polling 요청에는 `after`보다 ID가 큰 이벤트만 반환한다.

```js
events.filter((event) => event.id > after)
```

### 계약: `packages/api-types`

TypeScript 타입만으로는 네트워크에서 받은 JSON을 신뢰할 수 없다. 실행 중 실제 값을 검사하는 타입 가드를 사용한다.

```text
WebSocket 단건
→ isRealtimeEvent

Polling 목록 응답
→ isRealtimeEventListResponse
```

검증을 통과한 값만 `recordEvents`로 전달된다.

## 최초 연결 흐름

페이지가 렌더링되면 `useEffect`가 실행된다.

```tsx
useEffect(() => {
  let disposed = false;
  let pollingTimer;
  let socket;
  const nextUrls = getRealtimeUrls();
  // 연결 시작
}, [connectionRun]);
```

초기 상태는 다음과 같다.

```text
connection.mode = connecting
events = []
lastEventIdRef.current = 0
```

브라우저가 URL을 만든다.

```text
WebSocket: ws://현재호스트:3001/ws
Polling:   http://현재호스트:3001/events
```

배포 환경에서는 `NEXT_PUBLIC_REALTIME_WS_URL`과 `NEXT_PUBLIC_REALTIME_POLL_URL` 값이 우선한다.

## WebSocket 정상 경로

브라우저가 연결을 생성한다.

```tsx
socket = new WebSocket(nextUrls.websocket);
```

전체 정상 경로는 다음과 같다.

```text
Node realtime server
→ broadcast(event)
→ WebSocket text frame
→ 브라우저 socket.onmessage
→ event.data 문자열
→ JSON.parse
→ isRealtimeEvent
→ recordEvents([event])
→ React events state
→ 화면 이벤트 목록
```

### 연결 성공

```tsx
socket.onopen = () => {
  setConnection({
    mode: "websocket",
    detail: "WebSocket으로 실시간 이벤트를 수신 중입니다.",
  });
};
```

증거 패널은 이 실제 `connection.mode`를 받아 WebSocket 정상 경로를 초록색으로 강조한다.

### 메시지 검증

```tsx
socket.onmessage = (event) => {
  const realtimeEvent = parseRealtimeEvent(event.data);
  if (!realtimeEvent) {
    setError("WebSocket message shape is invalid.");
    return;
  }
  recordEvents([realtimeEvent]);
};
```

`parseRealtimeEvent`는 두 실패를 처리한다.

```text
JSON 문법 오류
→ JSON.parse에서 예외
→ undefined

JSON 형태 오류
→ isRealtimeEvent가 false
→ undefined
```

잘못된 데이터는 React 이벤트 목록에 들어가지 않는다.

## Polling fallback 경로

WebSocket 연결이 닫히면 `onclose`가 실행된다.

```tsx
socket.onclose = () => {
  if (!disposed) {
    startPolling(
      "WebSocket 연결이 닫혀 polling fallback으로 전환했습니다.",
    );
  }
};
```

전체 fallback 흐름은 다음과 같다.

```text
socket.onclose
→ startPolling
→ pollEvents
→ GET /events?after=마지막ID
→ HTTP status 확인
→ response.json
→ isRealtimeEventListResponse
→ recordEvents(data.events)
→ 요청 완료 후 3초 timer
→ 다음 pollEvents
```

### Cursor로 이어받기

마지막으로 반영한 이벤트가 24라면 다음 요청을 보낸다.

```text
GET /events?after=24
```

서버는 25 이상의 이벤트만 반환한다. WebSocket에서 이미 받은 이벤트를 Polling이 다시 화면에 추가하지 않도록 하는 이어받기 지점이다.

### 요청 중복 방지

다음 Polling은 현재 요청이 끝난 뒤 `finally`에서 예약한다.

```tsx
finally {
  if (!disposed) {
    pollingTimer = setTimeout(pollEvents, 3000);
  }
}
```

`setInterval`이 아니라 응답 완료 뒤 `setTimeout`을 사용하므로 느린 요청과 다음 요청이 겹치지 않는다.

### Polling 실패

HTTP 오류나 응답 형태 오류가 발생하면 상태가 `offline`이 된다.

```text
Polling 경로 카드
→ 빨간색 오류 표시

현재 전송 경로
→ WebSocket + HTTP unavailable
```

3초 뒤 다시 Polling을 시도하므로 일시적인 서버 장애가 복구되면 다시 `polling` 상태로 돌아올 수 있다.

## 두 경로를 합치는 `recordEvents`

WebSocket과 Polling은 데이터를 받는 방식만 다르다. 검증 뒤에는 같은 함수로 들어간다.

```text
WebSocket validated event ─┐
                           ├→ recordEvents
Polling validated events ──┘
```

`recordEvents`는 세 가지 일을 한다.

### 1. 이미 처리한 ID 제거

```tsx
const uniqueEvents = nextEvents.filter(
  (event) => event.id > lastEventIdRef.current,
);
```

### 2. 가장 큰 ID를 cursor에 저장

```tsx
lastEventIdRef.current = Math.max(
  lastEventId,
  ...uniqueEvents.map((event) => event.id),
);
```

### 3. 최신 12개만 화면 상태에 저장

```tsx
setEvents((current) =>
  [...uniqueEvents, ...current].slice(0, 12),
);
```

서버는 최근 50개를 보관하지만 브라우저 화면은 최신 12개만 렌더링한다. 전송 보관량과 UI 표시량은 서로 다른 책임이다.

## 현재 상태가 증거 패널에 연결되는 방법

패널은 별도 가짜 상태를 만들지 않는다.

```tsx
<WebSocketPollingEvidencePanel
  connection={connection}
  eventCount={events.length}
  lastEventId={lastEventIdRef.current}
  urls={urls}
/>
```

따라서 다음 값이 실제 연결과 함께 바뀐다.

```text
현재 연결 모드
연결 상세 문구
화면 이벤트 개수
마지막 cursor ID
WebSocket URL
Polling URL
강조되는 전송 경로
```

## 재연결

재연결 버튼은 cursor와 화면 상태를 초기화하고 `connectionRun`을 증가시킨다.

```tsx
function reconnect() {
  lastEventIdRef.current = 0;
  setEvents([]);
  setError(undefined);
  setConnectionRun((value) => value + 1);
}
```

React는 dependency가 바뀌면 다음 순서를 지킨다.

```text
기존 effect cleanup
→ 이전 socket close
→ 이전 polling timer 제거
→ 새 effect 실행
→ 새 WebSocket 연결
```

## cleanup

페이지 이동이나 재연결 시 다음 정리를 실행한다.

```tsx
return () => {
  disposed = true;
  socket?.close();
  if (pollingTimer) clearTimeout(pollingTimer);
};
```

`disposed`는 닫힌 이전 effect가 다시 Polling을 시작하거나 timer를 예약하지 못하게 막는다.

## 화면 증거 구성

### 하나의 실제 화면 경계

```text
Browser client · apps/web · RealtimeClient
```

브라우저가 상태와 화면을 소유한다는 뜻이다.

### 네 통신 책임 카드

```text
파랑: 브라우저 클라이언트
초록: 현재 성공한 전송 경로
주황: 독립 realtime 서버
보라: 계약 검증과 React 상태
```

### 두 실행 경로

```text
WebSocket 정상 경로
Polling fallback 경로
```

`connection.mode`에 맞는 경로만 강조한다. `offline`이면 Polling 경로를 빨간색으로 표시한다.

## 접근성

- 연결 상태 변화는 기존 `aria-live="polite"` 영역으로 전달한다.
- 연결 오류는 `role="alert"`로 전달한다.
- 이벤트 목록은 의미 있는 `<ol>`을 유지한다.
- 재연결은 실제 `<button>`이다.
- X-Ray 라벨은 기존 `aria-hidden="true"`라서 스크린 리더의 업무 화면 읽기를 방해하지 않는다.
- 색상 외에도 `WebSocket`, `Polling`, `Offline` 문자를 함께 표시한다.

## 반응형 화면

데스크톱에서는 통신 경계를 왼쪽에서 오른쪽으로 읽는다.

```text
client → transport ↔ server → contract/state
```

작은 화면에서는 한 열로 바꾸고 화살표를 아래로 회전한다.

```text
client
  ↓
transport
  ↓
server
  ↓
contract/state
```

## 변경 파일

```text
apps/web/app/realtime/page.tsx
apps/web/app/globals.css
docs/20-11-websocket-polling-xray-improvement.md
```

## 의도적으로 추가하지 않은 것

- 새 WebSocket wrapper
- 새 polling hook
- 새 Context나 상태 라이브러리
- 서버 상태를 흉내 내는 프런트 상태
- 서버를 화면 DOM처럼 감싼 가짜 X-RayBox
- 통신 디버깅 외부 패키지

기존 연결 코드, `connection` state, cursor ref, `XRayBox`만으로 요구를 충족할 수 있기 때문이다.

## 확인 순서

1. `/realtime?xray=websocket`에 접속한다.
2. 화면 X-Ray 라벨이 `Browser client · apps/web · RealtimeClient` 하나인지 확인한다.
3. `widget`, `feature`, `entity` 라벨이 없는지 확인한다.
4. 서버가 정상일 때 연결 상태가 `WebSocket`인지 확인한다.
5. WebSocket 정상 경로 카드가 강조되는지 확인한다.
6. heartbeat 또는 상태 변경 이벤트가 들어오는지 확인한다.
7. `events`와 `cursor`가 실제 수신에 따라 증가하는지 확인한다.
8. WebSocket 주소만 실패하게 설정하고 Polling 서버는 유지한다.
9. 연결 상태가 `Polling`으로 바뀌는지 확인한다.
10. `/events?after=cursor` 값이 마지막 ID를 사용하는지 확인한다.
11. Polling 경로 카드가 강조되는지 확인한다.
12. 두 서버 경로가 모두 실패하면 `Offline`과 빨간 fallback 카드를 확인한다.
13. 재연결 버튼을 눌러 cursor와 이벤트 목록이 초기화되는지 확인한다.
14. 다른 메뉴로 이동해 WebSocket X-Ray 경계가 따라오지 않는지 확인한다.

## 현재 한계

브라우저의 `WebSocket` API는 연결 과정의 모든 TCP frame이나 네트워크 패킷을 React에 제공하지 않는다. X-Ray는 애플리케이션이 실제로 소유한 연결 상태, URL, cursor, 검증 경로를 보여준다.

패킷 수준 분석이 필요해지는 시점에는 브라우저 Network 도구나 별도 관측 도구를 사용한다. 현재 학습 목표에는 애플리케이션의 정상 경로, fallback, 검증, 중복 방지, cleanup을 직접 연결해 보는 것으로 충분하다.
