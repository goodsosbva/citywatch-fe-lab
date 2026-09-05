"use client";

import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
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
  createPracticeFileTree,
  editablePracticeFiles,
  practiceDisplayFiles,
  practiceFilePaths,
  practiceSteps,
  safeRemoteViteConfig,
  type EditablePracticePath,
  type PracticeStep,
} from "./module-federation-practice-files";
import { useXRay } from "./xray-selector";

type PracticeStatus = "idle" | "booting" | "installing" | "formatting" | "ready" | "building" | "running" | "error";
type RuntimeResult = "idle" | "passed" | "failed";

let containerPromise: Promise<WebContainer> | undefined;
const ansiSequence = new RegExp("\\u001B\\[[0-?]*[ -/]*[@-~]", "g");
const spinnerSequence = /[|/\\-]{4,}/g;
const processEnvironment = {
  CI: "1",
  NO_COLOR: "1",
  npm_config_color: "false",
  npm_config_progress: "false",
};

export function ModuleFederationPractice() {
  const {
    practiceFrameWindow,
    practiceOpen,
    setPracticeFrameWindow,
    setPracticeOpen,
    setPracticePreviewUrl,
  } = useXRay();
  const [activePath, setActivePath] = useState<string>("remote/vite.config.ts");
  const [files, setFiles] = useState<Record<EditablePracticePath, string>>({ ...editablePracticeFiles });
  const [logs, setLogs] = useState("실습하기를 누르면 브라우저 안에 독립된 Node.js 환경을 준비합니다.");
  const [status, setStatus] = useState<PracticeStatus>("idle");
  const [drawerWidth, setDrawerWidth] = useState(560);
  const [activeStepId, setActiveStepId] = useState(practiceSteps[0].id);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [runtimeResult, setRuntimeResult] = useState<RuntimeResult>("idle");
  const editorExtensions = useMemo(() => [languageExtension(activePath)], [activePath]);
  const preparedRef = useRef<Promise<WebContainer> | null>(null);
  const buildProcessRef = useRef<WebContainerProcess | null>(null);
  const serverProcessRef = useRef<WebContainerProcess | null>(null);
  const serverUrlRef = useRef("");
  const previewOriginRef = useRef("");
  const runIdRef = useRef("");
  const disposePracticeEnvironment = useCallback(async () => {
    buildProcessRef.current?.kill();
    serverProcessRef.current?.kill();
    buildProcessRef.current = null;
    serverProcessRef.current = null;
    serverUrlRef.current = "";
    previewOriginRef.current = "";
    runIdRef.current = "";
    setPracticeFrameWindow(undefined);

    const containerTask = preparedRef.current ?? containerPromise;
    preparedRef.current = null;
    containerPromise = undefined;
    const container = await containerTask?.catch(() => undefined);
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
      if (
        event.origin !== previewOriginRef.current
        || event.source !== practiceFrameWindow
        || !isPracticeRuntimeMessage(event.data)
        || event.data.run !== runIdRef.current
      ) return;
      if (event.data.type === "runtime-ready") {
        setRuntimeResult("passed");
        appendLog("Host가 manifest를 읽고 AnalyticsMetrics Remote를 실제로 렌더링했습니다.\n");
        return;
      }
      setRuntimeResult("failed");
      setStatus("error");
      appendLog("Host runtime이 Remote를 불러오지 못했습니다. 실행 로그를 확인하세요.\n");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [practiceFrameWindow]);

  useEffect(() => () => {
    void disposePracticeEnvironment();
  }, [disposePracticeEnvironment]);

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const resize = (pointerEvent: PointerEvent) => {
      setDrawerWidth(clampDrawerWidth(window.innerWidth - pointerEvent.clientX));
    };
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

  function selectStep(step: PracticeStep) {
    setActiveStepId(step.id);
    setActivePath(step.path);
    setAnswerOpen(false);
  }

  function updateFile(path: EditablePracticePath, value: string) {
    setFiles((current) => ({ ...current, [path]: value }));
    setRuntimeResult("idle");
    setPracticePreviewUrl(undefined);
  }

  function applyAnswer() {
    const step = practiceSteps.find((item) => item.id === activeStepId);
    if (!step) return;
    const source = files[step.path];
    if (!source.includes(step.marker)) {
      appendLog(`정답을 적용할 TODO 위치를 찾지 못했습니다: ${step.title}\n`);
      return;
    }
    updateFile(step.path, source.replace(step.marker, step.answer));
    appendLog(`${step.title} 정답을 적용했습니다. 자동 검사를 확인하세요.\n`);
  }

  async function openPractice() {
    setPracticeOpen(true);
    if (status !== "idle" && status !== "error") return;
    try {
      await prepareContainer();
    } catch (reason) {
      fail(reason);
    }
  }

  function prepareContainer() {
    preparedRef.current ??= (async () => {
      setStatus("booting");
      setLogs("WebContainer를 시작하는 중입니다...\n");
      const container = await getContainer();
      await container.mount(createPracticeFileTree());

      setStatus("installing");
      appendLog("고정된 Vite와 Module Federation 의존성을 설치합니다.\n");
      const install = await container.spawn(
        "npm",
        ["install", "--no-audit", "--no-fund", "--no-progress"],
        { env: processEnvironment },
      );
      streamOutput(install);
      const exitCode = await withTimeout(install.exit, 60_000, "의존성 설치 시간이 초과되었습니다.");
      if (exitCode !== 0) throw new Error("의존성 설치에 실패했습니다.");

      setStatus("ready");
      appendLog("실습 환경 준비 완료. Remote 파일을 수정하고 실행하세요.\n");
      return container;
    })().catch(async (reason) => {
      await disposePracticeEnvironment();
      throw reason;
    });

    return preparedRef.current;
  }

  async function runPractice() {
    const incomplete = practiceSteps.find((step) => !checkStep(step, files).passed);
    if (incomplete) {
      selectStep(incomplete);
      appendLog(`실행 전 검사: ${incomplete.title} 단계가 아직 통과하지 않았습니다.\n`);
      return;
    }
    try {
      validateFiles(files);
      const container = await prepareContainer();
      buildProcessRef.current?.kill();
      setStatus("building");
      setLogs("편집한 파일을 Practice Remote에 저장합니다.\n");

      await container.fs.writeFile("remote/src/AnalyticsMetrics.tsx", files["remote/src/AnalyticsMetrics.tsx"]);
      await container.fs.writeFile("remote/vite.config.ts", safeRemoteViteConfig);

      appendLog("검사된 Federation 설정으로 Vite가 Host와 Remote를 실제로 빌드합니다.\n");
      const build = await container.spawn("npm", ["run", "build"], {
        env: processEnvironment,
      });
      buildProcessRef.current = build;
      streamOutput(build);
      const exitCode = await withTimeout(build.exit, 30_000, "Vite 빌드 시간이 초과되었습니다.");
      buildProcessRef.current = null;
      if (exitCode !== 0) throw new Error("Vite 빌드에 실패했습니다. 위 로그를 확인하세요.");

      if (!serverProcessRef.current) {
        appendLog("Practice Host 서버를 시작합니다.\n");
        serverUrlRef.current = await startServer(container);
      }

      const previewUrl = new URL(serverUrlRef.current);
      if (previewUrl.origin === window.location.origin) {
        throw new Error("실습 미리보기는 CityWatch와 다른 출처에서 실행되어야 합니다.");
      }
      previewOriginRef.current = previewUrl.origin;

      const runId = Date.now();
      runIdRef.current = runId.toString();
      previewUrl.searchParams.set("run", runIdRef.current);
      previewUrl.searchParams.set("parentOrigin", window.location.origin);
      setPracticePreviewUrl(previewUrl.href);
      setRuntimeResult("idle");
      setStatus("running");
      appendLog("manifest 등록과 loadRemote를 실행했습니다. 왼쪽 Remote 로딩 결과를 확인하는 중입니다.\n");
    } catch (reason) {
      await disposePracticeEnvironment();
      setRuntimeResult("failed");
      fail(reason);
    }
  }

  async function formatPractice() {
    try {
      const container = await prepareContainer();
      setStatus("formatting");
      appendLog("Prettier가 Remote 설정과 TSX 코드를 정리합니다.\n");
      await Promise.all(
        Object.entries(files).map(([path, contents]) => container.fs.writeFile(path, contents)),
      );
      const format = await container.spawn("npm", ["run", "format"], { env: processEnvironment });
      streamOutput(format);
      const exitCode = await withTimeout(format.exit, 20_000, "코드 정리 시간이 초과되었습니다.");
      if (exitCode !== 0) throw new Error("코드 정리에 실패했습니다. 문법 오류를 확인하세요.");
      const formatted = await Promise.all(
        (Object.keys(editablePracticeFiles) as EditablePracticePath[]).map(async (path) => [
          path,
          await container.fs.readFile(path, "utf-8"),
        ] as const),
      );
      setFiles(Object.fromEntries(formatted) as Record<EditablePracticePath, string>);
      setRuntimeResult("idle");
      setPracticePreviewUrl(undefined);
      setStatus("ready");
      appendLog("코드 정리 완료. 단계 체크를 다시 확인하세요.\n");
    } catch (reason) {
      fail(reason);
    }
  }

  async function resetPractice() {
    await disposePracticeEnvironment();
    setFiles({ ...editablePracticeFiles });
    setActivePath("remote/vite.config.ts");
    setActiveStepId(practiceSteps[0].id);
    setAnswerOpen(false);
    setRuntimeResult("idle");
    setPracticePreviewUrl(undefined);
    setLogs("기본 Host/Remote 파일로 초기화했습니다. 실행하면 새로 빌드합니다.");
    setStatus("idle");
  }

  function stopPractice() {
    buildProcessRef.current?.kill();
    buildProcessRef.current = null;
    setStatus(preparedRef.current ? "ready" : "idle");
    appendLog("현재 빌드를 중지했습니다.\n");
  }

  function appendLog(text: string) {
    const cleanText = text
      .replace(ansiSequence, "")
      .replaceAll("\r", "")
      .replaceAll("\0", "");
    setLogs((current) => `${current}${cleanText}`.replace(spinnerSequence, "").slice(-24_000));
  }

  function streamOutput(process: WebContainerProcess) {
    void process.output
      .pipeTo(new WritableStream({ write: appendLog }))
      .catch(() => undefined);
  }

  async function startServer(container: WebContainer) {
    const serverReady = new Promise<string>((resolve) => {
      const unsubscribe = container.on("server-ready", (port, url) => {
        if (port !== 4173) return;
        unsubscribe();
        resolve(url);
      });
    });
    const server = await container.spawn("npm", ["run", "start"]);
    serverProcessRef.current = server;
    streamOutput(server);
    return withTimeout(serverReady, 15_000, "Practice Host 서버가 준비되지 않았습니다.");
  }

  function fail(reason: unknown) {
    setStatus("error");
    appendLog(`오류: ${reason instanceof Error ? reason.message : "알 수 없는 실행 오류"}\n`);
  }

  const editable = isEditablePath(activePath);
  const content = editable ? files[activePath] : practiceDisplayFiles[activePath] ?? "";
  const editablePaths = practiceFilePaths.filter(isEditablePath);
  const referencePaths = practiceFilePaths.filter((path) => !isEditablePath(path));
  const hostPaths = referencePaths.filter((path) => path.startsWith("host/"));
  const supportPaths = referencePaths.filter((path) => !path.startsWith("host/"));
  const activeStep = practiceSteps.find((step) => step.id === activeStepId) ?? practiceSteps[0];
  const stepResults = practiceSteps.map((step) => ({ step, ...checkStep(step, files) }));

  return (
    <>
      <button className="xray-practice-button" onClick={openPractice} type="button">
        실습하기
      </button>

      {practiceOpen ? (
        <aside aria-labelledby="mf-practice-title" className="mf-practice-drawer">
          <div
            aria-label="실습 패널 너비 조절"
            aria-orientation="vertical"
            aria-valuemax={900}
            aria-valuemin={380}
            aria-valuenow={drawerWidth}
            className="mf-practice-resizer"
            onKeyDown={resizeWithKeyboard}
            onPointerDown={startResize}
            role="separator"
            tabIndex={0}
          />
          <header className="mf-practice-drawer__header">
            <div>
              <p className="eyebrow">Module Federation Practice</p>
              <h2 id="mf-practice-title">실제 Host / Remote 실습</h2>
            </div>
            <button
              className="mf-practice-host-button"
              onClick={() => setActivePath("host/src/main.tsx")}
              type="button"
            >
              Host 코드 보기
            </button>
            <button
              aria-label="실습 패널 닫기"
              className="mf-practice-drawer__close"
              onClick={() => setPracticeOpen(false)}
              type="button"
            >
              ×
            </button>
          </header>

          <ol className="mf-practice-steps" aria-label="실습 단계">
            {stepResults.map(({ step, passed }, index) => (
              <li data-active={activeStep.id === step.id} data-passed={passed} key={step.id}>
                <button onClick={() => selectStep(step)} type="button">
                  <span>{passed ? "✓" : "○"}</span> {index + 1}. {step.title}
                </button>
              </li>
            ))}
            <li data-active={runtimeResult !== "idle"} data-passed={runtimeResult === "passed"}>
              <span>{runtimeResult === "passed" ? "✓" : runtimeResult === "failed" ? "!" : "○"}</span> 7. 실제 빌드·연결
            </li>
          </ol>

          <div className="mf-practice-workspace">
            <nav aria-label="실습 파일" className="mf-practice-files">
              <strong className="mf-practice-files__group">Host · 읽기 전용</strong>
              {hostPaths.map((path) => (
                <button
                  aria-current={activePath === path ? "page" : undefined}
                  className={path === activePath ? "mf-practice-file mf-practice-file--active" : "mf-practice-file"}
                  key={path}
                  onClick={() => setActivePath(path)}
                  type="button"
                >
                  <span>{path}</span>
                  <small>{path === "host/src/main.tsx" ? "manifest · loadRemote" : "읽기"}</small>
                </button>
              ))}
              <strong className="mf-practice-files__group mf-practice-files__group--remote">Remote · 직접 수정</strong>
              {editablePaths.map((path) => (
                <button
                  aria-current={activePath === path ? "page" : undefined}
                  className={path === activePath ? "mf-practice-file mf-practice-file--active" : "mf-practice-file"}
                  key={path}
                  onClick={() => selectStep(practiceSteps.find((step) => step.path === path) ?? practiceSteps[0])}
                  type="button"
                >
                  <span>{path}</span>
                  <small>{files[path] === editablePracticeFiles[path] ? "편집" : "수정됨"}</small>
                </button>
              ))}
              <strong className="mf-practice-files__group mf-practice-files__group--reference">실행 기반 · 읽기 전용</strong>
              {supportPaths.map((path) => (
                <button
                  aria-current={activePath === path ? "page" : undefined}
                  className={path === activePath ? "mf-practice-file mf-practice-file--active" : "mf-practice-file"}
                  key={path}
                  onClick={() => setActivePath(path)}
                  type="button"
                >
                  <span>{path}</span>
                  <small>읽기</small>
                </button>
              ))}
            </nav>

            <section className="mf-practice-editor" aria-labelledby="mf-practice-file-title">
              <div className="mf-practice-editor__title">
                <strong id="mf-practice-file-title">{activePath}</strong>
                <span>
                  {codeLanguage(activePath)} · {
                    activePath === "remote/vite.config.ts"
                      ? "직접 편집 · 검증된 설정으로 안전 빌드"
                      : editable
                        ? "직접 편집 · Prettier 정리 가능"
                        : "문법 강조 · 읽기 전용"
                  }
                </span>
              </div>
              <CodeMirror
                aria-label={`${activePath} 코드`}
                basicSetup={{
                  bracketMatching: true,
                  closeBrackets: editable,
                  foldGutter: true,
                  highlightActiveLine: true,
                  highlightActiveLineGutter: true,
                  lineNumbers: true,
                  searchKeymap: true,
                }}
                className="mf-practice-code-editor"
                editable={editable}
                extensions={editorExtensions}
                height="100%"
                key={activePath}
                onChange={editable ? (value) => updateFile(activePath, value) : undefined}
                theme={oneDark}
                value={content}
              />
            </section>
          </div>

          <section className="mf-practice-guide" aria-labelledby="mf-practice-guide-title">
            <div>
              <p className="eyebrow">현재 단계 · {practiceSteps.findIndex((step) => step.id === activeStep.id) + 1} / {practiceSteps.length}</p>
              <h3 id="mf-practice-guide-title">{activeStep.title}</h3>
            </div>
            <p><b>할 일</b> · {activeStep.task}</p>
            <p className={checkStep(activeStep, files).passed ? "mf-practice-guide__success" : "mf-practice-guide__failure"}>
              <b>{checkStep(activeStep, files).passed ? "통과" : "아직 미완료"}</b> · {activeStep.complete}
            </p>
            <div className="mf-practice-guide__actions">
              <button
                aria-pressed={answerOpen}
                className="mf-practice-guide__toggle"
                onClick={() => setAnswerOpen((current) => !current)}
                type="button"
              >
                {answerOpen ? "정답 닫기" : "정답 보기"}
              </button>
              <button className="secondary-button" onClick={applyAnswer} type="button">정답 적용</button>
            </div>
            {answerOpen ? (
              <div className="mf-practice-guide__details">
                <strong>정답 코드 · TODO 위치에 넣으세요</strong>
                <pre><code>{activeStep.answer}</code></pre>
                <p><b>구현 의미</b> · {activeStep.meaning}</p>
                <p className="mf-practice-guide__success"><b>통과 기준</b> · {activeStep.complete}</p>
              </div>
            ) : null}
          </section>

          <section className="mf-practice-host-guide" aria-labelledby="mf-practice-host-guide-title">
            <div>
              <p className="eyebrow">Host는 읽기 전용으로 동작합니다</p>
              <h3 id="mf-practice-host-guide-title">Host가 manifest를 받아 Remote를 렌더링하는 과정</h3>
            </div>
            <p>실제 CityWatch Host는 Vite가 아닌 Next.js 앱(<code>apps/web/app/analytics-remote-panel.tsx</code>)입니다. 따라서 Host Federation 설정은 <code>vite.config.ts</code>가 아니라 브라우저 runtime 코드에 있습니다.</p>
            <ol>
              <li><code>createInstance()</code>가 <code>practice_remote</code>와 <code>/remote/mf-manifest.json</code>을 등록합니다.</li>
              <li>Host가 React를 shared singleton으로 등록해 Remote와 같은 React를 사용합니다.</li>
              <li><code>loadRemote(&quot;practice_remote/analytics-metrics&quot;)</code>가 공개된 Remote 모듈을 요청합니다.</li>
              <li>받은 <code>AnalyticsMetrics</code>를 Host React 화면에 렌더링합니다.</li>
            </ol>
            <button
              className="secondary-button"
              onClick={() => setActivePath("host/src/main.tsx")}
              type="button"
            >
              실습 Host runtime 코드 보기
            </button>
          </section>

          <section className="mf-practice-console" aria-label="빌드 로그">
            <div>
              <strong>실행 로그</strong>
              <span aria-live="polite">{statusLabel(status)}</span>
            </div>
            <pre aria-live="polite">{logs}</pre>
          </section>

          <footer className="mf-practice-actions">
            <button
              className="primary-button"
              disabled={status === "booting" || status === "installing" || status === "formatting" || status === "building"}
              onClick={runPractice}
              type="button"
            >
              실행
            </button>
            <button className="secondary-button" disabled={status !== "building"} onClick={stopPractice} type="button">
              중지
            </button>
            <button
              className="secondary-button"
              disabled={status === "booting" || status === "installing" || status === "formatting" || status === "building"}
              onClick={formatPractice}
              type="button"
            >
              코드 정리
            </button>
            <button className="secondary-button" onClick={resetPractice} type="button">초기화</button>
          </footer>
        </aside>
      ) : null}
    </>
  );
}

function getContainer() {
  containerPromise ??= import("@webcontainer/api").then(({ WebContainer }) =>
    WebContainer.boot({ coep: "credentialless", forwardPreviewErrors: "exceptions-only" }),
  );
  return containerPromise;
}

function isEditablePath(path: string): path is EditablePracticePath {
  return path === "remote/vite.config.ts" || path === "remote/src/AnalyticsMetrics.tsx";
}

function checkStep(step: PracticeStep, files: Record<EditablePracticePath, string>) {
  const config = files["remote/vite.config.ts"];
  const component = files["remote/src/AnalyticsMetrics.tsx"];
  const rules: Record<string, boolean> = {
    "remote-basics": /name\s*:\s*["']practice_remote["']/.test(config)
      && /filename\s*:\s*["']remoteEntry\.js["']/.test(config)
      && /manifest\s*:\s*true/.test(config),
    "remote-expose": /exposes\s*:\s*\{[\s\S]*["']\.\/analytics-metrics["']\s*:\s*["']\.\/src\/AnalyticsMetrics\.tsx["']/.test(config),
    "remote-react-share": /shared\s*:\s*\{[\s\S]*react\s*:\s*\{[\s\S]*singleton\s*:\s*true/.test(config),
    "remote-incident-type": /affectedPeople\s*:\s*number/.test(component)
      && /severity\s*:\s*["']low["']\s*\|\s*["']medium["']\s*\|\s*["']high["']\s*\|\s*["']critical["']/.test(component),
    "remote-component-props": /export\s+function\s+AnalyticsMetrics\s*\(\s*\{\s*incidents\s*\}\s*:\s*\{\s*incidents\s*:\s*readonly\s+Incident\[\]\s*\}\s*\)/.test(component),
    "remote-render": /const\s+critical\s*=\s*incidents\.filter/.test(component)
      && /const\s+affectedPeople\s*=\s*incidents\.reduce/.test(component)
      && /return\s*\([\s\S]*<section/.test(component),
  };
  return {
    passed: rules[step.id] ?? false,
  };
}

function isPracticeRuntimeMessage(value: unknown): value is { source: string; type: "runtime-ready" | "runtime-error"; run: string } {
  if (!value || typeof value !== "object") return false;
  const message = value as { source?: unknown; type?: unknown; run?: unknown };
  return message.source === "citywatch-mf-practice"
    && (message.type === "runtime-ready" || message.type === "runtime-error")
    && typeof message.run === "string";
}

function languageExtension(path: string) {
  if (path.endsWith(".tsx")) return javascript({ jsx: true, typescript: true });
  if (path.endsWith(".ts")) return javascript({ typescript: true });
  if (path.endsWith(".mjs")) return javascript();
  if (path.endsWith(".css")) return css();
  if (path.endsWith(".json")) return json();
  if (path.endsWith(".html")) return html();
  return [];
}

function codeLanguage(path: string) {
  if (path.endsWith(".tsx")) return "TSX";
  if (path.endsWith(".ts")) return "TypeScript";
  if (path.endsWith(".css")) return "CSS";
  if (path.endsWith(".json")) return "JSON";
  if (path.endsWith(".mjs")) return "JavaScript";
  if (path.endsWith(".html")) return "HTML";
  return "텍스트";
}

function clampDrawerWidth(width: number) {
  return Math.min(Math.max(width, 380), Math.max(380, window.innerWidth * 0.8));
}

function validateFiles(files: Record<EditablePracticePath, string>) {
  const values = Object.values(files);
  if (values.some((value) => value.length > 50_000)) throw new Error("파일 하나는 50KB를 넘을 수 없습니다.");
  if (values.reduce((sum, value) => sum + value.length, 0) > 80_000) throw new Error("전체 편집 코드는 80KB를 넘을 수 없습니다.");
}

function statusLabel(status: PracticeStatus) {
  const labels: Record<PracticeStatus, string> = {
    idle: "대기",
    booting: "환경 시작 중",
    installing: "의존성 설치 중",
    formatting: "코드 정리 중",
    ready: "실행 가능",
    building: "Vite 빌드 중",
    running: "Remote 연결됨",
    error: "오류",
  };
  return labels[status];
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (reason) => {
        window.clearTimeout(timeout);
        reject(reason);
      },
    );
  });
}
