# 18. Module Federation 증거 패널

## 무엇을 구현했는가

`Module Federation` X-Ray 모드에서만 원격 분석 구현의 근거를 보여 주는 패널을 추가했다.

```txt
http://127.0.0.1:3000/?xray=module-federation
```

패널은 현재 원격 모듈 상태, 실행 흐름, Host와 remote 코드 위치, 검증 방법, 현재 범위를 함께 표시한다.

## 왜 필요한가

17단계는 Module Federation proof를 선택하면 원격 분석 경계만 X-Ray로 표시했다. 하지만 테두리만으로는 Host가 어떤 remote를 어떻게 불러오고 있는지, 실패했을 때 무엇을 확인해야 하는지 알 수 없다.

이미 원격 분석 패널은 로딩 상태를 가지고 있으므로, 별도 요청이나 상태를 만들지 않고 그 상태와 실제 런타임 경로를 증거 패널에 재사용했다.

## 시작 전 설정: 파일은 어디에 두는가

이 프로젝트는 root `package.json`의 `workspaces`로 `apps/*`와 `packages/*`를 하나의 npm 프로젝트로 묶는다. 그래서 설치와 실행 명령은 개별 `apps` 폴더가 아니라 프로젝트 root에서 실행한다.

```json
{
  "scripts": {
    "dev:web": "npm --workspace @citywatch/web run dev",
    "dev:remote": "npm --workspace @citywatch/analytics-remote run dev"
  }
}
```

이 설정은 root `package.json`에 둔다. root가 workspace 이름을 알고 있으므로, 처음 실행하는 사람도 각 앱 폴더로 이동하지 않고 같은 명령으로 Host와 remote를 시작할 수 있다.

remote 앱 자체의 실행과 의존성은 `apps/analytics-remote/package.json`에 둔다.

```json
{
  "scripts": {
    "dev": "vite"
  },
  "devDependencies": {
    "@module-federation/vite": "^1.18.2",
    "vite": "^8.1.5"
  }
}
```

이 파일은 remote만의 실행 책임을 가지므로 Vite와 Vite Federation 플러그인을 여기서 선언한다. Host에는 runtime으로 remote를 읽는 `@module-federation/runtime`이 있고, remote에는 build와 manifest를 만드는 `@module-federation/vite`가 있다. 역할이 다르므로 같은 패키지를 두 앱에 억지로 공통 설정하지 않는다.

기존 저장소에서는 이미 의존성이 설치되어 있다. 새로 받은 저장소라면 먼저 root에서 다음 한 번만 실행한다.

```powershell
npm install
```

## 1. remote 공개 설정은 왜 Vite 설정 파일에 두는가

파일: `apps/analytics-remote/vite.config.ts`

Vite는 이 workspace에서 `npm run dev` 또는 `npm run build`를 실행할 때 이 파일을 읽는다. 따라서 어떤 모듈을 외부 Host에 공개할지, manifest를 만들지, 어느 주소에서 서버를 열지를 여기서 설정한다. 이 값을 `incident-analytics.ts`나 Host 파일에 넣으면 Vite가 remote build 설정으로 읽지 못한다.

```ts
federation({
  name: "citywatch_analytics",
  filename: "remoteEntry.js",
  manifest: true,
  exposes: {
    "./incident-analytics": "./src/incident-analytics.ts",
  },
});
```

각 값의 역할은 다음과 같다.

```txt
name
→ Host가 remote를 찾는 고유 이름: citywatch_analytics

exposes
→ Host에 공개할 이름과 실제 파일의 연결
→ ./incident-analytics = ./src/incident-analytics.ts

manifest: true
→ Host가 읽을 mf-manifest.json 생성

filename
→ remote 실행 엔트리 파일 이름
```

같은 파일의 서버 설정도 remote에 둔다. remote asset의 주소는 Vite가 만들기 때문에, 실제 Vite 서버의 주소와 manifest 안의 주소가 일치해야 한다.

