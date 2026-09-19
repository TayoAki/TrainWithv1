import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import Stripe from "stripe";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import {
  createProviders,
  type Providers,
  type ProviderEvent,
} from "../src/providers.js";
import { processNext, enqueue, syncSubscription } from "../src/events.js";
import { ApiError } from "../src/errors.js";
import type { DB, Row } from "../src/db.js";
import { checkout } from "../src/billing.js";

const owner = "10000000-0000-4000-8000-000000000001";
const member = "10000000-0000-4000-8000-000000000002";
const stranger = "10000000-0000-4000-8000-000000000003";
const identities: Record<string, { id: string; name: string; email: string }> =
  {
    owner: { id: owner, name: "Coach", email: "coach@example.test" },
    member: { id: member, name: "Member", email: "member@example.test" },
    stranger: { id: stranger, name: "Other", email: "other@example.test" },
  };
const config = readConfig({
  NODE_ENV: "test",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test_public_key",
  DATABASE_URL: "postgresql://test",
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  PLATFORM_FEE_PERCENT: "0",
  ADMIN_USER_IDS: owner,
});
const pg = new PGlite();
let db: DB;
let app: Awaited<ReturnType<typeof buildApp>>;
let creatorId: string;
let checkoutRequests = 0;
const end = Math.floor(Date.now() / 1000) + 86400 * 30;
let subscription: Row;
let refundedCharge: Row = {
  id: "ch_fixture",
  refunds: {
    data: [
      { id: "re_fixture", status: "succeeded", amount: 1900, currency: "usd" },
    ],
  },
};
const real = createProviders(config);
const providers: Providers = {
  ...real,
  customer: async () => "cus_member",
  checkout: async () => {
    checkoutRequests++;
    return {
      id: "cs_fixture",
      url: "https://checkout.stripe.com/test",
      expires: end,
    };
  },
  subscription: async () => subscription,
  charge: async () => refundedCharge,
  invoicePayment: async () => ({
    id: "ch_fixture",
    application_fee_amount: 0,
    balance_transaction: { fee: 80 },
  }),
  playback: async (id) => `https://stream.mux.com/${id}.m3u8?token=test-signed`,
  account: async () => ({
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
  }),
  upload: async () => ({
    id: "upload_fixture",
    url: "https://storage.example.test/upload",
  }),
  asset: async () => ({
    id: "asset_fixture",
    upload_id: "upload_fixture",
    passthrough: "workout_fixture",
    status: "ready",
    duration: 1200,
    playback_ids: [{ id: "playback_fixture", policy: "signed" }],
  }),
};
const headers = (token: string) => ({ authorization: `Bearer ${token}` });
const command = (token: string, name: string, payload: unknown) =>
  app.inject({
    method: "POST",
    url: "/v1/commands",
    headers: headers(token),
    payload: { name, payload },
  });
