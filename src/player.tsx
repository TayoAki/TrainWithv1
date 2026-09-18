import React, { useEffect, useState, useCallback } from "react";
import { View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import { useFocusEffect } from "expo-router";
import { DEMO_VIDEO } from "./data";
import { resolveVideo } from "./media";
import { Notice, Button, C, T } from "./ui";
export function WorkoutPlayer({ uri, photo }: { uri: string; photo: string }) {
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let resolved = "";
    resolveVideo(uri)
      .then((u) => {
        resolved = u;
        if (active) setSource(u);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      if (resolved.startsWith("blob:")) URL.revokeObjectURL(resolved);
    };
  }, [uri]);
  return (
    <View style={{ gap: 10 }}>
      {error ? (
        <Notice error>{error}</Notice>
      ) : source ? (
        <Player key={source} uri={source} />
      ) : (
        <Notice>Preparing video…</Notice>
      )}
      {uri === DEMO_VIDEO && (
        <T size={11} color={C.muted}>
          Sample player footage, not fitness instruction. Add your own workout
          video in Creator Studio.
        </T>
      )}
    </View>
  );
}
function Player({ uri }: { uri: string }) {
  const source =
    uri === DEMO_VIDEO ? require("../assets/demo-session.mp4") : uri;
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
  });
  useFocusEffect(
    useCallback(
      () => () => {
        player.pause();
      },
      [player],
    ),
  );
  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });
  return (
    <View style={{ gap: 10 }}>
      <VideoView
        player={player}
        style={{
          width: "100%",
          aspectRatio: 16 / 9,
          borderRadius: 16,
          backgroundColor: "#15221C",
        }}
        nativeControls
        allowsPictureInPicture
      />
      {status === "error" && (
        <>
          <Notice error>
            This video could not load. Check your connection or select another
            file in Creator Studio.
          </Notice>
          <Button
            title="Retry video"
            secondary
            onPress={() => player.replaceAsync(source)}
          />
        </>
      )}
    </View>
  );
}
