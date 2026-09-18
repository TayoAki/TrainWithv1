// Flat config. Expo's shared rules, with Prettier last so formatting
// concerns stay in Prettier rather than being reported twice.
const expo = require("eslint-config-expo/flat");
const prettier = require("eslint-config-prettier");

module.exports = [
  ...expo,
  prettier,
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "dist-native/**",
      ".expo/**",
      "expo-env.d.ts",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // The design system and screens are fully typed; keep it that way.
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Test harnesses run under Node, not the app runtime.
    files: ["tests/**"],
    languageOptions: {
      globals: { require: "readonly", module: "writable", process: "readonly" },
    },
    rules: { "no-console": "off" },
  },
];
