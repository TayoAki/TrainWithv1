const fs = require("node:fs");
const { Buffer } = require("node:buffer");
const path = require("node:path");
const assert = require("node:assert/strict");
const { JSDOM, VirtualConsole } = require("jsdom");
const {
  getByRole,
  getAllByLabelText,
  fireEvent,
  waitFor,
  getAllByText,
  isInaccessible,
} = require("@testing-library/dom");
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (e) => {
  if (!e.message.includes("Not implemented")) console.error(e.message);
});
const dom = new JSDOM('<html><body><div id="root"></div></body></html>', {
  url: "http://localhost:8081/",
  pretendToBeVisual: true,
  runScripts: "outside-only",
  virtualConsole,
});
const w = dom.window;
w.matchMedia = () => ({
  matches: false,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
});
w.ResizeObserver = w.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
w.TextEncoder = global.TextEncoder;
w.TextDecoder = global.TextDecoder;
w.structuredClone = global.structuredClone;
w.Headers = global.Headers;
w.Request = global.Request;
w.Response = global.Response;
w.HTMLMediaElement.prototype.load = function () {};
w.HTMLMediaElement.prototype.play = () => Promise.resolve();
w.HTMLMediaElement.prototype.pause = function () {};
w.HTMLElement.prototype.scrollTo = function () {};
const user = {
  id: "10000000-0000-4000-8000-000000000002",
  email: "member@example.test",
  name: "Real Member",
};
const state = {
  version: 1,
  user: null,
  creators: [],
  workouts: [],
  programs: [],
  memberships: [],
  completed: {},
  saved: [],
  supports: [],
  ownedId: null,
  eligibility: {
    accepted: false,
    status: "active",
    policyVersion: "2026-09-19",
  },
  blocked: [],
};
const requests = [];
let allowLogin = false;
let rejectSave = true;
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
w.fetch = async (input, init = {}) => {
  const url = String(input);
  requests.push({ url, init });
  if (url.includes("/auth/v1/token")) {
    if (!allowLogin)
      return json(
        { code: "invalid_credentials", msg: "Invalid login credentials" },
        400,
      );
    const claims = {
      sub: user.id,
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: "authenticated",
      role: "authenticated",
    };
    const token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.fixture`;
    return json({
      access_token: token,
      refresh_token: "fixture-refresh",
      token_type: "bearer",
      expires_in: 3600,
      user: {
        ...user,
        aud: "authenticated",
        role: "authenticated",
        email_confirmed_at: new Date().toISOString(),
        user_metadata: { name: user.name },
      },
    });
  }
  if (url.endsWith("/v1/policy/accept")) {
    const body = JSON.parse(init.body);
    assert.equal(body.adult, true);
    assert.equal(body.accepted, true);
    assert.equal(body.version, "2026-09-19");
    state.eligibility.accepted = true;
    return json({ ok: true });
  }
  if (url.endsWith("/public/config"))
    return json({
      operatorName: "TrainWith",
      supportEmail: null,
      policyVersion: "2026-09-19",
      minimumAge: 18,
      iosExternalCheckout: true,
      sandbox: true,
    });
  if (url.endsWith("/v1/state"))
    return json({ ...state, user: init.headers?.Authorization ? user : null });
  if (url.endsWith("/v1/commands")) {
    assert.ok(
      init.headers.Authorization,
      "Authenticated writes need bearer token",
    );
    const body = JSON.parse(init.body);
    if (rejectSave)
      return json({ message: "The server rejected this change." }, 409);
    if (body.name === "support.create")
      state.supports.push({
        id: "support_real",
        message: body.payload.message,
        date: new Date().toISOString(),
      });
    return json({ ...state, user });
  }
  throw new Error(`Unexpected network request: ${url}`);
};
const file = fs
  .readdirSync("dist-connected/_expo/static/js/web")
  .find((f) => f.endsWith(".js"));
w.eval(
  fs.readFileSync(
    path.join("dist-connected/_expo/static/js/web", file),
    "utf8",
  ),
);
const doc = w.document;
const text = async (value) =>
  waitFor(
    () =>
      assert.ok(
        getAllByText(doc.body, value, { exact: true }).some(
          (e) => !isInaccessible(e),
        ),
      ),
    { container: doc.body, timeout: 10000 },
  );
const click = async (name) => {
  const find = () => getByRole(doc.body, "button", { name, exact: true });
  await waitFor(() => assert.ok(find()), {
    container: doc.body,
    timeout: 10000,
  });
  fireEvent.click(find());
  await new Promise((resolve) => setTimeout(resolve, 100));
};
const fill = (name, value) =>
  fireEvent.change(
    getAllByLabelText(doc.body, name, { exact: true }).find(
      (e) => !isInaccessible(e),
    ),
    { target: { value } },
  );
(async () => {
  try {
    await text("Find your next coach.");
    assert.ok(requests.some((r) => r.url.endsWith("/v1/state")));
    assert.ok(!doc.body.textContent.includes("Maya Chen"));
    console.log(
      "PASS: connected discovery loads server state without demo seed",
    );
    await click("Profile");
    await click("Sign in");
    fill("Email address", user.email);
    fill("Password", "test-password-fixture");
    await click("Sign in");
    await text("Invalid login credentials");
    assert.ok(!doc.body.textContent.includes("Use a sample profile"));
    console.log("PASS: invalid credentials stay signed out with no demo login");
    allowLogin = true;
    await click("Sign in");
    await text("A space for adults to train.");
    const consentButton = getByRole(doc.body, "button", {
      name: "Continue to TrainWith",
      exact: true,
    });
    assert.ok(
      consentButton.getAttribute("aria-disabled") === "true" ||
        consentButton.disabled,
    );
    await click("I am 18 or older");
    await click("I accept the terms and acknowledge the privacy policy");
    await click("Continue to TrainWith");
    await text("Hey, Real.");
    console.log(
      "PASS: adult and policy acceptance is required and submitted to the server",
    );
    assert.ok(
      requests.some(
        (r) => r.url.endsWith("/v1/state") && r.init.headers.Authorization,
      ),
    );
    console.log("PASS: verified session is attached to API reads");
    await click("Help & support");
    fill("Your feedback", "Please help with my membership.");
    await click("Submit support request");
    await text("The server rejected this change.");
    assert.equal(state.supports.length, 0);
    console.log("PASS: rejected mutation never becomes local success");
    rejectSave = false;
    await click("Submit support request");
    await waitFor(() => assert.equal(state.supports.length, 1), {
      container: doc.body,
      timeout: 10000,
    });
    assert.equal(w.localStorage.getItem("trainwith.v1"), null);
    console.log(
      "PASS: support is submitted with authentication and no demo persistence",
    );
    await click("Profile");
    await click("Settings");
    await click("Privacy policy");
    await text("Your privacy at TrainWith");
    await click("Delete account");
    await text("Permanently delete your account");
    const deletionButton = getByRole(doc.body, "button", {
      name: "Permanently delete my account",
      exact: true,
    });
    assert.ok(
      deletionButton.getAttribute("aria-disabled") === "true" ||
        deletionButton.disabled,
    );
    assert.ok(!requests.some((r) => r.url.endsWith("/v1/account/delete")));
    console.log(
      "PASS: privacy and deletion are reachable; deletion requires explicit confirmation and password",
    );
    dom.window.close();
  } catch (error) {
    console.error(error.message.slice(0, 1000));
    console.error(doc.body.textContent.slice(-1800));
    dom.window.close();
    process.exitCode = 1;
  }
})();
