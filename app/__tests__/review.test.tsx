import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth(), signIn: vi.fn(), signOut: vi.fn() }));
const getAccessToken = vi.fn();
const accessMock = vi.fn();
vi.mock("@/lib/access", () => ({ getAccessToken: () => getAccessToken(), getAccess: () => accessMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<object>("next/navigation")),
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
const getChapter = vi.fn();
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<object>()),
  getEditions: async () => [
    { sigla: "VGCL", fullname: "Vulgata Clementina" },
    { sigla: "NVBSE", fullname: "Nova Vulgata" },
  ],
  getIndex: async (sigla: string) => ({ sigla, books: [{ bookNum: 17, name: sigla === "VGCL" ? "Tobias" : "Thobis", abbrev: "Tb", chapters: 14, versesPerChapter: [] }] }),
  getChapter: (...a: unknown[]) => getChapter(...a),
}));
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
process.env.BIBLEGET_API_URL = "https://api.test/dev";

const { default: ReviewPage } = await import("@/app/[locale]/review/page");
const { default: ChapterReviewPage } = await import("@/app/[locale]/review/[edition]/[book]/[chapter]/page");
const actions = await import("@/app/[locale]/review/actions");

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {ui}
  </NextIntlClientProvider>
);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const reviewer = { user: { email: "r@b.c" }, expires: "2099", emailVerified: true, admin: false, reviewer: true };
const row = (chapter: number, verse: number, text: string) => ({ chapter, verse, label: null, printedChapter: null, text, titles: [] });
const chapterParams = Promise.resolve({ locale: "en", edition: "vgcl", book: "17", chapter: "5" });
const chapterData = {
  links: [
    { id: 1, ref: "5:1", units: ["btu:tb.5.1"], kind: "same", status: "rule", confidence: null, stretch: null, note: null },
    { id: 2, ref: "5:2", units: ["btu:tb.5.2", "btu:tb.5.3"], kind: "corresponding", status: "draft", confidence: 0.45, stretch: "1", note: null },
  ],
  units: [
    { id: "btu:tb.5.2", ref: "5:2", stretch: "1" },
    { id: "btu:tb.5.3", ref: "5:3", stretch: "1" },
  ],
};

beforeEach(() => {
  for (const m of [auth, getAccessToken, fetchMock, getChapter, accessMock]) m.mockReset();
  accessMock.mockResolvedValue({ access: "reader", signedIn: true, emailVerified: true });
  auth.mockResolvedValue(reviewer);
  getAccessToken.mockResolvedValue("tok");
});

describe("review pages", () => {
  it("reviewPagesAre404WithoutTheRole", async () => {
    for (const session of [null, { ...reviewer, reviewer: false }, { ...reviewer, reviewer: false, admin: true }]) {
      auth.mockResolvedValue(session);
      await expect(ReviewPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
      await expect(ChapterReviewPage({ params: chapterParams })).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("theListPutsTheLeastConfidentChapterFirst", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/review/editions")
        ? json({ editions: [{ edition: "VGCL", draft: 3, reviewed: 1, rule: 900 }] })
        : json({ chapters: [{ book: 17, chapter: 9, drafts: 1, min_confidence: 0.9 }, { book: 17, chapter: 5, drafts: 2, min_confidence: 0.45 }] }),
    );
    render(wrap(await ReviewPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ edition: "VGCL" }) })));
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
    const links = within(screen.getByRole("list", { name: "Chapters to review" })).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/en/review/vgcl/17/5", "/en/review/vgcl/17/9"]);
    expect(links[0]).toHaveTextContent("Tobias 5");
    expect(links[0]).toHaveTextContent("45%");
    expect(screen.queryByRole("button", { name: /Accept all/ })).toBeNull();
  });

  it("theChapterShowsEachVerseBesideItsUnitsText", async () => {
    fetchMock.mockResolvedValue(json(chapterData));
    getChapter.mockImplementation(async (p: { sigla: string }) =>
      p.sigla === "VGCL"
        ? { rows: [row(5, 1, "Tunc respondit Tobias"), row(5, 2, "Quo modo autem <pof>pecuniam</pof>")], truncated: false, expectedVerses: 2 }
        : { rows: [row(5, 1, "NV one"), row(5, 2, "NV two"), row(5, 3, "NV three")], truncated: false, expectedVerses: 3 },
    );
    render(wrap(await ChapterReviewPage({ params: chapterParams })));
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/dev/review/editions/VGCL/books/17/chapters/5");
    const rows = screen.getAllByTestId("review-row");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent("Quo modo autem pecuniam");
    expect(rows[1]).toHaveTextContent("NV two");
    expect(rows[1]).toHaveTextContent("NV three");
    expect(within(rows[1]).getByLabelText("Confidence 45%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Accept all drafts in this chapter/ })).toBeInTheDocument();
  });

  it("anUncappedReaderAccessIsNeededOrTheChapterSaysSo", async () => {
    fetchMock.mockResolvedValue(json(chapterData));
    getChapter.mockResolvedValue({ rows: [], truncated: false, expectedVerses: 0 });
    accessMock.mockResolvedValue({ access: "visitor", signedIn: true, emailVerified: false });
    render(wrap(await ChapterReviewPage({ params: chapterParams })));
    expect(screen.getByRole("note")).toHaveTextContent(/first 30 verses/);
  });

  it("aHebrewRefGetsTheHebrewText", async () => {
    fetchMock.mockResolvedValue(json({ links: [{ ...chapterData.links[0], ref: "5:1@HEBREW" }], units: [] }));
    getChapter.mockImplementation(async (p: { sigla: string; tradition?: string }) =>
      ({ rows: [row(5, 1, p.sigla === "VGCL" ? (p.tradition === "HEBREW" ? "Hebrew text" : "Greek text") : "NV")], truncated: false, expectedVerses: 1 }));
    render(wrap(await ChapterReviewPage({ params: chapterParams })));
    expect(screen.getByTestId("review-row")).toHaveTextContent("Hebrew text");
  });

  it("reviewLinkActionRequiresTheReviewerRole", async () => {
    auth.mockResolvedValue({ ...reviewer, reviewer: false });
    expect(await actions.reviewLink(2, { action: "accept" })).toEqual({ ok: false, status: 403 });
    expect(await actions.acceptChapter("VGCL", 17, 5)).toEqual({ ok: false, status: 403 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reviewLinkSendsThePatchWithTheToken", async () => {
    fetchMock.mockResolvedValue(json({ ...chapterData.links[1], status: "reviewed" }));
    expect(await actions.reviewLink(2, { action: "relink", units: ["btu:tb.5.2"] })).toEqual({ ok: true, link: { ...chapterData.links[1], status: "reviewed" } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/dev/review/links/2");
    expect(init.method).toBe("PATCH");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ action: "relink", units: ["btu:tb.5.2"] });
    expect(await actions.reviewLink(0, { action: "accept" })).toEqual({ ok: false, status: 400 });
  });
});
