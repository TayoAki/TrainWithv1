import ExpoModulesCore
import StoreKit

public class TrainWithStorefrontModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TrainWithStorefront")
    AsyncFunction("getCountryCode") { () async -> String? in
      let storefront = await Storefront.current
      return storefront?.countryCode
    }
  }
}
