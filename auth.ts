import NextAuth, { type NextAuthConfig } from "next-auth";
import Zitadel from "next-auth/providers/zitadel";
import type { ZitadelToken } from "@/lib/zitadel-token";
import { isAdmin, isReviewer, ROLES_CLAIM } from "@/lib/roles";

// Exported so the callbacks can be unit tested without booting a provider.
// The test that matters asserts the access token never reaches the Session —
// see lib/__tests__/auth-callbacks.test.ts. Auth.js serves whatever the session
// callback returns as the body of GET /api/auth/session, so that property is a
// security boundary, not a style choice, and it needs a permanent guard.
export const callbacks = {
  async jwt({ token, account, profile }) {
    // Initial sign-in: account is present exactly once.
    if (account) {
      const claims = profile as Record<string, unknown> | undefined;
      return {
        ...token,
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
        // From the ID token: Zitadel access tokens carry no email claims. Only a
        // literal true counts. Read once, at sign-in: verifying later needs a fresh sign-in.
        emailVerified: claims?.email_verified === true,
        // A boolean only, never the roles claim: the Session copies it.
        admin: isAdmin(claims?.[ROLES_CLAIM]),
        reviewer: isReviewer(claims?.[ROLES_CLAIM]),
      };
    }
    // Deliberately no refresh here. This callback also runs under auth() in
    // Server Components, and there Auth.js throws away the Set-Cookie: a
    // refresh would spend Zitadel's rotating refresh token and keep nothing.
    // getAccessToken() (lib/access.ts) refreshes where it can persist the cookie.
    return token;
  },
  async session({ session, token }) {
    // NEVER put the access or refresh token here. Auth.js sets the session
    // callback's return value as the response body of GET /api/auth/session,
    // so anything on the session is readable by the browser. Server code reads
    // the token from the encrypted JWT cookie through getAccessToken() instead.
    //
    // Built from scratch so only whitelisted keys can ever leave: `error` is a
    // string like "RefreshAccessTokenError", and the flags are booleans.
    const current = token as ZitadelToken;
    return {
      user: session.user,
      expires: session.expires,
      ...(current.error ? { error: current.error } : {}),
      emailVerified: token.emailVerified === true,
      admin: token.admin === true,
      reviewer: token.reviewer === true,
    };
  },
} satisfies NonNullable<NextAuthConfig["callbacks"]>;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Zitadel({
      issuer: process.env.AUTH_ZITADEL_ISSUER,
      clientId: process.env.AUTH_ZITADEL_ID,
      clientSecret: process.env.AUTH_ZITADEL_SECRET,
      client: { token_endpoint_auth_method: "client_secret_post" },
      // offline_access is what makes Zitadel return a refresh token.
      // prompt=select_account shows Zitadel's account picker even while its own
      // SSO session is alive, so signing in after signing out can switch account.
      authorization: {
        params: { scope: "openid email profile offline_access", prompt: "select_account" },
      },
    }),
  ],
  // Behind a reverse proxy in production; AUTH_URL pins the public origin.
  trustHost: true,
  // JWT strategy: the tokens live in the encrypted HttpOnly cookie Auth.js manages.
  session: { strategy: "jwt" },
  callbacks,
});
