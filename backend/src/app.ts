import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import rawBody from "fastify-raw-body";
import { z, ZodError } from "zod";
import type { Config } from "./config.js";
import type { DB } from "./db.js";
import { one } from "./db.js";
import type { Authenticate, Identity } from "./auth.js";
import type { Providers } from "./providers.js";
import { ApiError } from "./errors.js";
import {
  canPlay,
  ensureProfile,
  owned,
  readState,
  runCommand,
} from "./catalog.js";
import { checkout, connect, studio, syncAccount } from "./billing.js";
import { enqueue, syncSubscription } from "./events.js";

declare module "fastify" {
  interface FastifyRequest {
    identity: Identity | null;
  }
}
export async function buildApp(
  c: Config,
  db: DB,
  p: Providers,
  authenticate: Authenticate,
  logging = false,
) {
  const app = Fastify({
    bodyLimit: 1024 * 1024,
    trustProxy:
      c.NODE_ENV === "production" ? (_address, hop) => hop === 0 : false,
    logger: logging
      ? {
          level: "info",
          redact: [
            "req.headers.authorization",
            "req.headers.cookie",
            "res.headers.set-cookie",
          ],
        }
      : false,
  });
  app.decorateRequest("identity", null);
  await app.register(cors, {
    origin: c.origins,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["authorization", "content-type"],
  });
  await app.register(helmet);
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await app.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
  });
  app.addHook("onRequest", async (request) => {
    if (!request.url.startsWith("/v1/") || request.method === "OPTIONS") return;
    const header = request.headers.authorization;
    if (header) {
      if (!header.startsWith("Bearer ") || header.length > 16000)
        throw new ApiError(401, "UNAUTHENTICATED", "Invalid authorization.");
      request.identity = await authenticate(header.slice(7));
      await ensureProfile(db, request.identity);
    }
  });
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    return payload;
  });
  const user = (u: Identity | null) => {
    if (!u) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
    return u;
  };
  const admin = (u: Identity | null) => {
    const identity = user(u);
    if (!c.admins.includes(identity.id))
      throw new ApiError(403, "FORBIDDEN", "Administrator access required.");
    return identity;
  };
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ApiError)
      return reply
        .code(error.status)
        .send({ error: error.code, message: error.message });
    if (error instanceof ZodError)
      return reply.code(400).send({
        error: "INVALID_INPUT",
        message: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    const code = (error as { code?: string }).code;
    if (code === "23505")
      return reply.code(409).send({
        error: "CONFLICT",
        message: "That handle or record is already in use.",
      });
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 429)
      return reply.code(429).send({
        error: "RATE_LIMITED",
        message: "Too many requests. Try again shortly.",
      });
    if (status === 400 || status === 413 || status === 415)
      return reply.code(status).send({
        error: "INVALID_REQUEST",
        message: "Invalid request body or content type.",
      });
    req.log.error(
      { requestId: req.id, errorCode: code || "INTERNAL" },
      "Request failed",
    );
    return reply.code(500).send({
      error: "INTERNAL",
      message: "The request could not be completed. Please try again.",
    });
  });
  app.get("/healthz", async () => ({
    ok: true,
    service: "trainwith-api",
    billingMode: "sandbox",
  }));
  app.get("/readyz", async (_req, reply) => {
    try {
      await db.query("select 1 from trainwith.profiles limit 1");
      return { ok: true };
    } catch {
      return reply.code(503).send({ ok: false, error: "DATABASE_NOT_READY" });
    }
  });
  app.get("/v1/state", async (req) => readState(db, req.identity));
  app.post("/v1/commands", async (req) => {
    const u = user(req.identity);
    const body = z
      .object({ name: z.string(), payload: z.unknown() })
      .strict()
      .parse(req.body);
    await runCommand(db, u, body.name, body.payload);
    return readState(db, u);
  });
  app.post(
    "/v1/billing/checkout",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req) => {
      const u = user(req.identity);
      const { creatorId } = z
        .object({ creatorId: z.string().min(3).max(100) })
        .strict()
        .parse(req.body);
      return checkout(db, p, u, creatorId, c);
    },
  );
  app.post("/v1/billing/portal", async (req) => {
    const u = user(req.identity);
    const customer = await one(
      db,
      "select stripe_customer_id from trainwith_private.customers where user_id=$1",
      [u.id],
    );
    if (!customer)
      throw new ApiError(404, "NOT_FOUND", "No billing account exists yet.");
    return { url: await p.portal(String(customer.stripe_customer_id)) };
  });
  app.post("/v1/billing/renewal", async (req) => {
    const u = user(req.identity);
    const { creatorId, renews } = z
      .object({ creatorId: z.string(), renews: z.boolean() })
      .strict()
      .parse(req.body);
    const sub = await one(
      db,
      "select id from trainwith_private.subscriptions where user_id=$1 and creator_id=$2 and status in ('active','past_due','trialing') order by started_at desc limit 1",
      [u.id, creatorId],
    );
    if (!sub)
      throw new ApiError(404, "NOT_FOUND", "Active subscription not found.");
    await p.renewal(String(sub.id), renews);
    await syncSubscription(db, p, String(sub.id));
    return readState(db, u);
  });
  app.post("/v1/connect/onboarding", async (req) => {
    const u = user(req.identity);
    const { creatorId } = z
      .object({ creatorId: z.string() })
      .strict()
      .parse(req.body);
    return connect(db, p, u, creatorId);
  });
  app.post("/v1/connect/refresh", async (req) => {
    const u = user(req.identity);
    const { creatorId } = z
      .object({ creatorId: z.string() })
      .strict()
      .parse(req.body);
    await owned(db, u, creatorId);
    const row = await one(
      db,
      "select stripe_account_id from trainwith_private.creator_billing where creator_id=$1",
      [creatorId],
    );
    if (row?.stripe_account_id)
      await syncAccount(db, p, String(row.stripe_account_id));
    return readState(db, u);
  });
  app.get("/v1/studio/:creatorId", async (req) =>
    studio(
      db,
      user(req.identity),
      (req.params as { creatorId: string }).creatorId,
    ),
  );
  app.post(
    "/v1/videos/upload",
    { config: { rateLimit: { max: 12, timeWindow: "1 hour" } } },
    async (req) => {
      const u = user(req.identity);
      const { workoutId } = z
        .object({ workoutId: z.string().min(3).max(100) })
        .strict()
        .parse(req.body);
      const w = await one(
        db,
        "select creator_id from trainwith.workouts where id=$1",
        [workoutId],
      );
      if (!w)
        throw new ApiError(404, "NOT_FOUND", "Save the workout draft first.");
      await owned(db, u, String(w.creator_id));
      const origin = req.headers.origin || new URL(c.APP_URL).origin;
      if (!c.origins.includes(origin))
        throw new ApiError(403, "FORBIDDEN", "Upload origin is not allowed.");
      return db.transaction(async (tx) => {
        await tx.query("select pg_advisory_xact_lock(hashtext($1))", [
          `upload:${w.creator_id}`,
        ]);
        const pending = await one(
          tx,
          `select count(*)::int as count from trainwith_private.video_assets a join trainwith.workouts w on w.id=a.workout_id where w.creator_id=$1 and a.status in ('waiting','processing') and a.updated_at>now()-interval '2 hours'`,
          [w.creator_id],
        );
        if (Number(pending?.count) >= 3)
          throw new ApiError(
            429,
            "UPLOAD_LIMIT",
            "Wait for current uploads to finish.",
          );
        const upload = await p.upload(workoutId, origin);
        await tx.query(
          `insert into trainwith_private.video_assets(workout_id,upload_id) values($1,$2) on conflict(workout_id) do update set upload_id=excluded.upload_id,asset_id=null,playback_id=null,status='waiting',updated_at=now()`,
          [workoutId, upload.id],
        );
        await tx.query(
          "update trainwith.workouts set published=false where id=$1",
          [workoutId],
        );
        return { url: upload.url, uploadId: upload.id };
      });
    },
  );
  app.post("/v1/videos/playback", async (req) => {
    const { workoutId } = z
      .object({ workoutId: z.string().min(3).max(100) })
      .strict()
      .parse(req.body);
    const w = await canPlay(db, workoutId, req.identity?.id || null);
    if (w.video_status !== "ready" || !w.playback_id)
      throw new ApiError(
        409,
        "VIDEO_NOT_READY",
        "The video is still processing.",
      );
    const ttl = Math.min(
      11400,
      Math.max(1800, Number(w.duration_seconds || 0) + 600),
    );
    return {
      url: await p.playback(String(w.playback_id), ttl),
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
  });
  app.post(
    "/webhooks/stripe",
    {
      config: {
        rawBody: true,
        rateLimit: { max: 600, timeWindow: "1 minute" },
      },
    },
    async (req) => {
      const event = p.verifyStripe(
        String(req.rawBody || ""),
        String(req.headers["stripe-signature"] || ""),
      );
      await enqueue(db, "stripe", event);
      return { received: true };
    },
  );
  app.post(
    "/webhooks/mux",
    {
      config: {
        rawBody: true,
        rateLimit: { max: 600, timeWindow: "1 minute" },
      },
    },
    async (req) => {
      const headers = Object.fromEntries(
        Object.entries(req.headers).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.join(",") : v || "",
        ]),
      );
      const event = await p.verifyMux(String(req.rawBody || ""), headers);
      await enqueue(db, "mux", event);
      return { received: true };
    },
  );
  app.post("/webhooks/revenuecat", async () => {
    throw new ApiError(
      503,
      "NATIVE_BILLING_DISABLED",
      "Native purchases are not enabled.",
    );
  });
  app.get("/v1/admin/status", async (req) => {
    admin(req.identity);
    const events = (
      await db.query(
        "select provider,status,count(*)::int as count from trainwith_private.events group by provider,status",
      )
    ).rows;
    return {
      events,
      features: {
        stripeSandbox: !!c.STRIPE_SECRET_KEY,
        stripeWebhooks: !!c.STRIPE_WEBHOOK_SECRET,
        mux: !!(c.MUX_TOKEN_ID && c.MUX_TOKEN_SECRET),
        muxSigning: !!(c.MUX_SIGNING_KEY_ID && c.MUX_SIGNING_PRIVATE_KEY),
        nativeBilling: false,
        emailProvider: false,
        sentry: false,
      },
    };
  });
  app.get("/v1/admin/support", async (req) => {
    admin(req.identity);
    return (
      await db.query(
        "select s.*,p.name from trainwith.support_requests s join trainwith.profiles p on p.id=s.user_id order by s.created_at desc limit 200",
      )
    ).rows;
  });
  app.post("/v1/admin/creators/approve", async (req) => {
    const u = admin(req.identity);
    const { creatorId, approved } = z
      .object({ creatorId: z.string(), approved: z.boolean() })
      .strict()
      .parse(req.body);
    await db.transaction(async (tx) => {
      await tx.query(
        "update trainwith.creators set approved=$1,published=case when $1 then published else false end where id=$2",
        [approved, creatorId],
      );
      await tx.query(
        "insert into trainwith_private.audit_log(actor_id,action,subject_id) values($1,$2,$3)",
        [u.id, approved ? "creator.approve" : "creator.suspend", creatorId],
      );
    });
    return { ok: true };
  });
  app.post("/v1/admin/events/retry", async (req) => {
    const u = admin(req.identity);
    const { provider, id } = z
      .object({ provider: z.enum(["stripe", "mux"]), id: z.string() })
      .strict()
      .parse(req.body);
    await db.transaction(async (tx) => {
      await tx.query(
        "update trainwith_private.events set status='pending',attempts=0,available_at=now() where provider=$1 and id=$2 and status='failed'",
        [provider, id],
      );
      await tx.query(
        "insert into trainwith_private.audit_log(actor_id,action,subject_id) values($1,$2,$3)",
        [u.id, "event.retry", `${provider}:${id}`],
      );
    });
    return { ok: true };
  });
  return app;
}
