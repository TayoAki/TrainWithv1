import { runtime, startWorker } from "./runtime.js";
const r = runtime();
const stop = startWorker(r.db, r.providers);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    await stop();
    await r.close();
    process.exit(0);
  });
