import React, { useState } from "react";
import { useRouter } from "expo-router";
import { authClient } from "./backend";
import { useStore } from "./store";
import { Shell, Heading, Field, Button, Notice, T, C, go } from "./ui";
export function ConnectedAuth({ id }: { id?: string }) {
  const [mode, setMode] = useState<"signin" | "signup" | "verify">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { refresh } = useStore();
  const submit = async () => {
    if (!authClient) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signup") {
        if (!name.trim()) throw new Error("Enter your name.");
        const { data, error } = await authClient.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          setMode("verify");
          setMessage("Check your email for the confirmation link or code.");
          return;
        }
      } else if (mode === "verify") {
        const { error } = await authClient.auth.verifyOtp({
          email: email.trim(),
          token: code.trim(),
          type: "signup",
        });
        if (error) throw error;
      } else {
        const { error } = await authClient.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
      if (await refresh())
        go(
          router,
          id === "creator" ? "creator-start" : id ? "membership" : "profile",
          id === "creator" ? undefined : id,
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell back title="Your TrainWith account">
      <Heading
        title={
          mode === "signup"
            ? "Make room for you."
            : mode === "verify"
              ? "Check your inbox."
              : "Welcome back."
        }
        description="Your memberships and training, together across your devices."
      />
      {mode === "signup" && (
        <Field label="Your name" value={name} onChange={setName} />
      )}
      <Field
        label="Email address"
        value={email}
        onChange={setEmail}
        keyboardType="email-address"
      />
      {mode === "verify" ? (
        <Field label="Confirmation code" value={code} onChange={setCode} />
      ) : (
        <Field
          label="Password"
          value={password}
          onChange={setPassword}
          secureTextEntry
        />
      )}
      {!!error && <Notice error>{error}</Notice>}
      {!!message && <Notice>{message}</Notice>}
      <Button
        title={
          mode === "signin"
            ? "Sign in"
            : mode === "signup"
              ? "Create account"
              : "Verify email"
        }
        loading={busy}
        onPress={() => void submit()}
      />
      <Button
        secondary
        title={mode === "signin" ? "Create an account" : "Back to sign in"}
        onPress={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError("");
          setMessage("");
        }}
      />
      {mode === "verify" && (
        <T color={C.muted}>
          If your email contains a link, open it to confirm your address, then
          return here and sign in.
        </T>
      )}
      <T size={12} color={C.muted}>
        During setup, email delivery uses Supabase’s default service. Public
        signups need a configured email provider.
      </T>
    </Shell>
  );
}
