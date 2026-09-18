import { useLocalSearchParams } from "expo-router";
import { AppScreen } from "../../src/screens";
export default function Screen() {
  const { page, id } = useLocalSearchParams<{
    page: string;
    id?: string;
  }>();
  return <AppScreen key={`${page}-${id || ""}`} screen={page} id={id} />;
}
