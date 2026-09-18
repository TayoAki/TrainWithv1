import { useLocalSearchParams } from "expo-router";
import { AppScreen } from "../src/screens";
export default function Channel() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  return <AppScreen key={handle} screen="channel" handle={handle} />;
}
