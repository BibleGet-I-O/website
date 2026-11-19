import "server-only";
import { cookies, headers } from "next/headers";
import { getToken, type JWT } from "next-auth/jwt";
import { unstable_rethrow } from "next/navigation";
import { auth } from "@/auth";
import { encodeSessionCookie, isSessionChunk, resolveAccessToken, SESSION_MAX_AGE } from "@/lib/session-token";
import type { Access } from "@/lib/types";
import { isExpired } from "@/lib/zitadel-token";

export type AccessInfo = { access: Access; signedIn: boolean; emailVerified: boolean };

/**
 * Which API key the page uses. `reader` only for a signed-in user whose email is
 * verified; a session whose refresh was rejected counts as signed out. Any failure
 * to read the session means visitor pages, never an error page.
 */
export async function getAccess(): Promise<AccessInfo> {
  let session = null;
  try {
    session = await auth();
  } catch (err) {
    unstable_rethrow(err);
    console.warn(`[access] could not read the session; serving visitor pages (${errorName(err)})`);
  }
  const signedIn = Boolean(session?.user) && !session?.error;
  const emailVerified = signedIn && session?.emailVerified === true;
  return { access: signedIn && emailVerified ? "reader" : "visitor", signedIn, emailVerified };
}

/** AUTH_URL decides the cookie name Auth.js used (`__Secure-` on https), not the request scheme behind a proxy. */
function secureCookie(): boolean {
  return (process.env.AUTH_URL ?? "").startsWith("https://");
}

/**
 * The Zitadel access token, for server code only (Server Actions, Route Handlers,
 * Server Components); never return it to a client component or put it in a
 * response body. Read from the encrypted session cookie, not from auth(), whose
 * Session is browser-readable.
 *
 * An expired token is refreshed only where the refreshed cookie can be written
 * (a Server Action or Route Handler): Zitadel rotates refresh tokens, so a
 * refresh in a Server Component, which cannot set cookies, would spend the
 * refresh token and keep nothing. There it returns null instead.
 */
export async function getAccessToken(): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const secure = secureCookie();

  let token: JWT | null = null;
  try {
    token = await getToken({ req: { headers: await headers() }, secret, secureCookie: secure });
  } catch (err) {
    unstable_rethrow(err);
    console.warn(`[access] could not read the session token (${errorName(err)})`);
    return null;
  }
  if (!token) return null;

  if (token.error || typeof token.access_token !== "string" || !token.access_token) return null;
  if (!isExpired(token.expires_at, Date.now())) return token.access_token;

  // Expired: refresh only where the result can be kept.
  const store = await cookies();
  if (!canWriteCookies(store)) return null;
  const { accessToken, persist } = await resolveAccessToken(token);
  if (persist) await persistSession(store, persist, secret, secure);
  return accessToken ?? null;
}

type CookieStore = Awaited<ReturnType<typeof cookies>>;

const PROBE = "bg-cookie-probe";

/** Next throws on set() while rendering a Server Component; an expired probe cookie is harmless elsewhere. */
function canWriteCookies(store: CookieStore): boolean {
  try {
    store.set(PROBE, "", { path: "/", maxAge: 0 });
    return true;
  } catch {
    return false;
  }
}

async function persistSession(store: CookieStore, token: JWT, secret: string, secure: boolean): Promise<void> {
  try {
    const encoded = await encodeSessionCookie(token, { secret, secure });
    if (!encoded) return;
    const attrs = { path: "/", httpOnly: true, sameSite: "lax" as const, secure };
    store.set(encoded.name, encoded.value, { ...attrs, maxAge: SESSION_MAX_AGE });
    // Chunked cookies from an earlier, larger session would be joined with ours by getToken.
    for (const { name } of store.getAll()) {
      if (isSessionChunk(name, secure)) store.set(name, "", { ...attrs, maxAge: 0 });
    }
  } catch (err) {
    console.warn(`[access] could not persist the session token (${errorName(err)})`);
  }
}

function errorName(err: unknown): string {
  return err instanceof Error ? err.name : "unknown error";
}
