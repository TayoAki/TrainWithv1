import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
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
import { processDeletion } from "../src/deletion.js";

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
  SUPABASE_SERVICE_ROLE_KEY: "test_secret_not_real",
  IOS_EXTERNAL_CHECKOUT: "true",
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
  customer: async (id) => (id === member ? "cus_member" : `cus_${id}`),
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
  const migrationDir = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(migrationDir))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(new URL(name, migrationDir), "utf8"));
  const wrap = (q: { query: typeof pg.query }): DB => ({
    query: (sql, values) => q.query(sql, values),
    transaction: (fn) => fn(wrap(q)),
  });
  db = {
    ...wrap(pg),
    transaction: (fn) =>
      pg.transaction((tx) => fn(wrap(tx as unknown as typeof pg))),
  };
  for (const u of Object.values(identities)) {
    await db.query("insert into auth.users values($1)", [u.id]);
    await db.query(
      "insert into trainwith.profiles(id,name,adult_confirmed_at,policy_version,age_source) values($1,$2,now(),'2026-09-19','self_declared')",
      [u.id, u.name],
    );
  }
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
    (
      await app.inject({
        method: "POST",
        url: "/v1/admin/moderation",
        headers: headers("owner"),
        payload: { action: "approve_workout", id: workout.id },
      })
    ).statusCode,
    200,
  );
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
test("a late Mux upload-created event cannot regress a ready asset", async () => {
  await enqueue(db, "mux", {
    id: "mux_created_late",
    type: "video.upload.asset_created",
    data: { id: "upload_fixture", asset_id: "asset_fixture" },
  });
  await processNext(db, providers);
  const row = (
    await db.query(
      "select status,playback_id from trainwith_private.video_assets where workout_id='workout_fixture'",
    )
  ).rows[0];
  assert.equal(row.status, "ready");
  assert.equal(row.playback_id, "playback_fixture");
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
test("Mux deletion unpublishes only the matching asset without retrieving deleted media", async () => {
  const noAssetFetch: Providers = {
    ...providers,
    asset: async () => {
      throw new Error("Deleted media must not be retrieved");
    },
  };
  const current = (
    await db.query(
      "select asset_id from trainwith_private.video_assets where workout_id='workout_fixture'",
    )
  ).rows[0];
  for (const [eventId, assetId] of [
    ["mux_deleted_old", "replaced_asset"],
    ["mux_deleted_current", String(current.asset_id)],
  ]) {
    await enqueue(db, "mux", {
      id: eventId,
      type: "video.asset.deleted",
      data: { id: assetId },
    });
    await processNext(db, noAssetFetch);
    assert.equal(
      (
        await db.query(
          "select status from trainwith_private.events where id=$1",
          [eventId],
        )
      ).rows[0].status,
      "done",
    );
    const video = (
      await db.query(
        "select status,playback_id from trainwith_private.video_assets where workout_id='workout_fixture'",
      )
    ).rows[0];
    assert.equal(
      video.status,
      eventId === "mux_deleted_old" ? "ready" : "errored",
    );
    if (eventId === "mux_deleted_current") {
      assert.equal(video.playback_id, null);
      assert.equal(
        (
          await db.query(
            "select published from trainwith.workouts where id='workout_fixture'",
          )
        ).rows[0].published,
        false,
      );
    }
  }
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

test("age and current policy acceptance are enforced by the API", async () => {
  await db.query(
    "update trainwith.profiles set adult_confirmed_at=null,policy_version=null where id=$1",
    [stranger],
  );
  assert.equal(
    (await command("stranger", "creator.claim", { handle: "underage" }))
      .statusCode,
    403,
  );
  const accept = (body: unknown) =>
    app.inject({
      method: "POST",
      url: "/v1/policy/accept",
      headers: headers("stranger"),
      payload: body as Record<string, unknown>,
    });
  assert.equal(
    (
      await accept({
        adult: false,
        accepted: true,
        version: "2026-09-19",
        ageSource: "self_declared",
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await accept({
        adult: true,
        accepted: true,
        version: "old",
        ageSource: "self_declared",
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await accept({
        adult: true,
        accepted: true,
        version: "2026-09-19",
        ageSource: "self_declared",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({ url: "/v1/state", headers: headers("stranger") })
    ).json().eligibility.accepted,
    true,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/v1/videos/playback",
        payload: { workoutId: "workout_fixture" },
      })
    ).statusCode,
    401,
  );
});

test("native checkout fails closed outside US iOS and returns only trusted browser destinations", async () => {
  const id = "10000000-0000-4000-8000-000000000004";
  identities.iosbuyer = { id, name: "iOS buyer", email: "ios@example.test" };
  await db.query("insert into auth.users values($1)", [id]);
  await db.query(
    "insert into trainwith.profiles(id,name,adult_confirmed_at,policy_version,age_source) values($1,'iOS buyer',now(),'2026-09-19','self_declared')",
    [id],
  );
  const request = (client: unknown) =>
    app.inject({
      method: "POST",
      url: "/v1/billing/checkout",
      headers: headers("iosbuyer"),
      payload: { creatorId, client },
    });
  for (const client of [
    { platform: "ios" },
    { platform: "ios", storefront: "CAN" },
    { platform: "android", storefront: "USA" },
  ])
    assert.equal((await request(client)).statusCode, 403);
  const result = await request({ platform: "ios", storefront: "USA" });
  assert.equal(result.statusCode, 200, result.body);
  const attempt = (
    await db.query(
      "select payload from trainwith_private.checkout_attempts where user_id=$1",
      [id],
    )
  ).rows[0].payload as Row;
  assert.equal(attempt.nativeReturn, true);
  assert.equal(attempt.appUrl, config.APP_URL);
  assert.equal(
    (
      await request({
        platform: "ios",
        storefront: "USA",
        returnUrl: "https://attacker.invalid",
      })
    ).statusCode,
    400,
  );
});

test("blocking hides content in API and RLS, stops playback, and preserves billing management", async () => {
  await db.query(
    "update trainwith.workouts set published=true,moderation_status='approved' where id='workout_fixture'",
  );
  await db.query(
    "update trainwith_private.video_assets set status='ready',playback_id='playback_fixture' where workout_id='workout_fixture'",
  );
  const block = (blocked: boolean) =>
    app.inject({
      method: "POST",
      url: "/v1/safety/block",
      headers: headers("stranger"),
      payload: { creatorId, blocked },
    });
  assert.equal((await block(true)).statusCode, 200);
  const state = (
    await app.inject({ url: "/v1/state", headers: headers("stranger") })
  ).json();
  assert.equal(state.creators.length, 0);
  assert.equal(state.workouts.length, 0);
  assert.equal(state.blocked[0].id, creatorId);
  assert.equal(state.memberships.length, 1);
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
  await db.transaction(async (tx) => {
    await tx.query("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      stranger,
    ]);
    assert.equal(
      (await tx.query("select * from trainwith.creators")).rows.length,
      0,
    );
  });
  assert.equal((await block(false)).statusCode, 200);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/v1/videos/playback",
        headers: headers("stranger"),
        payload: { workoutId: "workout_fixture" },
      })
    ).statusCode,
    200,
  );
});

test("reports are private and only an operator can review or remove a workout", async () => {
  const report = await app.inject({
    method: "POST",
    url: "/v1/safety/report",
    headers: headers("member"),
    payload: {
      creatorId,
      workoutId: "workout_fixture",
      reason: "age_inappropriate",
      details: "Please review the age suitability of this workout.",
    },
  });
  assert.equal(report.statusCode, 200, report.body);
  assert.equal(
    (
      await app.inject({
        url: "/v1/admin/moderation",
        headers: headers("member"),
      })
    ).statusCode,
    403,
  );
  const moderation = await app.inject({
    url: "/v1/admin/moderation",
    headers: headers("owner"),
  });
  assert.ok(
    moderation.json().reports.some((r: Row) => r.id === report.json().id),
  );
  const remove = (token: string) =>
    app.inject({
      method: "POST",
      url: "/v1/admin/moderation",
      headers: headers(token),
      payload: { action: "remove_workout", id: "workout_fixture" },
    });
  assert.equal((await remove("member")).statusCode, 403);
  assert.equal((await remove("owner")).statusCode, 200);
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
        method: "POST",
        url: "/public/contact",
        payload: {
          email: "requester@example.test",
          message: "Please export my account information.",
        },
      })
    ).statusCode,
    200,
  );
});

