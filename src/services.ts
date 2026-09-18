/**
 * The seam between the screens and whatever owns TrainWith's data.
 *
 * Every change to app state goes through a transition in this file. A
 * transition is a pure `AppState -> AppState` function: no React, no storage,
 * no navigation, so it can be unit tested directly (see tests/domain.test.mjs).
 * `src/store.tsx` binds them to local persisted state and exposes them to
 * screens as `apply`.
 *
 * Backend handoff: the screens never build state themselves, so moving to a
 * server means reimplementing the operations below against real endpoints and
 * leaving the screens alone. The two interfaces that must become real first are
 * `PaymentGateway` (charges and renewals) and the membership transitions, since
 * `hasAccess` in src/data.ts is a presentation check and not a security
 * boundary — authorization has to move server-side before it protects real
 * media.
 */
// Type-only imports are marked so Node's type stripping can erase them when
// the domain tests import this module directly.
import type { AppState, Category, Creator, Program, Workout } from "./data.ts";
import { photos, uid } from "./data.ts";

/** A pure state change. Screens dispatch these; they never write state inline. */
export type Transition = (state: AppState) => AppState;

/* ------------------------------------------------------------------ account */

export type Profile = { name: string; email: string };

export const signIn =
  (profile: Profile): Transition =>
  (s) => ({
    ...s,
    user: { name: profile.name.trim(), email: profile.email.trim() },
  });

export const signOut = (): Transition => (s) => ({ ...s, user: null });

/* --------------------------------------------------------------- membership */

/**
 * Grants a one month membership to a single creator, replacing any existing
 * membership for that creator.
 *
 * `startedAt` is injected so the caller controls the clock, which keeps the
 * transition testable. A real backend must own these dates: client-side
 * periods are trivially forged, and renewals need provider webhooks rather
 * than a date the app wrote down.
 */
export const startMembership =
  (
    creatorId: string,
    price: number,
    startedAt: Date = new Date(),
  ): Transition =>
  (s) => {
    const ends = new Date(startedAt);
    ends.setMonth(ends.getMonth() + 1);
    return {
      ...s,
      memberships: [
        ...s.memberships.filter((m) => m.creatorId !== creatorId),
        {
          creatorId,
          price,
          renews: true,
          started: startedAt.toISOString(),
          ends: ends.toISOString(),
        },
      ],
    };
  };

/** Cancelling keeps access through the period already paid for. */
export const setRenewal =
  (creatorId: string, renews: boolean): Transition =>
  (s) => ({
    ...s,
    memberships: s.memberships.map((m) =>
      m.creatorId === creatorId ? { ...m, renews } : m,
    ),
  });

/* ----------------------------------------------------------------- training */

/** Completion is recorded once per workout; re-completing keeps the first date. */
export const completeWorkout =
  (workoutId: string, at: Date = new Date()): Transition =>
  (s) => ({
    ...s,
    completed: {
      ...s.completed,
      [workoutId]: s.completed[workoutId] || at.toISOString(),
    },
  });

export const clearCompletion =
  (workoutId: string): Transition =>
  (s) => {
    const completed = { ...s.completed };
    delete completed[workoutId];
    return { ...s, completed };
  };

export const toggleSavedProgram =
  (programId: string): Transition =>
  (s) => ({
    ...s,
    saved: s.saved.includes(programId)
      ? s.saved.filter((x) => x !== programId)
      : [...s.saved, programId],
  });

/* ------------------------------------------------------------------ support */

export const addSupportRequest =
  (message: string, at: Date = new Date()): Transition =>
  (s) => ({
    ...s,
    supports: [
      ...s.supports,
      { id: uid("support"), message: message.trim(), date: at.toISOString() },
    ],
  });

/* ------------------------------------------------------------------ creator */

/**
 * Claims a handle, creating the channel on first call and renaming it after.
 * The new channel starts unpublished with no price and no payout setup, so it
 * cannot reach Discover until `publishChecks` passes.
 */
export const claimHandle =
  (handle: string, existing?: Creator): Transition =>
  (s) => {
    const id = existing?.id || uid("creator");
    return {
      ...s,
      ownedId: id,
      creators: existing
        ? s.creators.map((c) => (c.id === id ? { ...c, handle } : c))
        : [
            ...s.creators,
            {
              id,
              handle,
              name: s.user?.name || "Your name",
              category: "Strength" as Category,
              tagline: "",
              bio: "",
              photo: photos.workout,
              price: 0,
              published: false,
              payoutReady: false,
            },
          ],
    };
  };

/** Narrow patch type: publishing, pricing and payout have their own operations. */
export type ChannelProfile = Pick<
  Creator,
  "name" | "tagline" | "bio" | "category" | "photo"
>;

export const saveChannelProfile =
  (creatorId: string, profile: ChannelProfile): Transition =>
  (s) => ({
    ...s,
    creators: s.creators.map((c) =>
      c.id === creatorId
        ? {
            ...c,
            name: profile.name.trim(),
            tagline: profile.tagline.trim(),
            bio: profile.bio.trim(),
            category: profile.category,
            photo: profile.photo,
          }
        : c,
    ),
  });

export const setPrice =
  (creatorId: string, price: number): Transition =>
  (s) => ({
    ...s,
    creators: s.creators.map((c) => (c.id === creatorId ? { ...c, price } : c)),
  });

export const completePayoutSetup =
  (creatorId: string): Transition =>
  (s) => ({
    ...s,
    creators: s.creators.map((c) =>
      c.id === creatorId ? { ...c, payoutReady: true } : c,
    ),
  });

export const setChannelPublished =
  (creatorId: string, published: boolean): Transition =>
  (s) => ({
    ...s,
    creators: s.creators.map((c) =>
      c.id === creatorId ? { ...c, published } : c,
    ),
  });

/** Upserts by id, so the workout editor saves drafts and edits through one path. */
export const saveWorkout =
  (workout: Workout): Transition =>
  (s) => ({
    ...s,
    workouts: [...s.workouts.filter((w) => w.id !== workout.id), workout],
  });

export const saveProgram =
  (program: Program): Transition =>
  (s) => ({
    ...s,
    programs: [...s.programs.filter((p) => p.id !== program.id), program],
  });

/* ------------------------------------------------------------------ payment */

export type PaymentResult =
  { ok: true; reference: string } | { ok: false; reason: string };

export type ChargeRequest = {
  creatorId: string;
  amount: number;
  /** Drives the in-app failure path. A real gateway has no such input. */
  simulateFailure?: boolean;
};

/**
 * The payment seam. Swap this implementation for a real provider (and move
 * the charge server-side) without touching the membership screen.
 */
export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<PaymentResult>;
}

export const PAYMENT_FAILURE_MESSAGE =
  "The payment could not be completed. No membership was added. Please try again.";

/**
 * Stands in for a payment provider until one is wired up. It settles after a
 * short delay so the screen's pending state is exercised, and charges nothing.
 */
export const localPaymentGateway: PaymentGateway = {
  charge({ simulateFailure }) {
    return new Promise((resolve) =>
      setTimeout(
        () =>
          resolve(
            simulateFailure
              ? { ok: false, reason: PAYMENT_FAILURE_MESSAGE }
              : { ok: true, reference: uid("payment") },
          ),
        900,
      ),
    );
  },
};
