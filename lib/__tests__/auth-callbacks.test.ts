import { describe, it, expect, vi, afterEach } from "vitest";

// auth.ts reads these at module load; dummy values suffice for unit tests.
vi.stubEnv("AUTH_ZITADEL_ISSUER", "https://issuer.test");
vi.stubEnv("AUTH_ZITADEL_ID", "test-client");
vi.stubEnv("AUTH_ZITADEL_SECRET", "test-secret");
vi.stubEnv("AUTH_SECRET", "test-auth-secret");

const { callbacks } = await import("@/auth");

const ROLES = "urn:zitadel:iam:org:project:roles";
const token = {
  access_token: "SECRET-TOKEN",
  refresh_token: "SECRET-REFRESH",
  expires_at: 9_999_999_999,
  error: undefined,
};
const account = { provider: "zitadel", type: "oidc", providerAccountId: "user-1", access_token: "AT" };
const session = () => ({ user: { email: "a@b.c" }, expires: "2099-01-01" });

describe("session callback", () => {
  it("sessionNeverCarriesTheAccessToken", async () => {
    const result = await callbacks.session({
      session: session(),
      token: { ...token, emailVerified: true, admin: true },
    } as never);

    // Auth.js returns this object as the body of GET /api/auth/session.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("SECRET-TOKEN");
    expect(serialized).not.toContain("SECRET-REFRESH");
    expect(serialized).not.toContain("access_token");
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("refresh_token");
  });

  it("passes the refresh error through, which is not sensitive", async () => {
    const result = await callbacks.session({
      session: session(),
      token: { ...token, error: "RefreshAccessTokenError" },
    } as never);
    expect((result as { error?: string }).error).toBe("RefreshAccessTokenError");
  });

  it("exposes emailVerified and admin as booleans, and never the roles claim", async () => {
    const result = await callbacks.session({
      session: session(),
      token: { ...token, emailVerified: true, admin: true, [ROLES]: { bibleget_admin: {} } },
    } as never);
    expect(result).toMatchObject({ emailVerified: true, admin: true });
    expect(JSON.stringify(result)).not.toContain("urn:zitadel");
  });

  it("defaults emailVerified and admin to false when the token lacks them", async () => {
    const result = await callbacks.session({ session: session(), token } as never);
    expect(result).toMatchObject({ emailVerified: false, admin: false });
  });

  it("has only whitelisted keys, even when the token carries secrets and roles", async () => {
    const result = await callbacks.session({
      session: session(),
      token: { ...token, admin: true, emailVerified: true, [ROLES]: { bibleget_admin: {} }, roles: ["x"] },
    } as never);
    const allowed = ["user", "expires", "error", "emailVerified", "admin"];
    expect(Object.keys(result).filter((k) => !allowed.includes(k))).toEqual([]);
  });
});

describe("jwt callback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps the provider tokens onto the JWT at sign-in", async () => {
    const result = await callbacks.jwt({
      token: { sub: "user-1", email: "a@b.c" },
      account: { ...account, access_token: "AT", refresh_token: "RT", expires_at: 1_700_000_000 },
    } as never);

    expect(result).toEqual({
      sub: "user-1",
      email: "a@b.c",
      access_token: "AT",
      refresh_token: "RT",
      expires_at: 1_700_000_000,
      emailVerified: false,
      admin: false,
    });
  });

  it("jwtStoresEmailVerifiedAndAdminFromTheProfile", async () => {
    const result = await callbacks.jwt({
      token: { sub: "user-1" },
      account,
      profile: { email_verified: true, [ROLES]: { bibleget_admin: { "1": "x" } } },
    } as never);
    expect(result).toMatchObject({ emailVerified: true, admin: true });
    expect(Object.keys(result as object)).not.toContain(ROLES);
    expect(Object.keys(result as object)).not.toContain("email_verified");

    const unverified = await callbacks.jwt({
      token: { sub: "user-1" },
      account,
      profile: { email_verified: false, [ROLES]: { developer: {} } },
    } as never);
    expect(unverified).toMatchObject({ emailVerified: false, admin: false });
  });

  it("treats only a literal true as verified, and a missing or malformed roles claim as no admin", async () => {
    for (const profile of [{}, { email_verified: "true", [ROLES]: "bibleget_admin" }, undefined]) {
      const result = await callbacks.jwt({ token: { sub: "user-1" }, account, profile } as never);
      expect(result).toMatchObject({ emailVerified: false, admin: false });
    }
  });

  it("returns the token unchanged on later calls, without refreshing even when expired", async () => {
    // Refresh lives in getAccessToken(), which can persist the result only from a
    // server action or route handler; under auth() in a Server Component it would be thrown away.
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const expiredToken = { ...token, expires_at: 1_000 };

    const result = await callbacks.jwt({ token: expiredToken } as never);

    expect(result).toBe(expiredToken);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
