import type { FileSystemTree } from "@webcontainer/api";

export const editablePracticeFiles = {
  "remote/vite.config.ts": `import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/remote/",
  build: {
    emptyOutDir: true,
    outDir: "../dist/remote",
    target: "es2022",
  },
  plugins: [
    federation({
      // TODO(remote-basics): Remote 이름과 manifest를 설정하세요.
      // TODO(remote-expose): AnalyticsMetrics 파일을 공개하세요.
      // TODO(remote-react-share): React singleton을 설정하세요.
    }),
  ],
  root: "remote",
});
`,
  "remote/src/AnalyticsMetrics.tsx": `type Incident = {
  // TODO(remote-incident-type): Host가 전달할 사고 데이터의 필드를 작성하세요.
};

export function AnalyticsMetrics(
  // TODO(remote-component-props): incidents props를 작성하세요.
) {
  // TODO(remote-render): 지표를 계산하고 JSX를 반환하세요.
}
`,
} as const;

export type EditablePracticePath = keyof typeof editablePracticeFiles;

// User-written config is checked in the editor, but never executed. This is the
// only Vite config mounted for an actual build, so config code cannot mutate the
// practice Host, server, or package scripts.
export const safeRemoteViteConfig = `import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/remote/",
  build: {
    emptyOutDir: true,
    outDir: "../dist/remote",
    target: "es2022",
  },
  plugins: [
    federation({
      name: "practice_remote",
      filename: "remoteEntry.js",
      manifest: true,
      dts: false,
      exposes: {
        "./analytics-metrics": "./src/AnalyticsMetrics.tsx",
      },
      shared: {
        react: { singleton: true },
      },
    }),
  ],
  root: "remote",
});
`;

export type PracticeStep = {
  id: string;
  path: EditablePracticePath;
  title: string;
  task: string;
  marker: string;
  answer: string;
  meaning: string;
  complete: string;
};

