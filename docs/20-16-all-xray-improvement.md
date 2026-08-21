# 20-16. 전체(All) X-Ray 개선

## 큰 그림

기존 `전체` 모드는 현재 페이지의 모든 `XRayBox`를 동시에 표시했다.

```text
app
└─ widget
   └─ feature
      └─ entity
```

여기에 기술별 경계까지 더해지면 사용자는 기술 흐름보다 중첩된 테두리를 먼저 보게 된다. 20-16은 `전체`의 역할을 다음처럼 바꾼다.

```text
전체 모드
→ 테두리와 라벨을 겹쳐 표시하지 않음
→ 현재 DOM에 존재하는 X-Ray 메타데이터 수집
→ 현재 화면의 기술과 실행 패키지를 요약

개별 기술 모드
→ 해당 기술의 실제 경계와 증거 패널 표시
```

## 변경 파일

```text
apps/web/app/xray-selector.tsx
apps/web/app/layout.tsx
apps/web/app/globals.css
docs/20-16-all-xray-improvement.md
```

페이지별 기술 목록이나 새로운 전역 store는 추가하지 않았다.

## 1. 기존 XRayBox 메타데이터 재사용

활성화된 `XRayBox`는 이미 다음 정보를 DOM에 기록한다.

```html
<div
  class="cw-xray-box"
  data-xray-package="apps/web"
  data-xray-stacks="React,REST API,TypeScript"
>
```

`AllXRaySummary`는 새로운 기술 registry를 만들지 않고 현재 DOM의 `.cw-xray-box`만 조회한다.

```ts
const boxes = document.querySelectorAll<HTMLElement>(".cw-xray-box");
```

현재 렌더링되지 않은 컴포넌트는 DOM에 `XRayBox`도 없으므로 요약에 들어오지 않는다.

## 2. 중복 제거

한 페이지의 여러 경계가 `React`, `TypeScript`, `apps/web`을 반복해서 기록할 수 있다. 요약에서는 `Set`으로 중복을 제거한다.

```text
widget stacks: React, TypeScript
feature stacks: React, REST API

Set 결과
→ React
→ REST API
→ TypeScript
```

패키지도 같은 방식으로 한 번만 표시한다.

```text
apps/web
ol
@react-three/fiber
apps/analytics-remote
```

실제로 현재 페이지에 존재하는 패키지만 결과에 포함된다.

## 3. 동적 화면 상태 반영

페이지는 처음 렌더된 뒤에도 구조가 바뀐다.

```text
Module Federation Remote 로드 성공
2D 지도 → 3D 장면 전환
로딩 UI → 성공 UI 전환
페이지 route 이동
```

따라서 최초 한 번만 DOM을 읽으면 현재 상태와 달라질 수 있다. `MutationObserver`가 다음 변화를 관찰한다.

```text
childList
→ 컴포넌트 추가·제거

data-xray-package
→ 실제 실행 패키지 변경

data-xray-stacks
→ 현재 기술 조합 변경
```

변화가 연속으로 발생하면 매번 바로 수집하지 않고 `requestAnimationFrame` 하나로 합친다.

```text
DOM 변화 여러 건
→ 기존 예약 frame 취소
→ 다음 animation frame에서 한 번 수집
```

수집 결과가 이전 배열과 같으면 기존 React state를 그대로 반환한다. 같은 정보 때문에 요약 패널을 다시 렌더링하지 않는다.

## 4. All 모드 시각 정책

`All`에서도 XRayBox가 DOM 메타데이터를 제공해야 하므로 `enabled` 정책은 유지한다. 대신 All 모드에서 시각 요소만 제거한다.

```css
body[data-xray-mode="all"] .cw-xray-box {
  outline: 0;
}

body[data-xray-mode="all"] .cw-xray-label {
  display: none;
}
```

따라서 다음이 동시에 성립한다.

```text
사용자 화면
→ 중첩 테두리 없음
→ 중첩 라벨 없음

DOM
→ data-xray-package 유지
→ data-xray-stacks 유지
→ 현재 기술 요약 가능
```

## 5. 공통 layout 연결

`RootLayout`은 모든 페이지가 공유한다.

```tsx
<AppNavigation />
{children}
<AllXRaySummary />
<MonorepoWorkspaceMap />
```

요약 패널을 각 페이지에 복사하지 않고 layout에 한 번만 배치했다. `AllXRaySummary` 내부에서 현재 mode를 확인하므로 다른 X-Ray 모드에서는 아무것도 렌더링하지 않는다.

```ts
if (mode !== "all") return null;
```

## 6. 사용자에게 보이는 정보

요약 패널은 두 그룹을 표시한다.

```text
기술
→ 현재 XRayBox들의 data-xray-stacks 합집합

실행 패키지
→ 현재 XRayBox들의 data-xray-package 합집합
```

`All`은 개별 코드 흐름을 모두 펼치지 않는다. 사용자가 상단 X-Ray select에서 하나의 기술을 선택하면 기존 대표 화면 이동과 해당 기술의 경계·증거 패널이 작동한다.

## 7. 접근성과 반응형 처리

요약 전체는 제목과 연결된 `section`이고, 기술과 패키지는 실제 `ul`·`li` 목록이다.

```text
aria-labelledby="all-xray-title"
aria-live="polite"
ul → li 기술 chip
```

기술 목록이 비어 있는 짧은 초기 구간에는 `role="status"`로 확인 중 상태를 제공한다.

데스크톱에서는 기술과 패키지를 2열로, 760px 이하에서는 1열로 표시한다.

## 8. 전체 실행 흐름

```text
?xray=all 진입
→ getXRayMode("all")
→ body[data-xray-mode="all"] 설정
→ 현재 페이지 XRayBox 렌더링
→ CSS가 box outline과 label 숨김
→ AllXRaySummary effect 실행
→ 현재 .cw-xray-box 조회
→ package와 stacks Set 수집
→ 정렬된 배열로 React state 갱신
→ 현재 화면 기술 요약 렌더링
```

페이지 내부 상태나 route가 바뀌면 다음 순서로 이어진다.

```text
DOM 또는 X-Ray 속성 변경
→ MutationObserver
→ requestAnimationFrame
→ 현재 DOM 재수집
→ 값이 달라진 경우에만 요약 갱신
```

## 9. 직접 확인

1. `/?xray=all`에 접속한다.
2. 기존 app·widget·feature 중첩 테두리가 보이지 않는지 확인한다.
3. 화면 아래의 `현재 화면 기술 요약`을 확인한다.
4. 지도 관제로 이동한다.
5. 현재 요약에 `OpenLayers`와 `ol`이 포함되는지 확인한다.
6. 3D 위험 구역에서 2D와 3D 보기를 전환한다.
7. 현재 DOM의 패키지와 기술 변화가 요약에 반영되는지 확인한다.
8. X-Ray에서 개별 기술을 선택한다.
9. All 요약이 사라지고 해당 기술의 실제 경계와 증거 패널만 표시되는지 확인한다.

## 10. 하지 않은 것

```text
페이지별 기술 배열 중복 작성
새 Redux slice
새 Context
새 X-Ray registry
모든 기술 증거 패널 동시 렌더링
DOM에 없는 기술을 추정해 표시
```

현재 `XRayBox`가 이미 가진 메타데이터와 브라우저 표준 `MutationObserver`만 사용한다.
