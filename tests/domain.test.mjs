import test from "node:test";
import assert from "node:assert/strict";
import {
  seed,
  hasAccess,
  handleError,
  publishChecks,
  EMAIL,
} from "../src/data.ts";
import {
  startMembership,
  setRenewal,
  completeWorkout,
  clearCompletion,
  claimHandle,
  saveWorkout,
  localPaymentGateway,
  PAYMENT_FAILURE_MESSAGE,
} from "../src/services.ts";
test("a membership unlocks only its own creator and expires at its end date", () => {
  const s = seed();
  s.memberships.push({
    creatorId: "maya",
    price: 19,
    renews: false,
    started: new Date().toISOString(),
    ends: new Date(Date.now() + 86400000).toISOString(),
  });
  assert.equal(hasAccess(s, "maya"), true);
  assert.equal(hasAccess(s, "alex"), false);
  s.memberships[0].ends = new Date(Date.now() - 1).toISOString();
  assert.equal(hasAccess(s, "maya"), false);
});
test("handles reject duplicate and reserved names while allowing an owner to keep their handle", () => {
  const s = seed();
  assert.ok(handleError("trainwithmaya", s.creators));
  assert.ok(handleError("studio", s.creators));
  assert.ok(handleError("a b", s.creators));
  assert.equal(handleError("trainwithmaya", s.creators, "maya"), "");
  assert.equal(handleError("samtrains", s.creators), "");
});
test("creator cannot launch without both published free and paid content, a price, a profile, and payout setup", () => {
  const s = seed();
  const c = {
    ...s.creators[0],
    id: "new",
    price: 0,
    payoutReady: false,
    bio: "",
  };
  assert.equal(
    publishChecks(s, c).every((x) => x.ok),
    false,
  );
  c.bio = "Thoughtful training for busy people.";
  c.price = 19;
  c.payoutReady = true;
  s.workouts.push(
    { ...s.workouts[0], id: "new-free", creatorId: "new" },
    { ...s.workouts[1], id: "new-paid", creatorId: "new" },
  );
  assert.equal(
    publishChecks(s, c).every((x) => x.ok),
    true,
  );
  s.workouts.find((w) => w.id === "new-paid").published = false;
  assert.equal(
    publishChecks(s, c).every((x) => x.ok),
    false,
  );
});

test("a membership covers exactly one month and replaces any earlier one", () => {
  const started = new Date("2026-03-15T09:00:00.000Z");
  const s = startMembership("maya", 19, started)(seed());
  assert.equal(s.memberships.length, 1);
  const m = s.memberships[0];
  assert.equal(m.renews, true);
  assert.equal(m.price, 19);
  assert.equal(new Date(m.ends).toISOString(), "2026-04-15T09:00:00.000Z");
  // Re-joining replaces rather than stacking a second membership.
  const again = startMembership(
    "maya",
    23,
    new Date("2026-05-01T09:00:00.000Z"),
  )(s);
  assert.equal(again.memberships.length, 1);
  assert.equal(again.memberships[0].price, 23);
});

test("cancelling renewal keeps access, and access ends with the paid period", () => {
  const started = new Date();
  let s = startMembership("maya", 19, started)(seed());
  s = setRenewal("maya", false)(s);
  assert.equal(s.memberships[0].renews, false);
  // Cancelled, but still inside the paid period.
  assert.equal(hasAccess(s, "maya"), true);
  s.memberships[0].ends = new Date(Date.now() - 1).toISOString();
  assert.equal(hasAccess(s, "maya"), false);
});

test("a workout records its first completion date and can be cleared", () => {
  const first = new Date("2026-01-02T00:00:00.000Z");
  let s = completeWorkout("w1", first)(seed());
  assert.equal(s.completed.w1, first.toISOString());
  // Completing again keeps the original date rather than overwriting it.
  s = completeWorkout("w1", new Date("2026-02-02T00:00:00.000Z"))(s);
  assert.equal(s.completed.w1, first.toISOString());
  s = clearCompletion("w1")(s);
  assert.equal("w1" in s.completed, false);
});

test("claiming a handle creates an unpublishable channel, then renames it", () => {
  let s = claimHandle("samtrains")(seed());
  const own = s.creators.find((c) => c.id === s.ownedId);
  assert.equal(own.handle, "samtrains");
  assert.equal(own.published, false);
  assert.equal(own.price, 0);
  assert.equal(own.payoutReady, false);
  // A brand new channel cannot pass the publish gate.
  assert.equal(
    publishChecks(s, own).every((x) => x.ok),
    false,
  );
  const before = s.creators.length;
  s = claimHandle("samlifts", own)(s);
  assert.equal(s.creators.length, before, "renaming must not add a channel");
  assert.equal(s.creators.find((c) => c.id === own.id).handle, "samlifts");
});

test("saving a workout upserts, so editing does not duplicate it", () => {
  const base = seed();
  const w = { ...base.workouts[0], id: "w-new", title: "First cut" };
  let s = saveWorkout(w)(base);
  const count = s.workouts.length;
  s = saveWorkout({ ...w, title: "Second cut" })(s);
  assert.equal(s.workouts.length, count);
  assert.equal(s.workouts.find((x) => x.id === "w-new").title, "Second cut");
});

test("the local payment gateway resolves both outcomes without charging", async () => {
  const ok = await localPaymentGateway.charge({
    creatorId: "maya",
    amount: 19,
  });
  assert.equal(ok.ok, true);
  const failed = await localPaymentGateway.charge({
    creatorId: "maya",
    amount: 19,
    simulateFailure: true,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, PAYMENT_FAILURE_MESSAGE);
});

test("the email check catches typos without rejecting valid addresses", () => {
  for (const good of [
    "sam@example.com",
    "sam.taylor+gym@sub.example.co.uk",
    "s@e.io",
  ])
    assert.equal(EMAIL.test(good), true, `${good} should be accepted`);
  for (const bad of [
    "",
    "sam",
    "sam@",
    "@example.com",
    "sam@example",
    "a b@c.com",
  ])
    assert.equal(EMAIL.test(bad), false, `${bad} should be rejected`);
});