test("reviewed programs and workout metadata cannot bypass moderation with edits", async () => {
  await db.query(
    "update trainwith.workouts set published=true,moderation_status='approved' where id='workout_fixture'",
  );
  const program = {
    id: "program_review",
    creatorId,
    title: "Progressive strength",
    description: "Four weeks of training",
    weeks: 4,
    workoutIds: ["workout_fixture"],
    published: false,
  };
  assert.equal(
    (await command("owner", "program.save", { ...program, published: true }))
      .statusCode,
    409,
  );
  assert.equal(
    (await command("owner", "program.save", program)).statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/v1/admin/moderation",
        headers: headers("owner"),
        payload: { action: "approve_program", id: program.id },
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await command("owner", "program.save", { ...program, published: true }))
      .statusCode,
    200,
  );
  assert.equal(
    (
      await command("owner", "program.save", {
        ...program,
        description: "Changed instructions",
        published: true,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await command("owner", "program.save", {
        ...program,
        description: "Changed instructions",
      })
    ).statusCode,
    200,
  );
  const state = (
    await app.inject({ url: "/v1/state", headers: headers("owner") })
  ).json();
  assert.equal(
    state.programs.find((p: Row) => p.id === program.id).moderationStatus,
    "pending",
  );
  const workout = state.workouts.find((w: Row) => w.id === "workout_fixture");
  delete workout.moderationStatus;
  assert.equal(
    (
      await command("owner", "workout.save", {
        ...workout,
        equipment: "Changed guidance",
        published: true,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await command("owner", "workout.save", {
        ...workout,
        equipment: "Changed guidance",
        published: false,
      })
    ).statusCode,
    200,
  );
  await db.transaction(async (tx) => {
    await tx.query("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      member,
    ]);
    assert.equal(
      (
        await tx.query("select id from trainwith.programs where id=$1", [
          program.id,
        ])
      ).rows.length,
      0,
    );
  });
});

test("restricted accounts can cancel but cannot resume subscription renewal", async () => {
  let canceled = false;
  const cancellationApp = await buildApp(
    config,
    db,
    {
      ...providers,
      renewal: async (_id, renews) => {
        assert.equal(renews, false);
        canceled = true;
      },
    },
    async () => identities.member,
  );
  try {
    await db.query(
      "update trainwith.profiles set account_status='suspended',adult_confirmed_at=null where id=$1",
      [member],
    );
    const request = (renews: boolean) =>
      cancellationApp.inject({
        method: "POST",
        url: "/v1/billing/renewal",
        headers: headers("member"),
        payload: { creatorId, renews },
      });
    assert.equal((await request(true)).statusCode, 403);
    const result = await request(false);
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(canceled, true);
  } finally {
    await db.query(
      "update trainwith.profiles set account_status='active',adult_confirmed_at=now() where id=$1",
      [member],
    );
    await cancellationApp.close();
  }
});

test("deletion reauthenticates, restricts immediately, retries failures, removes data and ignores late events", async () => {
  const effects: string[] = [];
  let fail = true;
  const deleting: Providers = {
    ...providers,
    confirmPassword: async (_email, password) => {
      if (password !== "fixture-password")
        throw new ApiError(401, "REAUTHENTICATION_FAILED", "Wrong password.");
    },
    closeCheckout: async () => {
      effects.push("checkout_closed");
    },
    cancelSubscriptions: async () => {
      effects.push("subscription_canceled");
    },
    deleteCustomer: async () => {
      effects.push("customer_deleted");
    },
    deleteMedia: async () => {
      effects.push("media_delete_attempt");
      if (fail) throw new Error("Provider unavailable");
    },
    deleteAuthUser: async (id) => {
      await db.query("delete from auth.users where id=$1", [id]);
      effects.push("auth_deleted");
    },
  };
  const deletionApp = await buildApp(
    config,
    db,
    deleting,
    async (token) => identities[token],
  );
  try {
    const submit = (password: string) =>
      deletionApp.inject({
        method: "POST",
        url: "/v1/account/delete",
        headers: headers("owner"),
        payload: { confirmation: "DELETE", password },
      });
    assert.equal((await submit("wrong")).statusCode, 401);
    assert.equal(
      (await db.query("select * from trainwith_private.deletions")).rows.length,
      0,
    );
    const result = await submit("fixture-password");
    assert.equal(result.statusCode, 200, result.body);
    const { receipt } = result.json();
    assert.match(receipt, /^[a-f0-9]{64}$/);
    assert.equal(
      (await command("owner", "creator.price", { creatorId, price: 20 }))
        .statusCode,
      403,
    );
    assert.equal((await app.inject("/v1/state")).json().creators.length, 0);
    assert.equal(await processDeletion(db, deleting), true);
    const pending = (
      await app.inject({
        method: "POST",
        url: "/public/deletion-status",
        payload: { receipt },
      })
    ).json();
    assert.equal(pending.status, "pending");
    assert.ok(!effects.includes("auth_deleted"));
    assert.equal(
      (await db.query("select * from auth.users where id=$1", [owner])).rows
        .length,
      1,
    );
    fail = false;
    await db.query("update trainwith_private.deletions set available_at=now()");
    assert.equal(await processDeletion(db, deleting), true);
    const complete = (
      await app.inject({
        method: "POST",
        url: "/public/deletion-status",
        payload: { receipt },
      })
    ).json();
    assert.equal(complete.status, "done");
    for (const table of [
      "trainwith.creators",
      "trainwith.workouts",
      "trainwith_private.creator_billing",
      "trainwith_private.video_assets",
    ])
      assert.equal((await db.query(`select * from ${table}`)).rows.length, 0);
    assert.equal(
      (await db.query("select * from auth.users where id=$1", [owner])).rows
        .length,
      0,
    );
    assert.ok(effects.includes("subscription_canceled"));
    assert.ok(effects.includes("checkout_closed"));
    assert.ok(effects.includes("auth_deleted"));
    const job = (await db.query("select * from trainwith_private.deletions"))
      .rows[0];
    assert.deepEqual(job.payload, {});
    assert.equal(job.user_id, null);
    assert.notEqual(job.receipt_hash, receipt);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/public/deletion-status",
          payload: { receipt: "0".repeat(64) },
        })
      ).statusCode,
      404,
    );
    await syncSubscription(db, providers, "sub_fixture");
    assert.equal(
      (await db.query("select * from trainwith_private.subscriptions")).rows
        .length,
      0,
    );
    assert.equal(
      (await app.inject({ url: "/v1/state", headers: headers("owner") }))
        .statusCode,
      403,
    );
  } finally {
    await deletionApp.close();
  }
});