```ts
const origin = "http://127.0.0.1:3002";

server: {
  cors: true,
  host: "127.0.0.1",
  origin,
  port: 3002,
  strictPort: true,
}
```

`cors: true`는 다른 origin인 Host `http://127.0.0.1:3000`이 remote의 manifest와 JavaScript asset을 읽을 수 있게 한다. `strictPort: true`는 remote가 조용히 다른 포트로 바뀌어 Host의 기본 URL과 어긋나는 일을 막는다.

## 2. Host 주소 설정은 왜 환경 변수로 분리하는가

파일: `apps/web/.env.dev`

```env
NEXT_PUBLIC_ANALYTICS_REMOTE_URL=http://127.0.0.1:3002/mf-manifest.json
```

`apps/web/package.json`의 개발 명령은 Node의 `--env-file=.env.dev`로 이 파일을 읽는다. 로컬 주소는 이 파일에 두고, Preview와 Production의 실제 배포 URL은 Vercel Dashboard 환경 변수로 관리한다. 따라서 배포 주소를 Git에 고정하지 않는다.

Host 코드가 이 값을 읽는 위치는 `apps/web/app/analytics-remote-panel.tsx`다.

```tsx
const remoteManifestUrl =
  process.env.NEXT_PUBLIC_ANALYTICS_REMOTE_URL ??
  "http://127.0.0.1:3002/mf-manifest.json";
```

이 컴포넌트는 브라우저에서 실행되므로 Next.js가 브라우저에 노출하는 `NEXT_PUBLIC_` 접두사가 필요하다. 값이 없을 때 3002 기본값을 두어, 로컬에서 별도 환경 파일 없이도 바로 실행할 수 있게 했다.

## 3. remote 로더는 왜 패널 파일에 두는가

파일: `apps/web/app/analytics-remote-panel.tsx`

`apps/web/app/shell.tsx`는 REST API에서 `incidents`를 받아 전체 화면에 배치한다.

```tsx
{!loading && !error ? (
  <AnalyticsRemotePanel incidents={incidents} />
) : null}
```

`shell.tsx`에 Federation runtime 설정까지 넣으면 화면 조립, REST 상태, remote 로드가 한 파일에 섞인다. 반대로 `AnalyticsRemotePanel`은 remote 분석 결과를 표시하는 유일한 UI 경계이므로 manifest URL, `loadRemote`, 로딩·오류·재시도 상태를 이 파일에 둔다. 이 파일 첫 줄의 `"use client"`는 `useEffect`와 브라우저 런타임을 사용한다는 것을 Next.js에 알린다.

```tsx
"use client";

const [state, setState] = useState<AnalyticsState>({ status: "loading" });

useEffect(() => {
  let active = true;

  void loadAnalyticsModule()
    .then((remoteModule) => remoteModule.calculateIncidentAnalytics(incidents))
    .then((snapshot) => {
      if (!isAnalyticsSnapshot(snapshot)) {
        throw new Error("Remote analytics result shape is invalid.");
      }
      if (active) setState({ snapshot, status: "ready" });
    })
    .catch((reason) => {
      if (active) setState({ message: getErrorMessage(reason), status: "error" });
    });

  return () => {
    active = false;
  };
}, [incidents, loadRun]);
```

## 4. 처음부터 실행하는 순서

프로젝트 root에서 터미널 두 개를 연다. remote를 먼저 시작하면 Host가 처음 분석을 요청할 때 manifest가 이미 준비되어 있어 오류와 재시도를 거치지 않는다.

터미널 1:

```powershell
npm run dev:remote
```

다음 주소가 JSON으로 열리는지 확인한다.

```txt
http://127.0.0.1:3002/mf-manifest.json
```

터미널 2:

```powershell
npm run dev:web
```

그 뒤 브라우저에서 아래 주소를 연다.

```txt
http://127.0.0.1:3000/?xray=module-federation
```

이 순서에서 remote는 manifest와 분석 코드를 제공하고, Host는 사고 목록을 받은 뒤 그 코드를 런타임에 불러와 결과를 그린다.

