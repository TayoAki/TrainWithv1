import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { DB, Row } from "./db.js";
import { one } from "./db.js";
import type { Identity } from "./auth.js";
import type { Providers, CheckoutInput } from "./providers.js";
import { ApiError } from "./errors.js";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function requestDeletion(
  db: DB,
  p: Providers,
  u: Identity,
  input: unknown,
) {
  const body = z
    .object({
      confirmation: z.literal("DELETE"),
      password: z.string().min(1).max(512),
    })
    .strict()
    .parse(input);
  await p.confirmPassword(u.email, body.password, u.id);
  const receipt = randomBytes(32).toString("hex");
  await db.transaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock(hashtext($1))", [
      `account:${u.id}`,
    ]);
    const existing = await one(
      tx,
      "select id from trainwith_private.deletions where user_id=$1",
      [u.id],
    );
    if (existing) {
      await tx.query(
        "update trainwith_private.deletions set receipt_hash=$1 where id=$2",
        [hash(receipt), existing.id],
      );
      return;
    }
    const creator = await one(
      tx,
      "select id from trainwith.creators where owner_id=$1 for update",
      [u.id],
    );
    const cid = creator?.id || null;
    const customer = await one(
      tx,
      "select stripe_customer_id from trainwith_private.customers where user_id=$1",
      [u.id],
    );
    const attempts = (
      await tx.query(
        "select * from trainwith_private.checkout_attempts where user_id=$1 or creator_id=$2",
        [u.id, cid],
      )
    ).rows;
    const videos = (
      await tx.query(
        "select w.id,a.upload_id,a.asset_id from trainwith.workouts w left join trainwith_private.video_assets a on a.workout_id=w.id where w.creator_id=$1",
        [cid],
      )
    ).rows;
    const customers = (
      await tx.query(
        "select distinct customer_id from trainwith_private.subscriptions where creator_id=$1",
        [cid],
      )
    ).rows.map((s) => String(s.customer_id));
    for (const a of attempts) {
      const payload = a.payload as Row;
      if (payload.customer) customers.push(String(payload.customer));
    }
    await tx.query(
      "update trainwith.profiles set account_status='deleting' where id=$1",
      [u.id],
    );
    await tx.query(
      "update trainwith.creators set published=false,approved=false where owner_id=$1",
      [u.id],
    );
    await tx.query(
      "insert into trainwith_private.deletions(user_id,receipt_hash,payload) values($1,$2,$3::jsonb)",
      [
        u.id,
        hash(receipt),
        JSON.stringify({
          creatorId: cid,
          email: u.email,
          customerId: customer?.stripe_customer_id || null,
          attempts,
          videos,
          customers: [...new Set(customers)],
        }),
      ],
    );
  });
  return { receipt, status: "pending" };
}
export async function deletionStatus(db: DB, input: unknown) {
  const { receipt } = z
    .object({ receipt: z.string().regex(/^[a-f0-9]{64}$/) })
    .strict()
    .parse(input);
  const job = await one(
    db,
    "select status,created_at,completed_at from trainwith_private.deletions where receipt_hash=$1",
    [hash(receipt)],
  );
  if (!job)
    throw new ApiError(
      404,
      "NOT_FOUND",
      "Deletion receipt not found or expired.",
    );
  return {
    status: job.status,
    createdAt: job.created_at,
    completedAt: job.completed_at,
  };
}
async function purge(
  db: DB,
  userId: string,
  creatorId: string | null,
  workouts: string[],
  email: string,
) {
  await db.transaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock(hashtext($1))", [
      `account:${userId}`,
    ]);
    for (const [kind, ids] of [
      ["user", [userId]],
      ["creator", creatorId ? [creatorId] : []],
      ["workout", workouts],
    ] as const)
      for (const id of ids)
        await tx.query(
          "insert into trainwith_private.erased_subjects(kind,subject_id) values($1,$2) on conflict do nothing",
          [kind, id],
        );
    await tx.query(
      "delete from trainwith_private.checkout_attempts where user_id=$1 or creator_id=$2",
      [userId, creatorId],
    );
    await tx.query(
      "delete from trainwith_private.subscriptions where user_id=$1 or creator_id=$2",
      [userId, creatorId],
    );
    await tx.query("delete from trainwith_private.customers where user_id=$1", [
      userId,
    ]);
    await tx.query(
      "delete from trainwith_private.creator_billing where creator_id=$1",
      [creatorId],
    );
    await tx.query("delete from trainwith.programs where creator_id=$1", [
      creatorId,
    ]);
    await tx.query(
      "delete from trainwith.completions where workout_id=any($1::text[]) or user_id=$2",
      [workouts, userId],
    );
    await tx.query(
      "delete from trainwith_private.video_assets where workout_id=any($1::text[])",
      [workouts],
    );
    await tx.query(
      "delete from trainwith.program_workouts where workout_id=any($1::text[])",
      [workouts],
    );
    await tx.query(
      "delete from trainwith_private.reports where reporter_id=$1 or creator_id=$2",
      [userId, creatorId],
    );
    await tx.query("delete from trainwith.workouts where creator_id=$1", [
      creatorId,
    ]);
    await tx.query("delete from trainwith.creators where owner_id=$1", [
      userId,
    ]);
    await tx.query(
      "delete from trainwith_private.contact_requests where lower(email)=lower($1)",
      [email],
    );
    await tx.query("delete from trainwith.profiles where id=$1", [userId]);
    await tx.query(
      "update trainwith_private.audit_log set actor_id=null,subject_id=null where actor_id=$1 or subject_id=$1::text or subject_id=$2",
      [userId, creatorId],
    );
  });
}
export async function processDeletion(db: DB, p: Providers) {
  const job = await db.transaction(async (tx) => {
    const j = await one(
      tx,
      `select * from trainwith_private.deletions where (status='pending' and available_at<=now()) or (status='processing' and locked_at<now()-interval '10 minutes') order by created_at for update skip locked limit 1`,
    );
    if (j)
      await tx.query(
        "update trainwith_private.deletions set status='processing',locked_at=now(),attempts=attempts+1 where id=$1",
        [j.id],
      );
    return j;
  });
  if (!job) return false;
  try {
    const data = job.payload as {
      creatorId: string | null;
      email: string;
      customerId: string | null;
      attempts: Row[];
      videos: Row[];
      customers: string[];
    };
    for (const a of data.attempts)
      await p.closeCheckout(
        { ...(a.payload as CheckoutInput), key: `checkout:${a.request_key}` },
        a.session_id ? String(a.session_id) : undefined,
      );
    if (data.creatorId)
      for (const customer of data.customers)
        await p.cancelSubscriptions(customer, data.creatorId);
    if (data.customerId) await p.deleteCustomer(data.customerId); // Stripe cancels this customer's active subscriptions.
    const workouts = data.videos.map((v) => String(v.id));
    await p.deleteMedia(
      workouts,
      data.videos.filter((v) => v.upload_id).map((v) => String(v.upload_id)),
      data.videos.filter((v) => v.asset_id).map((v) => String(v.asset_id)),
    );
    await purge(db, String(job.user_id), data.creatorId, workouts, data.email);
    await p.deleteAuthUser(String(job.user_id));
    await db.query(
      "update trainwith_private.deletions set status='done',completed_at=now(),payload='{}'::jsonb,user_id=null,last_error=null where id=$1",
      [job.id],
    );
  } catch {
    const attempts = Number(job.attempts) + 1;
    await db.query(
      "update trainwith_private.deletions set status=$1,last_error='Deletion needs provider retry; no completion has been confirmed.',available_at=now()+($2*interval '1 second') where id=$3",
      [
        attempts >= 10 ? "failed" : "pending",
        Math.min(3600, 2 ** attempts * 5),
        job.id,
      ],
    );
  }
  return true;
}
