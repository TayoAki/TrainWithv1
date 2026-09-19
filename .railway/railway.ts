import { defineRailway, project, service } from "railway/iac";

// This partial manages only the API; frontend hosting can live separately.
export const partial = "api";

export default defineRailway(() => {
  const api = service("api", {
    start: "node backend/dist/index.js",
    healthcheck: "/readyz",
    healthcheckTimeout: 120,
    // The root Dockerfile is auto-detected. Secrets are configured separately.
  });
  return project("TrainWith", {
    resources: [api],
  });
});