export const practiceSteps: readonly PracticeStep[] = [
  {
    id: "remote-basics",
    path: "remote/vite.config.ts",
    title: "Remote 기본 설정",
    task: "federation({ ... }) 안에서 Remote 이름과 manifest 생성을 설정하세요.",
    marker: "// TODO(remote-basics): Remote 이름과 manifest를 설정하세요.",
    answer: `name: "practice_remote",
filename: "remoteEntry.js",
manifest: true,
dts: false,`,
    meaning: "name은 Host가 manifest에 등록할 Remote 식별자이고, manifest: true는 Host가 읽을 mf-manifest.json을 만듭니다.",
    complete: "name: practice_remote, filename: remoteEntry.js, manifest: true가 모두 설정되어야 합니다.",
  },
  {
    id: "remote-expose",
    path: "remote/vite.config.ts",
    title: "공개 모듈 등록",
    task: "Host가 요청할 이름과 실제 TSX 파일을 exposes로 연결하세요.",
    marker: "// TODO(remote-expose): AnalyticsMetrics 파일을 공개하세요.",
    answer: `exposes: {
  "./analytics-metrics": "./src/AnalyticsMetrics.tsx",
},`,
    meaning: "Host는 practice_remote/analytics-metrics를 요청합니다. 이 별칭이 AnalyticsMetrics.tsx 파일을 가리켜야 Remote를 가져올 수 있습니다.",
    complete: "./analytics-metrics가 ./src/AnalyticsMetrics.tsx를 가리켜야 합니다.",
  },
  {
    id: "remote-react-share",
    path: "remote/vite.config.ts",
    title: "React 공유 설정",
    task: "Host와 Remote가 같은 React 인스턴스를 쓰도록 shared 설정을 추가하세요.",
    marker: "// TODO(remote-react-share): React singleton을 설정하세요.",
    answer: `shared: {
  react: { singleton: true },
},`,
    meaning: "React를 두 번 로드하면 Hook 오류가 날 수 있습니다. singleton: true는 Host와 Remote가 하나의 React를 공유하게 합니다.",
    complete: "shared.react.singleton 값이 true여야 합니다.",
  },
  {
    id: "remote-incident-type",
    path: "remote/src/AnalyticsMetrics.tsx",
    title: "사고 데이터 타입",
    task: "Incident 타입 안에 영향 인원과 심각도 필드를 작성하세요.",
    marker: "// TODO(remote-incident-type): Host가 전달할 사고 데이터의 필드를 작성하세요.",
    answer: `affectedPeople: number;
severity: "low" | "medium" | "high" | "critical";`,
    meaning: "Host가 전달하는 incidents 항목의 모양을 선언합니다. 잘못된 severity나 없는 필드 접근을 빌드 전에 발견할 수 있습니다.",
    complete: "affectedPeople: number와 severity의 네 단계 union이 모두 있어야 합니다.",
  },
  {
    id: "remote-component-props",
    path: "remote/src/AnalyticsMetrics.tsx",
    title: "Remote 컴포넌트 export",
    task: "Host가 전달하는 incidents를 받는 AnalyticsMetrics named export를 작성하세요.",
    marker: "// TODO(remote-component-props): incidents props를 작성하세요.",
    answer: `{ incidents }: { incidents: readonly Incident[] }`,
    meaning: "Host는 Remote 모듈에서 AnalyticsMetrics named export를 찾아 incidents 데이터를 props로 전달합니다.",
    complete: "AnalyticsMetrics가 named export이고 incidents: readonly Incident[] props를 받아야 합니다.",
  },
  {
    id: "remote-render",
    path: "remote/src/AnalyticsMetrics.tsx",
    title: "지표 계산과 JSX 렌더링",
    task: "critical 사고 수와 영향 인원을 계산한 뒤, 화면에 표시할 JSX를 반환하세요.",
    marker: "// TODO(remote-render): 지표를 계산하고 JSX를 반환하세요.",
    answer: `const critical = incidents.filter(
  (incident) => incident.severity === "critical",
).length;
const affectedPeople = incidents.reduce(
  (sum, incident) => sum + incident.affectedPeople,
  0,
);

return (
  <section className="remote-card">
    <p className="remote-label">Practice Remote</p>
    <h2>내가 만든 원격 사고 분석</h2>
    <div className="remote-metrics">
      <strong>{incidents.length}건</strong>
      <span>긴급 {critical}건 · 영향 인원 {affectedPeople}명</span>
    </div>
  </section>
);`,
    meaning: "계산과 UI는 Remote가 소유합니다. 실행 후 이 JSX가 실제 Vite chunk로 빌드돼 Host의 왼쪽 미리보기에 렌더링됩니다.",
    complete: "incidents를 사용한 critical 계산, affectedPeople 합계, JSX return이 모두 필요합니다.",
  },
];

export const practiceFileGuide: Record<
  EditablePracticePath,
  {
    goal: string;
    checks: string[];
    details: string[];
    tutorial: Array<{
      title: string;
      instruction: string;
      code: string;
      meaning: string;
      success: string;
    }>;
  }
