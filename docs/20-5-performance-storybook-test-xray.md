# 20-5. Performance X-Ray / Storybook / Unit Test

20-5는 성능 도구나 테스트 프레임워크를 새로 설치하는 단계가 아니다. 실제 사이트 화면에서 실행되는 대량 데이터 처리만 X-Ray에 연결하고, Storybook과 Unit Test는 별도 개발 도구로 문서에서 설명한다.

```txt
Large Data Performance → /performance
Storybook             → 별도 :6006 개발 서버
Unit Test             → 터미널 또는 CI
```

새 의존성, 새 서버, 새 전역 상태, 새 성능 측정 라이브러리는 추가하지 않았다. Storybook과 Unit Test는 사이트 X-Ray에 가짜 증거 패널을 만들지 않는다.

## 1. 이번 단계에서 추가된 기능

X-Ray selector에는 화면에서 직접 증명할 수 있는 성능 관점 하나만 추가했다.

```txt
Large Data Performance
```

선택하면 다음 대표 화면으로 한 번 안내한다.

```txt
?xray=performance → /performance
```

페이지를 고정하지는 않는다. 선택 후 다른 메뉴를 누르면 사용자가 선택한 route로 이동하고 `xray` query만 유지된다.

변경 파일은 세 개다.

```txt
apps/web/app/xray-selector.tsx
apps/web/app/performance/page.tsx
docs/20-5-performance-storybook-test-xray.md
```

## 2. 세 기술이 해결하는 문제

### 2.1 Large Data Performance

데이터가 많을 때 중요한 것은 “배열 길이” 하나가 아니다. 데이터가 화면으로 가는 동안 서로 다른 비용이 생긴다.

```txt
서버 생성 비용
→ JSON 직렬화와 네트워크 전송 비용
→ 브라우저 메모리 비용
→ React element와 DOM 생성 비용
→ 지도 Feature와 화면 그리기 비용
```

이 프로젝트는 모든 비용을 한 기술로 해결하지 않는다.

```txt
서버 fixture       → 5,000/10,000건의 재현 가능한 데이터
OpenLayers Cluster → 가까운 지도 점을 묶어 화면 마커 수 감소
Virtual Rendering  → 현재 화면 주변 목록 행만 DOM 생성
3D detail          → 전체가 아니라 선택 사고 하나만 R3F로 표현
```

### 2.2 Storybook

Storybook은 전체 앱을 실행하지 않고 UI 컴포넌트 하나를 독립된 화면에서 확인하는 개발 도구다.

```txt
전체 앱 페이지
→ router, API, 페이지 상태가 함께 필요

Storybook Story
→ 컴포넌트 + props + 예제 상태만 실행
```

따라서 Badge의 색상 종류, SeverityBadge의 모든 심각도, X-Ray 토글 동작을 페이지를 찾아다니지 않고 한곳에서 볼 수 있다.

### 2.3 Unit Test

Unit Test는 작은 함수나 계약에 입력을 주고 기대 결과를 자동 비교한다.

```txt
준비한 입력
→ 테스트 대상 함수
→ 실제 반환값
→ expect로 기대값 비교
→ 성공 또는 실패 exit code
```

Storybook은 사람이 UI를 보고 조작하기 좋고, Unit Test는 같은 검사를 반복해서 빠르게 실행하기 좋다. 둘은 대체 관계가 아니라 서로 다른 실패를 잡는다.

## 3. X-Ray selector의 뿌리

### 3.1 타입이 허용값을 정한다

`apps/web/app/xray-selector.tsx`의 `XRayProof`에 다음 문자열을 추가했다.

```ts
| "performance"
```

`XRayMode`는 다음 구조다.

```ts
type XRayMode = "off" | "all" | XRayProof;
```

따라서 selector 값, URL query, `XRayBox.proofs`가 동일한 문자열 집합을 공유한다.

### 3.2 화면 option은 mode 값을 만든다

```tsx
<option value="performance">Large Data Performance</option>
```

사용자가 option을 선택하면 다음 흐름이 실행된다.

