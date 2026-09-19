import type { DB } from "./db.js";
import { one } from "./db.js";
import {
  array,
  record,
  externalId,
  type ProviderEvent,
  type Providers,
} from "./providers.js";
import { syncAccount } from "./billing.js";

export async function enqueue(db: DB, provider: string, e: ProviderEvent) {
  await db.query(
    "insert into trainwith_private.events(provider,id,payload) values($1,$2,$3::jsonb) on conflict do nothing",
    [provider, e.id, JSON.stringify(e)],
  );
}
export async function syncSubscription(
  db: DB,
  p: Providers,
  id: string,
  invoiceId?: string,
) {
  return db.transaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock(hashtext($1))", [
      `subscription:${id}`,
    ]);
    return syncSubscriptionLocked(tx, p, id, invoiceId);
  });
}
async function syncSubscriptionLocked(
  db: DB,
  p: Providers,
  id: string,
  invoiceId?: string,
) {
  const s = await p.subscription(id);
  const metadata = record(s.metadata);
  const userId = String(metadata.trainwith_user_id || "");
  const creatorId = String(metadata.trainwith_creator_id || "");
  if (!userId || !creatorId) return; // Other products in the same Stripe account.
  const mapping = await one(
    db,
    `select 1 from trainwith_private.customers where user_id=$1 and stripe_customer_id=$2`,
    [userId, externalId(s.customer)],
  );
  if (!mapping)
    throw new Error("Subscription customer mapping is not available");
  const item = array(record(s.items).data)[0] || {};
  const price = record(item.price);
  const invoice = invoiceId
    ? await p.invoice(invoiceId)
    : record(s.latest_invoice);
  if (
    invoiceId &&
    (externalId(invoice.customer) !== externalId(s.customer) ||
      (externalId(invoice.subscription) ||
        externalId(
          record(record(invoice.parent).subscription_details).subscription,
        )) !== id)
  )
    throw new Error("Invoice does not belong to this subscription");
  const end = Number(item.current_period_end || s.current_period_end || 0);
  const start = Number(s.start_date || s.created || 0);
  if (!end || !start) throw new Error("Subscription period missing");
  const paidEnd = Math.max(
    0,
    ...array(record(invoice.lines).data)
      .filter(
        (line) =>
          record(line.parent).type === "subscription_item_details" ||
          line.type === "subscription",
      )
      .map((line) => Number(record(line.period).end || 0)),
  );
  const paid =
    invoice.status === "paid" &&
    paidEnd > 0 &&
    s.status !== "incomplete_expired";
  const charge = paid ? await p.invoicePayment(String(invoice.id)) : {};
  await db.transaction(async (tx) => {
    await tx.query(
      `insert into trainwith_private.subscriptions(id,user_id,creator_id,customer_id,status,price_cents,currency,started_at,period_end,paid_until,cancel_at_period_end,last_invoice_id,paid_invoice_id)
      values($1,$2,$3,$4,$5,$6,$7,to_timestamp($8),to_timestamp($9),case when $10 then to_timestamp($13) else null end,$11,$12,case when $10 then $14 else null end)
      on conflict(id) do update set status=excluded.status,period_end=excluded.period_end,cancel_at_period_end=excluded.cancel_at_period_end,
      price_cents=excluded.price_cents,paid_until=case when $10 then greatest(subscriptions.paid_until,excluded.paid_until) else subscriptions.paid_until end,
      revoked_invoice_id=case when $10 and (subscriptions.paid_until is null or excluded.paid_until>subscriptions.paid_until) and subscriptions.revoked_invoice_id is distinct from excluded.paid_invoice_id then null else subscriptions.revoked_invoice_id end,
      last_invoice_id=excluded.last_invoice_id,paid_invoice_id=case when $10 and (subscriptions.paid_until is null or excluded.paid_until>subscriptions.paid_until) then excluded.paid_invoice_id else subscriptions.paid_invoice_id end,updated_at=now()`,
      [
        id,
        userId,
        creatorId,
        externalId(s.customer),
        String(s.status),
        Number(price.unit_amount || 0),
        String(price.currency || invoice.currency || "usd"),
        start,
        end,
        paid,
        s.cancel_at_period_end === true,
        externalId(s.latest_invoice),
        paidEnd,
        externalId(invoice),
      ],
    );
    if (paid) {
      const bt = record(charge.balance_transaction);
      await tx.query(
        `insert into trainwith_private.ledger(id,creator_id,subscription_id,invoice_id,charge_id,kind,amount_cents,currency,provider_fee_cents,platform_fee_cents)
        values($1,$2,$3,$4,$5,'payment',$6,$7,$8,$9) on conflict(id) do nothing`,
        [
          `invoice:${invoice.id}`,
          creatorId,
          id,
          invoice.id,
          charge.id || null,
          Number(invoice.amount_paid || 0),
          String(invoice.currency),
          bt.fee ?? null,
          charge.application_fee_amount ?? null,
        ],
      );
      if (Number(charge.amount_refunded) > 0 || charge.disputed === true)
        await tx.query(
          "update trainwith_private.subscriptions set revoked_invoice_id=$1 where id=$2 and paid_invoice_id=$1",
          [invoice.id, id],
        );
    }
  });
}
async function stripeEvent(db: DB, p: Providers, e: ProviderEvent) {
  let d = e.data;
  if (e.type === "account.updated") {
    await syncAccount(db, p, String(d.id));
    return;
  }
  if (e.type.startsWith("payout.") && e.account) {
    d = await p.payout(String(d.id), e.account);
    await db.query(
      `insert into trainwith_private.payouts(id,creator_id,amount_cents,currency,status,arrival_date)
      select $1,creator_id,$2,$3,$4,to_timestamp($5) from trainwith_private.creator_billing where stripe_account_id=$6
      on conflict(id) do update set status=excluded.status,arrival_date=excluded.arrival_date,updated_at=now()`,
      [d.id, d.amount, d.currency, d.status, d.arrival_date, e.account],
    );
    return;
  }
  if (e.type === "charge.refunded" || e.type.startsWith("charge.dispute.")) {
    const chargeId =
      e.type === "charge.refunded" ? String(d.id) : externalId(d.charge);
    const sale = await one(
      db,
      "select * from trainwith_private.ledger where charge_id=$1 and kind='payment'",
      [chargeId],
    );
    if (!sale) {
      // Retry: refund notifications can arrive before the invoice event.
      throw new Error("Payment ledger entry is not available yet");
    }
    await db.transaction(async (tx) => {
      await tx.query("select pg_advisory_xact_lock(hashtext($1))", [
        `subscription:${sale.subscription_id}`,
      ]);
      if (e.type === "charge.refunded") {
        d = await p.charge(chargeId);
        for (const r of array(record(d.refunds).data).filter(
          (r) => r.status === "succeeded",
        ))
          await tx.query(
            `insert into trainwith_private.ledger(id,creator_id,subscription_id,invoice_id,charge_id,kind,amount_cents,currency) values($1,$2,$3,$4,$5,'refund',$6,$7) on conflict do nothing`,
            [
              `refund:${r.id}`,
              sale.creator_id,
              sale.subscription_id,
              sale.invoice_id,
              chargeId,
              -Number(r.amount),
              r.currency,
            ],
          );
        await tx.query(
          "update trainwith_private.subscriptions set revoked_invoice_id=$1 where id=$2 and paid_invoice_id=$1",
          [sale.invoice_id, sale.subscription_id],
        );
      } else {
        d = await p.dispute(String(d.id));
        // Reserve once when a dispute opens; release that reserve if it is won.
        await tx.query(
          `insert into trainwith_private.ledger(id,creator_id,subscription_id,invoice_id,charge_id,kind,amount_cents,currency) values($1,$2,$3,$4,$5,'dispute',$6,$7) on conflict do nothing`,
          [
            `dispute:${d.id}`,
            sale.creator_id,
            sale.subscription_id,
            sale.invoice_id,
            chargeId,
            -Number(d.amount),
            d.currency,
          ],
        );
        if (d.status === "won") {
          await tx.query(
            `insert into trainwith_private.ledger(id,creator_id,subscription_id,invoice_id,charge_id,kind,amount_cents,currency) values($1,$2,$3,$4,$5,'dispute',$6,$7) on conflict do nothing`,
            [
              `dispute:${d.id}:won`,
              sale.creator_id,
              sale.subscription_id,
              sale.invoice_id,
              chargeId,
              Number(d.amount),
              d.currency,
            ],
          );
          await tx.query(
            "update trainwith_private.subscriptions set revoked_invoice_id=null where id=$1 and revoked_invoice_id=$2 and not exists(select 1 from trainwith_private.ledger where invoice_id=$2 and kind='refund')",
            [sale.subscription_id, sale.invoice_id],
          );
        } else
          await tx.query(
            "update trainwith_private.subscriptions set revoked_invoice_id=$1 where id=$2 and paid_invoice_id=$1",
            [sale.invoice_id, sale.subscription_id],
          );
      }
    });
    return;
  }
  const subscription = e.type.startsWith("customer.subscription.")
    ? String(d.id)
    : externalId(d.subscription) ||
      externalId(record(record(d.parent).subscription_details).subscription);
  if (subscription)
    await syncSubscription(
      db,
      p,
      subscription,
      e.type === "invoice.paid" || e.type === "invoice.payment_succeeded"
        ? String(d.id)
        : undefined,
    );
}
async function muxEvent(db: DB, p: Providers, e: ProviderEvent) {
  const d = e.data;
  if (e.type === "video.asset.deleted") {
    // Deleted assets cannot be fetched from Mux. Match the current asset only,
    // so a late deletion for an older upload cannot unpublish its replacement.
    await db.transaction(async (tx) => {
      await tx.query(
        `with deleted as (
          update trainwith_private.video_assets
          set status='errored',playback_id=null,updated_at=now()
          where asset_id=$1 returning workout_id
        ) update trainwith.workouts set published=false
          where id in (select workout_id from deleted)`,
        [d.id],
      );
    });
    return;
  }
  if (e.type === "video.upload.asset_created") {
    await db.query(
      "update trainwith_private.video_assets set asset_id=$1,status='processing',updated_at=now() where upload_id=$2 and status in ('waiting','processing')",
      [d.asset_id, d.id],
    );
    return;
  }
  if (!e.type.startsWith("video.asset.")) return;
  const asset = await p.asset(String(d.id));
  const workoutId = String(asset.passthrough || "");
  if (!workoutId) return;
  const video = await one(
    db,
    "select * from trainwith_private.video_assets where workout_id=$1",
    [workoutId],
  );
  if (!video) throw new Error("Upload mapping is not available");
  // Ignore notifications for a video replaced by a later upload.
  if (asset.upload_id && video.upload_id !== asset.upload_id) return;
  if (!asset.upload_id && video.asset_id !== asset.id) return;
  const playback = array(asset.playback_ids).find((x) => x.policy === "signed");
  const duration = Number(asset.duration || 0);
  const ready =
    asset.status === "ready" && !!playback && duration > 0 && duration <= 10800;
  const status = ready
    ? "ready"
    : asset.status === "errored" || duration > 10800
      ? "errored"
      : "processing";
  await db.transaction(async (tx) => {
    await tx.query(
      "update trainwith_private.video_assets set asset_id=$1,playback_id=$2,status=$3,duration_seconds=$4,updated_at=now() where workout_id=$5",
      [asset.id, playback?.id || null, status, duration || null, workoutId],
    );
    if (ready)
      await tx.query("update trainwith.workouts set minutes=$1 where id=$2", [
        Math.max(1, Math.ceil(duration / 60)),
        workoutId,
      ]);
    if (status === "errored")
      await tx.query(
        "update trainwith.workouts set published=false where id=$1",
        [workoutId],
      );
  });
}
export async function processNext(db: DB, p: Providers) {
  const job = await db.transaction(async (tx) => {
    const row = await one(
      tx,
      `select * from trainwith_private.events where (status='pending' and available_at<=now()) or (status='processing' and locked_at<now()-interval '5 minutes') order by created_at for update skip locked limit 1`,
    );
    if (!row) return;
    await tx.query(
      "update trainwith_private.events set status='processing',locked_at=now(),attempts=attempts+1 where provider=$1 and id=$2",
      [row.provider, row.id],
    );
    return row;
  });
  if (!job) return false;
  try {
    const e = job.payload as ProviderEvent;
    if (job.provider === "stripe") await stripeEvent(db, p, e);
    else if (job.provider === "mux") await muxEvent(db, p, e);
    else throw new Error("Native billing is not enabled");
    await db.query(
      "update trainwith_private.events set status='done',payload='{}'::jsonb,last_error=null where provider=$1 and id=$2",
      [job.provider, job.id],
    );
  } catch {
    const attempts = Number(job.attempts) + 1;
    await db.query(
      `update trainwith_private.events set status=$1,last_error='Provider synchronization failed; inspect provider event and retry.',available_at=now()+($2*interval '1 second') where provider=$3 and id=$4`,
      [
        attempts >= 10 ? "failed" : "pending",
        Math.min(3600, 2 ** attempts * 5),
        job.provider,
        job.id,
      ],
    );
  }
  return true;
}
