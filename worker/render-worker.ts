import http from "node:http";

const port = Number(process.env.PORT ?? 10000);
let workerStarted = false;
let workerError: string | null = null;

/**
 * Lightweight HTTP wrapper around `worker/dm-worker.ts` for Render Free Web
 * Services, which require an open HTTP port while background jobs run.
 */
const server = http.createServer((req, res) => {
  const path = req.url?.split("?")[0] ?? "/";
  if (path === "/" || path === "/health" || path === "/ping") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "openreply-worker",
        workerStarted,
        workerError,
        uptimeSec: Math.floor(process.uptime()),
      })
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[Render Worker] Health server listening on :${port}`);
  if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
    workerError = "Missing DATABASE_URL or REDIS_URL environment variable";
    console.error(`[Render Worker] ${workerError}`);
    return;
  }
  void import("./dm-worker")
    .then(() => {
      workerStarted = true;
    })
    .catch((error) => {
      workerError =
        error instanceof Error ? error.message : "Unknown worker error";
      console.error("[Render Worker] Failed to start DM worker:", error);
    });
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
  });
}
