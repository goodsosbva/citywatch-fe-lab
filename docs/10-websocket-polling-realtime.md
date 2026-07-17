# 10. WebSocket/Polling 실시간 처리

이 문서는 10단계에서 실시간 사고 피드를 붙인 흐름을 정리한다.

코드 실행 순서를 더 자세히 따라가는 설명은 `docs/10-websocket-polling-code-walkthrough.md`에 정리한다.

## 1. 지금까지 한 것

9단계까지는 다음이 완료되어 있었다.

```txt
REST API
Redux 필터/선택 상태
OpenLayers 지도 관제
RealtimeMessage 공유 타입
apps/realtime-server 자리
```

## 2. 이번에 구현한 것

이번 단계에서 추가한 것은 다음이다.

```txt
apps/realtime-server Node 서버
GET /health
GET /events?after=id
WebSocket /ws
/realtime 실시간 피드 화면
WebSocket 실패 시 polling fallback
수신 payload runtime validation
X-Ray 라벨로 실시간 기능 출처 표시
```

핵심 파일:

```txt
apps/realtime-server/src/server.mjs
apps/realtime-server/src/websocket-frame.mjs
apps/web/app/realtime/page.tsx
packages/api-types/src/index.ts
packages/api-types/test/risk-score.test.ts
```

## 3. 왜 이걸 했는지

관제 시스템에서 실시간 처리는 새 사고, 상태 변경, 연결 장애 대응을 보여줘야 한다.

그래서 화면은 WebSocket만 보여주지 않는다.

```txt
정상 상태
→ WebSocket으로 이벤트 수신

WebSocket 실패/종료
→ /events?after=id polling fallback

잘못된 payload
→ 공유 타입 가드에서 차단
```

## 4. 어떻게 세팅했는지

새 WebSocket 의존성은 추가하지 않았다.

```txt
Node http
Node crypto
직접 WebSocket handshake
직접 text frame encode
```

Ponytail 기준으로 `ws` 패키지는 아직 넣지 않았다. 현재 목표는 대규모 realtime 서버가 아니라 FE 학습 증명이다.

## 5. 실행 흐름

루트에서 두 프로세스를 켠다.

```bash
npm run dev:realtime
npm run dev:web
```

브라우저:

```txt
http://127.0.0.1:3000/realtime
```

동작:

```txt
/realtime 접속
→ ws://127.0.0.1:3001/ws 연결
→ RealtimeEvent 수신
→ isRealtimeEvent 검증
→ 이벤트 목록 표시

WebSocket close/error
→ http://127.0.0.1:3001/events?after={lastEventId} polling
→ isRealtimeEventListResponse 검증
→ lastEventId보다 큰 이벤트만 화면에 표시
```

## 6. 검증 방법

```bash
npm run test
npm run typecheck
npm run build
```

서버만 확인:

```bash
npm run dev:realtime
```

```txt
http://127.0.0.1:3001/health
http://127.0.0.1:3001/events
```

## 7. 아직 안 한 것

아직 실제 공공 데이터나 DB와 연결하지 않았다.

```txt
실제 사고 생성 broadcast
서울시/공공 API polling
인증/권한
서버 재시작 후 이벤트 보존
```

이건 10단계 핵심이 아니다. 지금은 WebSocket lifecycle, polling fallback, payload validation을 증명하는 것이 목적이다.
