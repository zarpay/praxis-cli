import { createServer } from "node:http";

import { createMemoryStore } from "./store/memory-store.js";
import * as createReview from "./services/create-review.js";
import * as rankParlors from "./services/rank-parlors.js";
import * as awards from "./features/awards/index.js";
import * as tastingMenu from "./features/tasting-menu/index.js";

/**
 * Scoop Society's HTTP surface: a deliberately tiny JSON API.
 *
 * Routing stays flat and dumb — all behavior lives in services, and
 * this file only translates HTTP to service inputs and Results to
 * status codes (200 for ok, 422 for domain failures, 404 for routes).
 */
const store = createMemoryStore();

const server = createServer((req, res) => {
  const send = (status: number, body: unknown): void => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body, null, 2));
  };

  if (req.method === "GET" && req.url === "/parlors") {
    const result = rankParlors.run(store, { minReviews: 0 });
    send(result.ok ? 200 : 422, result);
    return;
  }

  if (req.method === "GET" && req.url === "/tasting-menu") {
    const result = tastingMenu.buildMenu(store, { stops: 3 });
    send(result.ok ? 200 : 422, result);
    return;
  }

  if (req.method === "GET" && req.url === "/awards") {
    const result = awards.pickWinners(store, { minReviews: 0 });
    send(result.ok ? 200 : 422, result);
    return;
  }

  if (req.method === "POST" && req.url === "/reviews") {
    let raw = "";
    req.on("data", (chunk: Buffer) => (raw += String(chunk)));
    req.on("end", () => {
      try {
        const result = createReview.run(store, JSON.parse(raw));
        send(result.ok ? 200 : 422, result);
      } catch {
        send(400, { ok: false, error: "body must be valid JSON" });
      }
    });
    return;
  }

  send(404, { ok: false, error: "no such route — try GET /parlors, /tasting-menu, /awards, or POST /reviews" });
});

server.listen(3100, () => {
  console.log("Scoop Society listening on http://localhost:3100");
});
