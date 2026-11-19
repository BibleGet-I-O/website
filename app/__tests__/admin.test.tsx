import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth(), signIn: vi.fn(), signOut: vi.fn() }));
const getAccessToken = vi.fn();
vi.mock("@/lib/access", () => ({ getAccessToken: () => getAccessToken() }));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<object>("next/navigation")),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  unstable_rethrow: (e: unknown) => {
    throw e;
  },
}));
const setFullTextMock = vi.fn();
vi.mock("@/app/[locale]/admin/editions/actions", async (orig) => ({
  ...(await orig<object>()),
  setFullText: (...a: unknown[]) => setFullTextMock(...a),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
process.env.BIBLEGET_API_URL = "https://api.test/dev";

const { default: AdminPage } = await import("@/app/[locale]/admin/editions/page");
const { FullTextSwitch } = await import("@/components/FullTextSwitch");
const actions = await vi.importActual<typeof import("@/app/[locale]/admin/editions/actions")>("@/app/[locale]/admin/editions/actions");

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {ui}
  </NextIntlClientProvider>
);
const params = Promise.resolve({ locale: "en" });
const versions = {
  versions: [
    { sigla: "NABRE", fullname: "New American Bible", year: 2011, language: "en", copyright: true, reader_full_text: true },
    { sigla: "VGCL", fullname: "Vulgate", year: 1598, language: "la", copyright: false, reader_full_text: false },
  ],
  total: 2,
};
const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  for (const m of [auth, getAccessToken, revalidatePath, setFullTextMock, fetchMock]) m.mockReset();
  auth.mockResolvedValue({ user: { email: "a@b.c" }, expires: "2099", emailVerified: true, admin: true });
  getAccessToken.mockResolvedValue("tok123");
});

describe("admin page", () => {
  it("nonAdminGets404", async () => {
    auth.mockResolvedValue({ user: { email: "a@b.c" }, expires: "2099", emailVerified: true, admin: false });
    await expect(AdminPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
    auth.mockResolvedValue(null);
    await expect(AdminPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("listsEditionsWithCopyrightAndSwitchState", async () => {
    fetchMock.mockResolvedValue(json(200, versions));
    render(wrap(await AdminPage({ params })));
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/dev/admin/versions");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok123");
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("NABRE");
    expect(rows[1]).toHaveTextContent("Copyrighted");
    expect(screen.getByRole("switch", { name: /NABRE/ })).toBeChecked();
    expect(screen.getByRole("switch", { name: /VGCL/ })).not.toBeChecked();
  });

  it("asks to sign in again when there is no access token", async () => {
    getAccessToken.mockResolvedValue(null);
    render(wrap(await AdminPage({ params })));
    expect(screen.getByText(en.Admin.signInAgain)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows an error when the endpoint refuses the list", async () => {
    fetchMock.mockResolvedValue(json(403));
    render(wrap(await AdminPage({ params })));
    expect(screen.getByRole("alert")).toHaveTextContent(en.Admin.listFailed);
  });
});

describe("setFullText", () => {
  it("switchCallsPatchWithTheAccessTokenAndRevalidates", async () => {
    fetchMock.mockResolvedValue(json(200, versions.versions[0]));
    const res = await actions.setFullText("NABRE", false);
    expect(res).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/dev/admin/versions/NABRE");
    expect(init.method).toBe("PATCH");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(JSON.parse(init.body)).toEqual({ reader_full_text: false });
    expect(revalidatePath).toHaveBeenCalled();
    expect(JSON.stringify(res)).not.toContain("tok123");
  });

  it("returns the status and does not revalidate on a refusal", async () => {
    fetchMock.mockResolvedValue(json(403));
    expect(await actions.setFullText("NABRE", false)).toEqual({ ok: false, status: 403 });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses without an admin session or token, without calling the endpoint", async () => {
    auth.mockResolvedValue({ user: {}, expires: "2099", admin: false });
    expect(await actions.setFullText("NABRE", false)).toEqual({ ok: false, status: 403 });
    auth.mockResolvedValue({ user: {}, expires: "2099", admin: true });
    getAccessToken.mockResolvedValue(null);
    expect(await actions.setFullText("NABRE", false)).toEqual({ ok: false, status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a network failure as status 0", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    expect(await actions.setFullText("NABRE", false)).toEqual({ ok: false, status: 0 });
  });
});

describe("FullTextSwitch", () => {
  it("forbiddenFromTheEndpointShowsAnError", async () => {
    setFullTextMock.mockResolvedValue({ ok: false, status: 403 });
    render(wrap(<FullTextSwitch sigla="NABRE" initial={true} />));
    const sw = screen.getByRole("switch", { name: /NABRE/ });
    fireEvent.click(sw);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(en.Admin.forbidden));
    expect(sw).toBeChecked();
    expect(setFullTextMock).toHaveBeenCalledWith("NABRE", false);
  });

  it("keeps the new state after success", async () => {
    setFullTextMock.mockResolvedValue({ ok: true });
    render(wrap(<FullTextSwitch sigla="NABRE" initial={true} />));
    const sw = screen.getByRole("switch", { name: /NABRE/ });
    fireEvent.click(sw);
    await waitFor(() => expect(sw).not.toBeChecked());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
