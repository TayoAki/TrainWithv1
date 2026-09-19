import type { DB } from "./db.js";
import { one } from "./db.js";
import type { Identity } from "./auth.js";
import type { Providers, CheckoutInput } from "./providers.js";
import { ApiError, requireFeature } from "./errors.js";
import type { Config } from "./config.js";
import { owned } from "./catalog.js";
import { requireAdult } from "./safety.js";

export async function checkout(
  db: DB,
  p: Providers,
  u: Identity,
  creatorId: string,
  config: Pick<Config, "fee" | "APP_URL">,
  nativeReturn = false,
) {
  requireFeature(config.fee !== undefined, "Platform fee");
  // Commit the key and exact provider payload BEFORE requesting Checkout.
  // A lost Stripe response or failed final DB write must reuse the same key.
  const attempt = await db.transaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock(hashtext($1))", [
      `account:${u.id}`,
    ]);
    await requireAdult(tx, u);
    await tx.query("select pg_advisory_xact_lock(hashtext($1))", [
      `checkout:${u.id}:${creatorId}`,
    ]);
    const c = await one(
      tx,
      `select c.*,b.stripe_account_id,b.charges_enabled,b.payouts_enabled from trainwith.creators c join trainwith_private.creator_billing b on b.creator_id=c.id join trainwith.profiles owner on owner.id=c.owner_id where c.id=$1 and c.published and c.approved and owner.account_status='active' and not exists(select 1 from trainwith_private.blocks where user_id=$2 and creator_id=c.id) for share of c`,
      [creatorId, u.id],
    );
    if (
      !c ||
      !c.stripe_account_id ||
      !c.charges_enabled ||
      !c.payouts_enabled ||
      Number(c.price_cents) < 100
    )
      throw new ApiError(
        409,
        "CHANNEL_NOT_READY",
        "This channel is not accepting memberships yet.",
      );
    if (c.owner_id === u.id)
      throw new ApiError(
        409,
        "OWN_CHANNEL",
        "You already have access to your own channel.",
      );
    const existing = await one(
      tx,
      `select 1 from trainwith_private.subscriptions where user_id=$1 and creator_id=$2 and (status in ('active','trialing','past_due','unpaid','incomplete') or (paid_until>now() and revoked_invoice_id is null))`,
      [u.id, creatorId],
    );
    if (existing)
      throw new ApiError(
        409,
        "EXISTING_SUBSCRIPTION",
        "Manage your existing membership instead of starting another.",
      );
    const previous = await one(
      tx,
      "select * from trainwith_private.checkout_attempts where user_id=$1 and creator_id=$2 for update",
      [u.id, creatorId],
    );
    if (
      previous &&
      new Date(String(previous.expires_at)).getTime() > Date.now()
    )
      return previous;
    let customer = await one(
      tx,
      "select stripe_customer_id from trainwith_private.customers where user_id=$1",
      [u.id],
    );
    if (!customer) {
      const id = await p.customer(u.id, u.email);
      await tx.query(
        "insert into trainwith_private.customers values($1,$2) on conflict do nothing",
        [u.id, id],
      );
      customer = { stripe_customer_id: id };
    }
    const payload = {
      creatorId,
      name: String(c.name),
      price: Number(c.price_cents),
      currency: String(c.currency),
      account: String(c.stripe_account_id),
      customer: String(customer.stripe_customer_id),
      userId: u.id,
      expires: Math.floor(Date.now() / 1000) + 3600,
      fee: config.fee!,
      appUrl: config.APP_URL,
      nativeReturn,
    };
    return (await one(
      tx,
      `insert into trainwith_private.checkout_attempts(user_id,creator_id,expires_at,payload) values($1,$2,to_timestamp($3),$4::jsonb)
      on conflict(user_id,creator_id) do update set request_key=gen_random_uuid(),session_id=null,url=null,expires_at=excluded.expires_at,payload=excluded.payload returning *`,
      [u.id, creatorId, payload.expires, JSON.stringify(payload)],
    ))!;
  });
  if (attempt.url) return { url: String(attempt.url) };
  const session = await p.checkout({
    ...(attempt.payload as Omit<CheckoutInput, "key">),
    key: `checkout:${attempt.request_key}`,
  });
  const available = await one(
    db,
    "select 1 from trainwith.creators c join trainwith.profiles p on p.id=c.owner_id where c.id=$1 and p.account_status='active' and c.approved and c.published and exists(select 1 from trainwith.profiles buyer where buyer.id=$2 and buyer.account_status='active')",
    [creatorId, u.id],
  );
  if (!available) {
    await p.closeCheckout(
      {
        ...(attempt.payload as CheckoutInput),
        key: `checkout:${attempt.request_key}`,
      },
      session.id,
    );
    throw new ApiError(
      409,
      "CHECKOUT_UNAVAILABLE",
      "This membership is no longer available.",
    );
  }
  await db.query(
    "update trainwith_private.checkout_attempts set session_id=$1,url=$2,expires_at=to_timestamp($3) where user_id=$4 and creator_id=$5 and request_key=$6",
    [
      session.id,
      session.url,
      session.expires,
      u.id,
      creatorId,
      attempt.request_key,
    ],
  );
  return { url: session.url };
}
export async function connect(
  db: DB,
  p: Providers,
  u: Identity,
  creatorId: string,
) {
  return db.transaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock(hashtext($1))", [
      `account:${u.id}`,
    ]);
    await requireAdult(tx, u);
    await owned(tx, u, creatorId);
    const current = await one(
      tx,
      "select stripe_account_id from trainwith_private.creator_billing where creator_id=$1",
      [creatorId],
    );
    const result = await p.connect(
      creatorId,
      u.email,
      current?.stripe_account_id
        ? String(current.stripe_account_id)
        : undefined,
    );
    await tx.query(
      `insert into trainwith_private.creator_billing(creator_id,stripe_account_id) values($1,$2) on conflict(creator_id) do update set stripe_account_id=excluded.stripe_account_id`,
      [creatorId, result.account],
    );
    return { url: result.url };
  });
}
export async function syncAccount(db: DB, p: Providers, accountId: string) {
  const account = await p.account(accountId);
  await db.query(
    "update trainwith_private.creator_billing set charges_enabled=$1,payouts_enabled=$2,details_submitted=$3 where stripe_account_id=$4",
    [
      account.charges_enabled === true,
      account.payouts_enabled === true,
      account.details_submitted === true,
      accountId,
    ],
  );
}
export async function studio(db: DB, u: Identity, creatorId: string) {
  await owned(db, u, creatorId);
  const members = (
    await db.query(
      `select s.id,p.name,s.price_cents,s.started_at,s.paid_until,s.cancel_at_period_end from trainwith_private.subscriptions s join trainwith.profiles p on p.id=s.user_id where s.creator_id=$1 and s.paid_until>now() and s.revoked_invoice_id is null order by s.started_at desc limit 1000`,
      [creatorId],
    )
  ).rows;
  const ledger = (
    await db.query(
      "select id,kind,amount_cents,currency,created_at,provider_fee_cents,platform_fee_cents from trainwith_private.ledger where creator_id=$1 order by created_at desc limit 100",
      [creatorId],
    )
  ).rows;
  const totals = await one(
    db,
    `select coalesce(sum(amount_cents),0)::bigint as net_collected_cents,coalesce(sum(amount_cents) filter(where kind='payment'),0)::bigint as gross_collected_cents from trainwith_private.ledger where creator_id=$1`,
    [creatorId],
  );
  const payouts = (
    await db.query(
      "select id,amount_cents,currency,status,arrival_date from trainwith_private.payouts where creator_id=$1 order by updated_at desc limit 50",
      [creatorId],
    )
  ).rows;
  return { members, ledger, payouts, totals, sandbox: true };
}
