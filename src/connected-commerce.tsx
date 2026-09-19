import React, { useEffect, useState } from "react";
import { Platform, Linking, AppState } from "react-native";
import { useRouter } from "expo-router";
import { api } from "./backend";
import { useStore } from "./store";
import { hasAccess } from "./data";
import { Shell, Heading, Card, Button, Notice, T, Photo, go } from "./ui";
import { purchaseEligibility } from "./purchase-policy";
import { PolicyLinks } from "./connected-safety";
export function useCheckoutEligibility() {
  const [allowed, setAllowed] = useState<boolean | null>(
    Platform.OS === "web" ? true : null,
  );
  useEffect(() => {
    let active = true;
    const check = () => {
      setAllowed(null);
      void purchaseEligibility().then((v) => {
        if (active) setAllowed(v.allowed);
      });
    };
    check();
    const listener = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
  return allowed;
}
export function MembershipAction({
  creatorId,
  name,
  price,
  active,
}: {
  creatorId: string;
  name: string;
  price: number;
  active: boolean;
}) {
  const allowed = useCheckoutEligibility();
  const router = useRouter();
  if (active)
    return (
      <Button
        title="Go to my workouts"
        onPress={() => go(router, "my-workouts")}
      />
    );
  if (allowed === null)
    return <Notice>Checking membership availability…</Notice>;
  if (!allowed)
    return (
      <Notice>
        New memberships are unavailable in this app storefront. Existing members
        can sign in to train.
      </Notice>
    );
  return (
    <Button
      title={
        Platform.OS === "web"
          ? `Join ${name.split(" ")[0]} · $${price}/month`
          : `View ${name.split(" ")[0]} membership`
      }
      onPress={() => go(router, "membership", creatorId)}
    />
  );
}
export function ConnectedMembership({ id }: { id?: string }) {
  const { state, refresh } = useStore();
  const router = useRouter();
  const c = state.creators.find((x) => x.id === id);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const allowed = useCheckoutEligibility();
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
      const eligibility = await purchaseEligibility();
      if (!eligibility.allowed)
        throw new Error(
          "New memberships are unavailable in this app storefront.",
        );
      setUrl(
        (
          await api<{ url: string }>("/v1/billing/checkout", {
            creatorId: c.id,
            client: eligibility.client,
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
      {(allowed || hasAccess(state, c.id)) && (
        <Card>
          <T bold size={36}>
            ${c.price} / month
          </T>
          <T>
            Renews monthly. Cancel future renewal from your membership settings.
          </T>
        </Card>
      )}
      {allowed && (
        <Notice>
          Stripe sandbox: use test payment details only. No real money is
          charged.
        </Notice>
      )}
      {Platform.OS !== "web" && allowed && (
        <Notice>
          Continue in your browser to pay with Stripe. The purchase is processed
          by TrainWith through Stripe, not Apple. Return here after checkout;
          access starts only after payment confirmation.
        </Notice>
      )}
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
      ) : !allowed ? (
        <Notice>
          {allowed === null
            ? "Checking membership availability…"
            : "New memberships are unavailable in this app storefront. Existing members can sign in to train."}
        </Notice>
      ) : url ? (
        <>
          <Button
            title={
              Platform.OS === "web"
                ? "Open secure test Checkout"
                : "Continue to Stripe in browser"
            }
            onPress={async () => {
              try {
                const eligibility = await purchaseEligibility();
                if (!eligibility.allowed)
                  throw new Error(
                    "Checkout is unavailable in this storefront.",
                  );
                const target = new URL(url);
                if (
                  target.protocol !== "https:" ||
                  target.hostname !== "checkout.stripe.com"
                )
                  throw new Error("Checkout returned an unexpected address.");
                await Linking.openURL(url);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not open checkout.",
                );
              }
            }}
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
      <PolicyLinks />
    </Shell>
  );
}
export function CheckoutReturn({
  id,
  canceled = false,
}: {
  id?: string;
  canceled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const page = canceled ? "membership" : "joined";
  return (
    <Shell title="Return to TrainWith">
      <Heading
        title={canceled ? "Checkout was canceled." : "Continue in TrainWith."}
        description={
          canceled
            ? "You can return to your coach without starting a membership."
            : "Your membership is confirmed by the payment provider. This return page does not grant access."
        }
      />
      {!!error && <Notice error>{error}</Notice>}
      <Button
        title="Open TrainWith app"
        onPress={async () => {
          try {
            if (!id || !/^[a-zA-Z0-9_-]{3,100}$/.test(id))
              throw new Error("Invalid membership return.");
            await Linking.openURL(
              `trainwith://screen/${page}?id=${encodeURIComponent(id)}`,
            );
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Open TrainWith manually to refresh your membership.",
            );
          }
        }}
      />
      <Button
        secondary
        title="Continue on website"
        onPress={() => go(router, page, id)}
      />
      <T>
        If the app does not open, open TrainWith yourself and refresh My
        memberships. You may need to sign in again on the website.
      </T>
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
