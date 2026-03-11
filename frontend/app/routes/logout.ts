import { type ActionFunctionArgs, redirect } from "react-router";
import { ApiClient } from "~/lib/api.server";

export function loader() {
  throw redirect("/login");
}

export async function action({ request }: ActionFunctionArgs) {
  const api = new ApiClient(request.headers.get("Cookie") ?? "");
  await api.post("/auth/logout", {});

  // ApiClient discards response headers, so the backend's Set-Cookie clear headers never
  // reach the browser. We clear the cookies ourselves in the redirect response.
  const headers = new Headers();
  headers.append("Set-Cookie", "access_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict");
  headers.append("Set-Cookie", "csrf_token=; Max-Age=0; Path=/; SameSite=Strict");
  throw redirect("/login", { headers });
}
