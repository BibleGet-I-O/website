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
const refresh = vi.fn();
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<object>("next/navigation")),
  useRouter: () => ({ refresh }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  unstable_rethrow: (e: unknown) => {
    throw e;
  },
}));
const setFlagMock = vi.fn();
vi.mock("@/app/[locale]/admin/editions/actions", async (orig) => ({
  ...(await orig<object>()),
  setEditionFlag: (...a: unknown[]) => setFlagMock(...a),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
process.env.BIBLEGET_API_URL = "https://api.test/dev";

const { default: AdminPage } = await import("@/app/[locale]/admin/editions/page");
const { EditionFlagSwitch } = await import("@/components/EditionFlagSwitch");
const actions = await vi.importActual<typeof import("@/app/[locale]/admin/editions/actions")>("@/app/[locale]/admin/editions/actions");

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {ui}
  </NextIntlClientProvider>
);
const params = Promise.resolve({ locale: "en" });
const versions = {
  versions: [
    { sigla: "NABRE", fullname: "New American Bible", year: 2011, language: "en", copyright: true, reader_full_text: true, liturgical: true },
    { sigla: "VGCL", fullname: "Vulgate", year: 1598, language: "la", copyright: false, reader_full_text: false, liturgical: false },
  ],
  total: 2,
};
const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  for (const m of [auth, getAccessToken, revalidatePath, setFlagMock, fetchMock]) m.mockReset();
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
    expect(screen.getByRole("switch", { name: "Full text for NABRE" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Full text for VGCL" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Liturgical text for NABRE" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Liturgical text for VGCL" })).not.toBeChecked();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toContain(en.Admin.liturgical);
  });

  it("shows the liturgical switch off for an endpoint that omits the flag", async () => {
    fetchMock.mockResolvedValue(json(200, { versions: versions.versions.map(({ liturgical: _, ...v }) => v) }));
    render(wrap(await AdminPage({ params })));
    expect(screen.getByRole("switch", { name: "Liturgical text for NABRE" })).not.toBeChecked();
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

describe.each(["reader_full_text", "liturgical"] as const)("setEditionFlag(%s)", (field) => {
  it("switchCallsPatchWithTheAccessTokenAndRevalidates", async () => {
    fetchMock.mockResolvedValue(json(200, versions.versions[0]));
    const res = await actions.setEditionFlag("NABRE", field, false);
    expect(res).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/dev/admin/versions/NABRE");
    expect(init.method).toBe("PATCH");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(JSON.parse(init.body)).toEqual({ [field]: false });
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]/admin/editions", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]", "page");
    const chapters = revalidatePath.mock.calls.some((c) => c[0] === "/[locale]/read/[edition]/[book]/[chapter]");
    expect(chapters).toBe(field === "reader_full_text");
    expect(JSON.stringify(res)).not.toContain("tok123");
  });

  it("returns the status and does not revalidate on a refusal", async () => {
    fetchMock.mockResolvedValue(json(403));
    expect(await actions.setEditionFlag("NABRE", field, false)).toEqual({ ok: false, status: 403 });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses without an admin session or token, without calling the endpoint", async () => {
    auth.mockResolvedValue({ user: {}, expires: "2099", admin: false });
    expect(await actions.setEditionFlag("NABRE", field, false)).toEqual({ ok: false, status: 403 });
    auth.mockResolvedValue({ user: {}, expires: "2099", admin: true });
    getAccessToken.mockResolvedValue(null);
    expect(await actions.setEditionFlag("NABRE", field, false)).toEqual({ ok: false, status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid sigla or switch value with 400 before touching the token or endpoint", async () => {
    for (const sigla of ["..", "nabre", "A".repeat(17), "A", "NA/BRE"]) {
      expect(await actions.setEditionFlag(sigla, field, false)).toEqual({ ok: false, status: 400 });
    }
    expect(await actions.setEditionFlag("NABRE", field, "true" as unknown as boolean)).toEqual({ ok: false, status: 400 });
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a field outside the allow-list with 400", async () => {
    for (const bad of ["copyright", "", "__proto__", 1]) {
      expect(await actions.setEditionFlag("NABRE", bad as unknown as typeof field, false)).toEqual({ ok: false, status: 400 });
    }
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a network failure as status 0", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    expect(await actions.setEditionFlag("NABRE", field, false)).toEqual({ ok: false, status: 0 });
  });
});

describe.each([
  ["reader_full_text", "Full text for NABRE"],
  ["liturgical", "Liturgical text for NABRE"],
] as const)("EditionFlagSwitch(%s)", (field, label) => {
  it("forbiddenFromTheEndpointShowsAnError", async () => {
    setFlagMock.mockResolvedValue({ ok: false, status: 403 });
    render(wrap(<EditionFlagSwitch sigla="NABRE" field={field} initial={true} />));
    const sw = screen.getByRole("switch", { name: label });
    fireEvent.click(sw);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(en.Admin.forbidden));
    expect(sw).toBeChecked();
    expect(setFlagMock).toHaveBeenCalledWith("NABRE", field, false);
  });

  it("unauthorizedShowsTheSignInAgainMessage", async () => {
    setFlagMock.mockResolvedValue({ ok: false, status: 401 });
    render(wrap(<EditionFlagSwitch sigla="NABRE" field={field} initial={true} />));
    fireEvent.click(screen.getByRole("switch", { name: label }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(en.Admin.signInAgain));
  });

  /** An action result the test settles itself, so the pending state can be observed. */
  function deferred() {
    let resolve!: (v: { ok: true } | { ok: false; status: number }) => void;
    const promise = new Promise<{ ok: true } | { ok: false; status: number }>((r) => (resolve = r));
    return { promise, resolve };
  }

  it("keeps the new state after success", async () => {
    const result = deferred();
    setFlagMock.mockReturnValue(result.promise);
    render(wrap(<EditionFlagSwitch sigla="NABRE" field={field} initial={true} />));
    const sw = screen.getByRole("switch", { name: label });
    fireEvent.click(sw);
    await waitFor(() => expect(sw).toBeDisabled());
    result.resolve({ ok: true });
    await waitFor(() => expect(sw).toBeEnabled());
    expect(sw).not.toBeChecked();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("follows a changed initial value when no change is pending", () => {
    const { rerender } = render(wrap(<EditionFlagSwitch sigla="NABRE" field={field} initial={true} />));
    const sw = screen.getByRole("switch", { name: label });
    expect(sw).toBeChecked();
    rerender(wrap(<EditionFlagSwitch sigla="NABRE" field={field} initial={false} />));
    expect(sw).not.toBeChecked();
    rerender(wrap(<EditionFlagSwitch sigla="NABRE" field={field} initial={true} />));
    expect(sw).toBeChecked();
  });

  it("keeps the optimistic value while a change is pending", async () => {
    const result = deferred();
    setFlagMock.mockReturnValue(result.promise);
    const { rerender } = render(wrap(<EditionFlagSwitch sigla="NABRE" field={field} initial={true} />));
    const sw = screen.getByRole("switch", { name: label });
    fireEvent.click(sw);
    await waitFor(() => expect(sw).toBeDisabled());
    rerender(wrap(<EditionFlagSwitch sigla="NABRE" field={field} initial={false} />));
    rerender(wrap(<EditionFlagSwitch sigla="NABRE" field={field} initial={true} />));
    expect(sw).not.toBeChecked();
    result.resolve({ ok: true });
    await waitFor(() => expect(sw).toBeEnabled());
    expect(sw).not.toBeChecked();
  });

  it("an unknown outcome (status 0) is not rolled back: it asks to reload and refreshes", async () => {
    refresh.mockReset();
    setFlagMock.mockResolvedValue({ ok: false, status: 0 });
    const { rerender } = render(wrap(<EditionFlagSwitch sigla="NABRE" field={field} initial={true} />));
    const sw = screen.getByRole("switch", { name: label });
    fireEvent.click(sw);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(en.Admin.switchUnknown));
    expect(refresh).toHaveBeenCalled();
    expect(sw).not.toBeChecked();
    expect(sw).toBeDisabled();
    // The refresh brings the authoritative value.
    rerender(wrap(<EditionFlagSwitch sigla="NABRE" field={field} initial={false} />));
    expect(sw).not.toBeChecked();
    expect(sw).toBeEnabled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a confirmed rejection is rolled back without a refresh", async () => {
    refresh.mockReset();
    setFlagMock.mockResolvedValue({ ok: false, status: 400 });
    render(wrap(<EditionFlagSwitch sigla="NABRE" field={field} initial={true} />));
    const sw = screen.getByRole("switch", { name: label });
    fireEvent.click(sw);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(en.Admin.switchFailed));
    expect(sw).toBeChecked();
    expect(refresh).not.toHaveBeenCalled();
  });
});
