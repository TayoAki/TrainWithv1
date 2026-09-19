import React, {
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { AppState as NativeAppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppState } from "./data";
import { seed } from "./data";
import type { Transition, PaymentGateway } from "./services";
import { localPaymentGateway } from "./services";
import { api, authClient, demoMode } from "./backend";
const empty = (): AppState => ({
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
});
type Store = {
  state: AppState;
  ready: boolean;
  busy: boolean;
  error: string;
  connected: boolean;
  apply: (t: Transition) => Promise<boolean>;
  payments: PaymentGateway;
  reset: () => void;
  refresh: () => Promise<boolean>;
};
const Context = createContext<Store | null>(null);
export function Provider({
  children,
  payments = localPaymentGateway,
}: {
  children: React.ReactNode;
  payments?: PaymentGateway;
}) {
  const [state, setState] = useState<AppState>(demoMode ? seed : empty);
  const [ready, setReady] = useState(!demoMode && !authClient);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    !demoMode && !authClient
      ? "Supabase authentication is not configured."
      : "",
  );
  const version = useRef(0);
  const authEpoch = useRef(0);
  const inFlight = useRef(false);
  const persist = useRef(Promise.resolve());
  const refresh = useCallback(async () => {
    if (demoMode) return true;
    const generation = ++version.current;
    try {
      const next = await api<AppState>("/v1/state");
      if (generation === version.current) {
        setState(next);
        setError("");
      }
      return true;
    } catch (e) {
      if (generation === version.current)
        setError(
          e instanceof Error ? e.message : "Could not connect to TrainWith.",
        );
      return false;
    } finally {
      if (generation === version.current) setReady(true);
    }
  }, []);
  useEffect(() => {
    if (demoMode) {
      AsyncStorage.getItem("trainwith.v1")
        .then((raw) => {
          if (raw) {
            const data = JSON.parse(raw);
            if (
              data.version === 1 &&
              Array.isArray(data.creators) &&
              Array.isArray(data.memberships)
            )
              setState(data);
          }
        })
        .catch(() => setError("Saved demo data could not be loaded."))
        .finally(() => setReady(true));
      return;
    }
    if (!authClient) return;
    let active = true;
    const invalidate = () => {
      version.current++;
      authEpoch.current++;
    };
    const { data } = authClient.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
        invalidate();
        setState(empty());
        setReady(false);
      }
      queueMicrotask(() => {
        if (active) void refresh();
      });
    });
    const appListener = NativeAppState.addEventListener("change", (status) => {
      if (status === "active") {
        authClient?.auth.startAutoRefresh();
        void refresh();
      } else authClient?.auth.stopAutoRefresh();
    });
    return () => {
      active = false;
      invalidate();
      data.subscription.unsubscribe();
      appListener.remove();
    };
  }, [refresh]);
  useEffect(() => {
    if (demoMode && ready)
      persist.current = persist.current
        .then(() => AsyncStorage.setItem("trainwith.v1", JSON.stringify(state)))
        .catch(() => setError("Demo changes could not be saved."));
  }, [state, ready]);
  const apply = async (t: Transition) => {
    if (demoMode) {
      setState(t);
      return true;
    }
    if (inFlight.current) {
      setError("Please wait for the current change to finish.");
      return false;
    }
    if (!t.command) {
      setError("This operation is unavailable.");
      return false;
    }
    inFlight.current = true;
    const epoch = authEpoch.current;
    setBusy(true);
    setError("");
    try {
      if (t.command.name === "auth.signOut") {
        const result = await authClient?.auth.signOut();
        if (result?.error) throw result.error;
        setState(empty());
        return true;
      }
      if (t.command.name.endsWith(".demoOnly"))
        throw new Error(
          "This operation must be completed through the payment provider.",
        );
      const next = await api<AppState>(
        t.command.name === "membership.renewal"
          ? "/v1/billing/renewal"
          : "/v1/commands",
        t.command.name === "membership.renewal" ? t.command.payload : t.command,
      );
      if (epoch !== authEpoch.current) return false;
      version.current++;
      setState(next);
      return true;
    } catch (e) {
      if (epoch === authEpoch.current)
        setError(e instanceof Error ? e.message : "Could not save the change.");
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Context
      value={{
        state,
        ready,
        busy,
        error,
        connected: !demoMode,
        apply,
        payments: demoMode
          ? payments
          : {
              charge: async () => ({
                ok: false,
                reason: "Use secure Checkout to start a membership.",
              }),
            },
        refresh,
        reset: () => {
          if (demoMode) setState(seed());
          else void refresh();
        },
      }}
    >
      {children}
    </Context>
  );
}
export function useStore() {
  const value = use(Context);
  if (!value) throw new Error("Missing TrainWith provider");
  return value;
}
