"use client";

import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import CodeMirror from "@uiw/react-codemirror";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createMonorepoFileTree,
  editableMonorepoFiles,
  monorepoDisplayFiles,
  monorepoFilePaths,
  monorepoSteps,
  type EditableMonorepoPath,
  type MonorepoStep,
} from "./monorepo-practice-files";
import { useXRay } from "./xray-selector";

type PracticeStatus = "idle" | "booting" | "installing" | "ready" | "building" | "running" | "error";
type RuntimeResult = "idle" | "passed" | "failed";

let containerPromise: Promise<WebContainer> | undefined;
const ansiSequence = new RegExp("\\u001B\\[[0-?]*[ -/]*[@-~]", "g");
const processEnvironment = { CI: "1", NO_COLOR: "1", npm_config_color: "false", npm_config_progress: "false" };

export function MonorepoPractice() {
  const {
    practiceFrameWindow,
    practiceOpen,
    setPracticeFrameWindow,
    setPracticeOpen,
    setPracticePreviewUrl,
  } = useXRay();
  const [activePath, setActivePath] = useState<string>("apps/practice-web/src/App.tsx");
  const [files, setFiles] = useState<Record<EditableMonorepoPath, string>>({ ...editableMonorepoFiles });
  const [logs, setLogs] = useState("실습하기를 누르면 브라우저 안에 독립된 모노레포 환경을 준비합니다.");
  const [status, setStatus] = useState<PracticeStatus>("idle");
  const [drawerWidth, setDrawerWidth] = useState(560);
  const [activeStepId, setActiveStepId] = useState(monorepoSteps[0].id);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [runtimeResult, setRuntimeResult] = useState<RuntimeResult>("idle");
  const preparedRef = useRef<Promise<WebContainer> | null>(null);
  const buildProcessRef = useRef<WebContainerProcess | null>(null);
  const serverProcessRef = useRef<WebContainerProcess | null>(null);
  const serverUrlRef = useRef("");
  const previewOriginRef = useRef("");
  const runIdRef = useRef("");
  const editorExtensions = useMemo(() => [languageExtension(activePath)], [activePath]);

  const disposeEnvironment = useCallback(async () => {
    buildProcessRef.current?.kill();
    serverProcessRef.current?.kill();
    buildProcessRef.current = null;
    serverProcessRef.current = null;
    serverUrlRef.current = "";
    previewOriginRef.current = "";
    runIdRef.current = "";
    setPracticeFrameWindow(undefined);
    const task = preparedRef.current ?? containerPromise;
    preparedRef.current = null;
    containerPromise = undefined;
    const container = await task?.catch(() => undefined);
    container?.teardown();
  }, [setPracticeFrameWindow]);

  useEffect(() => {
    if (practiceOpen) {
      document.body.dataset.mfPractice = "open";
      document.body.style.setProperty("--mf-practice-width", `${drawerWidth}px`);
    } else {
      delete document.body.dataset.mfPractice;
      document.body.style.removeProperty("--mf-practice-width");
    }
    return () => {
      delete document.body.dataset.mfPractice;
      document.body.style.removeProperty("--mf-practice-width");
    };
  }, [drawerWidth, practiceOpen]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== previewOriginRef.current || event.source !== practiceFrameWindow || !isRuntimeMessage(event.data) || event.data.run !== runIdRef.current) return;
      if (event.data.type === "runtime-ready") {
        setRuntimeResult("passed");
        setStatus("running");
        appendLog(setLogs, "Practice Web이 workspace package를 실제로 렌더링했습니다.\n");
      } else {
        setRuntimeResult("failed");
        setStatus("error");
        appendLog(setLogs, "실습 앱 로드에 실패했습니다. 실행 로그를 확인하세요.\n");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [practiceFrameWindow]);

  useEffect(() => () => { void disposeEnvironment(); }, [disposeEnvironment]);

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const resize = (pointerEvent: PointerEvent) => setDrawerWidth(clampDrawerWidth(window.innerWidth - pointerEvent.clientX));
    const stop = () => {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stop, { once: true });
  }

  function resizeWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setDrawerWidth((current) => clampDrawerWidth(current + (event.key === "ArrowLeft" ? 32 : -32)));
  }

  function selectStep(step: MonorepoStep) {
    setActiveStepId(step.id);
    setActivePath(step.path);
    setAnswerOpen(false);
  }

  function updateFile(path: EditableMonorepoPath, value: string) {
    setFiles((current) => ({ ...current, [path]: value }));
    setRuntimeResult("idle");
    setPracticePreviewUrl(undefined);
  }

  function applyAnswer() {
    const step = monorepoSteps.find((item) => item.id === activeStepId);
    if (!step) return;
    const source = files[step.path];
    if (!source.includes(step.marker)) {
      appendLog(setLogs, `정답을 적용할 위치를 찾지 못했습니다: ${step.title}\n`);
      return;
    }
    updateFile(step.path, source.replace(step.marker, step.answer));
    appendLog(setLogs, `${step.title} 정답을 적용했습니다. 자동 검사를 확인하세요.\n`);
  }

  async function openPractice() {
    setPracticeOpen(true);
    if (status !== "idle" && status !== "error") return;
    try { await prepareContainer(); } catch (reason) { setStatus("error"); appendLog(setLogs, `오류: ${getErrorMessage(reason)}\n`); }
  }

  function prepareContainer() {
    preparedRef.current ??= (async () => {
      setStatus("booting");
      setLogs("WebContainer를 시작하는 중입니다...\n");
      const container = await getContainer();
      await container.mount(createMonorepoFileTree(files));
      setStatus("installing");
      appendLog(setLogs, "고정된 React와 Vite 의존성으로 workspace를 설치합니다.\n");
      const install = await container.spawn("npm", ["install", "--no-audit", "--no-fund", "--no-progress"], { env: processEnvironment });
      streamOutput(install, setLogs);
      if (await withTimeout(install.exit, 60_000, "의존성 설치 시간이 초과되었습니다.") !== 0) throw new Error("모노레포 의존성 설치에 실패했습니다.");
      setStatus("ready");
      appendLog(setLogs, "workspace 준비 완료. packages/ui 또는 App을 수정하고 실행하세요.\n");
      return container;
    })().catch(async (reason) => { await disposeEnvironment(); throw reason; });
    return preparedRef.current;
  }

  async function runPractice() {
    const incomplete = monorepoSteps.find((step) => !checkStep(step, files));
    if (incomplete) {
      selectStep(incomplete);
      appendLog(setLogs, `실행 전 검사: ${incomplete.title} 단계가 아직 통과하지 않았습니다.\n`);
      return;
    }
    try {
      validateFiles(files);
      const container = await prepareContainer();
      buildProcessRef.current?.kill();
      setStatus("building");
      setLogs("편집한 workspace 파일을 실습 환경에 저장합니다.\n");
      for (const [path, contents] of Object.entries(files)) await container.fs.writeFile(path, contents);
      appendLog(setLogs, "작성한 workspace 설정으로 의존성을 다시 연결합니다.\n");
      const install = await container.spawn("npm", ["install", "--no-audit", "--no-fund", "--no-progress"], { env: processEnvironment });
      streamOutput(install, setLogs);
      if (await withTimeout(install.exit, 60_000, "workspace 설치 시간이 초과되었습니다.") !== 0) throw new Error("작성한 workspace 설정을 설치하지 못했습니다.");
      appendLog(setLogs, "workspace 연결을 확인한 뒤 Practice Web을 빌드합니다.\n");
      const build = await container.spawn("npx", ["vite", "build", "--config", "apps/practice-web/vite.config.ts"], { env: processEnvironment });
      buildProcessRef.current = build;
      streamOutput(build, setLogs);
      if (await withTimeout(build.exit, 30_000, "Vite 빌드 시간이 초과되었습니다.") !== 0) throw new Error("모노레포 빌드에 실패했습니다. 위 로그를 확인하세요.");
      buildProcessRef.current = null;
      if (!serverProcessRef.current) serverUrlRef.current = await startServer(container, serverProcessRef, setLogs);
      const previewUrl = new URL(serverUrlRef.current);
      if (previewUrl.origin === window.location.origin) throw new Error("실습 미리보기는 CityWatch와 다른 출처에서 실행되어야 합니다.");
      previewOriginRef.current = previewUrl.origin;
      runIdRef.current = Date.now().toString();
      previewUrl.searchParams.set("run", runIdRef.current);
      previewUrl.searchParams.set("parentOrigin", window.location.origin);
      setPracticePreviewUrl(previewUrl.href);
      setRuntimeResult("idle");
      setStatus("running");
      appendLog(setLogs, "Practice Web을 실행했습니다. 왼쪽 workspace UI를 확인하세요.\n");
    } catch (reason) {
      await disposeEnvironment();
      setRuntimeResult("failed");
      setStatus("error");
      appendLog(setLogs, `오류: ${getErrorMessage(reason)}\n`);
    }
  }

  async function resetPractice() {
    await disposeEnvironment();
    setFiles({ ...editableMonorepoFiles });
    setActivePath("apps/practice-web/src/App.tsx");
    setActiveStepId(monorepoSteps[0].id);
    setAnswerOpen(false);
    setRuntimeResult("idle");
    setPracticePreviewUrl(undefined);
    setLogs("기본 workspace 파일로 초기화했습니다. 실행하면 새로 빌드합니다.");
    setStatus("idle");
  }

  const activeStep = monorepoSteps.find((step) => step.id === activeStepId) ?? monorepoSteps[0];
  const content = isEditablePath(activePath) ? files[activePath] : monorepoDisplayFiles[activePath] ?? "";
  const editablePaths = Object.keys(editableMonorepoFiles) as EditableMonorepoPath[];
  const activePassed = checkStep(activeStep, files);

  return (
    <>
      <button className="xray-practice-button" onClick={openPractice} type="button">실습하기</button>
      {practiceOpen ? (
        <aside aria-labelledby="monorepo-practice-title" className="mf-practice-drawer">
          <div aria-label="실습 패널 너비 조절" aria-orientation="vertical" aria-valuemax={900} aria-valuemin={380} aria-valuenow={drawerWidth} className="mf-practice-resizer" onKeyDown={resizeWithKeyboard} onPointerDown={startResize} role="separator" tabIndex={0} />
          <header className="mf-practice-drawer__header">
            <div><p className="eyebrow">Monorepo Practice</p><h2 id="monorepo-practice-title">workspace 패키지 실습</h2></div>
            <button aria-label="실습 패널 닫기" className="mf-practice-drawer__close" onClick={() => setPracticeOpen(false)} type="button">×</button>
          </header>
          <ol className="mf-practice-steps" aria-label="실습 단계">
            {monorepoSteps.map((step, index) => <li data-active={activeStep.id === step.id} data-passed={checkStep(step, files)} key={step.id}><button onClick={() => selectStep(step)} type="button"><span>{checkStep(step, files) ? "✓" : "○"}</span> {index + 1}. {step.title}</button></li>)}
            <li data-active={runtimeResult !== "idle"} data-passed={runtimeResult === "passed"}><span>{runtimeResult === "passed" ? "✓" : runtimeResult === "failed" ? "!" : "○"}</span> 4. 실제 빌드·화면 반영</li>
          </ol>
          <div className="mf-practice-workspace">
            <nav aria-label="실습 파일" className="mf-practice-files">
              <strong className="mf-practice-files__group">앱 · 읽기 전용</strong>
              {monorepoFilePaths.filter((path) => path.startsWith("apps/") && !isEditablePath(path)).map((path) => <FileButton key={path} path={path} activePath={activePath} onClick={() => setActivePath(path)} />)}
              <strong className="mf-practice-files__group mf-practice-files__group--remote">패키지·앱 · 직접 수정</strong>
              {editablePaths.map((path) => <FileButton key={path} path={path} activePath={activePath} onClick={() => selectStep(monorepoSteps.find((step) => step.path === path) ?? monorepoSteps[0])} edited={files[path] !== editableMonorepoFiles[path]} />)}
              <strong className="mf-practice-files__group mf-practice-files__group--reference">workspace 기반 · 읽기 전용</strong>
              {monorepoFilePaths.filter((path) => !path.startsWith("apps/") && !isEditablePath(path)).map((path) => <FileButton key={path} path={path} activePath={activePath} onClick={() => setActivePath(path)} />)}
            </nav>
            <section className="mf-practice-editor" aria-labelledby="monorepo-file-title">
              <div className="mf-practice-editor__title"><strong id="monorepo-file-title">{activePath}</strong><span>{codeLanguage(activePath)} · {isEditablePath(activePath) ? "직접 편집 · Prettier 정리 가능" : "문법 강조 · 읽기 전용"}</span></div>
              <CodeMirror aria-label={`${activePath} 코드`} basicSetup={{ bracketMatching: true, closeBrackets: isEditablePath(activePath), foldGutter: true, highlightActiveLine: true, highlightActiveLineGutter: true, lineNumbers: true, searchKeymap: true }} className="mf-practice-code-editor" editable={isEditablePath(activePath)} extensions={editorExtensions} height="100%" key={activePath} onChange={isEditablePath(activePath) ? (value) => updateFile(activePath, value) : undefined} theme={oneDark} value={content} />
            </section>
          </div>
          <section className="mf-practice-guide" aria-labelledby="monorepo-guide-title">
            <div><p className="eyebrow">현재 단계 · {monorepoSteps.findIndex((step) => step.id === activeStep.id) + 1} / {monorepoSteps.length}</p><h3 id="monorepo-guide-title">{activeStep.title}</h3></div>
            <p><b>할 일</b> · {activeStep.task}</p>
            <p className={activePassed ? "mf-practice-guide__success" : "mf-practice-guide__failure"}><b>{activePassed ? "통과" : "아직 미완료"}</b> · {activeStep.complete}</p>
            <div className="mf-practice-guide__actions"><button aria-pressed={answerOpen} className="mf-practice-guide__toggle" onClick={() => setAnswerOpen((value) => !value)} type="button">{answerOpen ? "정답 닫기" : "정답 보기"}</button><button className="secondary-button" onClick={applyAnswer} type="button">정답 적용</button></div>
            {answerOpen ? <div className="mf-practice-guide__details"><strong>정답 코드 · TODO 위치에 넣으세요</strong><pre><code>{activeStep.answer}</code></pre><p><b>구현 의미</b> · {activeStep.meaning}</p><p className="mf-practice-guide__success"><b>통과 기준</b> · {activeStep.complete}</p></div> : null}
          </section>
          <section className="mf-practice-host-guide" aria-labelledby="monorepo-guide-flow-title"><div><p className="eyebrow">workspace 연결 구조</p><h3 id="monorepo-guide-flow-title">앱이 내부 패키지를 사용하는 과정</h3></div><p>실습 프로젝트는 루트 workspace 아래에 앱과 패키지를 함께 둡니다. <code>apps/practice-web</code>은 <code>@practice/ui</code>를 package 이름으로 import하고, Vite가 workspace package의 변경 내용을 앱 번들에 포함합니다.</p><ol><li>루트 <code>workspaces</code>가 apps와 packages를 연결합니다.</li><li><code>packages/ui/src/index.ts</code>가 Public API를 제공합니다.</li><li>앱이 <code>@practice/ui</code>를 import합니다.</li><li>빌드된 결과가 왼쪽 실습 화면에 표시됩니다.</li></ol></section>
          <section className="mf-practice-console" aria-label="빌드 로그"><div><strong>실행 로그</strong><span aria-live="polite">{statusLabel(status)}</span></div><pre aria-live="polite">{logs}</pre></section>
          <footer className="mf-practice-actions"><button className="primary-button" disabled={status === "booting" || status === "installing" || status === "building"} onClick={runPractice} type="button">실행</button><button className="secondary-button" disabled={status !== "building"} onClick={() => buildProcessRef.current?.kill()} type="button">중지</button><button className="secondary-button" onClick={resetPractice} type="button">초기화</button></footer>
        </aside>
      ) : null}
    </>
  );
}

