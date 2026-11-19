import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));

const getToken = vi.fn();
vi.mock("next-auth/jwt", async (orig) => ({ ...(await orig<object>()), getToken: (o: unknown) => getToken(o) }));

const cookieSet = vi.fn();
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: "authjs.session-token=abc" }),
  cookies: async () => ({ set: cookieSet, getAll: () => [{ name: "authjs.session-token", value: "abc" }] }),
}));

const { getAccess, getAccessToken } = await import("@/lib/access");

const signedIn = (emailVerified: boolean) => ({
  user: { email: "a@b.c" },
  expires: "2099-01-01",
  emailVerified,
  admin: false,
});

beforeEach(() => {
  auth.mockReset();
  getToken.mockReset();
  cookieSet.mockReset();
  vi.stubEnv("AUTH_SECRET", "test-auth-secret");
  vi.stubEnv("AUTH_URL", "http://localhost:3000");
});

describe("getAccess", () => {
  it("noSessionGetsVisitorAccess", async () => {
    auth.mockResolvedValue(null);
    expect(await getAccess()).toEqual({ access: "visitor", signedIn: false, emailVerified: false });
  });

  it("unverifiedUserGetsVisitorAccess", async () => {
    auth.mockResolvedValue(signedIn(false));
    expect(await getAccess()).toEqual({ access: "visitor", signedIn: true, emailVerified: false });
  });

  it("verifiedUserGetsReaderAccess", async () => {
    auth.mockResolvedValue(signedIn(true));
    expect(await getAccess()).toEqual({ access: "reader", signedIn: true, emailVerified: true });
  });

  it("gives visitor access to a session whose refresh was rejected", async () => {
    auth.mockResolvedValue({ ...signedIn(true), error: "RefreshAccessTokenError" });
    expect(await getAccess()).toEqual({ access: "visitor", signedIn: false, emailVerified: true });
  });

  it("gives visitor access when the session cannot be read", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    auth.mockRejectedValue(new Error("JWTSessionError"));
    expect(await getAccess()).toEqual({ access: "visitor", signedIn: false, emailVerified: false });
    warn.mockRestore();
  });
});

describe("getAccessToken", () => {
  const now = Math.floor(Date.now() / 1000);

  it("returns null without a session token", async () => {
    getToken.mockResolvedValue(null);
    expect(await getAccessToken()).toBeNull();
  });

  it("returns an unexpired access token and writes no cookie", async () => {
    getToken.mockResolvedValue({ sub: "u1", access_token: "AT", refresh_token: "RT", expires_at: now + 3600 });
    expect(await getAccessToken()).toBe("AT");
    expect(cookieSet).not.toHaveBeenCalled();
    // Reads the cookie Auth.js wrote for AUTH_URL's scheme.
    expect(getToken).toHaveBeenCalledWith(expect.objectContaining({ secureCookie: false }));
  });

  it("does not refresh an expired token where cookies cannot be written (a Server Component)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    cookieSet.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
    });
    getToken.mockResolvedValue({ sub: "u1", access_token: "AT", refresh_token: "RT-sc", expires_at: now - 10 });
    expect(await getAccessToken()).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("refreshes an expired token where cookies can be written and persists the session cookie", async () => {
    vi.stubEnv("AUTH_ZITADEL_ISSUER", "https://issuer.test");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "AT2", refresh_token: "RT2", expires_in: 3600 }), { status: 200 }),
    );
    getToken.mockResolvedValue({ sub: "u1", access_token: "AT", refresh_token: "RT-action", expires_at: now - 10 });

    expect(await getAccessToken()).toBe("AT2");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const written = cookieSet.mock.calls.find(([name]) => name === "authjs.session-token");
    expect(written).toBeDefined();
    expect(written?.[2]).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", secure: false });
    expect(written?.[1]).not.toContain("AT2");
    fetchSpy.mockRestore();
  });
});
