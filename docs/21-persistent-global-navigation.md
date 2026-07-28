# 21. 페이지가 바뀌어도 동일한 전역 메뉴

## 문제

기존에는 각 페이지가 `topbar-actions` 안에 이동 링크와 `XRaySelector`를 직접 작성했다.

```txt
홈          → 지도, 3D, 실시간, 대량 관제, 사고 목록
지도        → 3D, 사고 목록, 실시간, 관제 홈
사고 등록   → 사고 목록, 관제 홈
사고 상세   → 사고 목록
```

그래서 페이지를 이동할 때 메뉴의 항목, 순서, 강조가 모두 바뀌었다. 사용자는 다음 메뉴가 어디에 나타날지 다시 찾아야 했고, 현재 페이지는 메뉴에서 사라지기도 했다.

## 선택한 구조

Next App Router의 루트 layout에 전역 메뉴를 한 번만 렌더링한다.

```txt
RootLayout
└─ StoreProvider
   └─ XRayProvider
      ├─ AppNavigation
      └─ 현재 페이지
```

루트 layout은 하위 페이지가 바뀌어도 공통 UI를 유지하는 위치다. 메뉴를 각 페이지가 아니라 여기에 두면 모든 경로가 같은 메뉴 인스턴스와 순서를 사용한다.

`AppNavigation`은 `XRayProvider` 안에 둬야 한다. 메뉴 안의 `XRaySelector`와 `useXRay()`가 이 Context를 읽기 때문이다.

## 메뉴 설정 위치

파일: `apps/web/app/app-navigation.tsx`

```tsx
const navigationItems = [
  ["/", "관제 홈"],
  ["/incidents", "사고 목록"],
  ["/incidents/new", "사고 등록"],
  ["/map", "지도 관제"],
  ["/risk-3d", "3D 위험 구역"],
  ["/realtime", "실시간 피드"],
  ["/performance", "대량 관제"],
] as const;
```

메뉴 이름, 주소, 순서를 이 배열 하나에서 관리한다. 새 메뉴가 실제로 필요할 때만 이 배열에 한 줄을 추가하면 된다.

## 현재 페이지 표시

현재 페이지도 메뉴에서 제거하지 않는다. `usePathname()`의 현재 경로와 메뉴 주소가 정확히 같을 때만 활성화한다.

```tsx
const active = pathname === href;
```

`/incidents/new`에서는 사고 등록을 표시한다. `/incidents/INC-001`처럼 메뉴에 없는 상세 경로에서는 어떤 전역 메뉴도 활성화하지 않는다.

활성 링크에는 접근성 표준 속성을 넣는다.

```tsx
<Link
  aria-current={active ? "page" : undefined}
  className={`nav-link${active ? " nav-link--active" : ""}`}
  href={`${href}?xray=${mode}`}
>
  {label}
</Link>
```

`aria-current="page"`는 화면 색상만 바꾸는 것이 아니라 보조 기술에도 현재 페이지임을 전달한다.

## X-Ray 상태 유지

`AppNavigation`은 현재 X-Ray mode를 읽어 모든 링크에 query를 포함한다.

```tsx
const { mode } = useXRay();

href={`${href}?xray=${mode}`}
```

따라서 `Monorepo`를 선택한 뒤 3D 페이지로 이동하면 다음 주소가 된다.

```txt
/risk-3d?xray=monorepo
```

X-Ray selector 자체의 대표 페이지 이동 규칙은 수정하지 않았다.

```txt
Monorepo 선택 → 홈으로 한 번 이동
이후 3D 메뉴 클릭 → 3D 페이지 유지
X-Ray 때문에 다시 홈으로 돌아가지 않음
```

## RootLayout 연결

파일: `apps/web/app/layout.tsx`

```tsx
<StoreProvider>
  <XRayProvider>
    <AppNavigation />
    {children}
  </XRayProvider>
</StoreProvider>
```

`AppNavigation`을 `{children}` 위에 두어 모든 페이지의 공통 상단 메뉴로 만든다.

## 페이지에서 제거한 코드

다음 화면에 중복되어 있던 `topbar-actions` 메뉴와 `XRaySelector`를 제거했다.

```txt
홈
사고 목록
사고 등록
사고 상세
지도 관제
3D 위험 구역
실시간 피드
대량 관제
```

본문의 상세 보기, 전체 보기, 취소처럼 페이지 기능에 필요한 `Link`는 제거하지 않았다. 전역 이동 메뉴만 공통 컴포넌트로 옮겼다.

## 반응형과 접근성

파일: `apps/web/app/globals.css`

데스크톱에서는 메뉴와 X-Ray 도구를 한 줄에 표시한다.

```css
.app-navigation {
  align-items: center;
  display: flex;
}
```

폭이 `760px` 이하이면 메뉴 순서를 유지한 채 가로 스크롤을 사용하고 X-Ray를 다음 줄에 둔다.

```css
.app-navigation__links {
  display: flex;
  overflow-x: auto;
}

@media (max-width: 760px) {
  .app-navigation {
    align-items: stretch;
    flex-direction: column;
  }
}
```

별도 햄버거 메뉴, 열림 상태, 외부 라이브러리는 추가하지 않았다.

## 실행 흐름

```txt
브라우저가 아무 페이지를 연다
→ RootLayout이 AppNavigation을 렌더링한다
→ usePathname이 현재 경로를 읽는다
→ 7개 메뉴는 항상 같은 순서로 표시된다
→ 현재 경로와 일치하는 링크만 활성화된다
→ 링크 클릭 시 X-Ray query와 함께 다음 페이지로 이동한다
→ 페이지 본문만 바뀌고 전역 메뉴 구조는 유지된다
```

## 검증

```txt
npm run typecheck 통과
git diff --check 통과
라우팅 메뉴와 XRaySelector가 AppNavigation 한 곳에만 존재함
홈 → 지도 이동 후 메뉴 7개와 순서 동일
현재 메뉴에 aria-current="page" 적용
Monorepo 선택 시 홈 이동 유지
Monorepo 상태에서 3D 메뉴 이동 성공, 홈으로 재고정되지 않음
390px 화면에서 메뉴 가로 스크롤과 X-Ray 표시 확인
브라우저 console error 없음
```
