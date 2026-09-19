import React, { useState } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { useStore } from "./store";
import { uid } from "./data";
import { saveWorkout } from "./services";
import { selectUpload, sendUpload } from "./upload-remote";
import { Shell, Heading, Button, Notice, T, go } from "./ui";
export function ConnectedUpload({ workoutId }: { workoutId?: string }) {
  const { state, apply, refresh } = useStore();
  const router = useRouter();
  const c = state.creators.find((x) => x.id === state.ownedId)!;
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const upload = async () => {
    setBusy(true);
    setMessage("");
    setProgress(0);
    try {
      const selected = await selectUpload();
      if (!selected) return;
      const id = workoutId || uid("workout");
      if (
        !workoutId &&
        !(await apply(
          saveWorkout({
            id,
            creatorId: c.id,
            title: selected.name.replace(/\.[^.]+$/, ""),
            description: "",
            minutes: 20,
            equipment: "Mat",
            level: "Beginner",
            free: false,
            published: false,
            video: "",
            photo: c.photo,
          }),
        ))
      )
        return;
      await sendUpload(id, selected.file, setProgress);
      await refresh();
      go(router, "workout-editor", id);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not upload this video.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell creator back title="Upload a workout">
      <Heading
        title="Your next session starts here."
        description="Upload your video, then add the details your members need."
      />
      {Platform.OS === "web" ? (
        <>
          <T>Up to 5 GB and 3 hours. Keep this tab open while uploading.</T>
          <Button
            title={
              busy
                ? `Uploading ${Math.round(progress)}%`
                : "Choose video and upload"
            }
            loading={busy}
            onPress={() => void upload()}
          />
        </>
      ) : (
        <Notice>
          Use the web studio to upload videos. Your sessions will be available
          on all devices after processing.
        </Notice>
      )}
      {!!message && <Notice error>{message}</Notice>}
      <Notice>
        Videos become publishable after processing finishes. No sample footage
        is added to your channel.
      </Notice>
    </Shell>
  );
}
