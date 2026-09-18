import React, { useState } from "react";
import { View, Pressable, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import {
  Check,
  ArrowRight,
  Play,
  LockKeyhole,
  Dumbbell,
  Heart,
  CheckCircle2,
  Settings,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { useStore } from "./store";
import {
  signIn,
  signOut,
  startMembership,
  setRenewal,
  completeWorkout,
  clearCompletion,
  toggleSavedProgram,
  addSupportRequest,
} from "./services";
import { Workout, hasAccess, EMAIL } from "./data";
import {
  Shell,
  T,
  Row,
  Card,
  Badge,
  Button,
  Field,
  Chips,
  Photo,
  Heading,
  Notice,
  Empty,
  Progress,
  Item,
  C,
  go,
} from "./ui";
import { WorkoutPlayer } from "./player";
export function WorkoutRow({ w }: { w: Workout }) {
  const { state } = useStore();
  const router = useRouter();
  return (
    <Item
      title={w.title}
      subtitle={`${w.minutes} min · ${w.level}${w.free ? " · Free sample" : ""}`}
      photo={w.photo}
      onPress={() => go(router, "workout", w.id)}
      end={
        state.completed[w.id] ? (
          <CheckCircle2 size={21} color={C.green} />
        ) : w.free || hasAccess(state, w.creatorId) ? (
          <Play size={18} color={C.green} />
        ) : (
          <LockKeyhole size={18} color={C.muted} />
        )
      }
    />
  );
}
export function Discover() {
  const { state } = useStore();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const coaches = state.creators.filter(
    (c) =>
      c.published &&
      (cat === "All" || c.category === cat) &&
      `${c.name} ${c.handle} ${c.tagline}`
        .toLowerCase()
        .includes(q.toLowerCase().replace("@", "")),
  );
  return (
    <Shell wide>
      <Heading
        eyebrow="A little movement. A better everyday."
        title="Find your next coach."
        description="Real people. Workouts you’ll come back to."
      />
      <Field
        label="Find your fit"
        placeholder="Search a name or @handle"
        value={q}
        onChange={setQ}
      />
      <Chips
        items={["All", "Strength", "Mobility", "Pilates"]}
        value={cat}
        onChange={setCat}
      />
      {coaches.length === 0 ? (
        <Empty
          title="No coaches found"
          description="Try a different name or training style."
          action={
            <Button
              title="Clear filters"
              secondary
              onPress={() => {
                setQ("");
                setCat("All");
              }}
            />
          }
        />
      ) : (
        <View
          style={{ flexDirection: width > 1100 ? "row" : "column", gap: 20 }}
        >
          {coaches.map((c, i) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={`View ${c.name}'s channel`}
              onPress={() => router.push(`/${c.handle}`)}
              style={{
                flex: 1,
                minWidth: 0,
                backgroundColor: C.white,
                borderRadius: 22,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: C.line,
              }}
            >
              <View>
                <Photo
                  uri={c.photo}
                  height={width > 1100 ? 300 : i === 0 ? 320 : 230}
                  style={{ borderRadius: 0 }}
                />
                <View style={{ position: "absolute", top: 16, left: 16 }}>
                  <Badge>{c.category.toUpperCase()}</Badge>
                </View>
              </View>
              <View style={{ padding: 22, gap: 9 }}>
                <Row between>
                  <T size={23} bold style={{ letterSpacing: -0.7 }}>
                    {c.name}
                  </T>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: C.lime,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ArrowRight size={17} color={C.green} />
                  </View>
                </Row>
                <T size={12} color={C.muted}>
                  @{c.handle}
                </T>
                <T>{c.tagline}</T>
                <View
                  style={{
                    height: 1,
                    backgroundColor: C.line,
                    marginVertical: 6,
                  }}
                />
                <Row between>
                  <T size={12} color={C.muted}>
                    Free workouts to get you started
                  </T>
                  <Play size={14} color={C.green} />
                </Row>
              </View>
            </Pressable>
          ))}
        </View>
      )}
      <Card style={{ backgroundColor: C.sage, borderWidth: 0 }}>
        <Row>
          <Dumbbell color={C.green} />
          <View style={{ flex: 1 }}>
            <T bold>A coach in your corner.</T>
            <T size={13} color={C.muted}>
              Try a session for free. Join when it feels right.
            </T>
          </View>
        </Row>
      </Card>
    </Shell>
  );
}
export function Channel({
  id,
  handle,
  preview = false,
}: {
  id?: string;
  handle?: string;
  preview?: boolean;
}) {
  const { state } = useStore();
  const router = useRouter();
  const [tab, setTab] = useState("Workouts");
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState("");
  const c = state.creators.find((c) =>
    id ? c.id === id : c.handle === handle,
  );
  if (!c || (!c.published && !preview))
    return (
      <Shell back>
        <Empty
          title="Channel not available"
          description="This creator has not published their channel yet."
        />
      </Shell>
    );
  const active = hasAccess(state, c.id);
  const ws = state.workouts.filter((w) => w.creatorId === c.id && w.published);
  return (
    <Shell back title={preview ? "Channel preview" : `@${c.handle}`}>
      <Photo uri={c.photo} height={280} />
      {preview && (
        <Notice>Preview · This is how members will see your channel.</Notice>
      )}
      <Row between>
        <View style={{ flex: 1, gap: 5 }}>
          <T size={32} bold>
            {c.name}
          </T>
          <T color={C.muted}>@{c.handle}</T>
        </View>
        <Button
          title={copied ? "Copied" : "Share"}
          secondary
          onPress={async () => {
            try {
              await Clipboard.setStringAsync(
                `https://jointrainwith.com/${c.handle}`,
              );
              setCopied(true);
            } catch {
              setShareError(
                `Copy is unavailable. Your planned channel link is https://jointrainwith.com/${c.handle}`,
              );
            }
          }}
        />
      </Row>
      {!!shareError && <Notice error>{shareError}</Notice>}
      <Heading title={c.tagline} description={c.bio} />
      <Chips
        items={["Workouts", "Programs", "About"]}
        value={tab}
        onChange={setTab}
      />
      {tab === "Workouts" ? (
        <>
          <T bold size={20}>
            Try a free workout
          </T>
          {ws
            .filter((w) => w.free)
            .map((w) => (
              <WorkoutRow key={w.id} w={w} />
            ))}
          <T bold size={20}>
            Keep showing up
          </T>
          {ws
            .filter((w) => !w.free)
            .map((w) => (
              <WorkoutRow key={w.id} w={w} />
            ))}
        </>
      ) : tab === "Programs" ? (
        <>
          {state.programs
            .filter((p) => p.creatorId === c.id && p.published)
            .map((p) => (
              <Card key={p.id}>
                <Badge light>
                  {p.weeks} WEEKS · {p.workoutIds.length} SESSIONS TO REPEAT
                </Badge>
                <T bold size={22}>
                  {p.title}
                </T>
                <T color={C.muted}>{p.description}</T>
                <Button
                  title="Explore program"
                  secondary
                  onPress={() => go(router, "program", p.id)}
                />
              </Card>
            ))}
          {!state.programs.some((p) => p.creatorId === c.id && p.published) && (
            <Empty
              title="Programs are on the way"
              description="Start with an individual workout."
            />
          )}
        </>
      ) : (
        <Card>
          <T bold size={20}>
            Meet your coach
          </T>
          <T>{c.bio}</T>
          <Badge light>{c.category}</Badge>
          <T size={12} color={C.muted}>
            Sample coach profile
          </T>
        </Card>
      )}
      {!preview && (
        <>
          <Button
            title={
              active
                ? "Go to my workouts"
                : `Join ${c.name.split(" ")[0]} · $${c.price}/month`
            }
            onPress={() =>
              go(router, active ? "my-workouts" : "membership", c.id)
            }
          />
          <T size={11} color={C.muted} style={{ textAlign: "center" }}>
            Membership applies to this channel. Cancel renewal anytime.
          </T>
        </>
      )}
    </Shell>
  );
}
export function ProgramScreen({ id }: { id?: string }) {
  const { state, apply } = useStore();
  const router = useRouter();
  const p = state.programs.find((p) => p.id === id && p.published);
  if (!p)
    return (
      <Shell back>
        <Empty
          title="Program not found"
          description="Choose a program from a creator’s channel."
        />
      </Shell>
    );
  const c = state.creators.find((c) => c.id === p.creatorId)!;
  const ws = p.workoutIds
    .map((id) => state.workouts.find((w) => w.id === id && w.published))
    .filter(Boolean) as Workout[];
  const count = ws.filter((w) => state.completed[w.id]).length;
  return (
    <Shell back title={p.title}>
      <Photo uri={c.photo} />
      <Badge light>
        {p.weeks} WEEKS · {ws.length} REPEATABLE SESSIONS
      </Badge>
      <Heading title={p.title} description={p.description} />
      <Item
        title={c.name}
        subtitle={`@${c.handle}`}
        onPress={() => router.push(`/${c.handle}`)}
        icon={<Dumbbell size={20} color={C.green} />}
      />
      <Card>
        <Row between>
          <T bold>Your first round</T>
          <T size={13} color={C.muted}>
            {count}/{ws.length} complete
          </T>
        </Row>
        <Progress value={ws.length ? count / ws.length : 0} />
        <T size={12} color={C.muted}>
          Repeat this sequence at your own pace across {p.weeks} weeks.
        </T>
      </Card>
      {ws.map((w, i) => (
        <View key={w.id}>
          <T size={10} bold color={C.muted}>
            SESSION {i + 1}
          </T>
          <WorkoutRow w={w} />
        </View>
      ))}
      <Button
        title={
          state.saved.includes(p.id) ? "Saved to my workouts" : "Save program"
        }
        secondary
        onPress={() => apply(toggleSavedProgram(p.id))}
      />
      {!hasAccess(state, c.id) && (
        <Button
          title={`See membership · $${c.price}/month`}
          onPress={() => go(router, "membership", c.id)}
        />
      )}
    </Shell>
  );
}
export function WorkoutScreen({ id }: { id?: string }) {
  const { state, apply } = useStore();
  const router = useRouter();
  const w = state.workouts.find((w) => w.id === id && w.published);
  if (!w)
    return (
      <Shell back>
        <Empty
          title="Workout not available"
          description="This workout may still be a draft."
        />
      </Shell>
    );
  const c = state.creators.find((c) => c.id === w.creatorId)!;
  const allowed = w.free || hasAccess(state, c.id);
  return (
    <Shell back title={w.title}>
      {allowed ? (
        <WorkoutPlayer key={w.video} uri={w.video} photo={w.photo} />
      ) : (
        <View>
          <Photo uri={w.photo} />
          <View
            style={{
              position: "absolute",
              inset: 0,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#173F3255",
              borderRadius: 15,
            }}
          >
            <LockKeyhole color={C.white} size={36} />
          </View>
        </View>
      )}
      <Badge light>{w.free ? "FREE SAMPLE" : "MEMBER WORKOUT"}</Badge>
      <Heading title={w.title} description={w.description} />
      <Row>
        <Badge light>{w.minutes} MIN</Badge>
        <Badge light>{w.level}</Badge>
        <Badge light>{w.equipment}</Badge>
      </Row>
      <Item
        title={c.name}
        subtitle={`@${c.handle}`}
        onPress={() => router.push(`/${c.handle}`)}
        icon={<UserIcon />}
      />
      {allowed ? (
        <>
          <Card>
            <T bold size={18}>
              Make this time yours.
            </T>
            <T color={C.muted}>
              Start with a gentle warm-up. Follow the session, take breaks when
              you need, and finish with a cool-down.
            </T>
          </Card>
          <Button
            title={
              state.completed[w.id]
                ? "View completion"
                : "Mark workout complete"
            }
            onPress={() => {
              apply(completeWorkout(w.id));
              go(router, "complete", w.id);
            }}
          />
          {w.free && !hasAccess(state, c.id) && (
            <Button
              title="Explore the membership"
              secondary
              onPress={() => go(router, "membership", c.id)}
            />
          )}
        </>
      ) : (
        <>
          <Notice>
            Join {c.name.split(" ")[0]}’s channel to unlock this workout and
            their full library.
          </Notice>
          <Button
            title={`Unlock · $${c.price}/month`}
            onPress={() => go(router, "membership", c.id)}
          />
        </>
      )}
    </Shell>
  );
}
function UserIcon() {
  return <Heart color={C.green} size={19} />;
}
export function Complete({ id }: { id?: string }) {
  const { state, apply } = useStore();
  const router = useRouter();
  const w = state.workouts.find((w) => w.id === id);
  return (
    <Shell title="A little stronger." back>
      <View style={{ alignItems: "center", gap: 20, paddingVertical: 30 }}>
        <View
          style={{
            width: 96,
            height: 96,
            backgroundColor: C.lime,
            borderRadius: 48,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Check size={45} color={C.green} />
        </View>
        <T bold size={34}>
          You showed up.
        </T>
        <T color={C.muted}>That’s how progress happens.</T>
      </View>
      <Card>
        <T bold size={21}>
          {w?.title || "Workout complete"}
        </T>
        <Row between>
          <T color={C.muted}>Session completed</T>
          <T bold>{w?.minutes || 0} min</T>
        </Row>
        <Row between>
          <T color={C.muted}>Total workouts completed</T>
          <T bold>{Object.keys(state.completed).length}</T>
        </Row>
      </Card>
      <Button
        title="Back to my workouts"
        onPress={() => go(router, "my-workouts")}
      />
      <Button
        title="Undo completion"
        subtle
        onPress={() => {
          if (id) apply(clearCompletion(id));
          go(router, "workout", id);
        }}
      />
    </Shell>
  );
}
export function Auth({ id }: { id?: string }) {
  const { state, apply } = useStore();
  const router = useRouter();
  const [name, setName] = useState(state.user?.name || "");
  const [email, setEmail] = useState(state.user?.email || "");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const enter = (demo = false) => {
    if (!demo) {
      // Point at the field that is wrong rather than one combined message.
      const next = {
        name: name.trim() ? undefined : "Enter your name.",
        email: EMAIL.test(email.trim())
          ? undefined
          : "Enter a valid email address.",
      };
      setErrors(next);
      if (next.name || next.email) return;
    }
    apply(
      signIn(
        demo
          ? { name: "Sam Taylor", email: "sam@example.com" }
          : { name, email },
      ),
    );
    go(
      router,
      id === "creator" ? "creator-start" : id ? "membership" : "profile",
      id === "creator" ? undefined : id,
    );
  };
  return (
    <Shell back title="Welcome to TrainWith">
      <Heading
        eyebrow="Your next chapter"
        title="Make room for you."
        description="Save your progress and train with people who inspire you."
      />
      <Notice>Enter your details to save your training on this device.</Notice>
      <Field
        label="Your name"
        value={name}
        onChange={setName}
        placeholder="Sam Taylor"
        error={errors.name}
      />
      <Field
        label="Email address"
        value={email}
        onChange={setEmail}
        placeholder="sam@example.com"
        keyboardType="email-address"
        error={errors.email}
      />
      <Button title="Continue with these details" onPress={() => enter()} />
      <Button
        title="Use a sample profile"
        secondary
        onPress={() => enter(true)}
      />
      <T size={12} color={C.muted}>
        Your profile is stored on this device.
      </T>
    </Shell>
  );
}
export function Membership({ id }: { id?: string }) {
  const { state, apply, payments } = useStore();
  const router = useRouter();
  const c = state.creators.find((c) => c.id === id);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState(false);
  const [error, setError] = useState("");
  const join = async () => {
    if (!c || busy) return;
    setBusy(true);
    setError("");
    const result = await payments.charge({
      creatorId: c.id,
      amount: c.price,
      simulateFailure: fail,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    apply(startMembership(c.id, c.price));
    go(router, "joined", c.id);
  };
  if (!c)
    return (
      <Shell back>
        <Empty
          title="Choose a coach first"
          description="Every membership belongs to one creator."
        />
      </Shell>
    );
  return (
    <Shell back title="Your membership">
      <Photo uri={c.photo} height={210} />
      <Heading
        eyebrow={`TRAIN WITH ${c.name.split(" ")[0]}`}
        title="A stronger routine starts here."
      />
      <Card>
        <Row between>
          <T bold size={20}>
            {c.name}’s channel
          </T>
          <Badge>MONTHLY</Badge>
        </Row>
        <Row>
          <T size={42} bold>
            ${c.price}
          </T>
          <T color={C.muted}>/ month</T>
        </Row>
        {[
          "Every member workout",
          "All published programs",
          "New sessions as they’re added",
          "Your workout completion history",
        ].map((x) => (
          <Row key={x}>
            <Check size={18} color={C.green} />
            <T>{x}</T>
          </Row>
        ))}
      </Card>
      <Notice>A membership applies to this creator’s channel only.</Notice>
      {!!error && <Notice error>{error}</Notice>}
      {hasAccess(state, c.id) ? (
        <Button
          title="Open my workouts"
          onPress={() => go(router, "my-workouts")}
        />
      ) : (
        <Button
          title={
            busy
              ? "Confirming membership…"
              : state.user
                ? "Confirm and join"
                : "Continue to sign in"
          }
          loading={busy}
          onPress={() => {
            if (state.user) join();
            else {
              setError("");
              go(router, "auth", id);
            }
          }}
        />
      )}
      <T size={12} color={C.muted}>
        Renews monthly at ${c.price}. Cancel renewal in Profile → Memberships;
        access continues through the current period.
      </T>
      {state.user && !hasAccess(state, c.id) && (
        <Card style={{ backgroundColor: C.sage, borderWidth: 0 }}>
          <T size={11} bold color={C.muted} style={{ letterSpacing: 1.5 }}>
            PAYMENT SANDBOX
          </T>
          <T size={12} color={C.muted}>
            No payment provider is connected, so nothing is charged. Choose how
            the next attempt should resolve. Remove this control once a real
            gateway is wired up.
          </T>
          <Chips
            items={["Successful payment", "Test payment failure"]}
            value={fail ? "Test payment failure" : "Successful payment"}
            onChange={(x) => setFail(x === "Test payment failure")}
          />
        </Card>
      )}
    </Shell>
  );
}
export function Joined({ id }: { id?: string }) {
  const { state } = useStore();
  const router = useRouter();
  const c = state.creators.find((c) => c.id === id);
  return (
    <Shell back>
      <View style={{ alignItems: "center", paddingVertical: 35, gap: 20 }}>
        <CheckCircle2 color={C.green} size={76} />
        <T bold size={36}>
          You’re in.
        </T>
        <T color={C.muted}>Welcome to {c?.name.split(" ")[0]}’s channel.</T>
      </View>
      <Card>
        <T bold>Your next step? Your first session.</T>
        <T color={C.muted}>
          Your membership is active on this device. All of this coach’s
          published workouts are ready for you.
        </T>
      </Card>
      <Button title="Let’s train" onPress={() => go(router, "my-workouts")} />
    </Shell>
  );
}
export function MyWorkouts() {
  const { state } = useStore();
  const router = useRouter();
  const [tab, setTab] = useState("My training");
  const active = state.creators.filter((c) => hasAccess(state, c.id));
  const history = state.workouts.filter((w) => state.completed[w.id]);
  return (
    <Shell>
      <Heading
        eyebrow="Consistency over perfection"
        title="Your time to get stronger."
        description={`${history.length} workout${history.length === 1 ? "" : "s"} completed. Every session counts.`}
      />
      <Chips
        items={["My training", "Saved programs", "History"]}
        value={tab}
        onChange={setTab}
      />
      {tab === "History" ? (
        history.length ? (
          history.map((w) => <WorkoutRow key={w.id} w={w} />)
        ) : (
          <Empty
            title="Your story starts here"
            description="Complete a workout to see it here."
          />
        )
      ) : tab === "Saved programs" ? (
        state.saved.length ? (
          state.programs
            .filter((p) => state.saved.includes(p.id))
            .map((p) => (
              <Item
                key={p.id}
                title={p.title}
                subtitle={`${p.weeks} weeks`}
                onPress={() => go(router, "program", p.id)}
              />
            ))
        ) : (
          <Empty
            title="A plan for later"
            description="Save a program from a coach’s channel."
          />
        )
      ) : active.length ? (
        active.map((c) => {
          const ws = state.workouts.filter(
            (w) => w.creatorId === c.id && w.published && !w.free,
          );
          const next = ws.find((w) => !state.completed[w.id]);
          return (
            <Card key={c.id}>
              <Row between>
                <T size={20} bold>
                  Train with {c.name.split(" ")[0]}
                </T>
                <Badge light>MEMBER</Badge>
              </Row>
              <Photo uri={c.photo} height={180} />
              <T bold>
                {next
                  ? `Up next: ${next.title}`
                  : "You’ve completed this library!"}
              </T>
              <Progress
                value={
                  ws.length
                    ? ws.filter((w) => state.completed[w.id]).length / ws.length
                    : 0
                }
              />
              <Button
                title={next ? "Start next workout" : "Revisit the channel"}
                onPress={() =>
                  next
                    ? go(router, "workout", next.id)
                    : router.push(`/${c.handle}`)
                }
              />
              {ws.map((w) => (
                <WorkoutRow key={w.id} w={w} />
              ))}
            </Card>
          );
        })
      ) : (
        <Empty
          title="Find your people. Find your rhythm."
          description="Try a free sample or join a coach to build your routine."
          action={
            <Button
              title="Discover coaches"
              onPress={() => go(router, "discover")}
            />
          }
        />
      )}
    </Shell>
  );
}
export function Profile() {
  const { state, apply } = useStore();
  const router = useRouter();
  return (
    <Shell>
      <Heading
        title={
          state.user
            ? `Hey, ${state.user.name.split(" ")[0]}.`
            : "Make yourself at home."
        }
        description={
          state.user?.email ||
          "Your coaches, progress, and account in one place."
        }
      />
      {!state.user && (
        <Button title="Sign in" onPress={() => go(router, "auth")} />
      )}
      <Card>
        <Row between>
          <View>
            <T bold size={32}>
              {Object.keys(state.completed).length}
            </T>
            <T size={12} color={C.muted}>
              Workouts complete
            </T>
          </View>
          <View>
            <T bold size={32}>
              {
                state.memberships.filter((m) => hasAccess(state, m.creatorId))
                  .length
              }
            </T>
            <T size={12} color={C.muted}>
              Creator memberships
            </T>
          </View>
        </Row>
      </Card>
      <View>
        <Item
          title="My memberships"
          subtitle="Manage access and renewal"
          icon={<Heart size={20} color={C.green} />}
          onPress={() => go(router, "memberships")}
        />
        <Item
          title="Edit profile"
          subtitle="Name and email"
          icon={<UserIcon />}
          onPress={() => go(router, "edit-profile")}
        />
        <Item
          title={state.ownedId ? "Open creator studio" : "Become a creator"}
          subtitle="Turn what you know into a channel"
          icon={<Dumbbell size={20} color={C.green} />}
          onPress={() => go(router, state.ownedId ? "studio" : "creator-start")}
        />
        <Item
          title="Help & support"
          subtitle="Questions and feedback"
          icon={<Heart size={20} color={C.green} />}
          onPress={() => go(router, "support")}
        />
        <Item
          title="Settings"
          subtitle="Storage and app data"
          icon={<Settings size={20} color={C.green} />}
          onPress={() => go(router, "settings")}
        />
      </View>
      {state.user && (
        <Button
          title="Sign out"
          subtle
          onPress={() => {
            apply(signOut());
            go(router, "discover");
          }}
        />
      )}
    </Shell>
  );
}
export function Memberships() {
  const { state } = useStore();
  const router = useRouter();
  return (
    <Shell back title="My memberships">
      <Heading title="Your coaches, in one place." />
      {state.memberships.length ? (
        state.memberships.map((m) => {
          const c = state.creators.find((c) => c.id === m.creatorId)!;
          return (
            <Card key={m.creatorId}>
              <Row between>
                <T bold size={20}>
                  {c.name}
                </T>
                <Badge light>
                  {hasAccess(state, c.id)
                    ? m.renews
                      ? "ACTIVE"
                      : "ENDING"
                    : "EXPIRED"}
                </Badge>
              </Row>
              <T>
                ${m.price}/month · {m.renews ? "Renews" : "Access until"}{" "}
                {new Date(m.ends).toLocaleDateString()}
              </T>
              <Button
                title={`Manage ${c.name.split(" ")[0]} membership`}
                secondary
                onPress={() => go(router, "manage-membership", m.creatorId)}
              />
            </Card>
          );
        })
      ) : (
        <Empty
          title="No memberships yet"
          description="Choose a coach and start with a free sample."
          action={
            <Button
              title="Explore coaches"
              onPress={() => go(router, "discover")}
            />
          }
        />
      )}
    </Shell>
  );
}
export function ManageMembership({ id }: { id?: string }) {
  const { state, apply } = useStore();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const m = state.memberships.find((m) => m.creatorId === id);
  const c = state.creators.find((c) => c.id === id);
  if (!m || !c)
    return (
      <Shell back>
        <Empty
          title="Membership not found"
          description="Your active memberships appear in your profile."
        />
      </Shell>
    );
  return (
    <Shell back title="Manage membership">
      <Heading
        title={c.name}
        description={`$${m.price}/month · ${m.renews ? "Renewal on" : "Renewal off"}`}
      />
      <Notice>
        {m.renews
          ? "Your membership renews"
          : "Your renewal is canceled. You can keep training until"}{" "}
        {new Date(m.ends).toLocaleDateString()}.
      </Notice>
      {!hasAccess(state, c.id) ? (
        <Button
          title="Rejoin this channel"
          onPress={() => go(router, "membership", c.id)}
        />
      ) : confirm ? (
        <Card>
          <T bold size={22}>
            Cancel renewal?
          </T>
          <T>
            You’ll keep access through {new Date(m.ends).toLocaleDateString()}.
            Your progress will stay saved.
          </T>
          <Button
            title="Confirm cancellation"
            onPress={() => {
              if (id) apply(setRenewal(id, false));
              setConfirm(false);
            }}
          />
          <Button
            title="Keep my membership"
            secondary
            onPress={() => setConfirm(false)}
          />
        </Card>
      ) : (
        <Button
          title={m.renews ? "Cancel renewal" : "Resume renewal"}
          secondary
          onPress={() => {
            if (m.renews) setConfirm(true);
            else if (id) apply(setRenewal(id, true));
          }}
        />
      )}
      <Button
        title="Back to channel"
        subtle
        onPress={() => router.push(`/${c.handle}`)}
      />
    </Shell>
  );
}
export function EditProfile() {
  const { state, apply } = useStore();
  const [name, setName] = useState(state.user?.name || "");
  const [email, setEmail] = useState(state.user?.email || "");
  const [msg, setMsg] = useState("");
  return (
    <Shell back title="Edit profile">
      <Field label="Your name" value={name} onChange={setName} />
      <Field
        label="Email address"
        value={email}
        onChange={setEmail}
        keyboardType="email-address"
      />
      {!!msg && <Notice>{msg}</Notice>}
      <Button
        title="Save profile"
        onPress={() => {
          if (!name.trim() || !EMAIL.test(email.trim())) {
            setMsg("Enter your name and a valid email address.");
            return;
          }
          apply(signIn({ name, email }));
          setMsg("Profile saved on this device.");
        }}
      />
    </Shell>
  );
}
export function Support() {
  const { state, apply } = useStore();
  const [message, setMessage] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <Shell back title="Help & support">
      <Heading title="We’re here for your next step." />
      <Card>
        <T bold>How do memberships work?</T>
        <T color={C.muted}>
          Each membership unlocks one creator’s published workouts and programs.
          Free samples are open to everyone.
        </T>
        <T bold>Where is my progress?</T>
        <T color={C.muted}>
          Open My workouts → History. Your progress is saved on this device.
        </T>
      </Card>
      <Field
        label="Your feedback"
        value={message}
        onChange={setMessage}
        multiline
        placeholder="What would make this better?"
      />
      {!!msg && <Notice>{msg}</Notice>}
      <Button
        title="Save request"
        disabled={message.trim().length < 10}
        onPress={() => {
          apply(addSupportRequest(message));
          setMessage("");
          setMsg("Your request is saved on this device.");
        }}
      />
      <T size={12} color={C.muted}>
        At least 10 characters. Support delivery will be connected with the
        backend.
      </T>
      {state.supports.map((x) => (
        <Card key={x.id}>
          <Badge light>LOCAL DRAFT</Badge>
          <T>{x.message}</T>
        </Card>
      ))}
    </Shell>
  );
}
export function AppSettings() {
  const { reset } = useStore();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  return (
    <Shell back title="Settings">
      <Heading
        title="Your data, your device."
        description="Profiles, memberships, progress and creator content are stored locally on this device."
      />
      <Card>
        <T bold>Storage</T>
        <T color={C.muted}>
          Workout videos you add are kept on this device and are not uploaded.
          Removing the app removes them.
        </T>
      </Card>
      {confirm ? (
        <Card>
          <T bold>Reset all data?</T>
          <T>
            This clears your memberships, progress and creator edits on this
            device. It cannot be undone.
          </T>
          <Button
            title="Yes, reset everything"
            onPress={() => {
              reset();
              go(router, "discover");
            }}
          />
          <Button
            title="Keep my data"
            secondary
            onPress={() => setConfirm(false)}
          />
        </Card>
      ) : (
        <Button
          title="Reset app data"
          subtle
          onPress={() => setConfirm(true)}
        />
      )}
    </Shell>
  );
}
