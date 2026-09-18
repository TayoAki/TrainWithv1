import { useRouter } from "expo-router";
import { Shell, Empty, Button, go } from "../src/ui";
export default function NotFound() {
  const router = useRouter();
  return (
    <Shell back>
      <Empty
        title="Let’s find your way back"
        description="This page doesn’t exist."
        action={
          <Button
            title="Discover coaches"
            onPress={() => go(router, "discover")}
          />
        }
      />
    </Shell>
  );
}
