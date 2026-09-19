import { Platform } from "react-native";
import * as AgeRange from "expo-age-range";

export async function adultAgeSource(): Promise<
  "self_declared" | "apple_age_range"
> {
  if (
    Platform.OS !== "ios" ||
    Number.parseInt(String(Platform.Version), 10) < 26
  )
    return "self_declared";
  // Never use Expo's unsupported-platform adult fallback as verified age.
  const result = await AgeRange.requestAgeRangeAsync({ threshold1: 18 });
  if (result.lowerBound === null || result.lowerBound < 18)
    throw new Error(
      "TrainWith's beta is for adults 18 and over. Share an eligible age range to continue.",
    );
  return "apple_age_range";
}
