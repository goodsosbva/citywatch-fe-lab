# 15. analytics-remote + Module Federation

## 1. 무엇을 구현했는가

홈 대시보드가 보유한 사고 데이터를 별도 Vite 앱의 React 지표 컴포넌트로 전달하고, remote JSX를 화면에 표시하는 Module Federation 흐름을 구현했다.

```txt
Next.js host: http://127.0.0.1:3000
Vite remote:  http://127.0.0.1:3002
Manifest:     http://127.0.0.1:3002/mf-manifest.json
Expose:       citywatch_analytics/analytics-metrics
```

홈 화면의 `원격 사고 분석` 영역은 분석 대상 수, 고위험 사고 수, 해결률, 평균 영향 인원을 보여준다. X-Ray를 켜면 이 지표 React UI가 로컬 번들 코드가 아니라 `apps/analytics-remote`에서 왔다는 경계를 확인할 수 있다.

## 2. 왜 필요한가

모노레포에 폴더만 나누는 것은 Module Federation 증명이 아니다. host가 실행 중에 다른 앱의 manifest를 읽고, 그 앱이 공개한 모듈을 네트워크로 받아 실행해야 remote 경계를 실제로 증명할 수 있다.

이 프로젝트에서는 UI 전체를 remote로 옮기기 전에 가장 작은 독립 단위인 분석 함수를 분리했다. React 컴포넌트를 공유하지 않으므로 host와 remote의 React 인스턴스 공유 문제를 피하면서 다음 핵심 흐름은 모두 확인할 수 있다.

```txt
독립 빌드
→ manifest 공개
→ host의 런타임 원격 로드
→ typed input 전달
→ 원격 계산 실행
→ 결과 검증
→ host UI 렌더링
```

## 3. remote는 어떻게 설정했는가

설정 위치는 `apps/analytics-remote/vite.config.ts`다.

```ts
federation({
  name: "citywatch_analytics",
  filename: "remoteEntry.js",
  manifest: true,
  exposes: {
    "./analytics-metrics": "./src/analytics-metrics.tsx",
  },
  shared: {
    react: { singleton: true },
  },
  dts: false,
})
```

`name`은 host가 remote를 식별하는 이름이다. `exposes`는 외부에 공개할 모듈 이름과 실제 파일을 연결한다. `manifest: true`는 host가 읽을 `mf-manifest.json`을 만들고, `filename`은 remote 실행 엔트리를 정한다.

개발 서버의 host와 port를 `127.0.0.1:3002`로 고정한 이유는 manifest 안의 원격 asset 주소와 실제 서버 주소를 일치시키기 위해서다. CORS도 이 개발 origin에 맞춰 host가 3000번 포트에서 remote asset을 읽을 수 있게 한다.

## 4. remote는 무엇을 공개하는가

실제 공개 모듈은 `apps/analytics-remote/src/analytics-metrics.tsx`다. 이 컴포넌트가 내부 계산 함수 `apps/analytics-remote/src/incident-analytics.ts`를 호출한다.

```ts
export function AnalyticsMetrics({ incidents }: { incidents: readonly Incident[] }) {
  const snapshot = calculateIncidentAnalytics(incidents);
  // snapshot으로 네 개의 metric JSX를 반환한다.
}
```

입력은 `packages/api-types`의 `Incident[]`를 사용한다. 같은 도메인 계약을 사용하므로 host가 가진 사고 데이터와 remote가 기대하는 입력 구조가 TypeScript 수준에서 어긋나지 않는다.

계산 코드는 remote 내부의 순수 함수로 유지한다. 네트워크, React, 브라우저 상태 없이 입력과 출력만으로 검증하기 위해서다. 테스트는 `apps/analytics-remote/src/incident-analytics.test.ts`에 있으며 일반 데이터와 빈 배열을 확인한다.

지표 UI는 `apps/analytics-remote/src/analytics-metrics.tsx`로 별도 노출한다.

```tsx
export function AnalyticsMetrics({ incidents }: { incidents: readonly Incident[] }) {
  const snapshot = calculateIncidentAnalytics(incidents);

  return (
    <div className="metric-grid">
      <article className="metric metric--neutral">
        <span>분석 대상</span>
        <strong>{snapshot.total}</strong>
      </article>
      {/* 고위험 사고, 해결률, 평균 영향 인원도 같은 방식으로 렌더링 */}
    </div>
  );
}
```