```txt
select onChange
→ setMode(event.target.value)
→ selectMode(nextMode)
→ React mode state 변경
→ URL의 xray query 변경
→ 대표 pathname으로 router.replace
```

### 3.3 URL 입력도 다시 검증한다

주소창 query는 사용자가 임의로 바꿀 수 있으므로 TypeScript cast만 믿지 않는다.

```txt
?xray=performance → 허용 → performance
?xray=wrong       → 거부 → all
```

이 검사는 `getXRayMode()`가 담당한다.

### 3.4 대표 화면 이동과 페이지 고정은 다르다

`getXRayPathname()`은 선택 순간의 안내 목적지만 결정한다.

```ts
if (mode === "performance") return "/performance";
```

그 뒤 pathname이 변할 때 실행되는 effect는 현재 pathname을 그대로 사용하고 query만 동기화한다.

예를 들어 `/performance?xray=performance`에서 지도 메뉴를 누르면 `/map?xray=performance`로 이동하며 다시 성능 페이지로 강제 복귀하지 않는다.

## 4. Performance: 데이터가 만들어지는 뿌리

### 4.1 사용자가 데이터 크기를 고른다

`PerformancePage`는 5,000건과 10,000건 중 하나를 선택한다.

```ts
export const performanceScenarioSizes = [5000, 10000] as const;
```

임의의 거대한 숫자를 받지 않는 이유는 브라우저와 서버에 예측할 수 없는 부하가 생기는 것을 막기 위해서다.

### 4.2 브라우저가 REST API를 호출한다

```txt
scenarioSize 변경
→ useEffect 실행
→ fetchPerformanceIncidents(scenarioSize)
→ GET /api/incidents/many-data?size=10000
```

effect는 `active` 값을 cleanup에서 `false`로 만든다. 요청 도중 페이지가 사라졌거나 새 크기를 요청했다면 이전 응답이 현재 state를 덮지 못하게 한다.

### 4.3 Route Handler가 size를 검증한다

`apps/web/app/api/incidents/many-data/route.ts`의 핵심 흐름이다.

```ts
const size = Number(new URL(request.url).searchParams.get("size"));

if (!isPerformanceScenarioSize(size)) {
  return 400;
}
```

허용된 값만 fixture 생성 함수에 전달된다.

```txt
size=5000  → 통과
size=10000 → 통과
size=99999 → 400 INVALID_PERFORMANCE_SIZE
size=hello → Number 결과 NaN → 400
```

### 4.4 fixture가 재현 가능한 사고를 만든다

`createPerformanceIncidents()`는 기존 사고를 template으로 사용한다.

```txt
기존 Incident[]
→ affectedPeople 기반 가중치 계산
→ index마다 template 선택
→ 결정적인 난수 함수로 좌표 offset 계산
→ PERF-00001 같은 새 ID 생성
→ 요청한 개수의 Incident[] 반환
```

`Math.random()`을 쓰지 않고 index와 salt로 값을 계산하므로 같은 입력이면 같은 분포를 얻는다. 성능 시나리오를 새로 열 때마다 데이터 모양이 완전히 달라지는 노이즈를 줄이기 위한 선택이다.

이 데이터는 실제 사고 저장소에 쓰이지 않는다. 성능 실습용 응답만 만들어 반환한다.

## 5. Performance: 지도 클러스터링 흐름

### 5.1 사고 객체를 지도 Feature로 바꾼다

OpenLayers는 `Incident`를 직접 그리지 않는다. 좌표를 가진 `Feature`가 필요하다.

```txt
Incident
→ longitude, latitude 추출
→ fromLonLat 좌표 변환
→ Point geometry
→ Feature
→ VectorSource
```

### 5.2 Cluster source가 가까운 점을 묶는다

```ts
new Cluster({ distance: 38, source })
```

`distance: 38`은 화면 픽셀 기준으로 가까운 Feature를 묶는 기준이다.

```txt
확대 전
→ 많은 사고가 가까운 화면 위치에 있음
→ 하나의 숫자 cluster marker

확대 후
→ 점 사이 화면 거리가 벌어짐
→ 더 작은 cluster 또는 단일 marker
```

