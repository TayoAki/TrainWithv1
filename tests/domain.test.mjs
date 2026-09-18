import test from "node:test";
import assert from "node:assert/strict";
import { seed, hasAccess, handleError, publishChecks } from "../src/data.ts";
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
