import { createServer } from "node:http";
import { encodeWebSocketText, getWebSocketAccept } from "./websocket-frame.mjs";

const port = Number(process.env.PORT ?? 3001);
const clients = new Set();
const events = [];
const maxEvents = 50;
let nextEventId = 0;
let tick = 0;

const incidentIds = ["INC-001", "INC-002", "INC-003", "INC-004"];
const statuses = ["reported", "dispatching", "in_progress", "resolved"];

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, getCorsHeaders());
    response.end();
    return;
  }

  if (url.pathname === "/health") {
    writeJson(response, 200, {
      clients: clients.size,
      events: events.length,
      ok: true,
      serverTime: now(),
    });
    return;
  }

  if (url.pathname === "/events") {
    const after = Number(url.searchParams.get("after") ?? 0);
    writeJson(response, 200, {
      events: events.filter((event) => event.id > after),
      serverTime: now(),
    });
    return;
  }

  writeJson(response, 404, { error: "NOT_FOUND" });
});

server.on("upgrade", (request, socket) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  const key = request.headers["sec-websocket-key"];

  if (url.pathname !== "/ws" || typeof key !== "string") {
    socket.destroy();
    return;
  }

  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${getWebSocketAccept(key)}`,
      "",
      "",
    ].join("\r\n"),
  );

  clients.add(socket);
  socket.on("close", () => clients.delete(socket));
  socket.on("error", () => clients.delete(socket));
  socket.on("data", (chunk) => {
    if ((chunk[0] & 0x0f) === 0x08) {
      socket.write(Buffer.from([0x88, 0x00]));
      socket.end();
    }
  });

  sendEvent(socket, appendEvent({ sentAt: now(), type: "heartbeat" }));
});

server.listen(port, () => {
  appendEvent({ sentAt: now(), type: "heartbeat" });
  console.log(`CityWatch realtime server listening on port ${port}`);
});

setInterval(() => {
  tick += 1;
  const message =
    tick % 3 === 0
      ? { sentAt: now(), type: "heartbeat" }
      : {
          incidentId: incidentIds[tick % incidentIds.length],
          sentAt: now(),
          status: statuses[tick % statuses.length],
          type: "incident.statusChanged",
        };

  broadcast(appendEvent(message));
}, 4000);

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function appendEvent(message) {
  const event = { id: ++nextEventId, message };
  events.push(event);
  if (events.length > maxEvents) events.shift();
  return event;
}

function broadcast(event) {
  for (const socket of clients) {
    sendEvent(socket, event);
  }
}

function sendEvent(socket, event) {
  if (socket.destroyed) return;

  try {
    socket.write(encodeWebSocketText(JSON.stringify(event)));
  } catch {
    clients.delete(socket);
  }
}

function writeJson(response, status, body) {
  response.writeHead(status, {
    ...getCorsHeaders(),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Origin": "*",
  };
}

function now() {
  return new Date().toISOString();
}

function shutdown() {
  for (const socket of clients) socket.destroy();
  server.close(() => process.exit(0));
}
