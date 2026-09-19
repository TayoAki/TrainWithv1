import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { readConfig } from "./config.js";
import { createDatabase } from "./db.js";
import { createProviders } from "./providers.js";
import { processNext } from "./events.js";
import { processDeletion } from "./deletion.js";
export function runtime() {
  for (const file of [".env.database.local", "backend/.env.database.local"])
    if (existsSync(file)) loadEnvFile(file);
  const config = readConfig();
  const database = createDatabase(config);
  return { config, ...database, providers: createProviders(config) };
}
export function startWorker(
  db: Parameters<typeof processNext>[0],
  p: Parameters<typeof processNext>[1],
) {
  let stopped = false;
  let running: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (running || stopped) return;
    running = (async () => {
      try {
        await processDeletion(db, p);
        for (let i = 0; i < 20 && !stopped; i++)
          if (!(await processNext(db, p))) break;
      } catch {
        console.error("Event worker unavailable; retrying.");
      } finally {
        running = undefined;
      }
    })();
  }, 2000);
  return async () => {
    stopped = true;
    clearInterval(timer);
    await running;
  };
}
