Pod::Spec.new do |s|
  s.name           = 'TrainWithStorefront'
  s.version        = '1.0.0'
  s.summary        = 'TrainWith App Store storefront'
  s.description    = 'Read StoreKit storefront eligibility for external browser checkout'
  s.author         = 'TrainWith'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: 'https://github.com/TayoAki/TrainWithv1.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