계산 함수는 순수 함수로 유지해 독립 테스트하고, TSX 컴포넌트는 그 계산 결과를 화면으로 바꾸는 책임만 가진다. React를 import하는 remote이므로 `vite.config.ts`의 `shared.react.singleton`과 Host runtime의 React 공유 설정이 필요하다. 이 설정은 Host와 remote가 서로 다른 React 복사본을 사용하는 문제를 막는다.

## 5. host는 어떻게 불러오는가

host 경계는 `apps/web/app/analytics-remote-panel.tsx`다. 이 파일은 브라우저에서 실행되는 client component다.

```txt
createInstance
→ remote 이름과 manifest URL 등록
→ loadRemote("citywatch_analytics/analytics-metrics")
→ export 형태 검증
→ remote AnalyticsMetrics에 incidents 전달
→ remote JSX 렌더링
→ 화면 상태 갱신
```

manifest URL은 `NEXT_PUBLIC_ANALYTICS_REMOTE_URL`로 바꿀 수 있고, 값이 없으면 로컬 3002번 주소를 사용한다. 배포 환경마다 remote 주소가 달라질 수 있으므로 코드에 하나의 배포 주소를 고정하지 않는다.

TypeScript 타입은 개발 중 실수를 막지만 네트워크에서 받은 모듈의 실제 형태까지 보장하지 않는다. 따라서 host는 `AnalyticsMetrics` export가 함수인지 런타임에도 확인한다. remote가 잘못 배포되거나 계약이 깨졌을 때 잘못된 값을 조용히 렌더링하지 않기 위해 필요한 경계 검증이다.

## 6. 화면에는 어떻게 연결되는가

`apps/web/app/shell.tsx`가 기존 REST API로 사고 목록을 받은 뒤 `AnalyticsRemotePanel`에 전달한다.

```txt
GET /api/incidents
→ CityWatchShell의 incidents state
→ AnalyticsRemotePanel props
→ remote AnalyticsMetrics 컴포넌트 로드
→ remote JSX가 metric UI 렌더링
```

remote가 담당하는 것은 계산과 네 개의 metric UI 렌더링이고, Host는 remote 로드 중 상태 메시지와 실패 시 `role="alert"` 오류·재시도 버튼을 담당한다. 따라서 remote 서버가 일시적으로 내려가도 홈 전체가 깨지지 않는다.

## 7. X-Ray는 무엇을 증명하는가

원격 분석 영역은 다음 DOM 증거를 가진다.

```txt
data-xray-layer="remote"
data-xray-label="remote/analytics/AnalyticsMetrics"
data-xray-package="apps/analytics-remote"
data-xray-stacks="Module Federation,Vite Remote,Runtime Manifest"
```

즉 화면만 보고도 이 영역의 계산 출처가 remote이고, 어떤 패키지와 전달 방식을 사용했는지 추적할 수 있다. 아직 선택형 Inspector는 없지만 필요한 증거 데이터는 실제 remote 경계에 연결되어 있다.

## 8. 실행과 확인

터미널 두 개에서 host와 remote를 실행한다.

```bash
npm run dev:web
npm run dev:remote
```

다음 주소를 확인한다.

```txt
http://127.0.0.1:3000/
http://127.0.0.1:3002/mf-manifest.json
```

홈에서 `원격 사고 분석`과 `Federated` 표시가 나오면 로드가 성공한 것이다. X-Ray를 켜서 `remote/AnalyticsMetrics` 경계도 확인한다.

검증 명령은 다음과 같다.

```bash
npm run typecheck
npm run test
npm run build
npm audit
```

## 9. 현재 범위와 이후 확장

현재 단계는 원격 순수 함수의 독립 빌드와 런타임 로드를 증명한다. remote가 React UI까지 소유하도록 만들지는 않았다.

이후 서로 다른 팀이 UI를 독립 배포해야 할 실제 요구가 생기면 React 공유 설정과 버전 정책을 정한 뒤 remote component로 확장한다. X-Ray 선택형 Inspector가 추가되면 같은 경계를 `source: remote`, `delivery: Module Federation` 관점으로 필터링할 수 있다.