function FileButton({ path, activePath, onClick, edited = false }: { path: string; activePath: string; onClick: () => void; edited?: boolean }) {
  return <button aria-current={activePath === path ? "page" : undefined} className={activePath === path ? "mf-practice-file mf-practice-file--active" : "mf-practice-file"} onClick={onClick} type="button"><span>{path}</span><small>{edited ? "수정됨" : "읽기"}</small></button>;
}

function getContainer() { containerPromise ??= import("@webcontainer/api").then(({ WebContainer }) => WebContainer.boot({ coep: "credentialless", forwardPreviewErrors: "exceptions-only" })); return containerPromise; }
function isEditablePath(path: string): path is EditableMonorepoPath { return path in editableMonorepoFiles; }
function checkStep(step: MonorepoStep, files: Record<EditableMonorepoPath, string>) {
  const root = files["package.json"];
  const appPackage = files["apps/practice-web/package.json"];
  const uiPackage = files["packages/ui/package.json"];
  const ui = files["packages/ui/src/status-card.tsx"];
  const api = files["packages/ui/src/index.ts"];
  const app = files["apps/practice-web/src/App.tsx"];
  if (step.id === "root-workspaces") return /"workspaces"\s*:\s*\[\s*"apps\/\*"\s*,\s*"packages\/\*"\s*\]/.test(root);
  if (step.id === "app-workspace") return /"name"\s*:\s*"@practice\/web"/.test(appPackage) && /"private"\s*:\s*true/.test(appPackage) && /"@practice\/ui"\s*:\s*"0\.0\.0"/.test(appPackage);
  if (step.id === "package-workspace") return /"name"\s*:\s*"@practice\/ui"/.test(uiPackage) && /"main"\s*:\s*"\.\/src\/index\.ts"/.test(uiPackage);
  if (step.id === "ui-public-api") return /export\s+\{\s*StatusCard\s*\}\s+from\s+["']\.\/status-card["']/.test(api);
  if (step.id === "ui-component") return /return\s*\([\s\S]*<article className="status-card">[\s\S]*\{title\}[\s\S]*\{value\}/.test(ui);
  return /<StatusCard\s+title=/.test(app) && /value=/.test(app);
}
function isRuntimeMessage(value: unknown): value is { type: "runtime-ready" | "runtime-error"; run: string } { if (!value || typeof value !== "object") return false; const message = value as { source?: unknown; type?: unknown; run?: unknown }; return message.source === "citywatch-monorepo-practice" && (message.type === "runtime-ready" || message.type === "runtime-error") && typeof message.run === "string"; }
function languageExtension(path: string) { if (path.endsWith(".tsx") || path.endsWith(".ts")) return javascript({ jsx: path.endsWith(".tsx"), typescript: true }); if (path.endsWith(".json")) return json(); if (path.endsWith(".css")) return css(); return []; }
function codeLanguage(path: string) { if (path.endsWith(".tsx")) return "TSX"; if (path.endsWith(".ts")) return "TypeScript"; if (path.endsWith(".json")) return "JSON"; if (path.endsWith(".css")) return "CSS"; return "텍스트"; }
function clampDrawerWidth(width: number) { return Math.min(Math.max(width, 380), Math.max(380, window.innerWidth * 0.8)); }
function validateFiles(files: Record<EditableMonorepoPath, string>) { const values = Object.values(files); if (values.some((value) => value.length > 50_000)) throw new Error("파일 하나는 50KB를 넘을 수 없습니다."); if (values.reduce((sum, value) => sum + value.length, 0) > 100_000) throw new Error("전체 편집 코드는 100KB를 넘을 수 없습니다."); }
function appendLog(setLogs: React.Dispatch<React.SetStateAction<string>>, value: string) { setLogs((current) => `${current}${value.replace(ansiSequence, "").replaceAll("\r", "")}`.slice(-24_000)); }
function streamOutput(process: WebContainerProcess, setLogs: React.Dispatch<React.SetStateAction<string>>) { void process.output.pipeTo(new WritableStream({ write: (value) => appendLog(setLogs, value) })).catch(() => undefined); }
async function startServer(container: WebContainer, ref: React.MutableRefObject<WebContainerProcess | null>, setLogs: React.Dispatch<React.SetStateAction<string>>) { const ready = new Promise<string>((resolve) => { const unsubscribe = container.on("server-ready", (port, url) => { if (port !== 4173) return; unsubscribe(); resolve(url); }); }); const server = await container.spawn("node", ["server.mjs"], { env: processEnvironment }); ref.current = server; streamOutput(server, setLogs); return withTimeout(ready, 15_000, "Practice Web 서버가 준비되지 않았습니다."); }
function getErrorMessage(reason: unknown) { return reason instanceof Error ? reason.message : "알 수 없는 실행 오류"; }
function statusLabel(status: PracticeStatus) { return ({ idle: "대기", booting: "환경 시작 중", installing: "의존성 설치 중", ready: "실행 가능", building: "Vite 빌드 중", running: "화면 반영됨", error: "오류" })[status]; }
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) { return new Promise<T>((resolve, reject) => { const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs); promise.then((value) => { window.clearTimeout(timeout); resolve(value); }, (reason) => { window.clearTimeout(timeout); reject(reason); }); }); }