### `EADDRINUSE`가 나오면

`EADDRINUSE`는 코드나 패키지 설치 오류가 아니다. 이미 다른 프로세스가 같은 포트를 듣고 있어 두 번째 서버가 시작할 수 없다는 뜻이다. 이 프로젝트의 개발 서버는 다음 포트를 사용한다.

```txt
3000 → Next.js Host
3001 → realtime server
3002 → Vite analytics remote
```

먼저 어떤 프로세스가 점유했는지 확인한다.

```powershell
$ports = 3000, 3001, 3002
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -in $ports } |
  Select-Object LocalPort, OwningProcess
```

`OwningProcess` 값으로 실행 명령도 확인한다.

```powershell
Get-CimInstance Win32_Process -Filter "ProcessId = <PID>" |
  Select-Object ProcessId, CommandLine
```

명령이 이 프로젝트의 `next`, `src/server.mjs`, `vite`인지 확인한 경우에만 종료한다. 다른 프로그램의 PID는 종료하면 안 된다.

```powershell
Stop-Process -Id <3000_PID>, <3001_PID>, <3002_PID>
npm run dev
```

기존 서버가 정상이라면 종료할 필요 없이 `http://127.0.0.1:3000/`을 그대로 사용하면 된다. 포트는 열려 있는데 브라우저 요청이 계속 시간 초과한다면 그 listener는 멈춘 서버이므로, 실행 명령을 확인한 뒤 종료하고 다시 시작한다. `scripts/dev.mjs`는 자신이 새로 시작한 child 중 하나가 실패하면 나머지도 종료하지만, 이미 실행 중이던 서버는 종료하지 않는다.

## 표시 조건

파일: `apps/web/app/analytics-remote-panel.tsx`

`useXRay`는 17단계부터 `enabled`와 현재 `mode`를 반환한다. 원격 경계 표시는 기존처럼 `enabled`를 사용하고, 증거 패널은 정확히 `module-federation` 모드일 때만 렌더링한다.

```tsx
const { enabled: xray, mode } = useXRay(["module-federation"]);

{mode === "module-federation" ? (
  <ModuleFederationEvidencePanel status={state.status} />
) : null}
```

따라서 `off`, `all`, `fsd-style`에서는 홈 화면의 정보 밀도가 늘어나지 않는다. `all`은 모든 X-Ray 경계를 보이는 모드이고, 증거 설명을 항상 보이는 모드로 바꾸지는 않는다.

## 기존 상태 재사용

원격 분석은 이미 세 상태를 관리한다.

```tsx
type AnalyticsState =
  | { status: "loading" }
  | { message: string; status: "error" }
  | { AnalyticsMetrics: ComponentType<{ incidents: readonly Incident[] }>; status: "ready" };
```

증거 패널은 이 중 `status`만 받는다.

```tsx
function ModuleFederationEvidencePanel({
  status,
}: {
  status: AnalyticsState["status"];
}) {
  const statusLabel =
    status === "ready" ? "원격 모듈 연결됨" :
    status === "error" ? "원격 로드 실패" :
    "원격 모듈 로드 중";
```

새 `useEffect`, fetch, Context, 전역 상태를 만들지 않았다. 원격 로드 성공·실패 상태와 증거 패널의 상태가 항상 같은 원천에서 나오기 때문이다.

## 실제 실행 흐름

Host는 환경 변수 또는 로컬 기본 URL로 manifest 위치를 정한다.

```tsx
const remoteManifestUrl =
  process.env.NEXT_PUBLIC_ANALYTICS_REMOTE_URL ??
  "http://127.0.0.1:3002/mf-manifest.json";
```

`getFederationRuntime`은 이 manifest와 remote 이름으로 Module Federation runtime을 생성한다.

```tsx
createInstance({
  name: "citywatch_web",
  remotes: [
    {
      entry: remoteManifestUrl,
      name: "citywatch_analytics",
    },
  ],
});
```

