import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import app from "../src/app.ts";

test("public bike and profile images allow portal embedding without using the API limiter", async () => {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;

    for (const [pathname, contentType] of [
      ["/uploads/bike/demo/pulsar-220f-1.jpg", "image/jpeg"],
      ["/uploads/profile/demo-aashish.png", "image/png"],
    ] as const) {
      const response = await fetch(`${origin}${pathname}`, {
        headers: { Origin: "http://localhost:3000" },
      });

      assert.equal(response.status, 200, pathname);
      assert.equal(
        response.headers.get("cross-origin-resource-policy"),
        "cross-origin",
      );
      assert.match(
        response.headers.get("content-type") ?? "",
        new RegExp(contentType),
      );
      assert.equal(response.headers.has("ratelimit-limit"), false);
      assert.ok((await response.arrayBuffer()).byteLength > 1024);
    }
  } finally {
    server.close();
    await once(server, "close");
  }
});