원본 사고 10,000건을 삭제하는 것은 아니다. 원본 Feature는 source에 있고, 현재 확대 수준에 맞는 묶음을 화면에 표시한다.

### 5.3 클릭은 cluster 크기에 따라 나뉜다

```txt
cluster 안 Feature 1개
→ 해당 사고 선택

cluster 안 Feature 여러 개
→ 묶인 Feature의 extent 계산
→ 그 범위로 지도 확대
```

### 5.4 3D는 선택 사고 하나만 넘긴다

```tsx
<RiskZoneScene incident={selectedIncident} />
```

1만 개의 3D mesh를 무조건 만들지 않는다. 전체 분포 탐색은 2D cluster가 맡고, 3D는 사용자가 고른 한 사고의 상세 표현만 맡는다.

## 6. Performance: Virtual Rendering 흐름

### 6.1 왜 배열 1만 건과 DOM 1만 개는 다른가

배열에 객체 1만 개가 있는 것과 버튼·텍스트·배지 1만 행을 DOM으로 만드는 것은 비용이 다르다.

```txt
Incident[] 10,000개
→ 데이터와 계산에 필요

DOM row 10,000개
→ layout, paint, 접근성 트리, event 대상이 모두 커짐
```

가상 목록은 전체 데이터는 유지하면서 DOM만 줄인다.

### 6.2 고정된 숫자 세 개

```ts
const rowHeight = 76;
const viewportHeight = 456;
const overscan = 6;
```

- `rowHeight`: 한 행 높이
- `viewportHeight`: 스크롤 창 높이
- `overscan`: 화면 위아래에 미리 그릴 여유 행

### 6.3 스크롤 위치로 범위를 계산한다

```ts
const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
const end = Math.min(
  total,
  Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan,
);
```

예를 들어 맨 위에서는 다음처럼 계산된다.

```txt
scrollTop = 0
start = max(0, 0 - 6) = 0
end = ceil(456 / 76) + 6 = 12
```

따라서 데이터가 10,000건이어도 처음 DOM에 만드는 목록 행은 12개다.

### 6.4 slice한 범위만 JSX로 만든다

```ts
const visibleIncidents = incidents.slice(range.start, range.end);
```

React의 `map()` 대상은 전체 `incidents`가 아니라 `visibleIncidents`다.

```txt
incidents 10,000개
→ visible range 계산
→ slice 약 12~19개
→ 그 행들만 <li><button>...</button></li> 생성
```

스크롤 전체 길이는 다음 빈 공간이 유지한다.

```tsx
<div style={{ height: incidents.length * rowHeight }}>
```

현재 범위는 `top: range.start * rowHeight` 위치로 옮긴다. 그래서 DOM은 적지만 스크롤바는 전체 10,000행 길이를 가진 것처럼 동작한다.

### 6.5 접근성을 함께 유지한다

가상화 때문에 DOM에 일부 행만 있어도 보조 기술에 전체 집합 정보를 전달한다.

```tsx
<li aria-posinset={index + 1} aria-setsize={total} role="listitem">
```

스크롤 영역에는 `role="list"`, 이름, `tabIndex={0}`가 있고 선택 버튼에는 `aria-pressed`가 있다. 성능 최적화가 키보드 조작과 의미 구조를 없애지 않게 한 것이다.

## 7. Performance X-Ray가 화면에 연결되는 방식

`PerformancePage`는 hook을 한 번만 호출한다.

```ts
const { enabled: xray, mode } = useXRay();
```

`enabled`는 기본 FSD/all 표시를 담당하고, 정확한 20-5 관점은 `mode`로 직접 비교한다.

```tsx
enabled={xray || mode === "performance"}
proofs={["fsd-style", "performance"]}
```

성능 관점에서 강조되는 경계는 다음과 같다.

```txt
widget/PerformanceScenarioSummary
widget/ClusteredPerformanceMap (2D일 때)
feature/performance/VirtualIncidentList
feature/performance/LargeDataPipeline
```

