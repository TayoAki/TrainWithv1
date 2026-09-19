import React, { useState } from "react";
import { Platform, Linking } from "react-native";
import { useRouter } from "expo-router";
import { api } from "./backend";
import { useStore } from "./store";
import { hasAccess } from "./data";
import { Shell, Heading, Card, Button, Notice, T, Photo, go } from "./ui";
export function ConnectedMembership({ id }: { id?: string }) {
  const { state, refresh } = useStore();
  const router = useRouter();
  const c = state.creators.find((x) => x.id === id);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!c)
    return (
      <Shell back>
        <Notice>Choose a coach to view their membership.</Notice>
      </Shell>
    );
  const prepare = async () => {
    setBusy(true);
    setError("");
    try {
      setUrl(
        (
          await api<{ url: string }>("/v1/billing/checkout", {
            creatorId: c.id,
          })
        ).url,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout could not start.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell back title="Your membership">
      <Photo uri={c.photo} height={210} />
      <Heading
        title={`Train with ${c.name}`}
        description="One membership. This coach’s published workouts and programs."
      />
      <Card>
        <T bold size={36}>
          ${c.price} / month
        </T>
        <T>
          Renews monthly. Cancel future renewal from your membership settings.
        </T>
      </Card>
      <Notice>
        Stripe sandbox: use test payment details only. No real money is charged.
      </Notice>
      {!!error && <Notice error>{error}</Notice>}
      {hasAccess(state, c.id) ? (
        <Button
          title="Open my workouts"
          onPress={() => go(router, "my-workouts")}
        />
      ) : !state.user ? (
        <Button
          title="Sign in to continue"
          onPress={() => go(router, "auth", c.id)}
        />
      ) : Platform.OS !== "web" ? (
        <Notice>
          In-app purchases are not available in this build. Existing members can
          sign in to train.
        </Notice>
      ) : url ? (
        <>
          <Button
            title="Open secure test Checkout"
            onPress={() => void Linking.openURL(url)}
          />
          <Button
            secondary
            title="Refresh membership after checkout"
            onPress={() => void refresh()}
          />
        </>
      ) : (
        <Button
          title="Prepare secure Checkout"
          loading={busy}
          onPress={() => void prepare()}
        />
      )}
    </Shell>
  );
}
export function ConnectedJoined({ id }: { id?: string }) {
  const { state, refresh } = useStore();
  const router = useRouter();
  const active = !!id && hasAccess(state, id);
  return (
    <Shell back>
      <Heading
        title={active ? "You’re in." : "Confirming your membership."}
        description={
          active
            ? "Your coach’s workouts are ready."
            : "Access appears after Stripe confirms your payment."
        }
      />
      {!state.user ? (
        <Button
          title="Sign in to view your membership"
          onPress={() => go(router, "auth", id)}
        />
      ) : active ? (
        <Button title="Let’s train" onPress={() => go(router, "my-workouts")} />
      ) : (
        <>
          <Notice>
            Returning from Checkout does not activate access by itself. Payment
            confirmation may take a moment.
          </Notice>
          <Button title="Check membership" onPress={() => void refresh()} />
        </>
      )}
    </Shell>
  );
}
export function ConnectedPayout() {
  const { state, refresh } = useStore();
  const c = state.creators.find((x) => x.id === state.ownedId)!;
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const setup = async () => {
    setBusy(true);
    setError("");
    try {
      setUrl(
        (
          await api<{ url: string }>("/v1/connect/onboarding", {
            creatorId: c.id,
          })
        ).url,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onboarding unavailable.");
    } finally {
      setBusy(false);
    }
  };
  const check = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/v1/connect/refresh", { creatorId: c.id });
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not refresh payout status.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell creator back title="Payout setup">
      <Heading
        title="Your work deserves to earn."
        description="Connect your payout account through Stripe’s secure onboarding."
      />
      <Notice>Sandbox setup: this does not activate real payouts.</Notice>
      <Card>
        <T bold>
          {c.payoutReady ? "Stripe onboarding complete" : "Onboarding required"}
        </T>
        <T>
          Stripe verifies account readiness. TrainWith never asks for your bank
          password.
        </T>
      </Card>
      {!!error && <Notice error>{error}</Notice>}
      {url ? (
        <Button
          title="Open Stripe onboarding"
          onPress={() => void Linking.openURL(url)}
        />
      ) : (
        <Button
          title="Prepare Stripe onboarding"
          loading={busy}
          onPress={() => void setup()}
        />
      )}
      <Button
        secondary
        title="Refresh payout status"
        loading={busy}
        onPress={() => void check()}
      />
    </Shell>
  );
}
