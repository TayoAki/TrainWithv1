import React, { createContext, use, useEffect, useState, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppState } from "./data";
import { seed } from "./data";
import type { Transition, PaymentGateway } from "./services";
import { localPaymentGateway } from "./services";
const KEY = "trainwith.v1";
type Store = {
  state: AppState;
  ready: boolean;
  error: string;
  /** Applies a transition from src/services.ts. Screens never build state inline. */
  apply: (transition: Transition) => void;
  /** Swappable seam: a real provider replaces this without screen changes. */
  payments: PaymentGateway;
  reset: () => void;
};
const Context = createContext<Store | null>(null);
export function Provider({
  children,
  payments = localPaymentGateway,
}: {
  children: React.ReactNode;
  payments?: PaymentGateway;
}) {
  const [state, setState] = useState(seed);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          const data = JSON.parse(raw);
          if (
            data.version === 1 &&
            Array.isArray(data.creators) &&
            Array.isArray(data.workouts) &&
            Array.isArray(data.memberships)
          )
            setState(data);
          else setError("Saved data was incompatible and has been reset.");
        }
      })
      .catch(() =>
        setError("Saved data could not be loaded and has been reset."),
      )
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready) {
      queue.current = queue.current
        .then(() => AsyncStorage.setItem(KEY, JSON.stringify(state)))
        .catch(() => {
          setError(
            "Changes could not be saved on this device. Please check available storage.",
          );
        });
    }
  }, [state, ready]);
  return (
    <Context
      value={{
        state,
        ready,
        error,
        apply: (transition) => setState(transition),
        payments,
        reset: () => {
          setState(seed());
          setError("");
        },
      }}
    >
      {children}
    </Context>
  );
}
export function useStore() {
  const s = use(Context);
  if (!s) throw new Error("Missing TrainWith provider");
  return s;
}
