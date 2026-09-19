import { Platform } from "react-native";
import storefront from "../modules/trainwith-storefront/src/TrainWithStorefrontModule";
import { api } from "./backend";

export type PublicConfig = {
  policyVersion: string;
  minimumAge: number;
  iosStorefronts: string[];
  iosExternalCheckout: boolean;
  sandbox: boolean;
  operatorName: string;
  supportEmail: string | null;
  legalIdentityConfigured: boolean;
};
export type PurchaseClient = {
  platform: "web" | "ios" | "android";
  storefront?: string;
};
export async function purchaseEligibility(): Promise<{
  allowed: boolean;
  client: PurchaseClient;
}> {
  if (Platform.OS === "web")
    return { allowed: true, client: { platform: "web" } };
  if (Platform.OS !== "ios" || !storefront)
    return {
      allowed: false,
      client: { platform: Platform.OS === "ios" ? "ios" : "android" },
    };
  try {
    const [country, config] = await Promise.all([
      storefront.getCountryCode(),
      api<PublicConfig>("/public/config"),
    ]);
    return {
      allowed: country === "USA" && config.iosExternalCheckout,
      client: { platform: "ios", ...(country ? { storefront: country } : {}) },
    };
  } catch {
    return { allowed: false, client: { platform: "ios" } };
  }
}
