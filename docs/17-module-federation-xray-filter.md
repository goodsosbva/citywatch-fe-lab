# 17. Module Federation 시범 필터

## 무엇을 구현했는가

16단계에서 만든 X-Ray selector에 `Module Federation` 항목을 추가했다.

```txt
끄기
전체
FSD-style
Module Federation
```

`Module Federation`을 선택하면 홈 화면의 일반 `app`, `widget`, `feature`, `entity` 경계는 사라지고 `원격 사고 분석` 경계만 표시된다.

```txt
/?xray=module-federation
```

## 왜 별도의 proof가 필요한가

기존 X-Ray는 `enabled` boolean만 받았다.

```tsx
<XRayBox enabled={xray}>...</XRayBox>
```

이 값만으로는 X-Ray가 켜졌는지는 알 수 있지만 어떤 기술 관점에서 보여야 하는지는 판단할 수 없다. 그래서 화면의 책임 경계와 기술 증거를 구분하는 `XRayProof`를 추가했다.

```tsx
export type XRayProof = "fsd-style" | "module-federation";
type XRayMode = "off" | "all" | XRayProof;
```

`off`와 `all`은 selector 동작이고, `fsd-style`과 `module-federation`은 실제 경계가 소속되는 증거 ID다.

## selector에 Module Federation 추가

파일: `apps/web/app/xray-selector.tsx`

```tsx
<option value="module-federation">Module Federation</option>
```

URL에서 직접 접근할 때도 유효한 값으로 인정한다.

```tsx
function getXRayMode(value: string | null): XRayMode {
  return value === "off" ||
    value === "fsd-style" ||
    value === "module-federation"
    ? value
    : "all";
}
```

따라서 다음 주소가 `all`로 교정되지 않고 Module Federation 모드로 열린다.

```txt
http://127.0.0.1:3000/?xray=module-federation
```

## 경계 표시 판정 변경

16단계의 `useXRay`는 `off`가 아니면 모든 경계를 표시했다.

```tsx
enabled: mode !== "off"
```

17단계에서는 현재 경계가 선택된 proof에 속하는지 확인한다.

```tsx
export function useXRay(
  proofs: readonly XRayProof[] = ["fsd-style"],
) {
  const { mode } = useXRayContext();

  return {
    enabled:
      mode === "all" ||
      (mode !== "off" && proofs.includes(mode)),
    mode,
  };
}
```

기본 proof는 `fsd-style`이다. 기존 페이지가 모두 `useXRay()`를 사용하므로 별도 수정 없이 일반 경계로 분류된다.

```tsx
const { enabled: xray } = useXRay();
```

이 코드는 다음과 같다.

```tsx
const { enabled: xray } = useXRay(["fsd-style"]);
```

## 원격 분석만 독립적으로 판정

파일: `apps/web/app/analytics-remote-panel.tsx`

```tsx
export function AnalyticsRemotePanel({
  incidents,
}: {
  incidents: Incident[];
}) {
  const { enabled: xray } = useXRay([
    "module-federation",
  ]);
```

이전에는 홈에서 계산한 `xray` boolean을 prop으로 받았다.

```tsx
<AnalyticsRemotePanel
  incidents={incidents}
  xray={xray}
/>
```

그러면 홈의 FSD-style 판정과 원격 경계가 같은 값에 묶이므로 두 관점을 분리할 수 없다. 변경 후 원격 패널은 자신의 proof를 직접 선언하고 현재 selector와 비교한다.

```tsx
<AnalyticsRemotePanel incidents={incidents} />
```

## DOM에 proof 근거 저장

파일: `packages/ui/src/xray.tsx`

`XRayBox`에 `proofs` prop을 추가했다.

```tsx
export type XRayBoxProps = {
  proofs?: string[];
  // 기존 props
};
```

별도 proof를 전달하지 않은 기존 경계는 `fsd-style`을 기본값으로 기록한다.

```tsx
proofs = ["fsd-style"]
```

활성화된 X-Ray DOM에는 공백으로 구분한 proof ID를 기록한다.

```tsx
data-xray-proofs={proofs.join(" ")}
```

원격 분석 경계는 다음처럼 선언한다.

```tsx
<XRayBox
  enabled={xray}
  label="remote/analytics/CalculateIncidentAnalytics"
  layer="remote"
  packageName="apps/analytics-remote"
  proofs={["module-federation"]}
  stacks={[
    "Module Federation",
    "Vite Remote",
    "Runtime Manifest",
  ]}
>
```

브라우저 DOM에서 다음 근거를 확인할 수 있다.

```html
<div
  data-xray-layer="remote"
  data-xray-label="remote/analytics/CalculateIncidentAnalytics"
  data-xray-package="apps/analytics-remote"
  data-xray-proofs="module-federation"
  data-xray-stacks="Module Federation,Vite Remote,Runtime Manifest"
>
```

`proofs`는 필터가 사용하는 안정적인 ID이고 `stacks`는 사람이 읽는 기술 설명이다. 표시 문자열이 바뀌어도 필터가 깨지지 않도록 두 책임을 분리했다.

## 모드별 실제 결과

```txt
off
→ 일반 경계 false
→ remote 경계 false
→ X-Ray 없음

all
→ mode === all
→ 일반 경계 true
→ remote 경계 true
→ 모든 X-Ray 표시

fsd-style
→ 기본 proofs에 fsd-style 포함
→ 일반 경계 true
→ remote proofs에는 없음
→ FSD-style 경계만 표시

module-federation
→ 기본 proofs에는 없음
→ 일반 경계 false
→ remote proofs에 module-federation 포함
→ 원격 사고 분석만 표시
```

부모 `app/home/HomePage` 경계가 비활성화돼도 `XRayBox`는 자식을 삭제하지 않고 Fragment로 반환한다.

```tsx
if (!enabled) {
  return <>{children}</>;
}
```

따라서 부모 경계가 숨겨져도 내부의 원격 분석 패널은 독립적으로 Module Federation 경계를 표시할 수 있다.

## 실행과 확인

Terminal 1:

```powershell
cd "C:\Users\admin\Desktop\side\CityWatchFELab"
npm run dev:web
```

Terminal 2:

```powershell
cd "C:\Users\admin\Desktop\side\CityWatchFELab"
npm run dev:remote
```

브라우저:

```txt
http://127.0.0.1:3000/?xray=module-federation
```

확인 항목:

```txt
selector 값이 Module Federation이다.
URL에 xray=module-federation이 유지된다.
일반 FSD-style 테두리가 보이지 않는다.
원격 사고 분석의 주황색 remote 테두리만 보인다.
해당 DOM에 data-xray-proofs="module-federation"이 있다.
```

## 검증 결과

```txt
npm run typecheck 통과
npm test 통과: 8 tests
npm run build 통과
git diff --check 통과

Module Federation 선택: 전체 X-Ray 1개, remote proof 1개
FSD-style 선택: 전체 X-Ray 5개, remote proof 0개
전체 선택: 전체 X-Ray 6개, remote proof 1개
끄기 선택: 전체 X-Ray 0개
/map 이동: xray=module-federation과 selector 선택값 유지, 표시 경계 0개
```

## 아직 하지 않은 것

증거 설명 패널, 코드 링크, Monorepo와 다른 기술 proof는 아직 추가하지 않았다. 17단계는 하나의 실제 기술을 이용해 selector의 proof 필터 구조가 작동함을 확인하는 시범 단계다.
