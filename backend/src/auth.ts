import { createClient } from "@supabase/supabase-js";
import type { Config } from "./config.js";
import { ApiError } from "./errors.js";
export type Identity = { id: string; email: string; name: string };
export type Authenticate = (token: string) => Promise<Identity>;
export function createAuthenticator(c: Config): Authenticate {
  const client = createClient(c.SUPABASE_URL, c.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return async (token) => {
    const { data, error } = await client.auth.getUser(token);
    if (
      error ||
      !data.user ||
      !data.user.email_confirmed_at ||
      !data.user.email
    )
      throw new ApiError(
        401,
        "UNAUTHENTICATED",
        "Sign in with a verified email address.",
      );
    return {
      id: data.user.id,
      email: data.user.email,
      name: String(data.user.user_metadata.name || "Member").slice(0, 100),
    };
  };
}
