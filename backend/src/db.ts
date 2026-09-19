import pg from "pg";
import type { Config } from "./config.js";

export interface Row {
  [key: string]: unknown;
}
export interface DB {
  query<T extends Row = Row>(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
  transaction<T>(fn: (db: DB) => Promise<T>): Promise<T>;
}
export function createDatabase(config: Config) {
  const url = new URL(config.DATABASE_URL);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  // Remove URL SSL overrides so they cannot silently disable certificate checks.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    url.searchParams.delete(key);
  const pool = new pg.Pool({
    connectionString: url.toString(),
    max: 8,
    connectionTimeoutMillis: 10000,
    ssl: local
      ? false
      : {
          rejectUnauthorized: true,
          ...(config.DATABASE_CA_CERT
            ? { ca: config.DATABASE_CA_CERT.replace(/\\n/g, "\n") }
            : {}),
        },
  });
  const root: DB = {
    query: (sql, values) => pool.query(sql, values),
    async transaction(fn) {
      const client = await pool.connect();
      const tx: DB = {
        query: (sql, values) => client.query(sql, values),
        transaction: (fn) => fn(tx),
      };
      try {
        await client.query("begin");
        const result = await fn(tx);
        await client.query("commit");
        return result;
      } catch (e) {
        await client.query("rollback");
        throw e;
      } finally {
        client.release();
      }
    },
  };
  return { db: root, close: () => pool.end() };
}
export async function one<T extends Row>(
  db: DB,
  sql: string,
  values: unknown[] = [],
): Promise<T | undefined> {
  return (await db.query<T>(sql, values)).rows[0];
}
