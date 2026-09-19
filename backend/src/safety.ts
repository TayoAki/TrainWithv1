import { z } from "zod";
import type { DB } from "./db.js";
import { one } from "./db.js";
import type { Identity } from "./auth.js";
import { ApiError } from "./errors.js";

export const POLICY_VERSION = "2026-09-19";
export async function requireAdult(db: DB, u: Identity) {
  const profile = await one(
    db,
    "select * from trainwith.profiles where id=$1",
    [u.id],
  );
  if (profile?.account_status !== "active")
    throw new ApiError(
      403,
      "ACCOUNT_RESTRICTED",
      "This account is restricted. Open Settings for account deletion or contact support.",
    );
  if (!profile.adult_confirmed_at || profile.policy_version !== POLICY_VERSION)
    throw new ApiError(
      403,
      "ELIGIBILITY_REQUIRED",
      "Confirm that you are 18 or older and accept the current terms first.",
    );
}
export async function acceptPolicy(db: DB, u: Identity, input: unknown) {
  const p = z
    .object({
      adult: z.literal(true),
      accepted: z.literal(true),
      version: z.literal(POLICY_VERSION),
      ageSource: z.enum(["self_declared", "apple_age_range"]),
    })
    .strict()
    .parse(input);
  await db.query(
    "update trainwith.profiles set adult_confirmed_at=now(),policy_version=$1,age_source=$2 where id=$3 and account_status='active'",
    [p.version, p.ageSource, u.id],
  );
  await requireAdult(db, u);
  return { ok: true };
}
export async function setBlock(db: DB, u: Identity, input: unknown) {
  const p = z
    .object({ creatorId: z.string().min(3).max(100), blocked: z.boolean() })
    .strict()
    .parse(input);
  const c = await one(
    db,
    "select owner_id from trainwith.creators where id=$1",
    [p.creatorId],
  );
  if (!c || c.owner_id === u.id)
    throw new ApiError(400, "INVALID_TARGET", "Choose another creator.");
  if (p.blocked)
    await db.query(
      "insert into trainwith_private.blocks(user_id,creator_id) values($1,$2) on conflict do nothing",
      [u.id, p.creatorId],
    );
  else
    await db.query(
      "delete from trainwith_private.blocks where user_id=$1 and creator_id=$2",
      [u.id, p.creatorId],
    );
  return { ok: true };
}
export async function reportContent(db: DB, u: Identity, input: unknown) {
  const p = z
    .object({
      creatorId: z.string().min(3).max(100),
      workoutId: z.string().min(3).max(100).optional(),
      reason: z.enum([
        "unsafe",
        "age_inappropriate",
        "harassment",
        "rights",
        "other",
      ]),
      details: z.string().trim().min(10).max(3000),
    })
    .strict()
    .parse(input);
  const c = await one(
    db,
    "select id from trainwith.creators where id=$1 and owner_id<>$2 and approved",
    [p.creatorId, u.id],
  );
  if (!c) throw new ApiError(404, "NOT_FOUND", "Creator not found.");
  if (
    p.workoutId &&
    !(await one(
      db,
      "select 1 from trainwith.workouts where id=$1 and creator_id=$2",
      [p.workoutId, p.creatorId],
    ))
  )
    throw new ApiError(404, "NOT_FOUND", "Workout not found.");
  return await one(
    db,
    "insert into trainwith_private.reports(reporter_id,creator_id,workout_id,reason,details) values($1,$2,$3,$4,$5) returning id",
    [u.id, p.creatorId, p.workoutId || null, p.reason, p.details],
  );
}
export const purchaseClient = z
  .object({
    platform: z.enum(["web", "ios", "android"]),
    storefront: z.string().length(3).optional(),
  })
  .strict();
export function validatePurchaseClient(input: unknown, enabled: boolean) {
  const client = purchaseClient.parse(input ?? { platform: "web" });
  if (
    client.platform !== "web" &&
    !(enabled && client.platform === "ios" && client.storefront === "USA")
  )
    throw new ApiError(
      403,
      "CHECKOUT_UNAVAILABLE",
      "New memberships are unavailable in this app storefront.",
    );
  return client;
}
