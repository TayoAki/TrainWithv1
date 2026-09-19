import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => v?.trim() || undefined);
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_URL: z.url().default("http://localhost:8081"),
  ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:8081,http://localhost:4321"),
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  DATABASE_URL: z.string().min(10),
  DATABASE_CA_CERT: optional,
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  STRIPE_CONNECT_WEBHOOK_SECRET: optional,
  PLATFORM_FEE_PERCENT: optional,
  CONNECT_COUNTRY: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .default("US"),
  MUX_TOKEN_ID: optional,
  MUX_TOKEN_SECRET: optional,
  MUX_WEBHOOK_SECRET: optional,
  MUX_SIGNING_KEY_ID: optional,
  MUX_SIGNING_PRIVATE_KEY: optional,
  ADMIN_USER_IDS: z.string().default(""),
  RUN_WORKER: z.enum(["true", "false"]).default("true"),
});
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(env);
  if (!result.success)
    throw new Error(
      `Missing or invalid configuration: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  const c = result.data;
  if (c.STRIPE_SECRET_KEY && !/^sk_test_|^rk_test_/.test(c.STRIPE_SECRET_KEY))
    throw new Error("Only Stripe sandbox keys are enabled.");
  const fee =
    c.PLATFORM_FEE_PERCENT === undefined
      ? undefined
      : Number(c.PLATFORM_FEE_PERCENT);
  if (fee !== undefined && (!Number.isFinite(fee) || fee < 0 || fee > 100))
    throw new Error("Invalid PLATFORM_FEE_PERCENT");
  const origins = c.ALLOWED_ORIGINS.split(",").map(
    (v) => new URL(v.trim()).origin,
  );
  if (
    c.NODE_ENV === "production" &&
    (!c.APP_URL.startsWith("https://") ||
      origins.some((v) => !v.startsWith("https://")))
  )
    throw new Error("Production URLs must use HTTPS.");
  return {
    ...c,
    fee,
    origins,
    admins: c.ADMIN_USER_IDS.split(",").filter(Boolean),
  };
}
export type Config = ReturnType<typeof readConfig>;
