import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { useStore } from "./store";
import { C, Shell, Notice, Empty, Button, go } from "./ui";
import * as Consumer from "./consumer";
import * as Creator from "./creator";
export type ScreenProps = { id?: string; handle?: string };
const creators: Record<string, React.ComponentType<ScreenProps>> = {
  studio: Creator.Studio,
  content: Creator.Content,
  members: Creator.Members,
  earnings: Creator.Earnings,
  "creator-profile": Creator.CreatorProfile,
  upload: Creator.UploadScreen,
  "workout-editor": Creator.WorkoutEditor,
  "program-editor": Creator.ProgramEditor,
  "creator-price": Creator.CreatorPrice,
  "creator-payout": Creator.CreatorPayout,
  "creator-publish": Creator.CreatorPublish,
  "creator-share": Creator.CreatorShare,
  "creator-settings": Creator.CreatorSettings,
};
const screens: Record<string, React.ComponentType<ScreenProps>> = {
  discover: Consumer.Discover,
  channel: Consumer.Channel,
  program: Consumer.ProgramScreen,
  workout: Consumer.WorkoutScreen,
  complete: Consumer.Complete,
  auth: Consumer.Auth,
  membership: Consumer.Membership,
  joined: Consumer.Joined,
  "my-workouts": Consumer.MyWorkouts,
  profile: Consumer.Profile,
  memberships: Consumer.Memberships,
  "manage-membership": Consumer.ManageMembership,
  "edit-profile": Consumer.EditProfile,
  support: Consumer.Support,
  settings: Consumer.AppSettings,
  "creator-start": Creator.CreatorStart,
  "creator-handle": Creator.CreatorHandle,
};
export function AppScreen({
  screen,
  id,
  handle,
}: {
  screen: string;
  id?: string;
  handle?: string;
}) {
  const { state, ready, error } = useStore();
  const router = useRouter();
  if (!ready)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: C.bg,
        }}
      >
        <ActivityIndicator color={C.green} />
      </View>
    );
  if ((creators[screen] || screen === "preview") && !state.ownedId)
    return <Creator.CreatorStart />;
  if (screen === "preview")
    return <Consumer.Channel id={state.ownedId!} preview />;
  const Screen = creators[screen] || screens[screen];
  return (
    <View style={{ flex: 1 }}>
      {!!error && <Notice error>{error}</Notice>}
      {Screen ? (
        <Screen id={id} handle={handle} />
      ) : (
        <Shell back>
          <Empty
            title="Let’s find your way back"
            description="This page isn’t available."
            action={
              <Button
                title="Discover coaches"
                onPress={() => go(router, "discover")}
              />
            }
          />
        </Shell>
      )}
    </View>
  );
}
