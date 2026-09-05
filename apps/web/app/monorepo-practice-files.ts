import type { FileSystemTree } from "@webcontainer/api";

export const editableMonorepoFiles = {
  "package.json": `{
  "name": "citywatch-monorepo-practice",
  "private": true,
  "workspaces": ["TODO_APPS", "TODO_PACKAGES"],
  "type": "module",
  "dependencies": {
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "vite": "8.1.5"
  }
}
`,
  "apps/practice-web/package.json": `{
  "name": "@practice/web",
  "version": "0.0.0",
  "private": true
}
`,
  "packages/ui/package.json": `{
  "name": "practice-ui",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts"
}
`,
  "packages/ui/src/index.ts": `// TODO(ui-public-api): StatusCard를 Public API로 export하세요.
`,
  "apps/practice-web/src/App.tsx": `import { StatusCard } from "@practice/ui";

export function App() {
  return (
    <main className="practice-app">
      <p className="eyebrow">CityWatch Monorepo Practice</p>
      <h1>내가 구성한 workspace</h1>
      <div className="card-grid">
        {/* TODO(app-consumer): workspace package 컴포넌트를 사용하세요. */}
      </div>
    </main>
  );
}
`,
  "packages/ui/src/status-card.tsx": `type StatusCardProps = {
  title: string;
  value: string;
};

export function StatusCard({ title, value }: StatusCardProps) {
  // TODO(ui-component): 공용 UI 컴포넌트를 완성하세요.
  return null;
}
`,
} as const;

export type EditableMonorepoPath = keyof typeof editableMonorepoFiles;

export type MonorepoStep = {
  id: string;
  path: EditableMonorepoPath;
  title: string;
  task: string;
  marker: string;
  answer: string;
  meaning: string;
  complete: string;
};

export const monorepoSteps: readonly MonorepoStep[] = [
  {
    id: "root-workspaces",
    path: "package.json",
    title: "루트 workspace 설정",
    task: "루트 package.json에서 apps와 packages를 workspace로 등록하세요.",
    marker: '"workspaces": ["TODO_APPS", "TODO_PACKAGES"]',
    answer: '"workspaces": ["apps/*", "packages/*"]',
    meaning: "루트 workspace가 저장소 안의 앱과 공유 패키지를 하나의 의존성 그래프로 묶습니다.",
    complete: 'workspaces에 "apps/*"와 "packages/*"가 있어야 합니다.',
  },
  {
    id: "app-workspace",
    path: "apps/practice-web/package.json",
    title: "앱 workspace 등록",
    task: "실행 앱을 독립적인 workspace package로 설정하세요.",
    marker: '"private": true',
    answer: '"private": true,\n  "dependencies": {\n    "@practice/ui": "0.0.0"\n  }',
    meaning: "apps/practice-web이 루트 모노레포 안에서 독립적인 앱 workspace가 됩니다.",
    complete: "앱 package.json에 @practice/ui workspace dependency가 필요합니다.",
  },
  {
    id: "package-workspace",
    path: "packages/ui/package.json",
    title: "공용 패키지 workspace 등록",
    task: "공용 UI 패키지의 이름과 진입점을 설정하세요.",
    marker: '"name": "practice-ui"',
    answer: '"name": "@practice/ui"',
    meaning: "package name은 앱이 import할 이름이고, main은 패키지의 공개 진입점입니다.",
    complete: 'name이 "@practice/ui"여야 하고 main은 ./src/index.ts를 가리켜야 합니다.',
  },
  {
    id: "ui-public-api",
    path: "packages/ui/src/index.ts",
    title: "패키지 Public API 구성",
    task: "패키지 내부의 StatusCard를 Public API로 export하세요.",
    marker: "// TODO(ui-public-api): StatusCard를 Public API로 export하세요.",
    answer: 'export { StatusCard } from "./status-card";',
    meaning: "앱이 패키지 내부 파일 경로에 결합되지 않도록 index.ts를 공개 진입점으로 사용합니다.",
    complete: "./status-card에서 StatusCard를 export해야 합니다.",
  },
  {
    id: "ui-component",
    path: "packages/ui/src/status-card.tsx",
    title: "공용 컴포넌트 작성",
    task: "packages/ui에서 재사용할 StatusCard JSX를 반환하세요.",
    marker: "// TODO(ui-component): 공용 UI 컴포넌트를 완성하세요.",
    answer: `return (
    <article className="status-card">
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );`,
    meaning: "공용 UI 패키지가 소유한 컴포넌트가 소비 앱의 화면에 표시됩니다.",
    complete: "StatusCard가 title과 value를 화면에 렌더링해야 합니다.",
  },
  {
    id: "app-consumer",
    path: "apps/practice-web/src/App.tsx",
    title: "앱에서 패키지 import",
    task: "앱에서 @practice/ui의 StatusCard를 렌더링하세요.",
    marker: "{/* TODO(app-consumer): workspace package 컴포넌트를 사용하세요. */}",
    answer: `<StatusCard title="공유 패키지" value="@practice/ui" />
        <StatusCard title="workspace" value="연결 완료" />`,
    meaning: "앱이 상대 경로가 아니라 workspace package 이름과 동일 버전으로 공용 패키지를 사용합니다.",
    complete: "App JSX 안에 StatusCard가 렌더링되어야 합니다.",
  },
];