3D로 전환했을 때 `RiskZoneScene`을 performance 증거로 거짓 표시하지 않는다. 20-5의 핵심은 전체 2D cluster와 가상 목록이며, 3D는 선택된 한 건으로 비용을 제한한다는 보조 전략이다.

증거 패널의 badge는 실제 페이지 state를 사용한다.

```txt
loading 중 → 10,000 loading
성공       → 10,000 loaded
실패       → load error
```

임의의 FPS나 처리 시간을 하드코딩하지 않았다. 실제로 측정하지 않은 숫자를 성능 결과처럼 표시하면 안 되기 때문이다.

## 8. Storybook이 실행되는 뿌리

### 8.1 루트 script

루트 `package.json`은 다음 명령을 제공한다.

```json
"storybook": "storybook dev -p 6006",
"build-storybook": "storybook build"
```

```txt
npm run storybook
→ Storybook CLI
→ 개발 서버 시작
→ http://127.0.0.1:6006
```

### 8.2 Story 검색 범위

`.storybook/main.ts`:

```ts
stories: ["../packages/ui/src/**/*.stories.@(ts|tsx)"],
framework: "@storybook/react-vite",
```

따라서 Storybook은 `packages/ui/src` 아래의 `.stories.ts`와 `.stories.tsx`만 찾는다. 앱 전체 파일을 무작정 읽지 않는다.

### 8.3 실제 Story 파일

```txt
packages/ui/src/badge.stories.tsx
packages/ui/src/severity-badge.stories.tsx
packages/ui/src/xray.stories.tsx
```

Story는 컴포넌트의 한 상태를 이름 붙인 예제다.

```txt
Badge / Playground
Badge / CriticalIncident
Badge / Tones

SeverityBadge / Playground
SeverityBadge / AllSeverities

XRay / BoxLayers
XRay / ToggleDemo
```

### 8.4 preview가 공통 환경을 넣는다

`.storybook/preview.ts`는 공유 UI CSS를 한 번 불러오고 Story 배치를 가운데로 맞춘다.

```ts
import "../packages/ui/src/styles.css";
```

앱의 페이지 CSS에 우연히 의존하지 않고, 공유 패키지가 자기 스타일로 보이는지 확인할 수 있다.

### 8.5 play 함수는 Story 안에서 조작한다

`XRay / ToggleDemo`에는 `play()`가 있다.

```txt
button 찾기
→ 초기 aria-pressed="false" 확인
→ userEvent.click(button)
→ aria-pressed="true" 확인
→ X-Ray proof 속성 확인
```

Story가 단순 스크린샷을 넘어 실제 사용자 동작을 표현할 수 있다는 예다.

## 9. Storybook을 X-Ray에서 제외한 이유

Storybook은 Next 앱과 다른 6006 포트에서 실행된다. 현재 사이트 화면의 실행 구조가 아니므로 X-Ray selector와 메인 앱 증거 패널에서 제외했다.

```txt
메인 앱 X-Ray
→ Storybook 항목 없음

별도 터미널
→ npm run storybook
→ localhost:6006에서 Story 확인
```

Storybook 화면에서 다음 Story를 직접 선택할 수 있다.

```txt
Badge / Playground
SeverityBadge / All Severities
XRay / Toggle Demo
```

Storybook 서버를 실행하지 않았다면 링크가 열리지 않는 것이 정상이다. 먼저 저장소 루트에서 다음을 실행해야 한다.

```bash
npm run storybook
```

## 10. Unit Test가 실행되는 뿌리

### 10.1 루트 명령이 workspace를 순회한다

루트 `package.json`:

```json
"test": "npm run test --workspaces --if-present"
```

흐름은 다음과 같다.

```txt
npm test
→ apps/*, packages/* workspace 확인
→ test script가 있는 workspace만 실행
→ 하나라도 non-zero exit code면 전체 실패
```

`--if-present` 때문에 test script가 없는 workspace는 오류가 아니라 건너뛴다.

### 10.2 공유 API 계약은 Vitest

`packages/api-types/package.json`:

```json
"test": "vitest run"
```

