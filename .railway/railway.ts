import { defineRailway, preserve, project, service } from "railway/iac";

// Keep the partial name stable so existing staging resources remain managed.
export const partial = "api";

export default defineRailway(() => {
  const api = service("api", {
    start: "node backend/dist/index.js",
    healthcheck: "/readyz",
    healthcheckTimeout: 120,
    env: {
      DATABASE_URL: preserve(),
      DATABASE_CA_CERT: preserve(),
      SUPABASE_URL: preserve(),
      SUPABASE_PUBLISHABLE_KEY: preserve(),
      SUPABASE_SERVICE_ROLE_KEY: preserve(),
      IOS_EXTERNAL_CHECKOUT: preserve(),
      LEGAL_OPERATOR_NAME: preserve(),
      SUPPORT_EMAIL: preserve(),
      ADMIN_USER_IDS: preserve(),
      STRIPE_SECRET_KEY: preserve(),
      PLATFORM_FEE_PERCENT: preserve(),
      PORT: preserve(),
      RUN_WORKER: preserve(),
      APP_URL: preserve(),
      ALLOWED_ORIGINS: preserve(),
      NODE_ENV: preserve(),
      MUX_TOKEN_ID: preserve(),
      MUX_TOKEN_SECRET: preserve(),
      MUX_SIGNING_KEY_ID: preserve(),
      MUX_SIGNING_PRIVATE_KEY: preserve(),
      MUX_WEBHOOK_SECRET: preserve(),
      STRIPE_WEBHOOK_SECRET: preserve(),
      STRIPE_CONNECT_WEBHOOK_SECRET: preserve(),
      STRIPE_PORTAL_CONFIGURATION_ID: preserve(),
    },
    // The root Dockerfile is auto-detected. Secrets are configured separately.
  });
  const web = service("web", {
    start: "caddy run --config /etc/caddy/Caddyfile --adapter caddyfile",
    healthcheck: "/healthz",
    healthcheckTimeout: 120,
    env: {
      RAILWAY_DOCKERFILE_PATH: preserve(),
      PORT: preserve(),
      EXPO_PUBLIC_DEMO_MODE: preserve(),
      EXPO_PUBLIC_API_URL: preserve(),
      EXPO_PUBLIC_WEB_URL: preserve(),
      EXPO_PUBLIC_SUPABASE_URL: preserve(),
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: preserve(),
    },
  });
  return project("TrainWith", {
    resources: [api, web],
  });
});
