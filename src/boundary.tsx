import React from "react";
import { View } from "react-native";
import { C, T, Button, Card } from "./ui";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Catches render and lifecycle errors below the app shell.
 *
 * Without this, a thrown error unmounts the whole tree: blank white on web,
 * a redbox then a blank screen on native. Persisted state is untouched by a
 * render failure, so retrying re-mounts the tree and usually recovers.
 *
 * Errors are reported to the console. Wire a crash reporter into
 * componentDidCatch before release so failures on real devices are visible.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("TrainWith crashed:", error, info.componentStack);
  }

  retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: C.bg,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Card style={{ maxWidth: 420, width: "100%" }}>
          <T size={22} bold>
            That didn’t go to plan.
          </T>
          <T color={C.muted}>
            Something broke while loading this screen. Your saved workouts and
            memberships are safe on this device.
          </T>
          <Button title="Try again" onPress={this.retry} />
        </Card>
      </View>
    );
  }
}