const bootstrapPackage = JSON.stringify({
  name: "citywatch-monorepo-practice",
  private: true,
  type: "module",
  dependencies: { react: "19.2.7", "react-dom": "19.2.7", vite: "8.1.5" },
}, null, 2);
const indexHtml = `<!doctype html><html lang="ko"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>CityWatch Monorepo Practice</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`;
const mainTsx = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
const root = document.getElementById("root");
if (!root) throw new Error("#root element를 찾지 못했습니다.");
createRoot(root).render(<StrictMode><App /></StrictMode>);
const params = new URLSearchParams(location.search);
const parentOrigin = params.get("parentOrigin");
const run = params.get("run");
if (parentOrigin && run) window.parent.postMessage({ source: "citywatch-monorepo-practice", type: "runtime-ready", run }, parentOrigin);
`;
const viteConfig = `import { defineConfig } from "vite";
export default defineConfig({
  resolve: { alias: { "@practice/ui": new URL("../../packages/ui/src/index.ts", import.meta.url).pathname } },
  build: { outDir: "../../dist/monorepo", emptyOutDir: true, target: "es2022" },
  root: "apps/practice-web",
});
`;
const styles = `* { box-sizing: border-box; } body { margin: 0; background: #f8fafc; color: #172033; font-family: Arial, sans-serif; } .practice-app { display: grid; gap: 16px; min-height: 100vh; padding: 28px; } .eyebrow { color: #2563eb; font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; } h1, p { margin: 0; } h1 { font-size: 24px; } .card-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); } .status-card { display: grid; gap: 10px; padding: 18px; border: 2px solid #60a5fa; border-radius: 12px; background: white; box-shadow: 0 12px 24px #0f172a14; } .status-card span { color: #64748b; font-size: 13px; font-weight: 700; } .status-card strong { color: #1d4ed8; font-size: 22px; }`;
const serverSource = `import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("./dist/monorepo", import.meta.url));
const mime = { ".css": "text/css", ".js": "text/javascript", ".html": "text/html" };
createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  const file = normalize(join(root, pathname === "/" ? "/index.html" : pathname));
  if (!file.startsWith(root)) { response.writeHead(404).end(); return; }
  try { response.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream" }).end(await readFile(file)); } catch { response.writeHead(404).end("Not found"); }
}).listen(4173, "0.0.0.0");
`;

export const monorepoDisplayFiles: Record<string, string> = { "apps/practice-web/index.html": indexHtml, "apps/practice-web/src/main.tsx": mainTsx, "apps/practice-web/src/styles.css": styles, "apps/practice-web/vite.config.ts": viteConfig, "server.mjs": serverSource };
export const monorepoFilePaths = ["package.json", "apps/practice-web/package.json", "apps/practice-web/vite.config.ts", "apps/practice-web/index.html", "apps/practice-web/src/main.tsx", "apps/practice-web/src/App.tsx", "apps/practice-web/src/styles.css", "packages/ui/package.json", "packages/ui/src/index.ts", "packages/ui/src/status-card.tsx", "server.mjs"] as const;

export function createMonorepoFileTree(files: Record<EditableMonorepoPath, string>): FileSystemTree {
  return {
    "package.json": { file: { contents: bootstrapPackage } },
    apps: { directory: {
      "practice-web": { directory: {
        "package.json": { file: { contents: files["apps/practice-web/package.json"] } },
        "index.html": { file: { contents: indexHtml } },
        src: { directory: {
          "main.tsx": { file: { contents: mainTsx } },
          "App.tsx": { file: { contents: files["apps/practice-web/src/App.tsx"] } },
          "styles.css": { file: { contents: styles } },
        } },
        "vite.config.ts": { file: { contents: viteConfig } },
      } },
    } },
    packages: { directory: {
      ui: { directory: {
        "package.json": { file: { contents: files["packages/ui/package.json"] } },
        src: { directory: {
          "index.ts": { file: { contents: files["packages/ui/src/index.ts"] } },
          "status-card.tsx": { file: { contents: files["packages/ui/src/status-card.tsx"] } },
        } },
      } },
    } },
    "server.mjs": { file: { contents: serverSource } },
  };
}