> = {
  "remote/vite.config.ts": {
    goal: "Remote 이름, expose 경로, React singleton을 설정합니다.",
    checks: [
      'name: "practice_remote"',
      '"./analytics-metrics" expose 등록',
      "manifest: true",
      "dts: false (브라우저 실습에서는 타입 파일 생성을 생략)",
      "shared.react.singleton: true",
    ],
    details: [
      "name은 Host가 manifest에 등록할 Remote 식별자입니다.",
      "exposes의 왼쪽 값은 Host가 loadRemote로 요청하는 공개 이름이고, 오른쪽 값은 실제 TSX 파일입니다.",
      "manifest를 켜면 빌드 결과에 mf-manifest.json이 생성됩니다.",
      "React singleton은 Host와 Remote가 같은 React 인스턴스를 공유하게 해 Hook 충돌을 막습니다.",
    ],
    tutorial: [
      {
        title: "1. federation({ ... }) 안에서 Remote의 정체성을 만듭니다",
        instruction: "remote/vite.config.ts에서 federation({ 를 찾으세요. 그 괄호 안에 아래 세 줄이 있어야 합니다. 기존에 같은 항목이 있으면 추가하지 말고 값을 교체하세요.",
        code: `name: "practice_remote",
filename: "remoteEntry.js",
manifest: true,`,
        meaning: "name은 Host가 Remote를 등록할 때 쓰는 이름입니다. manifest: true가 빌드 결과에 mf-manifest.json을 생성합니다.",
        success: "나중에 실행 로그에서 dist/remote/mf-manifest.json이 보이면 이 단계가 성공입니다.",
      },
      {
        title: "2. Host에 공개할 TSX 파일을 exposes로 연결합니다",
        instruction: "같은 federation({ ... }) 안에 아래 exposes 블록을 작성하세요. 왼쪽 문자열은 Host가 요청할 공개 이름이고, 오른쪽은 실제 TSX의 상대 경로입니다.",
        code: `exposes: {
  "./analytics-metrics": "./src/AnalyticsMetrics.tsx",
},`,
        meaning: "Host는 practice_remote/analytics-metrics를 요청합니다. 이때 ./analytics-metrics가 AnalyticsMetrics.tsx 파일을 가리키게 됩니다.",
        success: "경로의 대소문자와 파일명까지 정확히 맞으면 다음 단계로 갑니다.",
      },
      {
        title: "3. Host와 Remote가 하나의 React를 공유하게 합니다",
        instruction: "exposes 다음에 아래 shared 블록을 추가하세요. React Hook 오류를 피하기 위해 singleton 값을 true로 둡니다.",
        code: `shared: {
  react: { singleton: true },
},`,
        meaning: "Host와 Remote가 React를 각각 로드하면 Hook이 깨질 수 있습니다. singleton: true는 같은 React 인스턴스를 사용하게 합니다.",
        success: "name, exposes, shared가 모두 federation({ ... }) 괄호 안에 있으면 설정 파일 작성은 끝입니다.",
      },
    ],
  },
  "remote/src/AnalyticsMetrics.tsx": {
    goal: "Host가 불러올 AnalyticsMetrics React 컴포넌트를 작성합니다.",
    checks: [
      "AnalyticsMetrics named export",
      "incidents props 사용",
      "유효한 JSX 반환",
    ],
    details: [
      "이 named export가 Federation을 통해 Host에 전달되는 실제 React 컴포넌트입니다.",
      "Host가 incidents 데이터를 props로 넘기므로 운영 DOM이나 전역 상태에 직접 접근할 필요가 없습니다.",
      "내용이나 계산식을 수정하고 실행하면 Vite가 새 chunk를 만들고 왼쪽 iframe이 새 결과를 불러옵니다.",
    ],
    tutorial: [
      {
        title: "1. 파일 맨 위에 Host가 주는 incidents의 타입을 선언합니다",
        instruction: "remote/src/AnalyticsMetrics.tsx의 가장 위에 아래 타입을 둡니다. severity 문자열은 네 값 중 하나여야 하므로 철자를 그대로 복사하세요.",
        code: `type Incident = {
  affectedPeople: number;
  severity: "low" | "medium" | "high" | "critical";
};`,
        meaning: "이 타입은 Host가 넘기는 incidents 배열의 항목 모양을 문서화하고, 계산 코드의 실수를 빌드 전에 잡아 줍니다.",
        success: "파일에 Incident 타입이 한 번만 있으면 됩니다.",
      },
      {
        title: "2. Federation이 불러올 컴포넌트를 named export합니다",
        instruction: "타입 아래에 아래 함수 선언을 작성하세요. export와 AnalyticsMetrics라는 이름은 바꾸지 마세요. Host가 이 이름으로 모듈을 검사합니다.",
        code: `export function AnalyticsMetrics({ incidents }: {
  incidents: readonly Incident[];
}) {`,
        meaning: "default export가 아니라 named export여야 Host의 module.AnalyticsMetrics 조회와 일치합니다.",
        success: "마지막 단계에서 함수 본문을 닫는 }를 반드시 추가해야 합니다.",
      },
      {
        title: "3. incidents로 긴급 사고 수와 영향 인원을 계산합니다",
        instruction: "AnalyticsMetrics 함수의 여는 { 바로 다음에 아래 두 계산을 넣습니다. 이미 동일한 변수가 있다면 하나만 남기세요.",
        code: `const critical = incidents.filter(
  (incident) => incident.severity === "critical",
).length;

const affectedPeople = incidents.reduce(
  (sum, incident) => sum + incident.affectedPeople,
  0,
);`,
        meaning: "filter는 critical 사고만 세고, reduce는 모든 사고의 affectedPeople을 더합니다. 계산은 Remote 안에 있으므로 표시 방식은 Remote가 스스로 결정합니다.",
        success: "critical과 affectedPeople 변수가 각각 한 번씩 선언되면 됩니다.",
      },
      {
        title: "4. 계산 결과를 JSX로 반환하고 실행합니다",
        instruction: "계산 코드 아래에 아래 return 블록을 넣고 함수의 }로 닫으세요. h2의 문구는 자유롭게 바꿔도 됩니다.",
        code: `return (
  <section className="remote-card">
    <p className="remote-label">Practice Remote</p>
    <h2>내가 만든 원격 사고 분석</h2>
    <strong>{incidents.length}건</strong>
    <span>긴급 {critical}건 · 영향 인원 {affectedPeople}명</span>
  </section>
);
}`,
        meaning: "이 JSX가 실제로 빌드된 Remote chunk에 들어가고, Host가 manifest를 통해 불러와 왼쪽 미리보기에 렌더링합니다.",
        success: "실행 버튼을 누른 뒤 왼쪽 ‘실제 Module Federation 미리보기’에 바꾼 h2 문구가 나타나면 실습 완료입니다.",
      },
    ],
  },
};

