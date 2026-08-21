# 21. 구현 상태와 한계 표시

## 목적

21단계는 새 기술을 추가하는 단계가 아니다. 지금까지 만든 기술을 모두 같은 의미의 `완료`로 부르지 않고, 실행 근거와 현재 한계를 함께 공개하는 단계다.

```text
구현 완료
→ 약속한 학습 범위의 실행 화면·코드·검증 근거가 있음

부분 구현
→ 일부 개념과 시각 증거는 있으나 정식 구조 전체를 증명하지 못함

예정 · 미증명
→ 이름이나 라벨만으로 완료 처리할 수 없고 실제 구현이 필요함
```

`구현 완료`는 프로덕션 준비 완료라는 뜻이 아니다. 각 기술 카드에는 현재 근거와 함께 운영 수준에서 남은 한계를 반드시 표시한다.

## 사용자 진입점

상단 메뉴에 `구현 상태`를 추가했다.

```text
http://127.0.0.1:3000/status
```

화면의 상태 카드는 다음 구조다.

```text
기술명
상태 badge
현재 근거
현재 한계
실행 화면에서 확인 링크
```

## 상태 판정

### 구현 완료

```text
Module Federation
Monorepo
OpenLayers
R3F / Three.js
WebSocket / Polling
REST API
Redux Toolkit
Zod Validation
Performance
Storybook
Unit Test
```

각 항목은 실행 화면, 실제 코드 또는 실행 가능한 검사 중 적절한 근거가 있다. 단, 메모리 저장소·인증 부재·fixture 데이터·E2E 부재 같은 한계까지 카드에 함께 표시한다.

### 부분 구현

```text
FSD migration coverage
```

22단계에서 incident 핵심 흐름은 실제 FSD slice와 Public API로 이동했다. 다만 일부 페이지 전용 UI는 아직 Next route 폴더에 함께 있으므로 전 화면의 이동 범위는 부분 구현으로 남긴다.

따라서 `incident vertical slice의 정식 FSD`와 `전체 화면의 FSD 전환 범위`를 구분한다.

### 예정 · 미증명

```text
의미 있는 SSR 데이터 렌더링
```

정식 FSD는 22단계에서 `page → widget → feature → entity` incident vertical slice의 실제 구조, Public API, 하향 의존 검사까지 구현해 완료로 변경했다.

SSR은 Next.js를 사용한다는 사실만으로 완료되지 않는다. 현재 주요 데이터 화면은 `use client`와 브라우저 `fetch`를 사용한다. 23단계에서 서버 데이터 요청, 서버 HTML 결과, client hydration 경계를 실제 코드와 화면으로 증명해야 한다.

## 구현 구조

상태 데이터는 `/status/page.tsx` 한 파일에 둔다. 현재 한 화면만 소비하므로 registry, API, Redux 상태를 추가하지 않았다.

```ts
type ImplementationItem = {
  name: string;
  state: "complete" | "partial" | "planned";
  evidence: string;
  limit: string;
  href?: string;
};
```

화면은 상태별로 항목을 나누고 기존 `Badge`, `panel`, `nav-link`를 재사용한다.

```text
implementationItems
→ 상태별 개수 계산
→ complete / partial / planned 필터
→ StatusSection
→ 기술별 현재 근거와 한계 렌더링
```

## 오해 방지 기준

다음 표현을 사용하지 않는다.

```text
Next.js 사용 → SSR 완료
FSD 이름의 라벨 존재 → 정식 FSD 완료
클러스터 사용 → 성능 검증 완료
Unit Test 존재 → 전체 앱 품질 보장
WebSocket 동작 → 운영 실시간 시스템 완료
```

대신 실제 구현 범위를 제한해서 표현한다.

```text
주요 데이터 화면은 client fetch
FSD-style 책임 경계
fixture에서 marker·DOM 범위 확인
핵심 순수 로직과 계약 Unit Test
메모리 이벤트 기반 WebSocket/Polling 학습 구현
```

## 접근성과 반응형

상태 그룹은 실제 `section`과 제목으로 구분하고, 상세 정보는 의미에 맞는 `dl`, `dt`, `dd`를 사용한다. 실행 화면 이동은 실제 `Link`다.

데스크톱에서는 카드가 2열이며 760px 이하에서는 1열로 바뀐다. 상태 요약 숫자는 좁은 화면에서도 세 칸을 유지하되 전체 폭 안에서 줄어든다.

## 직접 확인

1. `/status?xray=all`에 접속한다.
2. 완료·부분·예정 개수가 각각 표시되는지 확인한다.
3. 각 완료 카드에 `현재 근거`와 `현재 한계`가 함께 있는지 확인한다.
4. FSD migration coverage가 부분 구현인지 확인한다.
5. 정식 FSD는 완료이고 SSR만 예정·미증명인지 확인한다.
6. `실행 화면에서 확인`을 눌러 해당 X-Ray 대표 화면으로 이동하는지 확인한다.
7. 모바일 폭에서 카드가 한 열로 바뀌는지 확인한다.

## 다음 단계로 상태를 바꾸는 조건

### 22. 정식 FSD

```text
실제 slice 폴더 구조
→ 계층 간 의존 방향
→ public API
→ 기존 기능 회귀 검증
→ X-Ray가 실제 구조를 가리키는지 확인
```

22단계에서 위 조건을 incident vertical slice에 구현했으며 `정식 FSD`를 완료로 바꿨다. 전체 화면의 이동 범위는 별도 부분 구현 항목으로 남긴다.

### 23. SSR

```text
서버 데이터 요청
→ 서버 컴포넌트에서 HTML 생성
→ client hydration 경계 분리
→ 브라우저 JavaScript 전후 결과 확인
```

이 조건을 실제로 증명한 뒤 `의미 있는 SSR 데이터 렌더링`을 완료로 바꾼다.
