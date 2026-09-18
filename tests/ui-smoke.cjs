const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");
const {
  getByRole,
  fireEvent,
  waitFor,
  getAllByText,
  getAllByLabelText,
  isInaccessible,
} = require("@testing-library/dom");
const assert = require("node:assert/strict");
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (e) => {
  if (!e.message.includes("Not implemented")) console.error(w.location.href);
  console.error(e.message.slice(0, 600));
});
virtualConsole.on("error", (...args) => console.error(...args));
const dom = new JSDOM(
  '<!doctype html><html><head></head><body><div id="root"></div></body></html>',
  {
    url: "http://localhost:8081/",
    pretendToBeVisual: true,
    runScripts: "outside-only",
    virtualConsole,
  },
);
const w = dom.window;
w.matchMedia = () => ({
  matches: false,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
});
w.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
w.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
w.fetch = global.fetch;
w.TextEncoder = global.TextEncoder;
w.TextDecoder = global.TextDecoder;
w.structuredClone = global.structuredClone;
w.HTMLMediaElement.prototype.load = function () {};
w.HTMLMediaElement.prototype.play = function () {
  return Promise.resolve();
};
w.HTMLMediaElement.prototype.pause = function () {};
w.HTMLElement.prototype.scrollTo = function () {};
const file = fs
  .readdirSync("dist/_expo/static/js/web")
  .find((f) => f.endsWith(".js"));
w.eval(fs.readFileSync(path.join("dist/_expo/static/js/web", file), "utf8"));
const doc = w.document;
const button = (name) => getByRole(doc.body, "button", { name, exact: true });
const click = async (name) => {
  await waitFor(() => assert.ok(button(name)), {
    container: doc.body,
    timeout: 10000,
  });
  fireEvent.click(button(name));
  await new Promise((r) => setTimeout(r, 80));
};
const text = async (s) => {
  await waitFor(
    () =>
      assert.ok(
        getAllByText(doc.body, s, { exact: true }).some(
          (e) => !isInaccessible(e),
        ),
      ),
    { container: doc.body, timeout: 10000 },
  );
};
const fill = (label, value) =>
  fireEvent.change(
    getAllByLabelText(doc.body, label, { exact: true }).find(
      (e) => !isInaccessible(e),
    ),
    { target: { value } },
  );
const pause = () => new Promise((r) => setTimeout(r, 100));
const passed = [];
const pass = (name) => {
  passed.push(name);
  console.log(`PASS: ${name}`);
};
(async () => {
  try {
    await text("Find your next coach.");
    pass("app mounts and discovery renders");
    fill("Find your fit", "no such coach");
    await text("No coaches found");
    await click("Clear filters");
    await click("View Maya Chen's channel");
    await text("Maya Chen");
    await click("Programs");
    await click("Explore program");
    await text("Everyday Strength");
    await click("Save program");
    await text("Saved to my workouts");
    pass("search, public channel, program details and save");
    await click("Discover");
    await click("View Maya Chen's channel");
    await click("Your first 20 minutes");
    await text("FREE SAMPLE");
    await click("Mark workout complete");
    await text("You showed up.");
    await click("Undo completion");
    await text("FREE SAMPLE");
    pass("free workout completion and undo");
    await click("Explore the membership");
    await click("Continue to sign in");
    await click("Use a sample profile");
    await click("Test payment failure");
    await click("Confirm and join");
    await text(
      "The payment could not be completed. No membership was added. Please try again.",
    );
    await click("Successful payment");
    await click("Confirm and join");
    await text("You’re in.");
    await click("Let’s train");
    await click("Start next workout");
    await click("Mark workout complete");
    await text("You showed up.");
    pass("failed payment retry, successful membership, unlock and completion");
    await click("Profile");
    await click("My memberships");
    await click("Manage Maya membership");
    await click("Cancel renewal");
    await click("Confirm cancellation");
    await text("Resume renewal");
    await click("Resume renewal");
    await text("Cancel renewal");
    pass("cancel and resume renewal");
    await click("Profile");
    await click("Become a creator");
    await click("Create my channel");
    fill("Channel handle", "trainwithmaya");
    await text("That handle is already taken.");
    fill("Channel handle", "samtrains");
    await pause();
    await click("Continue to channel profile");
    fill("Display name", "Sam Taylor");
    fill("One-line promise", "Strength for real life.");
    fill(
      "About your coaching",
      "Simple strength training that fits into a busy everyday life.",
    );
    await click("Save channel profile");
    await click("Get ready to publish");
    assert.equal(
      button("Publish my channel").getAttribute("aria-disabled"),
      "true",
    );
    pass("creator onboarding and launch requirements");
    await click("Content");
    await click("Add a workout");
    await click("Use sample video");
    fill("Workout title", "Free foundations");
    fill("Description", "An approachable introduction to training with Sam.");
    await click("Free sample");
    await click("Publish workout");
    await text("Free foundations");
    await click("Add a workout");
    await click("Use sample video");
    fill("Workout title", "Build everyday strength");
    fill(
      "Description",
      "A complete strength session for all of your everyday movements.",
    );
    await click("Publish workout");
    await text("Build everyday strength");
    pass("create and publish free and paid workouts");
    await click("Programs");
    await click("Create a program");
    fill("Program name", "Sam’s four-week routine");
    fill(
      "Program description",
      "Repeat these sessions weekly and build your strength over four weeks.",
    );
    await click("Free foundations");
    await click("Build everyday strength");
    await click("Publish program");
    await text("Sam’s four-week routine");
    pass("build and publish an ordered program");
    await click("Studio");
    await click("Set your monthly price");
    fill("Monthly price (USD)", "23");
    await click("Save monthly price");
    await click("Complete payout setup");
    await click("Complete payout setup");
    await click("Get ready to publish");
    await click("Publish my channel");
    await text("Your channel is ready.");
    await click("Open member view");
    await text("Strength for real life.");
    pass("pricing, payout setup and channel publishing");
    await click("Join Sam · $23/month");
    await click("Confirm and join");
    await text("You’re in.");
    await click("Profile");
    await click("Open creator studio");
    await click("Members");
    await text("1 active member.");
    await click("Earnings");
    await text("$23.00");
    pass("member purchase updates creator members and earnings");
    await click("Creator settings");
    await click("Switch to member view");
    await click("Profile");
    await click("Help & support");
    fill("Your feedback", "This is a support request test message.");
    await click("Save request");
    await text("Your request is saved on this device.");
    pass("support request stays local");
    await pause();
    const saved = JSON.parse(w.localStorage.getItem("trainwith.v1"));
    assert.equal(saved.memberships.length, 2);
    assert.ok(saved.completed["maya-1"]);
    assert.equal(
      saved.creators.find((c) => c.id === saved.ownedId).published,
      true,
    );
    assert.equal(
      saved.programs.find((p) => p.creatorId === saved.ownedId).workoutIds
        .length,
      2,
    );
    pass("all workflow changes persist to device storage");
    fs.writeFileSync(
      "tests/latest-result.json",
      JSON.stringify(
        {
          date: new Date().toISOString(),
          environment:
            "JSDOM component interaction tests against the production Expo web bundle; no browser layout or real media playback verification",
          passed,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`${passed.length} interaction groups passed.`);
  } catch (e) {
    console.error(w.location.href);
    console.error(e.message.slice(0, 600));
    console.error(doc.body.textContent.slice(-7000));
    process.exitCode = 1;
  } finally {
    dom.window.close();
  }
})();
