# 20-8. Module Federation X-Ray 개선

## 목표

기존 Module Federation X-Ray는 원격 분석 panel 전체를 Remote 경계처럼 표시했다. 하지만 실제 소유권은 다음처럼 나뉜다.

```txt
apps/web Host
→ panel 제목
→ manifest와 module 로드
→ loading/error 상태
→ 재시도 버튼

apps/analytics-remote Remote
→ AnalyticsMetrics 컴포넌트
→ 사고 데이터 분석
→ 네 개 지표 렌더링
```

20-8은 이 실제 경계를 화면에 그대로 표시한다. Module Federation 기능이나 별도 상태 관리 시스템은 새로 만들지 않는다.

## 화면에서 보이는 결과

`Module Federation`을 선택하면 홈으로 한 번 이동하고 다음 두 경계를 구분한다.

```txt
파란색
Host · apps/web · AnalyticsRemotePanel

주황색
Remote · apps/analytics-remote · AnalyticsMetricsContent
```

FSD의 `app/widget/feature/entity` 이름은 Module Federation mode에서 표시하지 않는다. 이 mode의 질문은 계층이 아니라 코드가 어느 실행 앱에서 전달됐는지이기 때문이다.

## 로드 상태와 경계의 관계

### loading

```txt
Host 경계 표시
Remote 경계 없음
증거 패널: 원격 모듈 로드 중
```

Host가 manifest와 remote module을 불러오는 중이므로 아직 Remote React 컴포넌트는 존재하지 않는다.

### ready

```txt
Host 경계 표시
Remote 경계 표시
AnalyticsMetrics 지표 표시
증거 패널: 원격 모듈 연결됨
```

런타임 검증을 통과한 `AnalyticsMetrics`가 실제로 렌더링됐을 때만 Remote 경계가 생긴다.

### error

```txt
Host 경계 표시
Remote 경계 없음
실제 오류 메시지 표시
Remote 다시 불러오기 버튼 표시
증거 패널: 원격 로드 실패
```

실패 화면과 재시도 버튼도 `apps/web` 코드이므로 Host 경계 안에 남는다.

## 실제 코드 흐름

```txt
AnalyticsRemotePanel mount
→ state = loading
→ loadAnalyticsModule()
→ getFederationRuntime()
→ createInstance({ remotes })
→ remoteManifestUrl 등록
→ runtime이 mf-manifest.json 조회
→ remote entry와 asset 위치 확인
→ loadRemote("citywatch_analytics/analytics-metrics")
→ isAnalyticsModule(remoteModule)
→ AnalyticsMetrics export가 함수인지 검사
→ state = ready
→ <AnalyticsMetrics incidents={incidents} />
→ Remote가 네 개 지표 렌더링
```

어느 단계에서든 Promise가 실패하면 `catch`가 `error` 상태를 만들고 Remote 컴포넌트는 렌더링하지 않는다.

## Host가 알고 있는 두 식별자

Manifest 주소:

```txt
NEXT_PUBLIC_ANALYTICS_REMOTE_URL
또는
http://127.0.0.1:3002/mf-manifest.json
```

공개 module ID:

```txt
citywatch_analytics/analytics-metrics
```

코드에서는 module ID를 `remoteModuleId` 한 곳에 두고 `loadRemote`와 증거 패널이 같은 값을 사용한다. 설명과 실행 코드가 서로 달라지는 것을 막기 위한 최소한의 상수다.

## Remote 설정과의 연결

`apps/analytics-remote/vite.config.ts`:

```tsx
federation({
  name: "citywatch_analytics",
  manifest: true,
  filename: "remoteEntry.js",
  exposes: {
    "./analytics-metrics": "./src/analytics-metrics.tsx",
  },
});
```

Host의 module ID는 다음처럼 대응한다.

```txt
citywatch_analytics
→ Remote name

/analytics-metrics
→ exposes의 ./analytics-metrics
```

따라서 `citywatch_analytics/analytics-metrics`는 `apps/analytics-remote/src/analytics-metrics.tsx`에서 export한 `AnalyticsMetrics`에 연결된다.

## 화면에 설정 흐름을 추가한 이유

실행 흐름만 보면 `loadRemote`가 모듈을 가져온다는 사실은 알 수 있지만, 그 모듈이 어떻게 만들어지고 Host가 어떤 이름으로 찾는지는 알기 어렵다. 그래서 증거 패널에 `설정부터 연결까지` 네 단계를 추가했다.

```txt
1. Remote 공개
   name: citywatch_analytics
   exposes: ./analytics-metrics → ./src/analytics-metrics.tsx
   manifest: true

2. Host 등록
   name: citywatch_analytics
   entry: 실제 remoteManifestUrl

3. 공개 모듈 요청
   Remote name + expose key
   → citywatch_analytics/analytics-metrics

4. React 공유
   shared.react.singleton: true
```