const packageJson = JSON.stringify(
  {
    name: "citywatch-module-federation-practice",
    private: true,
    type: "module",
    scripts: {
      build: "npm run build:remote && npm run build:host",
      "build:host": "vite build --config host/vite.config.ts",
      "build:remote": "vite build --config remote/vite.config.ts",
      format: "prettier --write remote/vite.config.ts remote/src/AnalyticsMetrics.tsx",
      start: "node server.mjs",
    },
    dependencies: {
      "@module-federation/runtime": "2.8.2",
      "@module-federation/vite": "1.20.7",
      react: "19.2.7",
      "react-dom": "19.2.7",
      vite: "8.1.5",
    },
    devDependencies: {
      prettier: "3.5.3",
    },
  },
  null,
  2,
);

const hostIndexHtml = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CityWatch Practice Host</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const remoteIndexHtml = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CityWatch Practice Remote</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const hostViteConfig = `import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: "../dist/host",
    target: "es2022",
  },
  root: "host",
});
`;

const hostMain = `import { createInstance } from "@module-federation/runtime";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const incidents = [
  { affectedPeople: 12, severity: "critical" },
  { affectedPeople: 4, severity: "high" },
  { affectedPeople: 2, severity: "medium" },
];

function App() {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    const run = new URLSearchParams(location.search).get("run") ?? Date.now().toString();
    const parentOrigin = new URLSearchParams(location.search).get("parentOrigin");
    const runtime = createInstance({
      name: "practice_host_" + run,
      remotes: [{
        entry: new URL("/remote/mf-manifest.json?run=" + run, location.href).href,
        name: "practice_remote",
      }],
      shared: {
        react: {
          lib: () => React,
          scope: "default",
          shareConfig: { requiredVersion: React.version, singleton: true },
          version: React.version,
        },
      },
    });

    runtime.loadRemote("practice_remote/analytics-metrics")
      .then((module) => {
        if (!module || typeof module.AnalyticsMetrics !== "function") {
          throw new Error("AnalyticsMetrics export를 찾지 못했습니다.");
        }
        setState({ Component: module.AnalyticsMetrics, status: "ready" });
        if (parentOrigin) {
          window.parent.postMessage({ source: "citywatch-mf-practice", type: "runtime-ready", run }, parentOrigin);
        }
      })
      .catch((reason) => {
        setState({
          message: reason instanceof Error ? reason.message : "Remote 로드 실패",
          status: "error",
        });
        if (parentOrigin) {
          window.parent.postMessage({ source: "citywatch-mf-practice", type: "runtime-error", run }, parentOrigin);
        }
      });
  }, []);

  return (
    <main className="practice-host">
      <header>
        <p>CityWatch Practice Host</p>
        <h1>실제 Module Federation 미리보기</h1>
      </header>
      {state.status === "loading" ? <p role="status">manifest와 Remote를 불러오는 중입니다.</p> : null}
      {state.status === "error" ? <p className="error" role="alert">{state.message}</p> : null}
      {state.status === "ready" ? <state.Component incidents={incidents} /> : null}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
`;

