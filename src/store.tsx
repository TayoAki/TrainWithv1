import React, { createContext, use, useEffect, useState, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, seed } from "./data";
const KEY = "trainwith.demo.v1";
type Store = {
  state: AppState;
  ready: boolean;
  error: string;
  update: (fn: (s: AppState) => AppState) => void;
  reset: () => void;
};
const Context = createContext<Store | null>(null);
export function Provider({ children }: { children: React.ReactNode }) {
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
          else
            setError(
              "Saved demo data was incompatible. A fresh demo is ready.",
            );
        }
      })
      .catch(() =>
        setError("Saved data could not be loaded. A fresh demo is ready."),
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
        update: (fn) => setState(fn),
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
