import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import app from "../src/app.ts";
import {
  createServerAccessGuidance,
  parseListenHost,
} from "../src/utils/server-access.ts";

test("listen host defaults to all interfaces and rejects URL-shaped values", () => {
  assert.equal(parseListenHost(undefined), "0.0.0.0");
  assert.equal(parseListenHost(" 192.168.1.20 "), "192.168.1.20");
  assert.equal(parseListenHost("localhost"), "localhost");
  assert.equal(parseListenHost("::"), "::");
  assert.throws(
    () => parseListenHost("http://localhost:5050"),
    /without a protocol, port or path/,
  );
});

test("startup guidance provides copy-ready local, emulator and LAN origins", () => {
  const messages = createServerAccessGuidance("0.0.0.0", 5050, {
    WiFi: [
      { address: "192.168.1.20", family: "IPv4", internal: false },
      { address: "fe80::1", family: "IPv6", internal: false },
    ],
    Loopback: [
      { address: "127.0.0.1", family: "IPv4", internal: true },
    ],
  });

  assert.deepEqual(messages, [
    "Bike Buddy backend listening on 0.0.0.0:5050",
    "Local: http://localhost:5050",
    "Android emulator: --dart-define=API_BASE_URL=http://10.0.2.2:5050",
    "Physical device: --dart-define=API_BASE_URL=http://192.168.1.20:5050",
    "Health check: http://localhost:5050/health",
  ]);
  assert.equal(messages.some((message) => message.includes("password")), false);
});

test("health remains reachable after the general API request budget is exhausted", async () => {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;

    for (let requestNumber = 0; requestNumber < 100; requestNumber += 1) {
      const response = await fetch(`${origin}/`);
      assert.equal(response.status, 200, `request ${requestNumber + 1}`);
    }

    const limited = await fetch(`${origin}/`);
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), {
      success: false,
      message: "Too many requests. Please try again later.",
      code: "RATE_LIMITED",
    });

    const health = await fetch(`${origin}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      success: true,
      message: "Bike Buddy backend is healthy",
    });
    assert.equal(health.headers.has("ratelimit-limit"), false);
  } finally {
    server.close();
    await once(server, "close");
  }
});