const hostStyles = `* {
  box-sizing: border-box;
}

body {
  background: #f6f7f9;
  color: #172033;
  font-family: Arial, sans-serif;
  margin: 0;
}

.practice-host {
  display: grid;
  gap: 18px;
  min-height: 100vh;
  padding: 24px;
}

header p,
header h1 {
  margin: 0;
}

header p {
  color: #2563eb;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

header h1 {
  font-size: 24px;
  margin-top: 6px;
}

.remote-card {
  background: #fff7ed;
  border: 2px solid #fb923c;
  border-radius: 10px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
  display: grid;
  gap: 12px;
  padding: 20px;
}

.remote-card h2,
.remote-card p {
  margin: 0;
}

.remote-label {
  color: #c2410c;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.remote-metrics {
  align-items: baseline;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.remote-metrics strong {
  font-size: 32px;
}

.remote-metrics span {
  color: #64748b;
  font-weight: 700;
}

.error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  padding: 12px;
}
`;

const remoteMain = `import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { AnalyticsMetrics } from "./AnalyticsMetrics";

const root = document.getElementById("root");

if (!root) {
  throw new Error("#root element를 찾지 못했습니다.");
}

createRoot(root).render(
  createElement(AnalyticsMetrics, { incidents: [] }),
);
`;

const serverSource = `import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { readFile } from "node:fs/promises";

const port = 4173;
const hostRoot = join(process.cwd(), "dist/host");
const remoteRoot = join(process.cwd(), "dist/remote");
const types = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://practice").pathname);
  const remote = pathname.startsWith("/remote/");
  const root = remote ? remoteRoot : hostRoot;
  const relative = remote ? pathname.slice(8) : pathname.slice(1);
  const requested = normalize(join(root, relative || "index.html"));
  const file = requested.startsWith(root) ? requested : join(root, "index.html");

  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors *");
  response.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  response.setHeader("Referrer-Policy", "no-referrer");

  try {
    const content = await readFile(file);
    response.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
    response.end(content);
  } catch {
    try {
      response.setHeader("Content-Type", "text/html");
      response.end(await readFile(join(hostRoot, "index.html")));
    } catch {
      response.statusCode = 404;
      response.end("Practice build not found");
    }
  }
}).listen(port, "0.0.0.0");
`;

export const practiceDisplayFiles: Record<string, string> = {
  "package.json": packageJson,
  "server.mjs": serverSource,
  "host/index.html": hostIndexHtml,
  "host/vite.config.ts": hostViteConfig,
  "host/src/main.tsx": hostMain,
  "host/src/styles.css": hostStyles,
  "remote/index.html": remoteIndexHtml,
  "remote/vite.config.ts": editablePracticeFiles["remote/vite.config.ts"],
  "remote/src/main.tsx": remoteMain,
  "remote/src/AnalyticsMetrics.tsx": editablePracticeFiles["remote/src/AnalyticsMetrics.tsx"],
};

export function createPracticeFileTree(): FileSystemTree {
  return {
    "package.json": { file: { contents: packageJson } },
    "server.mjs": { file: { contents: serverSource } },
    host: {
      directory: {
        "index.html": {
          file: {
            contents: hostIndexHtml,
          },
        },
        "vite.config.ts": {
          file: {
            contents: hostViteConfig,
          },
        },
        src: {
          directory: {
            "main.tsx": { file: { contents: hostMain } },
            "styles.css": { file: { contents: hostStyles } },
          },
        },
      },
    },
    remote: {
      directory: {
        "index.html": {
          file: {
            contents: remoteIndexHtml,
          },
        },
        "vite.config.ts": { file: { contents: editablePracticeFiles["remote/vite.config.ts"] } },
        src: {
          directory: {
            "AnalyticsMetrics.tsx": { file: { contents: editablePracticeFiles["remote/src/AnalyticsMetrics.tsx"] } },
            "main.tsx": { file: { contents: remoteMain } },
          },
        },
      },
    },
  };
}

export const practiceFilePaths = [
  "package.json",
  "server.mjs",
  "host/index.html",
  "host/vite.config.ts",
  "host/src/main.tsx",
  "host/src/styles.css",
  "remote/index.html",
  "remote/vite.config.ts",
  "remote/src/main.tsx",
  "remote/src/AnalyticsMetrics.tsx",
] as const;
