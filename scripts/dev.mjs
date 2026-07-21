import { spawn } from "node:child_process";

const services = [
  ["web", "@citywatch/web"],
  ["remote", "@citywatch/analytics-remote"],
  ["realtime", "@citywatch/realtime-server"],
];

const children = services.map(([name, workspace]) => {
  const child = spawn("npm", ["--workspace", workspace, "run", "dev"], {
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  child.on("error", (error) => shutdown(1, `${name} 실행 실패: ${error.message}`));
  child.on("exit", (code) => {
    if (!stopping) shutdown(code ?? 1, `${name} 종료`);
  });

  return child;
});

let stopping = false;

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function shutdown(exitCode, message) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;

  if (message) console.error(`[dev] ${message}`);

  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;

    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
}
