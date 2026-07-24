import { spawn, spawnSync } from "node:child_process";

const services = [
  ["web", "@citywatch/web"],
  ["remote", "@citywatch/analytics-remote"],
  ["realtime", "@citywatch/realtime-server"],
];

stopExistingDevServers([3000, 3001, 3002]);

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

function stopExistingDevServers(ports) {
  if (process.platform !== "win32") return;

  const result = spawnSync("netstat", ["-ano", "-p", "tcp"], {
    encoding: "utf8",
  });

  if (result.error) {
    console.error(`[dev] 기존 서버 확인 실패: ${result.error.message}`);
    process.exit(1);
  }

  const targetPorts = new Set(ports.map(String));
  const pids = new Set(
    result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/))
      .filter(
        ([protocol, address, , state]) =>
          protocol === "TCP" &&
          state === "LISTENING" &&
          targetPorts.has(address?.split(":").at(-1)),
      )
      .map((fields) => fields.at(-1))
      .filter(Boolean),
  );

  for (const pid of pids) {
    console.log(`[dev] 기존 개발 서버 종료: PID ${pid}`);
    const stopped = spawnSync("taskkill", ["/PID", pid, "/T", "/F"], {
      stdio: "inherit",
    });
    if (stopped.status !== 0) process.exit(stopped.status ?? 1);
  }
}
