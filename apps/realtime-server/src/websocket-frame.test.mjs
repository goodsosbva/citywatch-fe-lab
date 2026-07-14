import assert from "node:assert/strict";
import test from "node:test";
import { encodeWebSocketText, getWebSocketAccept } from "./websocket-frame.mjs";

test("creates the RFC websocket accept header", () => {
  assert.equal(
    getWebSocketAccept("dGhlIHNhbXBsZSBub25jZQ=="),
    "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=",
  );
});

test("encodes a small text frame", () => {
  const frame = encodeWebSocketText("ok");

  assert.equal(frame[0], 0x81);
  assert.equal(frame[1], 2);
  assert.equal(frame.subarray(2).toString(), "ok");
});
