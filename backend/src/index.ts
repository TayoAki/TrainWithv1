import { runtime, startWorker } from "./runtime.js";
import { buildApp } from "./app.js";
import { createAuthenticator } from "./auth.js";
const r = runtime();
const app = await buildApp(
  r.config,
  r.db,
  r.providers,
  createAuthenticator(r.config),
  true,
);
const stop =
  r.config.RUN_WORKER === "true"
    ? startWorker(r.db, r.providers)
    : async () => {};
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    await app.close();
    await stop();
    await r.close();
    process.exit(0);
  });
await app.listen({ port: r.config.PORT, host: "0.0.0.0" });
