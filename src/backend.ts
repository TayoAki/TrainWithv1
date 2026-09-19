import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { adultAgeSource } from "./age-policy";

export const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === "true";
export const appWebUrl = (
  process.env.EXPO_PUBLIC_WEB_URL ||
  (typeof window !== "undefined" ? window.location.origin : "")
).replace(/\/$/, "");
export const apiUrl = (process.env.EXPO_PUBLIC_API_URL || "").replace(
  /\/$/,
  "",
);
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Browser sessions stay in memory. Native sessions use the encrypted OS store.
// Persistent browser login can be added with a reviewed same-site cookie/BFF flow.
const memory = new Map<string, string>();
const storage = {
  getItem: (key: string) =>
    Platform.OS === "web"
      ? Promise.resolve(memory.get(key) || null)
      : SecureStore.getItemAsync(key),
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") memory.set(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") memory.delete(key);
    else await SecureStore.deleteItemAsync(key);
  },
};
export const authClient =
  !demoMode && supabaseUrl && publicKey
    ? createClient(supabaseUrl, publicKey, {
        auth: {
          storage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;
export async function api<T>(path: string, body?: unknown): Promise<T> {
  if (!apiUrl) throw new Error("The API URL has not been configured.");
  if (path === "/v1/videos/playback" || path === "/v1/billing/checkout")
    await adultAgeSource();
  const { data } =
    authClient && !path.startsWith("/public/")
      ? await authClient.auth.getSession()
      : { data: { session: null } };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(data.session
          ? { Authorization: `Bearer ${data.session.access_token}` }
          : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.message || "The server could not complete this request.",
      );
    return result as T;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError")
      throw new Error("The request timed out. Please try again.");
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
