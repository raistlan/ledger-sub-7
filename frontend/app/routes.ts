import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.ts"),
  route("reports", "routes/reports.tsx"),
  route("settings", "routes/settings.tsx"),
  route("*", "routes/$.tsx"),
] satisfies RouteConfig;