### 1단계: Remote 공개

Vite는 `federation()` 설정의 `exposes`를 읽어 외부에 공개할 파일을 결정한다. `manifest: true`이므로 Host가 읽을 `mf-manifest.json`도 빌드 결과에 생성한다.

```txt
./analytics-metrics
→ 외부에 공개되는 이름

./src/analytics-metrics.tsx
→ Remote 저장소 안의 실제 구현 파일
```

### 2단계: Host 등록

Host는 Remote의 내부 파일 경로를 직접 알지 못한다. `createInstance`에 Remote 이름과 manifest 주소만 등록한다.

```tsx
remotes: [
  {
    name: "citywatch_analytics",
    entry: remoteManifestUrl,
  },
]
```

화면에는 하드코딩한 예시 주소가 아니라 현재 실행 코드가 사용하는 `remoteManifestUrl`을 표시한다. 운영 환경 변수가 설정되면 패널에도 운영 주소가 나타난다.

### 3단계: 공개 모듈 요청

`loadRemote`에 전달하는 문자열은 임의의 파일 경로가 아니다.

```txt
citywatch_analytics/analytics-metrics
─────────────────── ────────────────
Remote name         expose key
```

Remote 이름은 Host 등록과 Vite 설정을 연결하고, expose key는 manifest 안에서 실제 asset을 찾는 데 사용된다.

### 4단계: React 공유

Host와 Remote가 각자 React를 번들에 포함하면 서로 다른 React 인스턴스에서 Hook이 실행될 수 있다. 양쪽 설정에서 React를 singleton으로 공유해 Remote 컴포넌트도 Host renderer가 사용하는 React를 사용하게 한다.

```txt
Host React ─┐
            ├─ 하나의 singleton React
Remote React┘
```

### 화면에서 제외한 설정

다음 정보는 핵심 연결을 이해하는 데 필요하지 않아 화면에는 넣지 않았다.

- `vite.config.ts` 전체 내용
- 생성된 manifest JSON 전체
- hash가 포함된 asset 파일 목록
- Vite preview 설정
- Federation runtime 내부 구현

이 값들을 화면에 모두 표시하면 설정 흐름보다 빌드 도구 세부사항이 더 크게 보인다. X-Ray에는 Remote가 무엇을 공개하고 Host가 무엇을 등록해 어떤 ID로 요청하는지만 남겼다.

## 런타임 검증이 필요한 이유

TypeScript 타입은 Host가 작성한 코드만 검사한다. 네트워크에서 받은 module이 실제로 같은 export를 제공하는지는 보장하지 못한다.

```tsx
function isAnalyticsModule(value: unknown): value is AnalyticsModule {
  return (
    typeof value === "object" &&
    value !== null &&
    "AnalyticsMetrics" in value &&
    typeof value.AnalyticsMetrics === "function"
  );
}
```

검사에 실패하면 잘못된 값을 React 컴포넌트처럼 실행하지 않고 오류 상태로 전환한다.

## 변경 파일

```txt
apps/web/app/analytics-remote-panel.tsx
→ Host와 Remote XRayBox 분리
→ 실제 manifest URL과 module ID 표시
→ 실행 흐름과 현재 상태 연결

apps/web/app/globals.css
→ Host 파란 경계
→ Remote 주황 경계
→ 반응형 Host → Remote 흐름

docs/20-8-module-federation-xray-improvement.md
→ 구현 원인과 검증 방법 기록
```

## 확인 순서

### 정상 연결

```txt
1. web과 analytics remote 실행
2. /?xray=module-federation 접속
3. 파란 Host 경계 확인
4. 주황 Remote 경계 확인
5. 원격 모듈 연결됨 상태 확인
6. 분석 대상·고위험 사고·해결률·평균 영향 인원 확인
```

### 실패와 재시도

```txt
1. analytics remote를 중단
2. 새로고침
3. 파란 Host 경계만 남는지 확인
4. 실제 오류 메시지와 Remote 다시 불러오기 버튼 확인
5. remote 재실행
6. 재시도 버튼 클릭
7. 주황 Remote 경계와 지표가 다시 생기는지 확인
```

## 현재 한계

- 원격 지표 컴포넌트 하나만 Federation으로 전달한다.
- 전체 페이지 Remote routing은 구현하지 않았다.
- Next.js SSR에서 Remote 컴포넌트를 실행하지 않는다.
- runtime 내부의 manifest fetch 세부 시간을 별도로 계측하지 않는다.
- 어느 네트워크 단계에서 실패했는지는 runtime이 반환한 실제 오류 메시지 범위에서만 표시한다.

세부 단계 추적이나 성능 계측은 실제 디버깅 요구가 생길 때 추가한다.
