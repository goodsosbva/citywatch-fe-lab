# 14. realtime-server 분리

14단계는 실시간 통신 코드를 Next.js 안에 넣지 않고, `apps/realtime-server`를 독립 실행 가능한 Node workspace로 분리했음을 증명한다.

실시간 기능 자체는 10단계에서 WebSocket 우선 연결과 polling fallback으로 구현했다. 당시 서버를 이미 별도 앱으로 만들었기 때문에 14단계에서는 같은 서버를 다시 만들거나 옮기지 않는다. 현재 경계를 확인하고 실행·연결·검증 방법을 명확히 남기는 것으로 분리를 완료한다.

## 1. 분리된 구조

```txt
apps/web
→ Next.js UI
→ WebSocket 또는 HTTP URL로만 realtime-server에 연결

apps/realtime-server
→ 독립 Node 프로세스
→ /ws, /events, /health 제공

packages/api-types
→ 브라우저가 수신한 실시간 payload를 검증하는 공유 계약
```

핵심 파일:

```txt
apps/realtime-server/package.json
apps/realtime-server/src/server.mjs
apps/realtime-server/src/websocket-frame.mjs
apps/realtime-server/src/websocket-frame.test.mjs
apps/web/app/realtime/page.tsx
packages/api-types/src/index.ts
```

`apps/web`은 서버 구현 파일을 import하지 않는다. 두 앱은 프로세스와 코드 경계가 분리되어 있고, 브라우저의 WebSocket·HTTP 요청과 JSON payload로만 통신한다.

## 2. 독립 workspace

`apps/realtime-server/package.json`은 서버 전용 workspace를 선언한다.

```json
{
  "name": "@citywatch/realtime-server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch src/server.mjs",
    "start": "node src/server.mjs",
    "test": "node --test src/websocket-frame.test.mjs"
  }
}
```

```txt
dev
→ 파일 변경을 감시하는 로컬 개발 실행

start
→ 감시 기능 없이 서버 프로세스 실행

test
→ WebSocket handshake와 text frame 인코딩 검증
```

루트의 `dev:realtime`은 이 workspace의 `dev` 명령만 위임한다.

```json
{
  "scripts": {
    "dev:realtime": "npm --workspace @citywatch/realtime-server run dev"
  }
}
```

루트가 서버 구현을 소유하는 것이 아니라 모노레포에서 실행 진입점만 제공한다.

## 3. 서버가 제공하는 경계

`apps/realtime-server/src/server.mjs`는 Node 표준 `http`, `crypto`만 사용한다.

```txt
GET /health
→ 서버 상태, 연결된 client 수, 보관 중인 event 수

GET /events?after={id}
→ 마지막으로 받은 ID보다 큰 event 목록

WebSocket /ws
→ 연결 후 실시간 event push
```

서버는 4초마다 heartbeat 또는 `incident.statusChanged` 메시지를 만든다. 최근 50개 event만 메모리에 보관하며, 서버가 재시작되면 event와 ID는 초기화된다.

이 제한은 학습 증명을 위한 현재 범위다. 운영 환경의 영속 큐나 메시지 브로커를 흉내 내지 않는다.

## 4. 웹 앱의 연결 방식

`apps/web/app/realtime/page.tsx`의 `getRealtimeUrls`가 서버 주소를 결정한다.

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

로컬에서는 기본 주소를 사용한다.

```txt
ws://127.0.0.1:3001/ws
http://127.0.0.1:3001/events
```

서버 주소가 달라지면 웹 코드를 수정하지 않고 환경변수로 연결 대상을 바꾼다.

```txt
NEXT_PUBLIC_REALTIME_WS_URL
NEXT_PUBLIC_REALTIME_POLL_URL
```

따라서 `apps/web`은 `apps/realtime-server`의 파일 위치나 내부 함수에 의존하지 않는다.

## 5. 런타임 흐름

두 프로세스를 각각 실행한다.

```bash
npm run dev:realtime
npm run dev:web
```