그 다음 `loadAnalyticsModule`이 exposed TSX module을 불러오고 React 컴포넌트 export 형태를 확인한다.

```tsx
runtime.loadRemote<unknown>(
  "citywatch_analytics/analytics-metrics",
);

if (!isAnalyticsModule(remoteModule)) {
  throw new Error("Remote analytics module shape is invalid.");
}
```

검사가 끝나면 Host는 remote 컴포넌트를 state에 저장하고, Host JSX 안에서 그 컴포넌트를 렌더링한다.

```tsx
const AnalyticsMetrics = state.status === "ready" ? state.AnalyticsMetrics : null;

{AnalyticsMetrics ? <AnalyticsMetrics incidents={incidents} /> : null}
```

따라서 화면의 흐름은 다음과 같다.

```txt
mf-manifest.json
→ citywatch_analytics/analytics-metrics
→ AnalyticsMetrics export 검사
→ remote AnalyticsMetrics가 calculateIncidentAnalytics(incidents) 실행
→ remote JSX 지표 렌더링
```

## 코드 근거

증거 패널은 다음 실제 파일 위치를 화면에 표시한다.

```txt
Host 로더
apps/web/app/analytics-remote-panel.tsx

Remote 설정
apps/analytics-remote/vite.config.ts

Remote React UI
apps/analytics-remote/src/analytics-metrics.tsx
```

remote 설정은 Vite Federation 플러그인에서 module을 노출한다.

```tsx
federation({
  exposes: {
    "./analytics-metrics": "./src/analytics-metrics.tsx",
  },
  manifest: true,
  name: "citywatch_analytics",
  shared: {
    react: { singleton: true },
  },
});
```

`./analytics-metrics`와 Host의 `citywatch_analytics/analytics-metrics`는 같은 remote module을 가리킨다. 이 TSX 파일에서 계산과 네 개의 metric JSX를 함께 렌더링한다.

`shared.react.singleton`은 Vite remote 설정에 둔다. remote가 React를 직접 import하므로, Federation build 단계에서 React를 공유 의존성으로 등록해야 한다. Host의 `createInstance`에도 같은 React 인스턴스를 등록한다.

```tsx
import * as React from "react";

createInstance({
  // remote 설정
  shared: {
    react: {
      lib: () => React,
      scope: "default",
      shareConfig: { requiredVersion: React.version, singleton: true },
      version: React.version,
    },
  },
});
```

Host와 remote가 서로 다른 React 복사본을 쓰면 Hook 사용 시 Invalid Hook Call 같은 오류가 발생할 수 있다. singleton 공유는 remote TSX가 Host React renderer와 같은 React를 사용하도록 만드는 설정이다.

## 실패 확인과 범위

remote가 중단되거나 module export가 기대한 React 컴포넌트가 아니면 기존 로더가 `error` 상태가 된다. 증거 패널도 같은 상태를 받아 `원격 로드 실패`를 표시하고, 기존 `Remote 다시 불러오기` 버튼으로 재시도할 수 있다.

```tsx
catch((reason) => {
  if (active) {
    setState({ message: getErrorMessage(reason), status: "error" });
  }
});
```

현재 remote 경계는 지표 UI 하나다. 전체 화면을 remote로 조합하거나 Next.js SSR에서 Federation module을 실행하는 구조는 구현하지 않았으므로 패널에도 그 한계를 명시한다.

## 검증

```txt
npm run typecheck 통과
npm --workspace @citywatch/analytics-remote run build 통과
npm --workspace @citywatch/analytics-remote run test 통과
git diff --check 통과
```

브라우저 확인은 web, analytics remote를 실행한 뒤 다음 URL로 한다.

```txt
http://127.0.0.1:3000/?xray=module-federation
```

확인 항목:

```txt
원격 사고 분석 경계만 X-Ray로 보인다.
Module Federation 증거 패널이 보인다.
remote가 정상일 때 원격 모듈 연결됨 상태와 분석 지표가 보인다.
remote를 중단하면 원격 로드 실패와 재시도 버튼이 보인다.
```
