import { ConnectedStudioReport } from "./connected-studio";
import { selectUpload, sendUpload } from "./upload-remote";
import { demoMode, appWebUrl } from "./backend";
import { ConnectedPayout } from "./connected-commerce";
import { ConnectedUpload } from "./connected-upload";
import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  Check,
  Plus,
  Upload,
  Layers,
  Wallet,
  CheckCircle2,
  Circle,
  Dumbbell,
} from "lucide-react-native";
import { useStore } from "./store";
import {
  claimHandle,
  saveChannelProfile,
  saveWorkout,
  saveProgram,
  setPrice as setChannelPrice,
  completePayoutSetup,
  setChannelPublished,
} from "./services";
import {
  Category,
  Program,
  uid,
  photos,
  SAMPLE_VIDEO,
  handleError,
  publishChecks,
  hasAccess,
} from "./data";
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
import { pickVideo } from "./media";
const categories = ["Strength", "Mobility", "Pilates"];
export function CreatorStart() {
  const { state } = useStore();
  const router = useRouter();
  return (
    <Shell back creator>
      <Heading
        eyebrow="Your knowledge. Their next chapter."
        title="Turn your workouts into a channel."
        description="One place for free samples, member workouts, and a community that trains with you."
      />
      <Photo uri={photos.workout} height={260} />
      <Card>
        {[
          [
            "01",
            "Make it yours",
            "Choose a handle and introduce your coaching style.",
          ],
          [
            "02",
            "Share your best work",
            "Add a free sample and a member workout.",
          ],
          [
            "03",
            "Open the doors",
            "Set a monthly price and share your channel.",
          ],
        ].map(([n, t, d]) => (
          <Row key={n}>
            <Badge light>{n}</Badge>
            <View style={{ flex: 1, gap: 3 }}>
              <T bold>{t}</T>
              <T size={13} color={C.muted}>
                {d}
              </T>
            </View>
          </Row>
        ))}
      </Card>
      <Button
        title={state.ownedId ? "Open my studio" : "Create my channel"}
        onPress={() => {
          if (!state.user) {
            go(router, "auth", "creator");
            return;
          }
          if (state.ownedId) {
            go(router, "studio");
            return;
          }
          go(router, "creator-handle");
        }}
      />
      <T size={12} color={C.muted}>
        Free to set up. You only pay when you earn.
      </T>
    </Shell>
  );
}
export function CreatorHandle() {
  const { state, apply } = useStore();
  const router = useRouter();
  const own = state.creators.find((c) => c.id === state.ownedId);
  const [handle, setHandle] = useState(own?.handle || "");
  const [err, setErr] = useState("");
  const issue = handle ? handleError(handle, state.creators, own?.id) : "";
  return (
    <Shell creator back title="Your channel handle">
      <Heading
        eyebrow="Step 1 of 3"
        title="A name they’ll remember."
        description="Your handle is how people find you and share your channel."
      />
      <Field
        label="Channel handle"
        value={handle}
        onChange={(x: string) => {
          setHandle(x.toLowerCase().replace(/^@/, ""));
          setErr("");
        }}
        placeholder="samtrains"
        error={issue || err}
      />
      {!!handle && !issue && (
        <Notice>
          @{handle} has a valid format. Availability is confirmed when you
          continue.
        </Notice>
      )}
      <Card>
        <T size={12} color={C.muted}>
          YOUR CHANNEL LINK
        </T>
        <T bold>
          {demoMode ? "jointrainwith.com" : "Your app domain"}/
          {handle || "yourhandle"}
        </T>
      </Card>
      <Button
        title="Continue to channel profile"
        disabled={!handle || !!issue}
        onPress={async () => {
          if (issue) {
            setErr(issue);
            return;
          }
          if (!(await apply(claimHandle(handle, own)))) return;
          go(router, "creator-profile");
        }}
      />
    </Shell>
  );
}
export function CreatorProfile() {
  const { state, apply } = useStore();
  const router = useRouter();
  const c = state.creators.find((c) => c.id === state.ownedId)!;
  const [name, setName] = useState(c.name);
  const [tagline, setTagline] = useState(c.tagline);
  const [bio, setBio] = useState(c.bio);
  const [category, setCategory] = useState(c.category);
  const [photo, setPhoto] = useState(c.photo);
  const [msg, setMsg] = useState("");
  return (
    <Shell creator back title="Channel profile">
      <Heading
        eyebrow="Make it yours"
        title="Introduce your kind of training."
      />
      <Field label="Display name" value={name} onChange={setName} />
      <Field
        label="One-line promise"
        value={tagline}
        onChange={setTagline}
        placeholder="Strength for your everyday."
      />
      <Field
        label="About your coaching"
        value={bio}
        onChange={setBio}
        multiline
        placeholder="Who do you help, and how do you train?"
      />
      <T bold size={13}>
        Training style
      </T>
      <Chips
        items={categories}
        value={category}
        onChange={(x) => setCategory(x as Category)}
      />
      <T bold size={13}>
        Choose a cover
      </T>
      <Row>
        {Object.values(photos).map((p) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Choose ${Object.keys(photos)[Object.values(photos).indexOf(p)]} cover`}
            key={p}
            onPress={() => setPhoto(p)}
            style={{
              flex: 1,
              borderWidth: photo === p ? 3 : 0,
              borderColor: C.green,
              borderRadius: 14,
            }}
          >
            <Photo uri={p} height={80} style={{ borderRadius: 10 }} />
          </Pressable>
        ))}
      </Row>
      <Field
        label="Or paste a cover image URL"
        value={photo}
        onChange={setPhoto}
      />
      {!!msg && <Notice error>{msg}</Notice>}
      <Button
        title="Save channel profile"
        onPress={async () => {
          if (
            !name.trim() ||
            !tagline.trim() ||
            bio.trim().length < 20 ||
            !/^https:\/\//.test(photo)
          ) {
            setMsg(
              "Add a name, promise, a bio of at least 20 characters, and an HTTPS cover URL.",
            );
            return;
          }
          if (
            !(await apply(
              saveChannelProfile(c.id, {
                name,
                tagline,
                bio,
                category,
                photo,
              }),
            ))
          )
            return;
          go(router, "studio");
        }}
      />
    </Shell>
  );
}
export function Studio() {
  const { state } = useStore();
  const router = useRouter();
  const c = state.creators.find((c) => c.id === state.ownedId)!;
  const checks = publishChecks(state, c);
  const done = checks.filter((x) => x.ok).length;
  const count = state.workouts.filter(
    (w) => w.creatorId === c.id && w.published,
  ).length;
  const members = state.memberships.filter(
    (m) => m.creatorId === c.id && hasAccess(state, c.id),
  );
  return (
    <Shell creator wide>
      <Heading
        eyebrow={`@${c.handle} · ${c.published ? "LIVE" : "DRAFT CHANNEL"}`}
        title={`Let’s build something, ${c.name.split(" ")[0]}.`}
        description="Your next great workout could be someone’s new beginning."
        action={
          <Badge light>{c.published ? "PUBLISHED" : "GETTING STARTED"}</Badge>
        }
      />
      {!demoMode && (
        <Notice>
          Open Members and Earnings for verified server records. Channel
          publishing requires TrainWith approval.
        </Notice>
      )}
      <Row style={{ flexWrap: "wrap" }}>
        {[
          [
            demoMode ? String(members.length) : "View Members",
            "Active members",
          ],
          [String(count), "Published workouts"],
          [
            demoMode
              ? `$${members.reduce((n, m) => n + m.price, 0)}`
              : "View Earnings",
            "Payment records",
          ],
        ].map(([v, l]) => (
          <Card key={l} style={{ flex: 1, minWidth: 140 }}>
            <T bold size={32}>
              {v}
            </T>
            <T size={12} color={C.muted}>
              {l}
            </T>
          </Card>
        ))}
      </Row>
      <Card style={{ backgroundColor: C.green, borderWidth: 0, padding: 25 }}>
        <Row between>
          <View style={{ flex: 1, gap: 6 }}>
            <T size={23} bold color={C.white}>
              {c.published
                ? "Your channel is open."
                : "Your channel starts with you."}
            </T>
            <T color="#BFD0C3">
              {c.published
                ? "Keep giving your members a reason to show up."
                : "A few small steps, then you’re ready to share."}
            </T>
          </View>
          <Dumbbell size={35} color={C.lime} />
        </Row>
        <Button
          title={c.published ? "Share my channel" : "Get ready to publish"}
          secondary
          onPress={() =>
            go(router, c.published ? "creator-share" : "creator-publish")
          }
        />
      </Card>
      <Card>
        <Row between>
          <T bold size={20}>
            Launch checklist
          </T>
          <T color={C.muted}>
            {done}/{checks.length}
          </T>
        </Row>
        <Progress value={done / checks.length} />
        {checks.map((x, i) => (
          <Item
            key={x.label}
            title={x.label}
            subtitle={x.ok ? "Ready" : "Let’s do this"}
            icon={
              x.ok ? (
                <Check size={19} color={C.green} />
              ) : (
                <Circle size={19} color={C.muted} />
              )
            }
            onPress={() =>
              go(
                router,
                [
                  "creator-profile",
                  "upload",
                  "upload",
                  "creator-price",
                  "creator-payout",
                ][i],
              )
            }
          />
        ))}
      </Card>
      <Row style={{ flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Button
            title="Add a workout"
            icon={<Plus size={18} color={C.white} />}
            onPress={() => go(router, "upload")}
          />
        </View>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Button
            title="Preview channel"
            secondary
            onPress={() => go(router, "preview", c.id)}
          />
        </View>
      </Row>
    </Shell>
  );
}
export function Content({ id }: { id?: string }) {
  const { state } = useStore();
  const router = useRouter();
  const [tab, setTab] = useState(id === "programs" ? "Programs" : "Workouts");
  const list = state.workouts.filter((w) => w.creatorId === state.ownedId);
  const programs = state.programs.filter((p) => p.creatorId === state.ownedId);
  return (
    <Shell creator>
      <Heading
        title="Good work lives here."
        description="Build your library, one session at a time."
      />
      <Chips items={["Workouts", "Programs"]} value={tab} onChange={setTab} />
      <Button
        title={tab === "Workouts" ? "Add a workout" : "Create a program"}
        icon={<Plus size={18} color={C.white} />}
        onPress={() =>
          go(router, tab === "Workouts" ? "upload" : "program-editor")
        }
      />
      {tab === "Workouts" ? (
        list.length ? (
          list.map((w) => (
            <Card key={w.id}>
              <Row>
                <Photo uri={w.photo} height={85} style={{ width: 100 }} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Badge light>
                    {w.published ? "PUBLISHED" : "DRAFT"} ·{" "}
                    {w.free ? "FREE" : "MEMBERS"}
                  </Badge>
                  <T bold>{w.title}</T>
                  <T size={12} color={C.muted}>
                    {w.minutes} min · {w.equipment}
                  </T>
                </View>
              </Row>
              <Button
                title={`Edit ${w.title}`}
                secondary
                onPress={() => go(router, "workout-editor", w.id)}
              />
            </Card>
          ))
        ) : (
          <Empty
            title="Your first session starts here"
            description="Add your own video or try the sample media."
          />
        )
      ) : programs.length ? (
        programs.map((p) => (
          <Item
            key={p.id}
            title={p.title}
            subtitle={`${p.published ? "Published" : "Draft"} · ${p.workoutIds.length} workouts · ${p.weeks} weeks`}
            icon={<Layers size={20} color={C.green} />}
            onPress={() => go(router, "program-editor", p.id)}
          />
        ))
      ) : (
        <Empty
          title="Give their training a little structure"
          description="Group your workouts into a repeatable program."
        />
      )}
    </Shell>
  );
}
export function UploadScreen() {
  return demoMode ? <DemoUploadScreen /> : <ConnectedUpload />;
}
function DemoUploadScreen() {
  const { state, apply } = useStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const add = async (video: string, title: string) => {
    const c = state.creators.find((c) => c.id === state.ownedId)!;
    const id = uid("workout");
    if (
      !(await apply(
        saveWorkout({
          id,
          creatorId: c.id,
          title,
          description: "",
          minutes: 20,
          equipment: "Mat",
          level: "Beginner",
          free: false,
          published: false,
          video,
          photo: c.photo,
        }),
      ))
    )
      return;
    go(router, "workout-editor", id);
  };
  return (
    <Shell creator back title="Add a workout">
      <Heading
        title="Press play on your next idea."
        description="Choose a video, then add the details your members need."
      />
      <Card
        style={{
          alignItems: "center",
          paddingVertical: 40,
          borderStyle: "dashed",
          borderWidth: 2,
        }}
      >
        <Upload size={40} color={C.green} />
        <T bold size={20}>
          Your next workout goes here
        </T>
        <T color={C.muted} style={{ textAlign: "center" }}>
          MP4 recommended · Up to 100 MB
        </T>
        <Button
          title={busy ? "Saving video…" : "Choose a video"}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            setMsg("");
            try {
              const file = await pickVideo();
              if (file) add(file.uri, file.name.replace(/\.[^.]+$/, ""));
            } catch (e) {
              setMsg(
                e instanceof Error && e.message
                  ? e.message
                  : "Could not save this file. Please try another video.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      </Card>
      {!!msg && <Notice error>{msg}</Notice>}
      <Button
        title="Use sample video"
        secondary
        onPress={() => add(SAMPLE_VIDEO, "My first workout")}
      />
      <Notice>
        Videos stay on this device. The sample is placeholder footage; upload
        your own fitness content to try a real workout.
      </Notice>
    </Shell>
  );
}
export function WorkoutEditor({ id }: { id?: string }) {
  const { state, apply, refresh } = useStore();
  const router = useRouter();
  const w = state.workouts.find(
    (w) => w.id === id && w.creatorId === state.ownedId,
  );
  const [title, setTitle] = useState(w?.title || "");
  const [description, setDescription] = useState(w?.description || "");
  const [minutes, setMinutes] = useState(String(w?.minutes || 20));
  const [equipment, setEquipment] = useState(w?.equipment || "Mat");
  const [level, setLevel] = useState(w?.level || "Beginner");
  const [access, setAccess] = useState(
    w?.free ? "Free sample" : "Members only",
  );
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [video, setVideo] = useState(w?.video || "");
  if (!w)
    return (
      <Shell creator back>
        <Empty
          title="Workout not found"
          description="Choose a workout in your content library."
        />
      </Shell>
    );
  const save = async (published: boolean) => {
    if (
      !title.trim() ||
      !description.trim() ||
      !Number.isFinite(Number(minutes)) ||
      Number(minutes) < 1 ||
      Number(minutes) > 180 ||
      (demoMode && !video) ||
      !equipment.trim()
    ) {
      setMsg(
        "Add a title, description, equipment, video, and a duration from 1 to 180 minutes.",
      );
      return;
    }
    if (
      !(await apply(
        saveWorkout({
          ...w,
          title: title.trim(),
          description: description.trim(),
          minutes: Number(minutes),
          equipment: equipment.trim(),
          level,
          free: access === "Free sample",
          published,
          video: demoMode ? video : w.video,
        }),
      ))
    )
      return;
    go(router, "content");
  };
  return (
    <Shell creator back title="Workout details">
      <Photo uri={w.photo} height={170} />
      <Field label="Workout title" value={title} onChange={setTitle} />
      <Field
        label="Description"
        value={description}
        onChange={setDescription}
        multiline
        placeholder="What will they work on?"
      />
      <Field
        label="Duration (minutes)"
        value={minutes}
        onChange={setMinutes}
        keyboardType="numeric"
      />
      <Field label="Equipment" value={equipment} onChange={setEquipment} />
      <T bold size={13}>
        Level
      </T>
      <Chips
        items={["Beginner", "Intermediate", "Advanced"]}
        value={level}
        onChange={setLevel}
      />
      <T bold size={13}>
        Who can watch?
      </T>
      <Chips
        items={["Free sample", "Members only"]}
        value={access}
        onChange={setAccess}
      />
      <Button
        title="Replace video"
        secondary
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            if (!demoMode) {
              const selected = await selectUpload();
              if (selected) {
                await sendUpload(w.id, selected.file, () => {});
                await refresh();
                setMsg("Video uploaded. Refresh after processing finishes.");
              }
              return;
            }
            const f = await pickVideo();
            if (f) {
              setVideo(f.uri);
              setMsg(`Selected ${f.name}. Save to apply.`);
            }
          } catch (e) {
            setMsg(
              e instanceof Error && e.message
                ? e.message
                : "Could not select that video. Please try another file.",
            );
          } finally {
            setBusy(false);
          }
        }}
      />
      {!demoMode && (
        <>
          <Notice>
            {w.video
              ? "Video is ready."
              : "Video is missing or processing. You can save a draft while it processes."}
          </Notice>
          <Button
            secondary
            title="Refresh video status"
            onPress={() => void refresh()}
          />
        </>
      )}
      {!!msg && <Notice>{msg}</Notice>}
      <Button
        title="Publish workout"
        disabled={busy || (!demoMode && !w.video)}
        onPress={() => save(true)}
      />
      <Button
        title={w.published ? "Move to draft" : "Save draft"}
        secondary
        disabled={busy}
        onPress={() => save(false)}
      />
      <T size={12} color={C.muted}>
        Publishing makes it available in your channel once the channel is live.
      </T>
    </Shell>
  );
}
export function ProgramEditor({ id }: { id?: string }) {
  const { state, apply } = useStore();
  const router = useRouter();
  const p = state.programs.find(
    (p) => p.id === id && p.creatorId === state.ownedId,
  );
  const [title, setTitle] = useState(p?.title || "");
  const [desc, setDesc] = useState(p?.description || "");
  const [weeks, setWeeks] = useState(String(p?.weeks || 4));
  const [ids, setIds] = useState(p?.workoutIds || []);
  const [msg, setMsg] = useState("");
  const ws = state.workouts.filter(
    (w) => w.creatorId === state.ownedId && w.published,
  );
  const save = async (published: boolean) => {
    if (
      !title.trim() ||
      !desc.trim() ||
      !ids.length ||
      !Number.isInteger(+weeks) ||
      +weeks < 1 ||
      +weeks > 52
    ) {
      setMsg(
        "Add a title, description, 1–52 weeks, and at least one published workout.",
      );
      return;
    }
    const next: Program = {
      id: p?.id || uid("program"),
      creatorId: state.ownedId!,
      title: title.trim(),
      description: desc.trim(),
      weeks: +weeks,
      workoutIds: ids,
      published,
    };
    if (!(await apply(saveProgram(next)))) return;
    go(router, "content", "programs");
  };
  return (
    <Shell creator back title="Program builder">
      <Heading
        title="A little structure goes a long way."
        description="Arrange a sequence of sessions your members can repeat each week."
      />
      <Field
        label="Program name"
        value={title}
        onChange={setTitle}
        placeholder="Everyday strength"
      />
      <Field
        label="Program description"
        value={desc}
        onChange={setDesc}
        multiline
      />
      <Field
        label="Program length (weeks)"
        value={weeks}
        onChange={setWeeks}
        keyboardType="numeric"
      />
      <T size={20} bold>
        Session order
      </T>
      {ids.map((wid, i) => {
        const w = state.workouts.find((w) => w.id === wid);
        return (
          <Card key={wid}>
            <Row>
              <Badge light>{i + 1}</Badge>
              <T bold style={{ flex: 1 }}>
                {w?.title || "Unavailable workout"}
              </T>
            </Row>
            <Row>
              <View style={{ flex: 1 }}>
                <Button
                  title="Move up"
                  secondary
                  disabled={i === 0}
                  onPress={() =>
                    setIds((a) => {
                      const b = [...a];
                      [b[i - 1], b[i]] = [b[i], b[i - 1]];
                      return b;
                    })
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Remove"
                  subtle
                  onPress={() => setIds((a) => a.filter((x) => x !== wid))}
                />
              </View>
            </Row>
          </Card>
        );
      })}
      <T size={20} bold>
        Add a published workout
      </T>
      {ws
        .filter((w) => !ids.includes(w.id))
        .map((w) => (
          <Item
            key={w.id}
            title={w.title}
            subtitle={`${w.minutes} minutes`}
            onPress={() => setIds((a) => [...a, w.id])}
            end={<Plus size={20} color={C.green} />}
          />
        ))}
      {!ws.length && (
        <Empty
          title="Publish a workout first"
          description="Your published workouts will be available to add here."
          action={
            <Button
              title="Add a workout"
              onPress={() => go(router, "upload")}
            />
          }
        />
      )}
      <T size={12} color={C.muted}>
        Members repeat this ordered sequence across the program’s weeks.
      </T>
      {!!msg && <Notice error>{msg}</Notice>}
      <Button title="Publish program" onPress={() => save(true)} />
      <Button
        title="Save program draft"
        secondary
        onPress={() => save(false)}
      />
    </Shell>
  );
}
export function CreatorPrice() {
  const { state, apply } = useStore();
  const router = useRouter();
  const c = state.creators.find((c) => c.id === state.ownedId)!;
  const [price, setPrice] = useState(c.price ? String(c.price) : "19");
  const [msg, setMsg] = useState("");
  return (
    <Shell creator back title="Membership price">
      <Heading
        eyebrow="One channel. One membership."
        title="Give your work a monthly home."
        description="Members get all of your published paid workouts and programs."
      />
      <Field
        label="Monthly price (USD)"
        value={price}
        onChange={setPrice}
        keyboardType="decimal-pad"
      />
      <Card>
        <T color={C.muted}>YOUR MEMBER SEES</T>
        <T size={42} bold>
          ${price || "0"}
          <T color={C.muted}> / month</T>
        </T>
        <T>Full access to {c.name}’s channel. Cancel renewal anytime.</T>
      </Card>
      <Notice>
        Platform fees and taxes are applied at checkout. Existing memberships
        keep the price they started on.
      </Notice>
      {!!msg && <Notice error>{msg}</Notice>}
      <Button
        title="Save monthly price"
        onPress={async () => {
          const n = Number(price);
          if (
            !Number.isFinite(n) ||
            n < 1 ||
            n > 999 ||
            !/^\d+(\.\d{1,2})?$/.test(price.trim())
          ) {
            setMsg(
              "Enter a price between $1 and $999, with up to two decimal places.",
            );
            return;
          }
          if (!(await apply(setChannelPrice(c.id, n)))) return;
          go(router, "studio");
        }}
      />
    </Shell>
  );
}
export function CreatorPayout() {
  return demoMode ? <DemoCreatorPayout /> : <ConnectedPayout />;
}
function DemoCreatorPayout() {
  const { state, apply } = useStore();
  const router = useRouter();
  const c = state.creators.find((c) => c.id === state.ownedId)!;
  return (
    <Shell creator back title="Payout setup">
      <Heading
        title="Your work deserves to earn."
        description="A place to connect your payout account when payments are ready."
      />
      <Card>
        <Wallet size={36} color={C.green} />
        <T size={22} bold>
          {c.payoutReady ? "Payout setup complete" : "Set up payouts"}
        </T>
        <T color={C.muted}>
          This frontend does not collect bank details or identity documents.
          Payment-provider onboarding comes with the backend.
        </T>
        <Button
          title={c.payoutReady ? "Back to studio" : "Complete payout setup"}
          onPress={async () => {
            if (!(await apply(completePayoutSetup(c.id)))) return;
            go(router, "studio");
          }}
        />
      </Card>
    </Shell>
  );
}
export function CreatorPublish() {
  const { state, apply } = useStore();
  const router = useRouter();
  const c = state.creators.find((c) => c.id === state.ownedId)!;
  const checks = publishChecks(state, c);
  return (
    <Shell creator back title="Publish your channel">
      <Heading
        title="Ready to open the doors?"
        description="A quick check before your channel appears in Discover."
      />
      <Card>
        {checks.map((x, i) => (
          <Item
            key={x.label}
            title={x.label}
            subtitle={x.ok ? "Complete" : "Required before publishing"}
            icon={
              x.ok ? (
                <Check size={20} color={C.green} />
              ) : (
                <Circle size={20} color={C.muted} />
              )
            }
            onPress={() =>
              go(
                router,
                [
                  "creator-profile",
                  "upload",
                  "upload",
                  "creator-price",
                  "creator-payout",
                ][i],
              )
            }
          />
        ))}
      </Card>
      <Button
        title="Preview channel"
        secondary
        onPress={() => go(router, "preview", c.id)}
      />
      <Button
        title={c.published ? "View sharing options" : "Publish my channel"}
        disabled={checks.some((x) => !x.ok)}
        onPress={async () => {
          if (!(await apply(setChannelPublished(c.id, true)))) return;
          go(router, "creator-share");
        }}
      />
      <T size={12} color={C.muted}>
        Publishing lists your channel in Discover. Sharing needs the backend
        before other devices can access it.
      </T>
    </Shell>
  );
}
export function CreatorShare() {
  const { state } = useStore();
  const router = useRouter();
  const c = state.creators.find((c) => c.id === state.ownedId)!;
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const channelUrl = `${demoMode ? "https://jointrainwith.com" : appWebUrl}/${c.handle}`;
  return (
    <Shell creator back title="Share your channel">
      <View style={{ alignItems: "center", gap: 18, paddingVertical: 24 }}>
        <CheckCircle2 size={64} color={C.green} />
        <T bold size={32}>
          {c.published
            ? "Your channel is ready."
            : "Your channel link is reserved."}
        </T>
        <T color={C.muted}>One link. Your whole training world.</T>
      </View>
      <Card>
        <Photo uri={c.photo} height={180} />
        <T bold size={24}>
          {c.name}
        </T>
        <T color={C.muted}>@{c.handle}</T>
        <T>{channelUrl}</T>
        <Button
          title={copied ? "Link copied" : "Copy channel link"}
          onPress={async () => {
            try {
              await Clipboard.setStringAsync(channelUrl);
              setCopied(true);
            } catch {
              setErr(
                "Copy is unavailable here. Select the link above to copy it.",
              );
            }
          }}
        />
      </Card>
      {!!err && <Notice error>{err}</Notice>}
      <Notice>
        {demoMode
          ? "This is your demo channel link."
          : c.published
            ? "Your published channel is available at this link."
            : "Your channel will be visible here after approval and publishing."}
      </Notice>
      <Button
        title="Open member view"
        secondary
        onPress={() =>
          c.published
            ? router.push(`/${c.handle}`)
            : go(router, "preview", c.id)
        }
      />
    </Shell>
  );
}
export function Members() {
  return demoMode ? <DemoMembers /> : <ConnectedStudioReport kind="members" />;
}
function DemoMembers() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const rows = state.memberships.filter(
    (m) => m.creatorId === state.ownedId && hasAccess(state, m.creatorId),
  );
  const visible = rows.filter(() =>
    `${state.user?.name || "Member"} ${state.user?.email || ""}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return (
    <Shell creator>
      <Heading
        title="People showing up with you."
        description={`${rows.length} active member${rows.length === 1 ? "" : "s"}.`}
      />
      <Field
        label="Search members"
        value={q}
        onChange={setQ}
        placeholder="Search by name"
      />
      {visible.length ? (
        visible.map((m) => (
          <Card key={m.creatorId}>
            <Row between>
              <T bold>{state.user?.name || "Member"}</T>
              <Badge light>{m.renews ? "ACTIVE" : "ENDING"}</Badge>
            </Row>
            <T color={C.muted}>
              Joined {new Date(m.started).toLocaleDateString()}
            </T>
            <T>${m.price}/month</T>
            <T size={12} color={C.muted}>
              Messaging members needs the backend
            </T>
          </Card>
        ))
      ) : (
        <Empty
          title={
            q
              ? "No matching members"
              : "Your first member is your next milestone."
          }
          description={
            q
              ? "Try another name."
              : "Publish your channel, switch to member view, and try joining it to see the member appear here."
          }
        />
      )}
    </Shell>
  );
}
export function Earnings() {
  return demoMode ? (
    <DemoEarnings />
  ) : (
    <ConnectedStudioReport kind="earnings" />
  );
}
function DemoEarnings() {
  const { state } = useStore();
  const router = useRouter();
  const c = state.creators.find((c) => c.id === state.ownedId)!;
  const rows = state.memberships.filter(
    (m) => m.creatorId === c.id && hasAccess(state, c.id),
  );
  const gross = rows.reduce((n, m) => n + m.price, 0);
  return (
    <Shell creator>
      <Heading
        title="Your work, adding up."
        description="A transparent look at your memberships."
      />
      <Card style={{ backgroundColor: C.green, borderWidth: 0 }}>
        <T color="#BFD0C3">Current monthly gross</T>
        <T bold size={48} color={C.white}>
          ${gross.toFixed(2)}
        </T>
        <T color="#BFD0C3">
          {rows.length} active membership{rows.length === 1 ? "" : "s"}
        </T>
      </Card>
      <Card>
        <Row between>
          <T>Gross membership value</T>
          <T bold>${gross.toFixed(2)}</T>
        </Row>
        <Row between>
          <T>Platform & processing fees</T>
          <T color={C.muted}>Not configured</T>
        </Row>
        <Row between>
          <T>Available to pay out</T>
          <T bold>$0.00</T>
        </Row>
      </Card>
      <Notice>
        Payouts are not connected yet, so this reflects memberships recorded on
        this device rather than settled revenue or an available balance.
      </Notice>
      <Button
        title={c.payoutReady ? "View payout setup" : "Set up payouts"}
        secondary
        onPress={() => go(router, "creator-payout")}
      />
    </Shell>
  );
}
export function CreatorSettings() {
  const { state, apply } = useStore();
  const router = useRouter();
  const c = state.creators.find((c) => c.id === state.ownedId)!;
  const [confirm, setConfirm] = useState(false);
  return (
    <Shell creator back title="Creator settings">
      <Heading title={c.name} description={`@${c.handle}`} />
      {[
        ["Channel profile", "creator-profile"],
        ["Handle & channel link", "creator-handle"],
        ["Monthly membership", "creator-price"],
        ["Payout setup", "creator-payout"],
        ["Preview channel", "preview"],
      ].map(([t, s]) => (
        <Item
          key={s}
          title={t}
          onPress={() => go(router, s, s === "preview" ? c.id : undefined)}
        />
      ))}
      <Button
        title="Switch to member view"
        secondary
        onPress={() => go(router, "discover")}
      />
      {c.published &&
        (confirm ? (
          <Card>
            <T bold>Unpublish your channel?</T>
            <T>
              Your channel will disappear from Discover. Existing members keep
              workout access for their current period.
            </T>
            <Button
              title="Confirm unpublish"
              onPress={async () => {
                if (!(await apply(setChannelPublished(c.id, false)))) return;
                setConfirm(false);
              }}
            />
            <Button
              title="Keep published"
              secondary
              onPress={() => setConfirm(false)}
            />
          </Card>
        ) : (
          <Button
            title="Unpublish channel"
            subtle
            onPress={() => setConfirm(true)}
          />
        ))}
    </Shell>
  );
}
