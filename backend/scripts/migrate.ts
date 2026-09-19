import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { runtime } from "../src/runtime.js";
const r = runtime();
try {
  await r.db.query("create schema if not exists trainwith_meta");
  await r.db.query(
    "create table if not exists trainwith_meta.migrations(name text primary key,sha256 text not null,applied_at timestamptz default now())",
  );
  await r.db.query(
    "alter table trainwith_meta.migrations enable row level security; revoke all on schema trainwith_meta from public,anon,authenticated; revoke all on trainwith_meta.migrations from public,anon,authenticated",
  );
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(dir))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(new URL(name, dir), "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    await r.db.transaction(async (tx) => {
      await tx.query("select pg_advisory_xact_lock(714908321)");
      const applied = (
        await tx.query(
          "select sha256 from trainwith_meta.migrations where name=$1",
          [name],
        )
      ).rows[0];
      if (applied) {
        if (applied.sha256 !== hash)
          throw new Error(`Applied migration changed: ${name}`);
        return;
      }
      await tx.query(sql);
      await tx.query(
        "insert into trainwith_meta.migrations(name,sha256) values($1,$2)",
        [name, hash],
      );
      console.log(`Applied ${name}`);
    });
  }
} finally {
  await r.close();
}