브라우저에서 다음 화면을 연다.

```txt
http://127.0.0.1:3000/realtime
```

전체 흐름:

```txt
apps/realtime-server 프로세스 시작
→ 127.0.0.1:3001 listen

apps/web 프로세스 시작
→ /realtime 페이지 제공

브라우저가 /realtime 접속
→ new WebSocket(ws://127.0.0.1:3001/ws)
→ realtime-server가 handshake 응답
→ event JSON 전송
→ 브라우저가 isRealtimeEvent로 payload 검증
→ 검증된 event만 화면에 표시

WebSocket 연결 종료
→ GET /events?after={lastEventId}
→ isRealtimeEventListResponse로 응답 검증
→ polling 방식으로 계속 갱신
```

## 6. 공유 계약의 역할

서버가 별도 프로세스라는 이유만으로 네트워크 payload를 신뢰하지 않는다.

`packages/api-types`에는 다음 계약이 있다.

```txt
RealtimeMessage
RealtimeEvent
RealtimeEventListResponse
isRealtimeEvent
isRealtimeEventListResponse
```

TypeScript 타입은 브라우저 실행 시 사라진다. 따라서 WebSocket 문자열을 `JSON.parse`한 뒤 `isRealtimeEvent`를 통과한 값만 state에 저장한다. Polling JSON도 `isRealtimeEventListResponse`를 통과해야 한다.

```txt
별도 프로세스
→ 네트워크 경계
→ runtime validation 필요
```

## 7. X-Ray에서 보이는 증거

`/realtime` 화면의 X-Ray에는 다음 경계가 표시된다.

```txt
app/realtime/RealtimePage
widget/RealtimeConnectionSummary
widget/RealtimeFeed
feature/realtime/ValidateRealtimeEvents
entity/realtime/RealtimeProof
```

증명 패널은 WebSocket, polling fallback, payload 검증과 함께 서버가 `apps/realtime-server` 독립 workspace라는 점을 표시한다.

X-Ray의 목적은 단순히 “실시간처럼 보이는 화면”을 보여주는 것이 아니라, 해당 화면이 별도 서버 프로세스와 어떤 계약으로 연결되는지 추적하게 하는 것이다.

## 8. 검증

전체 workspace 검증:

```bash
npm run test
npm run typecheck
npm run build
```

서버 workspace만 검증:

```bash
npm --workspace @citywatch/realtime-server test
npm --workspace @citywatch/realtime-server start
```

서버를 실행한 뒤 확인할 주소:

```txt
http://127.0.0.1:3001/health
http://127.0.0.1:3001/events?after=0
```

확인 기준:

```txt
web을 실행하지 않아도 /health와 /events가 응답
realtime-server를 종료해도 Next.js의 다른 페이지는 실행 가능
WebSocket이 닫히면 /realtime 화면이 polling으로 전환
잘못된 payload는 공유 타입 가드에서 차단
```

## 9. 현재 범위 밖

다음 항목은 별도 서버 분리를 증명하는 데 필요하지 않아 추가하지 않았다.

```txt
DB와 event 영속화
Redis Pub/Sub 또는 메시지 브로커
다중 realtime 서버
인증과 사용자별 구독 권한
WSS와 reverse proxy
heartbeat timeout
재연결 exponential backoff
backpressure
Docker와 별도 배포 파이프라인
```

운영 배포나 여러 서버 간 event 공유가 실제 요구사항이 될 때 추가한다.

## 최종 결과

```txt
Next.js UI
→ apps/web 독립 workspace

WebSocket/Polling 서버
→ apps/realtime-server 독립 workspace와 프로세스

실시간 payload 검증
→ packages/api-types

두 앱의 연결
→ WebSocket/HTTP URL과 JSON 계약
```

14단계의 핵심은 서버 코드를 더 많이 작성하는 것이 아니라, UI와 실시간 서버가 서로의 내부 구현을 import하지 않고 독립적으로 실행되는 경계를 증명하는 것이다.
