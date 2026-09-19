import type { DB, Row } from "./db.js";
import { one } from "./db.js";
import type { Identity } from "./auth.js";
import { ApiError } from "./errors.js";
import { z } from "zod";
import { POLICY_VERSION, requireAdult } from "./safety.js";

const active = `s.paid_until>now() and s.revoked_invoice_id is null`;
const safety = `exists(select 1 from trainwith.profiles owner where owner.id=c.owner_id and owner.account_status='active') and not exists(select 1 from trainwith_private.blocks b where b.user_id=$1::uuid and b.creator_id=c.id)`;
export const visible = `${safety} and (c.owner_id=$1::uuid or (c.approved and (c.published or exists(select 1 from trainwith_private.subscriptions s where s.creator_id=c.id and s.user_id=$1::uuid and ${active}))))`;
export async function ensureProfile(db: DB, u: Identity) {
  if (
    await one(
      db,
      "select 1 from trainwith_private.erased_subjects where kind='user' and subject_id=$1",
      [u.id],
    )
  )
    throw new ApiError(
      403,
      "ACCOUNT_DELETED",
      "This account has been deleted.",
    );
  await db.query(
    "insert into trainwith.profiles(id,name) values($1,$2) on conflict(id) do nothing",
    [u.id, u.name],
  );
}
export async function owned(db: DB, u: Identity, id: string) {
  const row = await one(
    db,
    "select * from trainwith.creators where id=$1 and owner_id=$2",
    [id, u.id],
  );
  if (!row) throw new ApiError(404, "NOT_FOUND", "Channel not found.");
  return row;
}
export async function canPlay(
  db: DB,
  workoutId: string,
  userId: string | null,
) {
  if (!userId)
    throw new ApiError(
      401,
      "UNAUTHENTICATED",
      "Sign in and confirm you are 18 or older to play workouts.",
    );
  await requireAdult(db, { id: userId, email: "", name: "" });
  const row = await one(
    db,
    `select w.*,c.owner_id,c.approved,c.published as channel_published,
    a.playback_id,a.status as video_status,a.duration_seconds from trainwith.workouts w
    join trainwith.creators c on c.id=w.creator_id left join trainwith_private.video_assets a on a.workout_id=w.id
    where w.id=$1 and exists(select 1 from trainwith.profiles owner where owner.id=c.owner_id and owner.account_status='active') and not exists(select 1 from trainwith_private.blocks b where b.user_id=$2::uuid and b.creator_id=c.id) and (c.owner_id=$2::uuid or (c.approved and w.published and w.moderation_status='approved' and
    ((w.free and c.published) or exists(select 1 from trainwith_private.subscriptions s where s.creator_id=c.id and s.user_id=$2::uuid and ${active}))))`,
    [workoutId, userId],
  );
  if (!row)
    throw new ApiError(
      403,
      "ACCESS_REQUIRED",
      "This workout requires an active membership.",
    );
  return row;
}
export async function readState(db: DB, u: Identity | null) {
  const uid = u?.id || null;
  const creators = (
    await db.query(
      `select c.*, coalesce(b.charges_enabled and b.payouts_enabled and b.details_submitted,false) as payout_ready
    from trainwith.creators c left join trainwith_private.creator_billing b on b.creator_id=c.id
    where ${visible} order by c.created_at desc limit 300`,
      [uid],
    )
  ).rows;
  const workouts = (
    await db.query(
      `select w.*,a.status as video_status from trainwith.workouts w join trainwith.creators c on c.id=w.creator_id
    left join trainwith_private.video_assets a on a.workout_id=w.id
    where ${visible} and ((w.published and w.moderation_status='approved') or c.owner_id=$1::uuid) order by w.created_at desc limit 3000`,
      [uid],
    )
  ).rows;
  const programs = (
    await db.query(
      `select p.*,coalesce((select json_agg(pw.workout_id order by pw.position) from trainwith.program_workouts pw join trainwith.workouts w on w.id=pw.workout_id where pw.program_id=p.id and ((w.published and w.moderation_status='approved') or c.owner_id=$1::uuid)),'[]') as workout_ids
    from trainwith.programs p join trainwith.creators c on c.id=p.creator_id where ${visible} and ((p.published and p.moderation_status='approved') or c.owner_id=$1::uuid) limit 1000`,
      [uid],
    )
  ).rows;
  const memberships = uid
    ? (
        await db.query(
          `select * from trainwith_private.subscriptions where user_id=$1 and paid_until is not null and revoked_invoice_id is null order by paid_until desc`,
          [uid],
        )
      ).rows
    : [];
  const completions = uid
    ? (
        await db.query(
          "select workout_id,completed_at from trainwith.completions where user_id=$1",
          [uid],
        )
      ).rows
    : [];
  const saved = uid
    ? (
        await db.query(
          "select program_id from trainwith.saved_programs where user_id=$1",
          [uid],
        )
      ).rows
    : [];
  const supports = uid
    ? (
        await db.query(
          "select id,message,created_at,status from trainwith.support_requests where user_id=$1 order by created_at desc limit 100",
          [uid],
        )
      ).rows
    : [];
  const profile = uid
    ? await one(db, "select * from trainwith.profiles where id=$1", [uid])
    : undefined;
  const iso = (v: unknown) => new Date(String(v)).toISOString();
  return {
    version: 1,
    eligibility: {
      accepted:
        !!profile?.adult_confirmed_at &&
        profile?.policy_version === POLICY_VERSION,
      status: profile?.account_status || "active",
      policyVersion: POLICY_VERSION,
    },
    blocked: uid
      ? (
          await db.query(
            "select b.creator_id as id,c.name,c.handle,c.price_cents/100.0 as price from trainwith_private.blocks b join trainwith.creators c on c.id=b.creator_id where b.user_id=$1",
            [uid],
          )
        ).rows
      : [],
    user: u
      ? { id: u.id, name: profile?.name || u.name, email: u.email }
      : null,
    creators: creators.map((c) => ({
      id: c.id,
      name: c.name,
      handle: c.handle,
      category: c.category,
      tagline: c.tagline,
      bio: c.bio,
      photo: c.photo,
      price: Number(c.price_cents) / 100,
      published: c.published,
      payoutReady: c.payout_ready,
      approved: c.approved,
      currency: c.currency,
    })),
    workouts: workouts.map((w) => ({
      id: w.id,
      creatorId: w.creator_id,
      title: w.title,
      description: w.description,
      minutes: w.minutes,
      equipment: w.equipment,
      level: w.level,
      free: w.free,
      published: w.published,
      photo: w.photo,
      moderationStatus: w.moderation_status,
      video: w.video_status === "ready" ? `trainwith:workout:${w.id}` : "",
    })),
    programs: programs.map((p) => ({
      id: p.id,
      creatorId: p.creator_id,
      title: p.title,
      description: p.description,
      weeks: p.weeks,
      published: p.published,
      workoutIds: p.workout_ids,
      moderationStatus: p.moderation_status,
    })),
    memberships: memberships
      .filter(
        (s, i, all) =>
          all.findIndex((x) => x.creator_id === s.creator_id) === i,
      )
      .map((s) => ({
        creatorId: s.creator_id,
        price: Number(s.price_cents) / 100,
        renews: !s.cancel_at_period_end,
        started: iso(s.started_at),
        ends: iso(s.paid_until),
        provider: "stripe",
      })),
    completed: Object.fromEntries(
      completions.map((c) => [c.workout_id, iso(c.completed_at)]),
    ),
    saved: saved.map((s) => s.program_id),
    supports: supports.map((s) => ({
      id: s.id,
      message: s.message,
      date: iso(s.created_at),
      status: s.status,
    })),
    ownedId: creators.find((c) => c.owner_id === uid)?.id || null,
  };
}
const id = z.string().regex(/^[a-zA-Z0-9_-]{3,100}$/);
const photo = z.union([
  z.literal(""),
  z.url().refine((v) => v.startsWith("https://"), "Use an HTTPS image URL."),
]);
const reserved = new Set([
  "studio",
  "profile",
  "discover",
  "workouts",
  "support",
  "join",
  "admin",
  "settings",
  "auth",
  "screen",
  "membership",
  "explore",
  "creators",
  "about",
  "privacy",
  "terms",
  "api",
  "healthz",
  "readyz",
]);
const commands = {
  "profile.update": z
    .object({
      name: z.string().trim().min(1).max(100),
      email: z.email().optional(),
    })
    .strict(),
  "creator.claim": z
    .object({
      handle: z
        .string()
        .regex(/^[a-z][a-z0-9_]{2,23}$/)
        .refine((v) => !reserved.has(v), "This handle is reserved."),
    })
    .strict(),
  "creator.profile": z
    .object({
      creatorId: id,
      name: z.string().trim().min(1).max(100),
      tagline: z.string().trim().max(160),
      bio: z.string().trim().max(5000),
      category: z.enum(["Strength", "Mobility", "Pilates"]),
      photo,
    })
    .strict(),
  "creator.price": z
    .object({
      creatorId: id,
      price: z
        .number()
        .min(1)
        .max(1000)
        .refine(
          (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6,
          "Use at most two decimal places.",
        ),
    })
    .strict(),
  "creator.publish": z
    .object({ creatorId: id, published: z.boolean() })
    .strict(),
  "workout.save": z
    .object({
      id,
      creatorId: id,
      title: z.string().trim().min(1).max(160),
      description: z.string().max(5000),
      minutes: z.number().int().min(1).max(180),
      equipment: z.string().max(160),
      level: z.string().max(60),
      free: z.boolean(),
      published: z.boolean(),
      photo,
      video: z.string().max(500),
    })
    .strict(),
  "program.save": z
    .object({
      id,
      creatorId: id,
      title: z.string().trim().min(1).max(160),
      description: z.string().max(5000),
      weeks: z.number().int().min(1).max(52),
      workoutIds: z
        .array(id)
        .max(300)
        .refine((x) => new Set(x).size === x.length),
      published: z.boolean(),
    })
    .strict(),
  "workout.complete": z.object({ workoutId: id }).strict(),
  "workout.clear": z.object({ workoutId: id }).strict(),
  "program.saveToggle": z.object({ programId: id }).strict(),
  "support.create": z
    .object({ message: z.string().trim().min(10).max(5000) })
    .strict(),
};
export async function runCommand(
  db: DB,
  u: Identity,
  name: string,
  payload: unknown,
) {
  if (!(name in commands))
    throw new ApiError(400, "INVALID_COMMAND", "Unsupported operation.");
  const p = commands[name as keyof typeof commands].parse(payload) as Row;
  await db.transaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock(hashtext($1))", [
      `account:${u.id}`,
    ]);
    await requireAdult(tx, u);
    if (p.creatorId) await owned(tx, u, String(p.creatorId));
    switch (name) {
      case "profile.update":
        if (p.email && p.email !== u.email)
          throw new ApiError(
            400,
            "EMAIL_CHANGE_REQUIRES_VERIFICATION",
            "Email changes require a new verification.",
          );
        await tx.query("update trainwith.profiles set name=$1 where id=$2", [
          p.name,
          u.id,
        ]);
        break;
      case "creator.claim":
        await tx.query(
          `insert into trainwith.creators(owner_id,handle,name) values($1,$2,$3)
          on conflict(owner_id) do update set handle=excluded.handle`,
          [u.id, p.handle, u.name],
        );
        break;
      case "creator.profile":
        await tx.query(
          "update trainwith.creators set name=$1,tagline=$2,bio=$3,category=$4,photo=$5,approved=false,published=false where id=$6 and owner_id=$7",
          [p.name, p.tagline, p.bio, p.category, p.photo, p.creatorId, u.id],
        );
        break;
      case "creator.price":
        await tx.query(
          "update trainwith.creators set price_cents=$1 where id=$2 and owner_id=$3",
          [Math.round(Number(p.price) * 100), p.creatorId, u.id],
        );
        break;
      case "creator.publish": {
        if (p.published) {
          const c = await one(
            tx,
            `select c.*,b.charges_enabled,b.payouts_enabled,b.details_submitted,
            exists(select 1 from trainwith.workouts w join trainwith_private.video_assets a on a.workout_id=w.id where w.creator_id=c.id and w.published and w.free and a.status='ready') as has_free,
            exists(select 1 from trainwith.workouts w join trainwith_private.video_assets a on a.workout_id=w.id where w.creator_id=c.id and w.published and not w.free and a.status='ready') as has_paid
            from trainwith.creators c left join trainwith_private.creator_billing b on b.creator_id=c.id where c.id=$1`,
            [p.creatorId],
          );
          if (!c?.approved)
            throw new ApiError(
              409,
              "APPROVAL_REQUIRED",
              "Your channel needs TrainWith approval before publishing.",
            );
          if (
            !c.name ||
            !c.tagline ||
            String(c.bio).length < 20 ||
            !c.has_free ||
            !c.has_paid ||
            !c.charges_enabled ||
            !c.payouts_enabled ||
            !c.details_submitted ||
            Number(c.price_cents) < 100
          )
            throw new ApiError(
              409,
              "INCOMPLETE_CHANNEL",
              "Complete your profile, ready free and paid videos, price, and Stripe onboarding first.",
            );
        }
        await tx.query(
          "update trainwith.creators set published=$1 where id=$2 and owner_id=$3",
          [p.published, p.creatorId, u.id],
        );
        break;
      }
      case "workout.save": {
        const existing = await one(
          tx,
          "select * from trainwith.workouts where id=$1",
          [p.id],
        );
        if (existing && existing.creator_id !== p.creatorId)
          throw new ApiError(
            403,
            "FORBIDDEN",
            "Workout belongs to another channel.",
          );
        const changed =
          !!existing &&
          [
            "title",
            "description",
            "photo",
            "free",
            "equipment",
            "level",
            "minutes",
          ].some((key) => existing[key] !== p[key]);
        if (
          p.published &&
          (existing?.moderation_status !== "approved" || changed)
        )
          throw new ApiError(
            409,
            "MODERATION_REQUIRED",
            "Save this workout as a draft for content review before publishing.",
          );
        if (changed)
          await tx.query(
            "update trainwith.workouts set moderation_status='pending',published=false where id=$1",
            [p.id],
          );
        if (
          p.published &&
          !(await one(
            tx,
            "select 1 from trainwith_private.video_assets where workout_id=$1 and status='ready'",
            [p.id],
          ))
        )
          throw new ApiError(
            409,
            "VIDEO_NOT_READY",
            "Upload a video and wait for processing before publishing.",
          );
        await tx.query(
          `insert into trainwith.workouts(id,creator_id,title,description,minutes,equipment,level,free,published,photo)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(id) do update set title=excluded.title,description=excluded.description,minutes=excluded.minutes,equipment=excluded.equipment,level=excluded.level,free=excluded.free,published=excluded.published,photo=excluded.photo where workouts.creator_id=excluded.creator_id`,
          [
            p.id,
            p.creatorId,
            p.title,
            p.description,
            p.minutes,
            p.equipment,
            p.level,
            p.free,
            p.published,
            p.photo,
          ],
        );
        break;
      }
      case "program.save": {
        const existing = await one(
          tx,
          "select * from trainwith.programs where id=$1",
          [p.id],
        );
        if (existing && existing.creator_id !== p.creatorId)
          throw new ApiError(
            403,
            "FORBIDDEN",
            "Program belongs to another channel.",
          );
        const changed =
          !!existing &&
          ["title", "description", "weeks"].some(
            (key) => existing[key] !== p[key],
          );
        if (
          p.published &&
          (existing?.moderation_status !== "approved" || changed)
        )
          throw new ApiError(
            409,
            "MODERATION_REQUIRED",
            "Save this program as a draft for content review before publishing.",
          );
        if (changed)
          await tx.query(
            "update trainwith.programs set moderation_status='pending',published=false where id=$1",
            [p.id],
          );
        const ids = p.workoutIds as string[];
        const valid = (
          await tx.query(
            "select id,published from trainwith.workouts where id=any($1::text[]) and creator_id=$2",
            [ids, p.creatorId],
          )
        ).rows;
        if (
          valid.length !== ids.length ||
          (p.published && (!ids.length || valid.some((w) => !w.published)))
        )
          throw new ApiError(
            400,
            "INVALID_WORKOUTS",
            "Use published workouts from your own channel.",
          );
        await tx.query(
          `insert into trainwith.programs(id,creator_id,title,description,weeks,published) values($1,$2,$3,$4,$5,$6)
          on conflict(id) do update set title=excluded.title,description=excluded.description,weeks=excluded.weeks,published=excluded.published where programs.creator_id=excluded.creator_id`,
          [p.id, p.creatorId, p.title, p.description, p.weeks, p.published],
        );
        await tx.query(
          "delete from trainwith.program_workouts where program_id=$1",
          [p.id],
        );
        for (const [position, workoutId] of ids.entries())
          await tx.query(
            "insert into trainwith.program_workouts values($1,$2,$3)",
            [p.id, workoutId, position],
          );
        break;
      }
      case "workout.complete":
        await canPlay(tx, String(p.workoutId), u.id);
        await tx.query(
          "insert into trainwith.completions(user_id,workout_id) values($1,$2) on conflict do nothing",
          [u.id, p.workoutId],
        );
        break;
      case "workout.clear":
        await tx.query(
          "delete from trainwith.completions where user_id=$1 and workout_id=$2",
          [u.id, p.workoutId],
        );
        break;
      case "program.saveToggle": {
        const available = await one(
          tx,
          `select p.id from trainwith.programs p join trainwith.creators c on c.id=p.creator_id where ${visible} and p.id=$2 and ((p.published and p.moderation_status='approved') or c.owner_id=$1::uuid)`,
          [u.id, p.programId],
        );
        if (!available)
          throw new ApiError(404, "NOT_FOUND", "Program not found.");
        const removed = await tx.query(
          "delete from trainwith.saved_programs where user_id=$1 and program_id=$2 returning program_id",
          [u.id, p.programId],
        );
        if (!removed.rows.length)
          await tx.query(
            "insert into trainwith.saved_programs values($1,$2) on conflict do nothing",
            [u.id, p.programId],
          );
        break;
      }
      case "support.create":
        await tx.query(
          "insert into trainwith.support_requests(user_id,message) values($1,$2)",
          [u.id, p.message],
        );
        break;
    }
  });
}
