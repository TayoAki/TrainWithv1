import { requireOptionalNativeModule } from "expo";
export default requireOptionalNativeModule<{
  getCountryCode(): Promise<string | null>;
}>("TrainWithStorefront");