`packages/api-types/test/risk-score.test.ts`는 위험 점수와 실시간 응답 runtime guard를 검증한다.

```txt
Incident 입력 → calculateIncidentRisk → score/level 비교
unknown 입력  → isRealtimeEventListResponse → true/false 비교
```

### 10.3 Analytics remote도 Vitest

`apps/analytics-remote/src/incident-analytics.test.ts`는 remote UI가 사용하는 계산 함수를 검증한다.

UI 전체를 띄우지 않고 입력 사고 배열에서 기대 통계가 나오는지 확인한다.

### 10.4 Realtime server는 Node 기본 test runner

`apps/realtime-server/package.json`:

```json
"test": "node --test src/websocket-frame.test.mjs"
```

브라우저 UI가 아닌 Node 서버 코드이므로 Node의 내장 test runner로 WebSocket handshake와 text frame encoding을 검증한다. 별도의 테스트 의존성을 추가하지 않았다.

## 11. Unit Test를 X-Ray에서 제외한 이유

Unit Test는 브라우저 화면에서 실행되는 기능이 아니라 터미널 또는 CI 작업이다. 따라서 X-Ray selector와 메인 앱 증거 패널에서 제외한다.

실제 test 파일과 실행 명령은 다음과 같다.

```txt
packages/api-types/test/risk-score.test.ts
apps/analytics-remote/src/incident-analytics.test.ts
apps/realtime-server/src/websocket-frame.test.mjs
npm test
```

메인 앱에 `PASS`를 하드코딩하지 않는다. 빌드 시점에 성공했던 결과가 현재도 성공한다고 보장할 수 없으므로 테스트 프로세스의 exit code가 진실의 원천이다.

## 12. 왜 새 helper와 라이브러리를 만들지 않았는가

20-5에서 하지 않은 것:

```txt
성능 데이터를 위한 새 데이터베이스
react-window 같은 새 가상화 의존성
클러스터링을 감싸는 새 adapter
Storybook 링크 registry
테스트 결과를 저장하는 새 API
가짜 FPS/실행 시간/통과 badge
```

현재 요구에는 기존 구현이 충분하다.

```txt
고정 행 높이 목록 → 작은 getVisibleRange 함수
OpenLayers 사용 중 → 기본 Cluster source
Story가 세 파일 → 별도 Storybook에서 직접 확인
test workspace가 세 곳 → 기존 npm workspace script
```

규모가 실제로 커져 반복이 생길 때만 추상화한다.

## 13. 직접 실습 1: 10,000건 Virtual Rendering 확인

### 목적

데이터 개수와 DOM 개수가 같지 않다는 것을 확인한다.

### 순서

1. 앱을 실행한다.

```bash
npm run dev
```

2. X-Ray에서 `Large Data Performance`를 선택한다.

3. URL이 `/performance?xray=performance`인지 확인한다.

4. 사고 수를 `10,000건`으로 둔다.

5. 증거 badge가 `10,000 loaded`인지 확인한다.

6. 가상 사고 목록 badge를 확인한다. 맨 위에서는 `DOM 12건`이 보인다.

7. 목록을 중간까지 스크롤한다.

8. 범위 숫자는 바뀌지만 전체 분모는 `10,000`으로 유지되는지 확인한다.

### 이유

브라우저에는 10,000개 데이터가 있지만 React가 만드는 행은 현재 범위뿐이라는 가장 직접적인 증거다.

## 14. 직접 실습 2: Cluster 동작 확인

### 순서

1. 같은 화면에서 `2D 전체 분포`를 선택한다.

2. 숫자가 표시된 cluster marker를 누른다.

3. 지도가 해당 범위로 확대되는지 확인한다.

4. 확대하면서 큰 숫자 cluster가 작은 cluster와 단일 marker로 나뉘는지 확인한다.

5. 단일 marker를 눌러 선택 사고 ID가 바뀌는지 확인한다.

6. `3D 선택 사고`를 눌러 선택한 한 사고만 3D로 전달되는지 확인한다.

### 이유

