# 16. X-Ray Selector 기본형

## 무엇을 구현했는가

기존 페이지별 `X-Ray: On/Off` 버튼을 다음 세 가지 값을 가진 selector로 교체했다.

```txt
끄기
전체
FSD-style
```

선택값은 루트 `XRayProvider`가 관리하고 URL의 `xray` query parameter에 기록한다.

```txt
/?xray=off
/?xray=all
/?xray=fsd-style
```

## 왜 전역 Provider가 필요한가

기존에는 홈, 사고 목록, 지도, 실시간, 3D, 성능 페이지가 각각 `useState(true)`를 가지고 있었다. 따라서 한 페이지에서 X-Ray를 꺼도 다른 페이지로 이동하면 다시 켜졌다.

`XRayProvider`를 루트 layout에 한 번 연결하면 페이지가 바뀌어도 같은 상태를 공유할 수 있다. 선택값을 URL에도 기록하므로 현재 검사 관점을 주소에서 확인할 수 있고, 이후 특정 기술 관점을 직접 여는 링크로 확장할 수 있다.

## 코드 위치

```txt
apps/web/app/xray-selector.tsx
X-Ray mode, Provider, selector, useXRay hook, URL 동기화

apps/web/app/layout.tsx
모든 페이지를 XRayProvider로 감싸는 위치

apps/web/app/globals.css
selector 스타일

apps/web/app/shell.tsx
apps/web/app/incidents/page.tsx
apps/web/app/incidents/new/page.tsx
apps/web/app/incidents/incident-detail-view.tsx
apps/web/app/map/page.tsx
apps/web/app/realtime/page.tsx
apps/web/app/risk-3d/page.tsx
apps/web/app/performance/page.tsx
페이지별 XRayToggle을 공통 XRaySelector로 교체한 위치
```

## 실행 흐름

```txt
브라우저가 페이지를 연다
→ XRayProvider가 URL의 xray 값을 읽는다
→ 유효하지 않거나 없는 값은 all로 정규화한다
→ XRaySelector가 현재 값을 표시한다
→ useXRay가 off 여부를 enabled boolean으로 변환한다
→ 기존 XRayBox가 enabled 값에 따라 경계와 라벨을 표시하거나 제거한다
→ 페이지 이동 시 Provider가 현재 mode를 새 URL에 다시 기록한다
```

기존 `XRayBox` 구현은 수정하지 않았다. 각 화면이 이미 `enabled={xray}`를 사용하고 있었기 때문에 상태 공급자만 로컬 state에서 공통 hook으로 바꿨다.

## 현재 각 옵션의 의미

`끄기`는 모든 X-Ray 경계와 라벨을 제거한다.

`전체`는 현재 등록된 모든 X-Ray 경계를 표시한다. 여기에는 FSD-style 경계와 analytics remote 경계가 포함된다.

`FSD-style`은 현재 16단계에서는 기존 경계를 표시한다. 기술별 `proofs` 분류가 아직 없기 때문에 `전체`와 시각 결과가 같다. 17단계부터 Module Federation 같은 명시적 proof ID를 추가하면 두 모드의 결과가 분리된다.

## 실행과 확인

```powershell
cd "C:\Users\admin\Desktop\side\CityWatchFELab"
npm run dev:web
```

브라우저에서 다음 주소를 확인한다.

```txt
http://127.0.0.1:3000/?xray=off
http://127.0.0.1:3000/?xray=all
http://127.0.0.1:3000/?xray=fsd-style
```

확인 항목:

```txt
끄기 선택 시 data-xray-label 요소가 사라진다.
전체와 FSD-style 선택 시 기존 경계가 보인다.
지도, 실시간, 3D, 성능, 사고 페이지로 이동해도 선택값이 유지된다.
현재 URL에 xray query parameter가 유지된다.
```

## 검증 결과

```txt
npm run typecheck 통과
npm test 통과: 8 tests
npm run build 통과
git diff --check 통과
```

## 아직 하지 않은 것

Module Federation, Monorepo, OpenLayers 같은 기술별 `proofs` 분류는 추가하지 않았다. 증거 패널도 아직 없다. 이 단계는 이후 필터를 붙일 수 있는 전역 선택 상태와 URL 기반을 만드는 데까지만 책임진다.
