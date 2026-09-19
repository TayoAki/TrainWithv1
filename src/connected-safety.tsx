import React, { useEffect, useState } from "react";
import { WorkoutPlayer } from "./player";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, authClient } from "./backend";
import { useStore } from "./store";
import { adultAgeSource } from "./age-policy";
import { Button, Card, Field, Heading, Notice, Shell, T, go } from "./ui";

export function PolicyLinks() {
  const router = useRouter();
  return (
    <>
      <Button
        subtle
        title="Privacy policy"
        onPress={() => go(router, "privacy")}
      />
      <Button
        subtle
        title="Terms & community rules"
        onPress={() => go(router, "terms")}
      />
      <Button
        subtle
        title="Contact TrainWith"
        onPress={() => go(router, "contact")}
      />
    </>
  );
}
export function Eligibility() {
  const { state, refresh } = useStore();
  const [adult, setAdult] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Shell title="Before you train">
      <Heading
        title="A space for adults to train."
        description="The first TrainWith beta is for people aged 18 and over."
      />
      <Button
        secondary
        title={adult ? "✓ I am 18 or older" : "I am 18 or older"}
        onPress={() => setAdult(!adult)}
      />
      <PolicyLinks />
      <Button
        secondary
        title={
          accepted
            ? "✓ I accept the terms and acknowledge the privacy policy"
            : "I accept the terms and acknowledge the privacy policy"
        }
        onPress={() => setAccepted(!accepted)}
      />
      {!!error && <Notice error>{error}</Notice>}
      <Button
        title="Continue to TrainWith"
        disabled={!adult || !accepted}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          setError("");
          try {
            const ageSource = await adultAgeSource();
            await api("/v1/policy/accept", {
              adult: true,
              accepted: true,
              version: state.eligibility?.policyVersion || "2026-09-19",
              ageSource,
            });
            await refresh();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not confirm eligibility.",
            );
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button
        subtle
        title="Sign out"
        onPress={() => void authClient?.auth.signOut()}
      />
    </Shell>
  );
}
export function SafetyActions({
  creatorId,
  workoutId,
}: {
  creatorId: string;
  workoutId?: string;
}) {
  const { state, refresh } = useStore();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (state.ownedId === creatorId) return null;
  return (
    <Card>
      <T bold>Keep TrainWith safe</T>
      <Button
        subtle
        title={workoutId ? "Report this workout" : "Report this creator"}
        onPress={() =>
          go(
            router,
            "report",
            `${creatorId}${workoutId ? `:${workoutId}` : ""}`,
          )
        }
      />
      {!!error && <Notice error>{error}</Notice>}
      {confirm ? (
        <>
          <T>
            Blocking hides this creator and prevents playback. It does not
            cancel your membership. You can still manage renewal in My
            memberships.
          </T>
          <Button
            title="Confirm block"
            loading={busy}
            onPress={async () => {
              if (!state.user) {
                go(router, "auth");
                return;
              }
              setBusy(true);
              try {
                await api("/v1/safety/block", { creatorId, blocked: true });
                await refresh();
                go(router, "discover");
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not block creator.",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
          <Button
            secondary
            title="Keep creator visible"
            onPress={() => setConfirm(false)}
          />
        </>
      ) : (
        <Button
          subtle
          title="Block this creator"
          onPress={() => setConfirm(true)}
        />
      )}
    </Card>
  );
}
export function Report({ id }: { id?: string }) {
  const { state } = useStore();
  const router = useRouter();
  const [reason, setReason] = useState("unsafe");
  const [details, setDetails] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [creatorId, workoutId] = (id || "").split(":");
  return (
    <Shell back title="Report content">
      <Heading
        title="Tell us what needs attention."
        description="Reports are reviewed by TrainWith. The creator does not see who reported them."
      />
      {!state.user ? (
        <Button title="Sign in to report" onPress={() => go(router, "auth")} />
      ) : result ? (
        <Notice>{result}</Notice>
      ) : (
        <>
          <T bold>Reason</T>
          {[
            ["unsafe", "Unsafe training or harmful content"],
            ["age_inappropriate", "Age-inappropriate or sexual content"],
            ["harassment", "Harassment or abusive behavior"],
            ["rights", "Copyright or other rights"],
            ["other", "Something else"],
          ].map(([value, label]) => (
            <Button
              key={value}
              secondary
              title={`${reason === value ? "✓ " : ""}${label}`}
              onPress={() => setReason(value)}
            />
          ))}
          <Field
            label="Report details"
            value={details}
            onChange={setDetails}
            multiline
          />
          {!!error && <Notice error>{error}</Notice>}
          <Button
            title="Submit report"
            disabled={details.trim().length < 10}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await api("/v1/safety/report", {
                  creatorId,
                  ...(workoutId ? { workoutId } : {}),
                  reason,
                  details,
                });
                setResult(
                  "Report received. TrainWith will review it. You can block this creator while we investigate.",
                );
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Report could not be submitted.",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
      <PolicyLinks />
    </Shell>
  );
}
export function SafetySettings() {
  const { state, refresh } = useStore();
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <Shell back title="Settings">
      <Heading title="Your account, your choices." />
      <Button
        title="Manage my memberships"
        onPress={() => go(router, "memberships")}
      />
      <PolicyLinks />
      <Card>
        <T bold>Blocked creators</T>
        {!state.blocked?.length && <T>You have not blocked any creators.</T>}
        {state.blocked?.map((c) => (
          <Button
            key={c.id}
            secondary
            title={`Unblock ${c.name}`}
            onPress={async () => {
              try {
                await api("/v1/safety/block", {
                  creatorId: c.id,
                  blocked: false,
                });
                await refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not unblock.");
              }
            }}
          />
        ))}
      </Card>
      {!!error && <Notice error>{error}</Notice>}
      <Button
        title="Delete my account"
        secondary
        onPress={() => go(router, "delete-account")}
      />
      <Button
        subtle
        title="Check a deletion request"
        onPress={() => go(router, "deletion-status")}
      />
      <Button
        subtle
        title="Moderation dashboard"
        onPress={() => go(router, "moderation")}
      />
    </Shell>
  );
}
const receiptKey = "trainwith.deletion-receipt";
let currentReceipt = "";
export function DeleteAccount() {
  const { state } = useStore();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Shell back title="Delete account">
      <Heading title="Permanently delete your account" />
      <T>
        Your profile, progress, saved programs and uploaded content will be
        removed. Your Stripe subscriptions will be canceled. If you are a
        creator, your channel will close and its member subscriptions will also
        be canceled. Existing payments are not automatically refunded.
      </T>
      <T>
        Payment providers may retain records they need for financial or legal
        obligations. TrainWith keeps limited payment and security records.
        Deletion normally completes in minutes; provider retries may take
        longer. Keep your receipt to check completion. Contact us if it remains
        pending after 7 days.
      </T>
      {state.user ? (
        <>
          <Field
            label="Current password"
            value={password}
            onChange={setPassword}
            secureTextEntry
          />
          <Field
            label="Type DELETE to confirm"
            value={confirmation}
            onChange={setConfirmation}
          />
          {!!error && <Notice error>{error}</Notice>}
          <Button
            title="Permanently delete my account"
            loading={busy}
            disabled={confirmation !== "DELETE" || !password}
            onPress={async () => {
              setBusy(true);
              setError("");
              try {
                const result = await api<{ receipt: string }>(
                  "/v1/account/delete",
                  { confirmation, password },
                );
                setPassword("");
                currentReceipt = result.receipt;
                await AsyncStorage.setItem(receiptKey, result.receipt).catch(
                  () => {},
                );
                await authClient?.auth.signOut({ scope: "local" });
                go(router, "deletion-status");
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Deletion could not be requested.",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      ) : (
        <Button
          title="Sign in to delete your account"
          onPress={() => go(router, "auth")}
        />
      )}
      <PolicyLinks />
    </Shell>
  );
}
export function DeletionStatus() {
  const [receipt, setReceipt] = useState(currentReceipt);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    void AsyncStorage.getItem(receiptKey)
      .then((v) => {
        if (v && !currentReceipt) setReceipt(v);
      })
      .catch(() => {});
  }, []);
  const check = async () => {
    try {
      const result = await api<{ status: string }>("/public/deletion-status", {
        receipt,
      });
      setStatus(result.status);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check deletion.");
    }
  };
  useEffect(() => {
    if (receipt.length !== 64) return;
    let active = true;
    const checkStatus = () => {
      void api<{ status: string }>("/public/deletion-status", { receipt })
        .then((r) => {
          if (active) setStatus(r.status);
        })
        .catch(() => {});
    };
    checkStatus();
    const timer = setInterval(checkStatus, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [receipt]);
  return (
    <Shell back title="Deletion receipt">
      <Heading
        title={
          status === "done"
            ? "Your account has been deleted."
            : "Track your deletion request"
        }
      />
      <T>
        This private receipt shows completion without signing in. Save it before
        clearing app data.
      </T>
      <Field label="Deletion receipt" value={receipt} onChange={setReceipt} />
      {status && (
        <Notice>
          {status === "done"
            ? "Your app data and authentication account have been removed. The limited retention described in the privacy policy still applies."
            : status === "failed"
              ? "Deletion is delayed. The operator must retry a provider step. Your account remains restricted; this is not a completion confirmation."
              : "Deletion is in progress. Your account is restricted while subscriptions and media are removed."}
        </Notice>
      )}
      {!!error && <Notice error>{error}</Notice>}
      <Button title="Refresh deletion status" onPress={() => void check()} />
      <PolicyLinks />
    </Shell>
  );
}
type Queue = {
  creators: {
    id: string;
    name: string;
    handle: string;
    tagline: string;
    bio: string;
    photo: string;
  }[];
  reports: {
    id: string;
    creator_id: string;
    workout_id: string | null;
    reason: string;
    details: string;
    status: string;
  }[];
  workouts: {
    id: string;
    title: string;
    description: string;
    photo: string;
    equipment: string;
    level: string;
    creator_name: string;
  }[];
  programs: {
    id: string;
    title: string;
    description: string;
    weeks: number;
    creator_name: string;
  }[];
  contacts: { id: string; email: string; message: string; status: string }[];
  deletions: { id: string; status: string }[];
};
export function Moderation() {
  const [preview, setPreview] = useState<{ id: string; url: string } | null>(
    null,
  );
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      setQueue(await api<Queue>("/v1/admin/moderation"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot load moderation.");
    }
  };
  useEffect(() => {
    void api<Queue>("/v1/admin/moderation")
      .then(setQueue)
      .catch((e) => setError(e.message));
  }, []);
  const act = async (action: string, id: string) => {
    setBusy(true);
    try {
      if (action === "approve_creator")
        await api("/v1/admin/creators/approve", {
          creatorId: id,
          approved: true,
        });
      else await api("/v1/admin/moderation", { action, id });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Moderation action failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell back title="Moderation">
      <Heading
        title="Review and respond"
        description="Administrator access is checked by the server."
      />
      {!!error && <Notice error>{error}</Notice>}
      <Button secondary title="Refresh queue" onPress={() => void load()} />
      {queue?.creators.map((c) => (
        <Card key={c.id}>
          <T bold>
            {c.name} (@{c.handle})
          </T>
          <T>{c.tagline}</T>
          <T>{c.bio}</T>
          {!!c.photo && (
            <Image
              source={c.photo}
              style={{ width: 180, height: 180 }}
              contentFit="cover"
              accessibilityLabel="Creator profile image for review"
            />
          )}
          <Button
            title="Approve reviewed creator"
            loading={busy}
            onPress={() => void act("approve_creator", c.id)}
          />
        </Card>
      ))}
      {queue?.reports
        .filter((r) => r.status === "open")
        .map((r) => (
          <Card key={r.id}>
            <T bold>{r.reason}</T>
            <T>{r.details}</T>
            {r.workout_id && (
              <Button
                title="Remove reported workout"
                loading={busy}
                onPress={() => void act("remove_workout", r.workout_id!)}
              />
            )}
            <Button
              secondary
              title="Suspend reported creator"
              loading={busy}
              onPress={() => void act("suspend_creator", r.creator_id)}
            />
            <Button
              subtle
              title="Mark report reviewed"
              loading={busy}
              onPress={() => void act("resolve_report", r.id)}
            />
          </Card>
        ))}
      {queue?.workouts.map((w) => (
        <Card key={w.id}>
          <T bold>{w.title}</T>
          <T>{w.creator_name}</T>
          <T>{w.description}</T>
          <T>
            {w.equipment} · {w.level}
          </T>
          {!!w.photo && (
            <Image
              source={w.photo}
              style={{ width: 240, height: 150 }}
              contentFit="cover"
              accessibilityLabel="Workout image for review"
            />
          )}
          <Button
            secondary
            title="Preview video"
            onPress={async () => {
              try {
                const result = await api<{ url: string }>("/v1/admin/preview", {
                  workoutId: w.id,
                });
                setPreview({ id: w.id, url: result.url });
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Preview unavailable.",
                );
              }
            }}
          />
          {preview?.id === w.id && (
            <WorkoutPlayer uri={preview.url} photo={w.photo} />
          )}
          <Button
            title="Approve reviewed workout"
            loading={busy}
            onPress={() => void act("approve_workout", w.id)}
          />
          <Button
            secondary
            title="Reject workout"
            loading={busy}
            onPress={() => void act("remove_workout", w.id)}
          />
        </Card>
      ))}
      {queue?.programs.map((p) => (
        <Card key={p.id}>
          <T bold>{p.title}</T>
          <T>
            {p.creator_name} · {p.weeks} weeks
          </T>
          <T>{p.description}</T>
          <Button
            title="Approve reviewed program"
            loading={busy}
            onPress={() => void act("approve_program", p.id)}
          />
          <Button
            secondary
            title="Reject program"
            loading={busy}
            onPress={() => void act("remove_program", p.id)}
          />
        </Card>
      ))}
      {queue?.contacts
        .filter((c) => c.status === "open")
        .map((c) => (
          <Card key={c.id}>
            <T bold>{c.email}</T>
            <T>{c.message}</T>
            <Button
              title="Mark contact resolved"
              loading={busy}
              onPress={() => void act("resolve_contact", c.id)}
            />
          </Card>
        ))}
      {queue?.deletions.map((d) => (
        <Card key={d.id}>
          <T>
            Deletion {d.id}: {d.status}
          </T>
          {d.status === "failed" && (
            <Button
              title="Retry deletion"
              loading={busy}
              onPress={() => void act("retry_deletion", d.id)}
            />
          )}
        </Card>
      ))}
    </Shell>
  );
}