before(async () => {
  await pg.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to anon,authenticated;`,
  );
  await pg.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/202609190001_trainwith.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const wrap = (q: { query: typeof pg.query }): DB => ({
    query: (sql, values) => q.query(sql, values),
    transaction: (fn) => fn(wrap(q)),
  });
  db = {
    ...wrap(pg),
    transaction: (fn) =>
      pg.transaction((tx) => fn(wrap(tx as unknown as typeof pg))),
  };
  for (const u of Object.values(identities))
    await db.query("insert into auth.users values($1)", [u.id]);
  app = await buildApp(config, db, providers, async (token) => {
    if (!identities[token])
      throw new ApiError(401, "UNAUTHENTICATED", "Invalid session.");
    return identities[token];
  });
});
after(async () => {
  await app?.close();
  await pg.close();
});

test("anonymous browsing is empty; writes and invalid sessions are rejected", async () => {
  assert.equal((await app.inject("/v1/state")).json().creators.length, 0);
  assert.equal(
    (await command("bad", "creator.claim", { handle: "fake" })).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/v1/commands",
        payload: { name: "creator.claim", payload: { handle: "fake" } },
      })
    ).statusCode,
    401,
  );
});
test("real owner creates channel; reserved and duplicate handles fail", async () => {
  assert.equal(
    (await command("owner", "creator.claim", { handle: "explore" })).statusCode,
    400,
  );
  const result = await command("owner", "creator.claim", {
    handle: "testcoach",
  });
  assert.equal(result.statusCode, 200, result.body);
  creatorId = result.json().ownedId;
  assert.ok(creatorId);
  assert.equal(
    (await command("stranger", "creator.claim", { handle: "testcoach" }))
      .statusCode,
    409,
  );
  assert.equal((await app.inject("/v1/state")).json().creators.length, 0);
});
test("owner spoofing, fake access and payout readiness cannot be submitted", async () => {
  assert.equal(
    (await command("stranger", "creator.price", { creatorId, price: 19 }))
      .statusCode,
    404,
  );
  assert.equal(
    (await command("member", "membership.demoOnly", { creatorId })).statusCode,
    400,
  );
  assert.equal(
    (await command("owner", "payout.demoOnly", { creatorId })).statusCode,
    400,
  );
  assert.equal(
    (await command("owner", "creator.publish", { creatorId, published: true }))
      .statusCode,
    409,
  );
});
test("drafts, signed media authorization and unready publish behavior", async () => {
  const workout = {
    id: "workout_fixture",
    creatorId,
    title: "A real lesson",
    description: "Practice",
    minutes: 20,
    equipment: "Mat",
    level: "Beginner",
    free: false,
    published: false,
    photo: "",
    video: "",
  };
  assert.equal(
    (await command("owner", "workout.save", workout)).statusCode,
    200,
  );
  assert.equal(
    (await command("owner", "workout.save", { ...workout, published: true }))
      .statusCode,
    409,
  );
  assert.equal(
    (await command("stranger", "workout.save", workout)).statusCode,
    404,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/v1/videos/playback",
        headers: headers("member"),
        payload: { workoutId: workout.id },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/v1/videos/upload",
        headers: headers("owner"),
        payload: { workoutId: workout.id },
      })
    ).statusCode,
    200,
  );
  await enqueue(db, "mux", {
    id: "mux_ready",
    type: "video.asset.ready",
    data: { id: "asset_fixture" },
  });
  assert.equal(await processNext(db, providers), true);
  assert.equal(
    (await command("owner", "workout.save", { ...workout, published: true }))
      .statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/v1/videos/playback",
        headers: headers("owner"),
        payload: { workoutId: workout.id },
      })
    ).statusCode,
    200,
  );
});
test("Checkout rejects client price, reuses a session and does not grant access", async () => {
  await db.query(
    "update trainwith.creators set approved=true,published=true,price_cents=1900 where id=$1",
    [creatorId],
  );
  await db.query(
    "insert into trainwith_private.creator_billing values($1,'acct_fixture',true,true,true)",
    [creatorId],
  );
  const request = {
    method: "POST" as const,
    url: "/v1/billing/checkout",
    headers: headers("member"),
    payload: { creatorId },
  };
  assert.equal(
    (await app.inject({ ...request, payload: { creatorId, amount: 1 } }))
      .statusCode,
    400,
  );
  for (let i = 0; i < 2; i++) {
    const result = await app.inject(request);
    assert.equal(result.statusCode, 200, result.body);
  }
  assert.equal(checkoutRequests, 1);
  assert.equal(
    (await app.inject({ url: "/v1/state", headers: headers("member") })).json()
      .memberships.length,
    0,
  );
});
test("signed Stripe events persist, deduplicate and grant only the correct member/channel", async () => {
  subscription = {
    id: "sub_fixture",
    metadata: { trainwith_user_id: member, trainwith_creator_id: creatorId },
    customer: "cus_member",
    status: "active",
    start_date: end - 86400 * 30,
    cancel_at_period_end: false,
    items: {
      data: [
        {
          current_period_end: end,
          price: { unit_amount: 1900, currency: "usd" },
        },
      ],
    },
    latest_invoice: {
      id: "in_fixture",
      status: "paid",
      amount_paid: 1900,
      currency: "usd",
      lines: { data: [{ type: "subscription", period: { end } }] },
    },
  };
  const payload = JSON.stringify({
    id: "evt_fixture",
    type: "customer.subscription.updated",
    livemode: false,
    data: { object: { id: "sub_fixture" } },
  });
  const signer = new Stripe("sk_test_fixture");
  const signature = signer.webhooks.generateTestHeaderString({
    payload,
    secret: "whsec_fixture",
  });
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/webhooks/stripe",
        headers: { "stripe-signature": "invalid" },
        payload: JSON.parse(payload),
      })
    ).statusCode,
    400,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/webhooks/stripe",
          headers: {
            "content-type": "application/json",
            "stripe-signature": signature,
          },
          payload,
        })
      ).statusCode,
      200,
    );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from trainwith_private.events where id='evt_fixture'",
      )
    ).rows[0].n,
    1,
  );
  await processNext(db, providers);
  assert.equal(
    (await app.inject({ url: "/v1/state", headers: headers("member") })).json()
      .memberships.length,
    1,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/v1/videos/playback",
        headers: headers("member"),
        payload: { workoutId: "workout_fixture" },
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/v1/videos/playback",
        headers: headers("stranger"),
        payload: { workoutId: "workout_fixture" },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        url: `/v1/studio/${creatorId}`,
        headers: headers("stranger"),
      })
    ).statusCode,
    404,
  );
});
test("a lost Checkout response keeps the durable key and exact trusted price snapshot", async () => {
  const user = identities.stranger;
  const seen: Parameters<Providers["checkout"]>[0][] = [];
  const recovering: Providers = {
    ...providers,
    customer: async () => "cus_stranger",
    checkout: async (input) => {
      seen.push(input);
      if (seen.length === 1)
        throw new Error("Response lost after Stripe accepted request");
      return {
        id: "cs_recovered",
        url: "https://checkout.stripe.com/recovered",
        expires: input.expires,
      };
    },
  };
  await assert.rejects(() => checkout(db, recovering, user, creatorId, config));
  await db.query("update trainwith.creators set price_cents=2500 where id=$1", [
    creatorId,
  ]);
  assert.equal(
    (await checkout(db, recovering, user, creatorId, config)).url,
    "https://checkout.stripe.com/recovered",
  );
  assert.deepEqual(seen[0], seen[1]);
  assert.equal(seen[1].price, 1900);
  assert.equal(seen[1].fee, 0);
  await db.query("update trainwith.creators set price_cents=1900 where id=$1", [
    creatorId,
  ]);
});
test("renewal failure never extends access; current invoice refund revokes playback", async () => {
  subscription = {
    ...subscription,
    status: "past_due",
    items: {
      data: [
        {
          current_period_end: end + 86400 * 30,
          price: { unit_amount: 1900, currency: "usd" },
        },
      ],
    },
    latest_invoice: { id: "in_unpaid", status: "open", currency: "usd" },
  };
  await syncSubscription(db, providers, "sub_fixture");
  const row = (
    await db.query("select paid_until from trainwith_private.subscriptions")
  ).rows[0];
  assert.equal(new Date(String(row.paid_until)).getTime(), end * 1000);
  // Refunding the paid invoice still revokes access when the latest renewal is unpaid.
  await enqueue(db, "stripe", {
    id: "evt_refund_unpaid_latest",
    type: "charge.refunded",
    data: { id: "ch_fixture" },
  });
  await processNext(db, providers);
  assert.equal(
    (
      await db.query(
        "select revoked_invoice_id from trainwith_private.subscriptions",
      )
    ).rows[0].revoked_invoice_id,
    "in_fixture",
  );
  subscription = {
    ...subscription,
    status: "active",
    latest_invoice: {
      id: "in_fixture",
      status: "paid",
      amount_paid: 1900,
      currency: "usd",
      lines: { data: [{ type: "subscription", period: { end } }] },
    },
    items: {
      data: [
        {
          current_period_end: end,
          price: { unit_amount: 1900, currency: "usd" },
        },
      ],
    },
  };
  await syncSubscription(db, providers, "sub_fixture");
  await enqueue(db, "stripe", {
    id: "evt_refund",
    type: "charge.refunded",
    data: {
      id: "ch_fixture",
      refunds: {
        data: [
          {
            id: "re_fixture",
            status: "succeeded",
            amount: 1900,
            currency: "usd",
          },
        ],
      },
    },
  });
  await processNext(db, providers);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/v1/videos/playback",
        headers: headers("member"),
        payload: { workoutId: "workout_fixture" },
      })
    ).statusCode,
    403,
  );
  await syncSubscription(db, providers, "sub_fixture");
  assert.equal(
    (await app.inject({ url: "/v1/state", headers: headers("member") })).json()
      .memberships.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from trainwith_private.ledger where kind='payment'",
      )
    ).rows[0].n,
    1,
  );
});
test("delayed paid invoices restore their paid period, never the newer unpaid period", async () => {
  const latest = { id: "in_new_unpaid", status: "open", currency: "usd" };
  const olderPaid = {
    id: "in_delayed",
    customer: "cus_stranger",
    subscription: "sub_delayed",
    status: "paid",
    amount_paid: 1900,
    currency: "usd",
    lines: {
      data: [
        { parent: { type: "subscription_item_details" }, period: { end } },
      ],
    },
  };
  const delayed: Providers = {
    ...providers,
    subscription: async () => ({
      ...subscription,
      id: "sub_delayed",
      customer: "cus_stranger",
      status: "past_due",
      metadata: {
        trainwith_user_id: stranger,
        trainwith_creator_id: creatorId,
      },
      latest_invoice: latest,
      items: {
        data: [
          {
            current_period_end: end + 86400 * 30,
            price: { unit_amount: 1900, currency: "usd" },
          },
        ],
      },
    }),
    invoice: async () => olderPaid,
    invoicePayment: async () => ({ id: "ch_delayed", amount_refunded: 0 }),
  };
  await syncSubscription(db, delayed, "sub_delayed", "in_delayed");
  const row = (
    await db.query(
      "select * from trainwith_private.subscriptions where id='sub_delayed'",
    )
  ).rows[0];
  assert.equal(new Date(String(row.paid_until)).getTime(), end * 1000);
  assert.equal(row.last_invoice_id, "in_new_unpaid");
  assert.equal(row.paid_invoice_id, "in_delayed");
  await syncSubscription(db, delayed, "sub_delayed", "in_delayed");
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from trainwith_private.ledger where invoice_id='in_delayed'",
      )
    ).rows[0].n,
    1,
  );
});
test("support is private, admin routes are restricted, native billing fails closed", async () => {
  assert.equal(
    (
      await command("member", "support.create", {
        message: "Please help with my workout.",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({ url: "/v1/state", headers: headers("stranger") })
    ).json().supports.length,
    0,
  );
  assert.equal(
    (await app.inject({ url: "/v1/admin/support", headers: headers("member") }))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({ url: "/v1/admin/support", headers: headers("owner") })
    ).json().length,
    1,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/webhooks/revenuecat",
        payload: { event: { entitlement_id: creatorId } },
      })
    ).statusCode,
    503,
  );
});
test("database policies prevent direct private reads and all direct client writes", async () => {
  await db.transaction(async (tx) => {
    await tx.query("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      stranger,
    ]);
    assert.equal(
      (await tx.query("select * from trainwith.support_requests")).rows.length,
      0,
    );
  });
  await assert.rejects(() =>
    db.transaction(async (tx) => {
      await tx.query("set local role authenticated");
      await tx.query("select * from trainwith_private.subscriptions");
    }),
  );
  await assert.rejects(() =>
    db.transaction(async (tx) => {
      await tx.query("set local role authenticated");
      await tx.query("update trainwith.creators set price_cents=1");
    }),
  );
});