클러스터는 데이터를 없애는 기술이 아니라 현재 화면 해상도에 맞춰 표시 단위를 묶는 기술임을 확인한다.

## 15. 직접 실습 3: Storybook 확인

### 순서

1. 별도 터미널에서 실행한다.

```bash
npm run storybook
```

2. 브라우저에서 `http://127.0.0.1:6006`을 연다.

3. `Badge / Playground`를 선택한다.

4. Controls에서 props를 바꿔 UI가 즉시 변하는지 확인한다.

5. `X-Ray / Toggle Demo`를 열어 토글 동작을 확인한다.

6. 터미널을 종료한 뒤 Storybook 서버도 종료되는지 확인한다.

### 이유

Storybook이 메인 Next 앱의 route가 아니라 별도 개발 서버라는 점을 이해할 수 있다.

## 16. 직접 실습 4: Unit Test 성공과 실패 확인

### 정상 실행

```bash
npm test
```

각 workspace의 테스트와 마지막 exit code를 확인한다.

### 의도적 실패 실습

1. 테스트 파일의 기대 숫자 하나를 일부러 잘못 바꾼다.
2. `npm test`를 다시 실행한다.
3. 어떤 파일, 어떤 테스트, 실제값과 기대값이 출력되는지 읽는다.
4. 바꾼 숫자를 원래대로 되돌린다.
5. `npm test`가 다시 성공하는지 확인한다.

### 이유

테스트 코드를 읽기만 하는 것보다 실패 메시지를 직접 보는 것이 assertion과 exit code의 역할을 빠르게 이해하게 한다.

실습 변경은 커밋에 포함하지 않는다.

## 17. 직접 실습 5: 라우팅이 고정되지 않는지 확인

1. `Large Data Performance`를 선택한다.
2. `/performance?xray=performance`로 이동하는지 확인한다.
3. 상단의 다른 메뉴를 누른다.
4. 선택한 페이지로 이동하면서 `?xray=performance`만 유지되는지 확인한다.
대표 화면 이동은 선택 순간 한 번뿐이어야 한다.

## 18. 검증 명령

```bash
npm run typecheck
npm test
npm run build-storybook
git diff --check
```

- `typecheck`: selector mode, props, JSX 타입 검증
- `test`: workspace별 실제 자동 테스트 실행
- `build-storybook`: 모든 Story 검색, 변환, 정적 빌드 검증
- `diff --check`: 공백 오류와 충돌 흔적 검증

## 19. 다음 기능을 추가할 때의 순서

### 새 성능 전략

```txt
실제 병목 측정
→ 기존 브라우저/라이브러리 기능으로 해결 가능한지 확인
→ 가장 작은 변경 구현
→ 전후를 같은 조건에서 다시 측정
→ X-Ray에는 측정 가능한 근거만 표시
```

### 새 공유 UI Story

```txt
packages/ui/src에 컴포넌트 작성
→ 같은 위치에 *.stories.tsx 작성
→ 대표 props와 경계 상태 추가
→ 필요한 경우 play 상호작용 추가
→ npm run build-storybook
```

### 새 Unit Test

```txt
순수 계산 또는 계약 경계 선택
→ 정상 입력 테스트
→ 경계값 테스트
→ 잘못된 입력 테스트
→ 해당 workspace test 실행
→ 루트 npm test 실행
```

## 20. 핵심 정리

```txt
Performance
→ 모든 데이터를 DOM이나 개별 지도 마커로 그리지 않는다.
→ cluster와 visible slice로 표현 비용을 줄인다.

Storybook
→ 공유 UI를 메인 앱과 분리해 상태별로 확인한다.
→ 실제 별도 서버와 Story 링크를 사용한다.

Unit Test
→ 작은 로직과 계약을 반복 가능한 입력/기대값으로 검사한다.
→ 화면의 문구가 아니라 실행 프로세스의 결과가 진실이다.

X-Ray
→ selector의 mode와 실제 코드 경계가 같은 proof 문자열로 연결된다.
→ 선택 시 대표 화면으로 안내하지만 이후 라우팅은 고정하지 않는다.
```
